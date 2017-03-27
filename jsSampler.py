import xml.etree.ElementTree as ET
from xml.etree.ElementTree import ParseError
from html.parser import HTMLParser

input_file = r"E:\Downloads\Anime\stackexchange\stackoverflow.com-Posts\Posts.xml"
output_file = r"E:\Downloads\Anime\stackexchange\stackoverflow.com-Posts\javascript_no_jquery.xml"
unusual_file = r"E:\Downloads\Anime\stackexchange\stackoverflow.com-Posts\strange.xml"
counts_file = r"E:\Downloads\Anime\stackexchange\stackoverflow.com-Posts\counts_top100.json"

code_dex = r"E:\Downloads\Anime\stackexchange\stackoverflow.com-Posts\code_index_no_jquery.js"

wanted_tags = set(['javascript', 'node.js'])
not_wanted = set(['jquery', 'html', 'css'])

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
    with open(input_file, encoding="utf8") as f:
        f.readline()
        f.readline()
        with open(output_file, 'w', encoding="utf8") as o:
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
                        
                        
def parse_js_xml():
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
    with open(output_file, 'r', encoding="utf8") as input_xml:
        with open(code_dex, 'w', encoding="utf8") as output:
            for line in input_xml:
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
                                    output.write(output_text)
                
                parser.new_block()
                parser.close()
                count += 1
                if count % 3000 == 0:
                    print("%s rows done." % count)
  
import json
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