//The analyzer
//Looks at js code files to figure out stuff
var fs = require('fs');
var path = require('path');
var jsonfile = require('jsonfile');

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
        console.log("Valid File Size:" + toString(valid.length) );
        console.log("Invalid File Size:" + toString(invalid.length) );
        return {
            'valid':valid,
            'invalid':invalid
            }
    }
    
    return {
        'checkIfValid':tryParse,
        'iterateThroughDir':iterateThroughDir,
        'getFiles' : getFiles
    }
}

var run = function(){
	if (module.parent){
		module.exports = analyzer();
		return ;
	}
   
	var directory = path.resolve(process.argv[2]);
	if (!directory){
		console.log("No directory specified. Closing.");
		return;
	}
	console.log(directory);
    var a = analyzer();
    a.iterateThroughDir(directory, a.checkIfValid);
    lis = a.getFiles()

    jsonfile.writeFile('valid.js', lis.valid);
    jsonfile.writeFile('invalid.js', lis.invalid);
}()