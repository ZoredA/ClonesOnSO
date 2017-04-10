//The analyzer
//Looks at js code files to figure out stuff
var fs = require('fs');
var path = require('path');
var jsonfile = require('jsonfile');
var inspector = require('./wrapInspect.js');
var async = require('async');

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
    
    var iterateThroughThresholds = function(validListFile, thresholds){
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
                jsonfile.writeFile('thresholds.json', json_obj);
            }
        )
    }
    
    var files_self_compare = function(validListFile, threshold, big_callback){
        console.log("Working on threshold: " + threshold.toString() + " with file count: " + validListFile.length.toString());
        var count = 0;
        async.map(validListFile,
            function(file, callback){
                var args = {
                    'filename':file,
                    'threshold':threshold
                }
                var ins = inspector({'files':[file,file],
                    'threshold':threshold,
                    'minimal':true
                },(arg1,arg2)=>{
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
    
    // var doSelfCompare = function(validListFile){
        // var files = require(validListFile);
        // thresholds = [50,30,20,15];
        // var updateFunc = function(data, args){
            // if (data.err){
                // args['errors'].add(args.filename);
                // args.innerCallback();
            // }
            // js_data = data.data;
            // if (!js_data || js_data.length < 1){
                // args.innerCallback();
                // //return;
            // }
            // else{
                // args[args.current_threshold].add(args.filename);
                // args['done'].add(args.filename);
            // }
            // if (args['done'].size % 100 == 0){
                // console.log(args['done'].size.toString() + " files done.");
                // console.log(args['errors'].size.toString() + " files errored.");
            // }
            // args.innerCallback();
        // }
        
        // var funcArgs = {
            // 'done':new Set(),
            // 'errors':new Set()
        // };
        
        // for(var i = 0; i < thresholds.length; i++){
            // var threshold = thresholds[i];
            // funcArgs[threshold] = new Set();
        // }
        
        // var doneSet = new Set();
        
        // for(var j = 0; j < files.length; j++){
            // //Go through each file. In series try to get a threshold for them.
            // var file_path = files[j];
            // for (var i = 0; i < thresholds.length; i++){
                // threshold = thresholds[i];
                // async.series([
                    // function(callback){
                        // var ins = inspector({'files':[file_path,file_path],
                            // 'threshold':threshold
                        // },updateFunc, funcArgs);
                    // }
                // ],
                // )
            // }
        // }
        
        
        // // var j = 0;
        // // async.whilst(
            // // // test for next iteration
            // // function() { return j < files.length; },
            // // //The actual function to run.
            // // function(fileCallback){
                // // var i = 0;
                // // var file_path = files[j];
                // // async.whilst(
                    // // function() { return i < thresholds.length ;},//|| !funcArgs.done.has(files[j]) || !funcArgs.errors.has(files[j]) ;},
                    // // function(threshCallback){
                        // // //console.log("in inner loop with thres " + thresholds[i].toString());
                        // // // if (funcArgs.done.has(files[j]) || funcArgs.errors.has(files[j])){
                            // // // i = thresholds.length;
                            // // // threshCallback();
                        // // // }
                        // // var threshold = thresholds[i];
                        // // funcArgs['current_threshold'] = threshold;
                        // // funcArgs['filename'] = file_path;
                        // // funcArgs['innerCallback'] = threshCallback;
                        
                        // // i++;
                        // // var ins = inspector({'files':[file_path,file_path],
                            // // 'threshold':threshold
                        // // },updateFunc, funcArgs);
                    // // },
                    // // //Moving to the next file.
                    // // function(err){
                        // // console.log("exiting inner loop for file" + files[j].toString());
                        // // j++;
                        // // console.log("exiting inner loop for file with j:" + j.toString());
                        // // fileCallback();
                    // // }
                // // );
                
            // // },
            // // //Runs after the loop is done.
            // // function(err){
                // // console.log("Done looping.");
                // // console.log(j);
                // // console.log(funcArgs.done.length);
            // // }
            
        // // );
        
                
        // // for(var i = 0; i < thresholds.length; i++){
            // // var threshold = thresholds[i];
            // // funcArgs['current_threshold'] = threshold;
            // // funcArgs[threshold] = new Set();
            // // // var j = 0;
            // // // async.whilst(
                // // // // test for next iteration
                // // // function() { return j < files.length; },
                // // // function(innerCallback){
                    // // // if (funcArgs.done.has(files[i])){
                        // // // j++;
                        // // // innerCallback();
                    // // // }
                    // // // funcArgs['filename'] = files[j];
                    // // // funcArgs['innerCallback'] = innerCallback;
                    // // // var ins = inspector({'files':[files[j],files[j]],
                        // // // 'threshold':threshold
                    // // // },updateFunc, funcArgs);
                    // // // j++;
                // // // },
                // // // function(){
                    // // // console.log("Done looping.");
                    // // // console.log(j);
                    // // // console.log(funcArgs.done.length);
                // // // }
                
            // // // )
            // // for(var j = 0; j < files.length; j++){
                // // if (funcArgs.done.has(files[j]) || funcArgs.errors.has(files[j])){
                    // // continue;
                // // }
                // // funcArgs['filename'] = files[j];
                // // funcArgs.innerCallback = () => {return;};
                // // var ins = inspector({'files':[files[j],files[j]],
                    // // 'threshold':threshold
                // // },updateFunc, funcArgs);
            // // }
        // // }
        
        // process.nextTick(function(){
            // //By now the sets should have been made. We write them to a file.
            // output_js = {};
            // for(var i = 0; i < thresholds.length; i++){
                // var threshold = thresholds[i];
                // output_js[threshold] = [...funcArgs[threshold]];
            // }
            // no_match = [];
            // error = [];
            // for(var j = 0; j < files.length; j++){
                // if (funcArgs.done.has(files[j])){
                    // continue;
                // }
                // if (funcArgs.errors.has(files[j])){
                    // error.push(files[j]);
                // }
                // else{
                    // no_match.push(files[j]);
                // }
                
            // }
            // output_js['no_match'] = no_match;
            // output_js['error'] = error;
            // jsonfile.writeFile('thresholds.json', output_js);
        // })
    // }
    
    return {
        'checkIfValid':tryParse,
        'iterateThroughDir':iterateThroughDir,
        'getFiles' : getFiles,
        'selfCompare':iterateThroughThresholds
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
    
    var a = analyzer();
    //SelfCompare takes a json file with a list as the filenames to look at.
    //This could be the valid files created by createValidInvalid, but in this
    //case it is the set of valid+(invalid but with reference error)
    //Note: You have to generate this separately. Code not included in this repo, but is easy enough.
    process.nextTick(function(){a.selfCompare('./workable.json');});
    

}()