//A wrapper for jsinspect.
//Pass in the threshold and filename(s)
//and this file will return a json object representing change

//Code based on and using jsinpsect.js: https://github.com/danielstjules/jsinspect/blob/master/bin/jsinspect
var filepaths = require('filepaths');
var jsinspect = require('jsinspect');

const Writable = require('stream').Writable;

//https://nodejs.org/api/stream.html#stream_implementing_a_writable_stream
class MyWritable extends Writable {
    constructor(options) {
        
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

    getData() {
        return this.buffer;
    }
    
}

var runjsinspect = function(parameters, callback){
    
    options = {
        'threshold':parameters['threshold'] || 50,
        'identifiers':true,
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
      paths = filepaths.getSync(parameters.files, {
        ext: extensions,
        ignore: ignorePatterns
      });
    } catch(e) {
      console.log(e.message);
      console.log('breaking')
      throw e;
      process.exit(4);
    }
    
    var inspector = new jsinspect.Inspector(paths, {
      threshold:    options.threshold,
      identifiers:  options.identifiers,
      literals:     options.literals,
      minInstances: options.minInstances
    });
    
    var datadump = []; //We just write everything into a list...
    var writeable = new MyWritable(datadump);
    
    var reporters = jsinspect.reporters;
    var reporterType = reporters[options.reporter] || reporters.default;
    console.dir(reporterType);
    new reporterType(inspector, {
      truncate: options.truncate,
      writableStream:parameters.writableStream
    });
    
    // Track the number of matches
    var matches = 0;
    inspector.on('match', () => matches++);
    inspector.on('end', () => callback( JSON.parse( parameters.datadump.join('')) ) );
    
    try {
      inspector.run();
      //process.exit(matches ? 5 : 0);
    } catch(err) {
      console.log(err);
      process.exit(1);
    }
    
}

var run = function(){
	if (module.parent){
		module.exports = runjsinspect;
		return ;
	}

    var datadump = [];
    var z = runjsinspect({
        'datadump':datadump,
        'writableStream':new MyWritable(datadump),
        'files':['C:\\Users\\Zored\\Git\\StackClones\\Clone Detect\\wrapInspect.js','C:\\Users\\Zored\\Git\\StackClones\\Clone Detect\\wrapInspect.js']
    }, (data) => (console.log(data))
    )
    
}()


