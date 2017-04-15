#This file creates box plot ready csvs for our SO posts
import json

#Expects a list of tuples in the form (key,value)
#note key is meant to repeat
#50,300
#30,100
#50,500
#...
def writeCSV(header, data, output_file):
    output = ','.join(header) + '\n'
    output += '\n'.join(['%s,%s,%s' % x for x in data])
    with open(output_file, 'w') as f:
        f.write(output)
    

#this tallies the votes for each snippet and makes a tuple in the form
# (threshold, vote)
# we can then use this in a box plot
# assumes the js snippets are not modified and include the dictionary as the first line
# comment.
def getVotes(order, file_input, ommit, rename={}):
    print("Writing scores")
    with open(file_input, encoding="utf-8") as f:
        data = json.load(f)
    output = []
    for key in order:
        if key in ommit:
            continue
        file_list = data[key]
        for path in file_list:
            with open(path, encoding="utf-8") as f:
                top_line = f.readline()
            top_line = top_line.lstrip('//#')
            top_line = json.loads(top_line)
            score = top_line['Score']
            output.append( (key, score ) )
                
            
    writeCSV(('threshold','score'), output, 'votes_cut.csv')
    
def writeLinesOfCode(order, file_input, ommit, rename={}):
    print("Writing lines of code")
    with open(file_input, encoding="utf-8") as f:
        data = json.load(f)
    output = []
    for key in order:
        if key in ommit:
            continue
        file_list = data[key]
        for path in file_list:
            with open(path, encoding="utf-8") as f:
                count = 0
                for line in f:
                    strLine = line.strip()
                    if not line or line[0:2] == '''//''':
                        continue
                    count += 1
                output.append( (key, count ) )
    
        #    output+= [(key, i) for i in data[key]]
    writeCSV(('threshold','LoC'), output, 'linesOfCode_cut.csv')
        
def locWithID(order, file_input, ommit, rename={}):
    import os
    print("Writing lines of code")
    with open(file_input, encoding="utf-8") as f:
        data = json.load(f)
    output = []
    for key in order:
        if key in ommit:
            continue
        file_list = data[key]
        for path in file_list:
            with open(path, encoding="utf-8") as f:
                count = 0
                for line in f:
                    strLine = line.strip()
                    if not line or line[0:2] == '''//''':
                        continue
                    count += 1
                f = os.path.split(path)[1]
                output.append( (key, count, f ) )
    
        #    output+= [(key, i) for i in data[key]]
    writeCSV(('threshold','LoC'), output, 'linesOfCodeKeyed.csv')
        
#Expects a json file
#with an obj in the form {'key':[]}
file_input = r"C:\Users\Zored\Git\StackClones\Clone Detect\thresholds_110.json"

ommit = ['error', 'below_15']
rename = {'below_15': 'Below 15'}
if __name__ == "__main__":
    order = ['below_15', '15','20','30','50','70','90','110']
    #writeLinesOfCode(order, file_input, ommit, rename)
    #getVotes(order, file_input, ommit, rename)
    locWithID(order, file_input, ommit, rename)
