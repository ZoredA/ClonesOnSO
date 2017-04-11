//A wrapper for jsinspect.
//Pass in the threshold and filename(s)
//and this file will return a json object representing change

//Code based on and using jsinpsect.js: https://github.com/danielstjules/jsinspect/blob/master/bin/jsinspect
var filepaths = require('filepaths');
var jsinspect = require('jsinspect');

const Writable = require('stream').Writable;

//https://nodejs.org/api/stream.html#stream_implementing_a_writable_stream
class MyWritable extends Writable {
    constructor(options, datadump) {
        
        // Calls the stream.Writable() constructor
        super(options);
        this.buffer = datadump;
    }
  

    _write(chunk, encoding, callback) {
    if (!chunk) {
        callback(new Error('chunk is invalid'));
    } else {
        this.buffer.push(chunk.toString());
        if (callback) {callback();}
    }
    
    }
    
}

var runjsinspect = function(parameters, callback, callback_args){
    var callback_args = callback_args || {};
    
    //A bit of a hack around not wanting to modify the inspector code (it outputs on console.error)
    console.error = function(err){
      console.log(parameters.files[0] + " threw an error.");
      callback_args.error=true;
      // if (parameters.minimal){
        // callback(null, callback_args);
        // return;
      // }
      // else{
        // callback({'err':err}, callback_args);
        // return;
      // }
      
    }
    
    
    var options = {
        'threshold':parameters['threshold'] || 50,
        'identifiers':parameters['identifiers'] || true,
        'literals':parameters['literals'] || true,
        'minInstances':2,
        'reporter': "json",
        'truncate':100
    }
    
    if (!parameters.files){
        console.log('No file path given');
        process.exit(0);
    }
    
    // Ignore node_modules by default, along with ignore arg
    var ignorePatterns = ['node_modules', 'bower_components'];
    if (parameters.ignore) {
      ignorePatterns.push(program.ignore);
    }
    
    var extensions = ['.js', '.jsx'];
    
    try {
      var paths = filepaths.getSync(parameters.files, {
        ext: extensions,
        ignore: ignorePatterns
      });
    } catch(e) {
      console.log(e.message);
      console.log('breaking')
      throw e;
    }

    var inspector = new jsinspect.Inspector(paths, {
      threshold:    options.threshold,
      identifiers:  options.identifiers,
      literals:     options.literals,
      minInstances: options.minInstances
    });
    
    var datadump = []; //We just write everything into a list...
    var writeable = new MyWritable({},datadump);
    
    var reporters = jsinspect.reporters;
    var reporterType = reporters[options.reporter] || reporters.default;
    
    var rep = new reporterType(inspector, {
      truncate: options.truncate,
      writableStream:writeable
    });
    
    // Track the number of matches
    var matches = 0;
    inspector.on('match', () => matches++);
    inspector.on('end', () => { 
        var ret_data = {};
        if (parameters.minimal){
            ret_data = null;
            callback_args.matches = matches;
        }
        else if (matches == 0){
            ret_data = {'data':[], 'json':''}; 
        }
        else{
            var joined = datadump.join('');
            var json_obj = JSON.parse(joined);
            if (parameters.intra_file == false){
                //We only include matches that are not in the same file.
                var new_obj = [];
                for(var i = 0; i < json_obj.length; i++){
                    var entry = json_obj[i];
                    var instances = entry.instances; //list of objects. Each one has a path, lines and code
                    var pathSet = new Set();
                    for (var j = 0; j < instances.length; j++){
                        pathSet.add( instances[j]['path'] );
                    }
                    if (pathSet.length < 2){
                        //We don't have at least two unique paths. We omit this entry.
                        continue;
                    }
                    new_obj.push(entry);
                }
                ret_data = {'data':new_obj, 'json':JSON.stringify(new_obj)};
            }
            else{
                ret_data = {'data':json_obj, 'json':joined};
            }
        }
        delete writeable.buffer;
        delete rep._inspector;
        
        callback( ret_data , callback_args); 
        
        return ;
    });
    
    try {
      inspector.run();
      //process.exit(matches ? 5 : 0);
    } catch(err) {
      console.log(err);
      //callback({'err':err}, callback_args);
      //process.exit(1);
    }
    
}

var run = function(){
	if (module.parent){
		module.exports = runjsinspect;
		return ;
	}

    var z = runjsinspect({
        'files':['C:\\Users\\Zored\\Git\\StackClones\\Clone Detect\\wrapInspect.js','C:\\Users\\Zored\\Git\\StackClones\\Clone Detect\\wrapInspect.js']
    }, function(data){
        if (data.data.length > 0){
            console.log(data.data[0]['instances']);
        }
        else{
            console.log("no match");
        }
    } )
    
}()


