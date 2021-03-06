import xml.etree.ElementTree as ET
import operator
import os
import json
import sys
from xml.etree.ElementTree import ParseError
from html.parser import HTMLParser

base_path = r""
input_xml_file = os.path.join(base_path, "Posts.xml")
js_xml_file = os.path.join(base_path, "javascript_no_jquery.xml")
unusual_file = os.path.join(base_path, "strange.xml")
counts_file = os.path.join(base_path, "counts_top100.json")
code_dex = os.path.join(base_path, "code_index_no_jquery.js")
dex_dirs = os.path.join(base_path, "dex_dirs/")

wanted_tags = set(['javascript', 'node.js'])
not_wanted = set(['jquery', 'html', 'css'])

dir_count = 40
interval = 99

def make_dirs():
    dirs = {}
    start = 1
    end = start + interval
    if not os.path.exists(dex_dirs):
        os.mkdir(dex_dirs)
        
    for i in range(0,dir_count):
        dir_name = "%s-%s" % (start, end)
        dir_path = os.path.join(dex_dirs, dir_name)
        if not os.path.exists(dir_path):
            os.mkdir(dir_path)
            
        dirs[ (end // (interval + 1) ) - 1] = dir_path
        start = end + 1
        end = start + interval
    
    dir_name = "%s-%s" % (end,'')
    dir_path = os.path.join(dex_dirs, dir_name)
    if not os.path.exists(dir_path):
        os.mkdir(dir_path)
        
    dirs[ (end // (interval + 1) ) - 1] = dir_path
    dirs['max'] = (end // (interval + 1) ) - 1
    return dirs
    

#Looks for <pre><code> html blocks in the data.
class PreCodeHTMLParser(HTMLParser):
    prev_tag_is_pre = False
    prev_tag_is_code = True
    codes = []
    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.prev_tag_is_pre = True
        elif tag == 'code':
            self.prev_tag_is_code = self.prev_tag_is_pre and True
        else:
            self.prev_tag_is_pre = False
            self.prev_tag_is_code = False

    def handle_endtag(self, tag):
        self.prev_tag_is_pre = False
        self.prev_tag_is_code = False

    def handle_data(self, data):
        if self.prev_tag_is_code:
            self.codes.append(data)
    def new_block(self):
        self.codes = []
        self.prev_tag_is_pre = False
        self.prev_tag_is_code = False

def create_js_xml():
    question_id_set = set()
    count = 0
    with open(input_xml_file, encoding="utf8") as f:
        f.readline()
        f.readline()
        with open(js_xml_file, 'w', encoding="utf8") as o:
            for line in f:
                try:
                    tag = ET.fromstring(line)
                except ParseError:
                    print("error: " + line)
                    continue
                attributes = tag.attrib
                if not attributes:
                    continue
                Id = attributes['Id']
                if attributes['PostTypeId'] == '1':
                    #We have a question
                    tag_list = set(attributes['Tags'].replace('><',' ').replace('<','').replace('>','').split(' '))
                    if tag_list & wanted_tags and ( not (tag_list & not_wanted)):
                        #It is relevant!
                        o.write(line)
                        question_id_set.add(Id)
                else:
                    if 'ParentId' in attributes:
                        parent_id = attributes['ParentId']
                        if parent_id in question_id_set:
                            o.write(line)
                    else:
                        with open(unusual_file, 'a', encoding="utf8") as u:
                            u.write(line)
                count += 1
                if count % 1000 == 0:
                    o.flush()
                    if count % 10000 == 0:
                        print('Done %s rows' % count)
                        


#Takes a row and writs out the code snippet if necessary
#output has to be a write supporting object
def write_xml_to_file(tag, questions, parser, output, not_obj = False):
    attributes = tag.attrib
    if not attributes:
        return None
    Id = attributes['Id']
    if attributes['PostTypeId'] == '1':
        questions[Id] = {}
        #We have a question
        if 'AcceptedAnswerId' in attributes:
            questions[Id]['AcceptedAnswerId'] = attributes['AcceptedAnswerId']
        else:
            questions[Id]['AcceptedAnswerId'] = None
        if 'Title' in attributes:
            questions[Id]['Title'] = attributes['Title']
        else:
            questions[Id]['Title'] = None
        if 'ViewCount' in attributes:
            questions[Id]['ViewCount'] = attributes['ViewCount']
        else:
            questions[Id]['ViewCount'] = None
        questions[Id]['CreationDate'] = attributes['CreationDate']
        questions[Id]['Id'] = Id
        
    else:
        parent_id = attributes['ParentId']
        answers = {k : attributes[k] for k in attributes if k != 'Body'}
        parent_dic = questions[parent_id]
        if Id == parent_dic['AcceptedAnswerId']:
            answers['AcceptedAnswer'] = True
        else:
            answers['AcceptedAnswer'] = False
        answers['Title'] = parent_dic['Title']
        answers['Parent_CreationDate'] = parent_dic['CreationDate']
        answers['Parent_ViewCount'] = parent_dic['ViewCount']
        body = attributes['Body'] 
        if answers['AcceptedAnswer'] is True:
            if '<code>' in body:
                parser.feed(body)
                snippets = parser.codes
                if snippets:
                    output_text = get_formated_block(answers, snippets)
                    if output_text is not None:
                        if not_obj is False:
                            output.write(output_text)
                        else:
                            with open(output, 'w', encoding="utf8") as output_file:
                                output_file.write(output_text)
                            return output
    return False
                        
def create_single_dex():
    questions = {} #this maps each question to some attributes 
    #{
    #   ID: {
    #        AcceptedAnswerId:int
    #        Title:  str
    #        date: date ,
    #        ViewCount: int    
    #   }
    #}
    #answers = {}
    #{
    #   ID: {
    #       isAccepted:bool
    #       parent_id : int
    #       date: date
    #       Title
    #       Parent_CreationDate
    #       Parent_ViewCount
    #   }
    #}
    parser = PreCodeHTMLParser()
    count = 0
    f_count = 0
    with open(js_xml_file, 'r', encoding="utf8") as input_xml:
        with open(code_dex, 'w', encoding="utf8") as output:
            for line in input_xml:
                try:
                    tag = ET.fromstring(line)
                except ParseError:
                    print("error: " + line)
                    continue
                if write_xml_to_file(tag, questions, parser, output) is True:
                    f_count += 1
                parser.new_block()
                parser.close()
                count += 1
                if count % 3000 == 0:
                    print("%s rows done." % count)
    
    print("files written: %s " % f_count)
    return
                    
def create_folder_js():
    #Steps: Run through the js xml and tabulate counts so you can sort them
    #Sort the ids
    #Run through the file again, now placing them in their apt folder accordingly
    id_vote_dic = {}
    questions = {} #this maps each question to some attributes 
    with open(js_xml_file, 'r', encoding="utf8") as input_xml:
        for line in input_xml:
            try:
                tag = ET.fromstring(line)
            except ParseError:
                print("error: " + line)
                continue
            attributes = tag.attrib
            Id = attributes['Id']
            if attributes['PostTypeId'] == '1':
                questions[Id] = {k : attributes[k] for k in attributes if k != 'Body'}
                if 'AcceptedAnswerId' in attributes:
                    questions[Id]['AcceptedAnswerId'] = attributes['AcceptedAnswerId']
                else:
                    questions[Id]['AcceptedAnswerId'] = None
                
                continue
            score = int(attributes['Score']) #very unnecessary cast
            
            id_vote_dic[Id] = score
    
    print('Scores counted')
    #Ref: http://stackoverflow.com/a/613218
    id_votes_sorted = sorted(id_vote_dic.items(), key=operator.itemgetter(1), reverse=True)
    id_votes_ranked = {k[0]:i+1 for i,k in enumerate(id_votes_sorted)}
    print('Scores ranked')
    parser = PreCodeHTMLParser()
    count = 0
    dirs = make_dirs()
    print('Dirs Made')
    
    print('id_votes_sorted Size: %s' % sys.getsizeof(id_votes_sorted))
    print('id_votes_ranked Size: %s' % sys.getsizeof(id_votes_ranked))
    print('Questions Size: %s' % sys.getsizeof(questions))
    print('Dir Size: %s' % sys.getsizeof(dirs))
    
    
    with open(js_xml_file, 'r', encoding="utf8") as input_xml:
        for line in input_xml:
            try:
                tag = ET.fromstring(line)
            except ParseError:
                print("error: " + line)
                continue
            if tag.attrib['PostTypeId'] == '1':
                continue
            Id = tag.attrib['Id']
            rank = id_votes_ranked[Id]
            max = dirs['max']
            
            bucket, modulo = divmod(rank, (interval+1)) 
            if bucket > 0 and modulo == 0:
                bucket = bucket - 1
            if bucket >= max:
                dir_path = dirs[max]
            else:
                dir_path = dirs[bucket]
                    
            f_path = os.path.join(dir_path, '%s-%s.js' % (rank, Id))
            write_xml_to_file(tag, questions, parser, f_path, True)
            parser.new_block()
            parser.close()
            count += 1
            if count % 10000 == 0:
                print("%s rows done." % count)
    
    
def write_counts():
    forbidden_set = set( ['\n','+','-','*','/','==','=', '{','}','{\n','}\n' ] )
    from collections import Counter
    count = Counter()
    with open(code_dex, 'r', encoding="utf8") as f:
        for line in f:
            if '//' in line: 
                continue
            
            count.update([x for x in line.replace('.',' ').split(' ') if x and x not in forbidden_set])
    with open(counts_file, 'w', encoding="utf8") as f: 
        json.dump(count.most_common(100), f)

#returns the code blocks
def get_formated_block(dict, snippets):
    joined = "".join(snippets)
    if joined.count('\n') < 3:
        return None
    z = json.dumps(dict)
    output = "//#" + z + "\n" + joined + "\n//**\n"
    return output