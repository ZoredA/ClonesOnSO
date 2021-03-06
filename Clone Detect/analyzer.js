//The analyzer
//Looks at js code files to figure out stuff
var fs = require('fs');
var path = require('path');
var jsonfile = require('jsonfile');
var inspector = require('./wrapInspect.js');
var async = require('async');
var _ = require('lodash');
var filepaths = require('filepaths');

//https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Set
Set.prototype.union = function(setB) {
    var union = new Set(this);
    for (var elem of setB) {
        union.add(elem);
    }
    return union;
}

Set.prototype.intersection = function(setB) {
    var intersection = new Set();
    for (var elem of setB) {
        if (this.has(elem)) {
            intersection.add(elem);
        }
    }
    return intersection;
}

Set.prototype.difference = function(setB) {
    var difference = new Set(this);
    for (var elem of setB) {
        difference.delete(elem);
    }
    return difference;
}

var analyzer = function(){
    var valid = [];
    var invalid = [];
    
    
    var tryParse = function(fileName){
        //Idea from here http://stackoverflow.com/a/15333480
        var data = fs.readFileSync(fileName, 'utf8');
        try{
            new Function(data);
            valid.push(fileName);
        }
        catch(e){
            if (e instanceof SyntaxError){
                invalid.push({'fileName':fileName,
                    'error':'SyntaxError'
                });
            }
            else if (e instanceof ReferenceError){
                invalid.push({'fileName':fileName,
                    'error':'ReferenceError'
                });
            }
            else{
                console.log(data);
                throw e;
                
            }
            
        }
          
    }
    
    var iterateThroughDir = function(directory, perFileFunc){
        var dirFiles = fs.readdirSync(directory);
        for(var i = 0; i < dirFiles.length; i++)
        {
            var currentFile = path.join(directory, dirFiles[i]);
            if (fs.lstatSync(currentFile).isDirectory()){
                // if (dirFiles[i] === '4100-'){
                    // continue;
                // }
                console.log('Traversing ' + currentFile);
                iterateThroughDir(currentFile, perFileFunc);
            }
            else{
                perFileFunc(currentFile);
            }
        }

    }
    var getFiles = function(){
        console.log("Valid File Size:" + valid.length.toString() );
        console.log("Invalid File Size:" + invalid.length.toString() );
        return {
            'valid':valid,
            'invalid':invalid
            }
    }
    
    var iterateThroughThresholds = function(validListFile, thresholds, output_name, options){
        var files = require(validListFile);
        var thresholds = thresholds || [50,30,20,15];
        var done_set = new Set();
        var error_set = new Set();
        var full_set = new Set(files);
        
        async.timesSeries(thresholds.length, 
            function(n,callback){
                var threshold = thresholds[n];
                if (n > 0){
                    var new_set = full_set.difference(done_set).difference(error_set);
                    var fileList = [...new_set];
                }
                else{
                    var fileList = files;
                }
                files_self_compare(fileList, threshold, function(data){
                    temp_list = [];
                    for(var i = 0; i < data.length; i++){
                        item = data[i];
                        if (item.error){
                            error_set.add(item.filename);
                            continue;
                        }
                        if (item.matches > 0){
                            temp_list.push(item.filename);
                            done_set.add(item.filename);
                        }
                    }
                    //finish up
                    callback(null,{
                        'threshold':threshold,
                        'files':temp_list 
                    });
                })
            },
            function(err,results){
                
                console.log("In threshold final callback. Sample for threshold:");
                console.log(results[0]['threshold'].toString() + ' : ' + results[0]['files'].slice(0,30).join('\n') + '..');
                json_obj = {
                    'error':[...error_set]
                };
                for (var i = 0; i < thresholds.length; i++){
                    json_obj[thresholds[i]] = results[i]['files'];
                }
                jsonfile.writeFile(output_name, json_obj);
            }
        )
    }
    
    var files_self_compare = function(validListFile, threshold, big_callback, options){
        if (!options){
          var options = {};
        }
        console.log("Working on threshold: " + threshold.toString() + " with file count: " + validListFile.length.toString());
        var count = 0;
        async.map(validListFile,
            function(file, callback){
                var args = {
                    'filename':file,
                    'threshold':threshold
                }
                var defaults = {'files':[file,file],
                      'threshold':threshold,
                      'minimal':true
                }
                _.extend(defaults, options);
                
                var ins = inspector(defaults,(arg1,arg2)=>{
                    count++;
                    if (count % 100 == 0){
                        console.log(count.toString() + " iterated through.")
                    }
                    callback(arg1,arg2);
                    return;
                }, args);
                
            },
            function (err, fileStats){
                console.log("in files callback");
                //This should have an array in the form
                //[{
                //  filename:path,
                //  threshold:threshold,
                //  matches:matches
                // },..]
                    big_callback(fileStats);
                }
            );
            
    }
    
    var single_file_self_compare = function(file, options, callback){
        var ins_options = {
            'files':[file, file]
        };
        _.extend(ins_options, options);
        var z = inspector(ins_options, function(data){
            if (data.data.length > 0){
                callback(true);
            }
            else{
                callback(false);
            }
        } 
        )
    }
    
    
    //json_file_data is something like thresholds.json it is a list mapping
    //all thresholds to a list of snippets. Note: expects object not the file path
    var findClonesInDir = function(startDir, js_files, json_file_data, options, big_callback ){
        
        var threshold = options.threshold;
        var snippet_threshold = options.snippet_threshold;
        var snippetList = json_file_data[snippet_threshold];
        if (!snippetList){
            console.log("snipping list not found for " + snippet_threshold.toString());
            return;
        }
        var threshes = threshold.toString() + '-' + snippet_threshold.toString(); //used in output file name.
        var writeFileMatchData = function(fileName, fileStats){
            var baseName = path.basename(fileName);
            var fileExt = path.extname(fileName);
            var output_name = _.replace(baseName, fileExt, '_'+threshes+'_matches.json');
            var output_file = path.join(startDir, 'clones', output_name);
            if (fileStats.length < 1){
                console.log(fileName + " had no matches.");
            }
            else{
                console.log(fileName + " had " + fileStats.length.toString() + " matches.");
            }
            jsonfile.writeFileSync(output_file, fileStats, {spaces: 2});
            
        }
        
        async.forEachOf(js_files, function(js_file, key, callback){
            
            var baseName = path.basename(js_file);
            var fileExt = path.extname(js_file);
            var output_name = _.replace(baseName, fileExt, '_'+threshes+'_matches.json');
            var output_file = path.join(startDir, 'clones', output_name);
            if (fs.existsSync(output_file)){
                console.log( output_file + " exists. Skipping." );
                return callback();
            }
            
            files_multi_compare(js_file, snippetList, options, (fileName, fileStats) =>{
                 writeFileMatchData(fileName, fileStats);
                 callback();
            });
        }, function(err){
            big_callback();
        });
        
        
    }
    
    //files_self_compare compares against itself. This compares a single file against a snippet collection!
    var files_multi_compare = function(file, snippetList, options, big_callback){
        threshold = options.threshold;
        console.log("Working on file: " + file);
        console.log("Working with threshold: " + threshold.toString() + " with snippet count: " + snippetList.length.toString());
        var count = 0;
        async.map(snippetList,
            function(snippet, callback){
                var callback_args = {
                    'filename':file,
                    'snippet':snippet
                }
                var inspector_options = {
                    'files':[file,snippet],
                    'intra_file':false //We don't allow matches within the same file.
                }
                //We sync options, this will add any additional settings
                //such as threshold, literals etc
                _.extend(callback_args, options);
                _.extend(inspector_options, options);
                
                var ins = inspector(inspector_options,
                    (arg1,arg2)=>{
                        count++;
                        if (count % 100 == 0){
                            console.log(count.toString() + " iterated through.")
                        }
                        //the two received arguments
                        //arg1 = ret_data = {'data':json_obj, 'json':joined};
                        //arg2 = callback_args
                        if (!arg1.data || arg1.data.length < 1){
                            arg2.match=false;
                        }else{
                            arg2.match=true;
                            arg2.dump = arg1.json; //In case we want to toss this straight into a file.
                        }
                        
                        //err is the first argument, so we purposefully pass in null
                        callback(null,arg2);
                        return;
                    }, callback_args
                );
                
            },
            function (err, fileStats){
                if (err){
                    console.log(err);
                    process.exit(2);
                }
                console.log("in files callback for file " + file);
                console.log("fileStats length: " + fileStats.length.toString());
                //This should have an array in the form
                //[{
                //  filename:path,
                //  threshold:threshold,
                //  matches:matches
                // },..]
                    //We make a simplified list of just files that have matches.
                    _.remove(fileStats, (value, index, array)=> {return !value.match;} );
                    big_callback(file, fileStats);
                }
            );
            
    }
    
    
    return {
        'checkIfValid':tryParse,
        'iterateThroughDir':iterateThroughDir,
        'getFiles' : getFiles,
        'selfCompare':iterateThroughThresholds,
        'findClonesInDir':findClonesInDir,
        'singleFileCompare':single_file_self_compare
    }
}

var run = function(){
	if (module.parent){
		module.exports = analyzer();
		return ;
	}

    var createValidInvalid = function(){
        var directory = path.resolve(process.argv[2]);
        if (!directory){
            console.log("No directory specified. Closing.");
            return;
        }
        console.log(directory);
        var a = analyzer();
        a.iterateThroughDir(directory, a.checkIfValid);
        lis = a.getFiles()

        jsonfile.writeFile('valid.json', lis.valid);
        jsonfile.writeFile('invalid.json', lis.invalid);
    }
    
    var createSelfCompare = function(){
        var a = analyzer();
        //SelfCompare takes a json file with a list as the filenames to look at.
        //This could be the valid files created by createValidInvalid, but in this
        //case it is the set of valid+(invalid but with reference error)
        //Note: You have to generate this separately. Code not included in this repo, but is easy enough.
        process.nextTick(function(){a.selfCompare('./workable.json', [110,90,70,50,30,20,15], 
        'thresholds_no_limit.json', {
          'identifiers':false,
          'literals':false
        });});
    }
    
    
    var getFiles = function(someDir){
        var extensions = ['.js', '.jsx'];
        var ignorePatterns = ['node_modules', 'bower_components'];
        try {
          var js_files = filepaths.getSync([someDir], {
            ext: extensions,
            ignore: ignorePatterns
          });
        } catch(e) {
          console.log(e.message);
          console.log('breaking')
          throw e;
        }
        //There is a bug in filepaths that stops it from working on windows paths I think. So
        //we just trim the ./ it adds at the beginning for some reason.
        js_files = _.map(js_files, (str)=>{return _.trimStart(str, './');});
        if (!js_files || js_files.length < 1){
            console.log("No js files found in " + someDir);
            console.log("Exiting.");
            return;
        }
        
        console.log(js_files);
        console.log(someDir);
        return js_files;
    }
    
    //This function actually looks at a given directory, then matches all .js files with the SO snippets
    //but only matches to those of the threshold or less.
    var doDirectoryMatches = function(){
        
        var dirToWorkOn = process.argv[2];
        if (!dirToWorkOn){
            console.log("No directory given.");
            return;
        }
        var a = analyzer();
        
        var dexFile = './thresholds_110.json'
        snippet_thresholds=[50,30,20];
        var json_file_data = require(dexFile);
        
        //Will contain a set of fils that don't meet the threshold so we can ignore them.
        var excludeSet = new Set();
        var js_files = getFiles(dirToWorkOn);
        
        async.series([
            function(outer_callback){
                
                //We chose to set our self-compare threshold at 30.
                var options = {
                    'threshold':30,
                    'identifiers':true,
                    'literals':true
                }
                
                //We check each file against itself. If it does not self-match then we exclude it.
                async.eachOf(js_files, function(file, index, callback){
                    console.log("self checking " + file);
                    a.singleFileCompare(file, options, (result)=>{
                        if (result != true){
                            console.log("self checking of " + file + " resulted in no match.");
                            excludeSet.add(file);
                        }
                        callback();
                    })
                },function(err){
                    outer_callback(); //Moves us on to next item in async series.
                })
            },
            //This just writes the list of files out to a json file.
            function(outer_callback){
              var output_obj = {
                'total_count':js_files.length,
                'excluded_count':excludeSet.size
              }
              _.remove(js_files, (data, index, arr) => {return excludeSet.has(data);});
              output_obj.worked_on = js_files;
              
              var output_name = 'files.json';
              var output_file = path.join(dirToWorkOn, 'clones', output_name);

              jsonfile.writeFileSync(output_file, output_obj, {spaces: 2});
              outer_callback();
            },
            function(outer_callback){
                async.timesSeries(snippet_thresholds.length, 
                    function(n, callback){
                        var options = {
                            'threshold':20,
                            'snippet_threshold':snippet_thresholds[n],
                            'identifiers':false,
                            'literals':false,
                            'intra_file':false
                        }
                        a.findClonesInDir(dirToWorkOn, js_files, json_file_data, options, callback);
                    },
                    function(err, data){
                        outer_callback();
                    }
                )
            }
        
        ], function(err){
            if(err){
                throw err;
            }
            console.log("Finished async series");
            console.timeEnd('Directory to snippet compare');
        });

        
        //
        
        // var options = {
            // 'threshold':90,
            // 'snippet_threshold':90,
            // 'identifiers':false,
            // 'literals':false,
            // 'intra_file':false
        // }
        // a.findClonesInDir(curDir, './thresholds_110.json', options);
        
        // var options = {
            // 'threshold':70,
            // 'snippet_threshold':70,
            // 'identifiers':false,
            // 'literals':false,
            // 'intra_file':false
        // }
        // a.findClonesInDir(curDir, './thresholds_110.json', options);
        
        // var options = {
            // 'threshold':70,
            // 'snippet_threshold':30,
            // 'identifiers':false,
            // 'literals':false,
            // 'intra_file':false
        // }
        // a.findClonesInDir(curDir, './thresholds_110.json', options);
        
    }
    //console.time('Directory to snippet compare');
    //doDirectoryMatches();
    createSelfCompare();
}()