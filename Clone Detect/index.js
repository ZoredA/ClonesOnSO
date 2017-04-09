//index.js
fs = require('fs');

var analyzer = function(){
    var valid = [];
    var invalid = [];
    var tryParse = function(fileName){
        //Idea from here http://stackoverflow.com/a/15333480
        fs.readFile(fileName, 'utf8', function(err, data){
            try{
                new Function(data)
                valid.push(fileName)
            }
            catch(e){
                if (e instanceof SyntaxError){
                    invalid.push(fileName)
                }
                else{
                    throw e;
                }
                
            }
            
        })
        
    }
    
    return {
        'checkIfValid':tryParse,
        'getFiles' : {
            'valid':valid,
            'invalid':invalid
        }
    }
}
module.exports = {
    
}