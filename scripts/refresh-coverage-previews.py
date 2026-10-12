"""Cache public article metadata for static coverage hover cards."""
import concurrent.futures, json, pathlib, urllib.request, urllib.parse
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = 'https://ai-deals-lawsuit.s3.us-east-2.amazonaws.com/deals_lawsuits_data.json'
class Metadata(HTMLParser):
 def __init__(self):
  super().__init__(); self.meta={}; self.title=''; self.in_title=False
 def handle_starttag(self, tag, attrs):
  a=dict(attrs)
  if tag=='meta': self.meta[a.get('property',a.get('name','')).lower()]=a.get('content','')
  if tag=='title': self.in_title=True
 def handle_endtag(self,tag):
  if tag=='title': self.in_title=False
 def handle_data(self,data):
  if self.in_title: self.title+=data

def fetch(url):
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; TowCoveragePreview/1.0)'})
  with urllib.request.urlopen(req,timeout=7) as response:
   if 'html' not in response.headers.get('Content-Type',''): return url, None
   parser=Metadata(); parser.feed(response.read(1000000).decode('utf-8',errors='replace'))
   m=parser.meta; title=m.get('og:title') or m.get('twitter:title') or parser.title
   if not title.strip() or any(v in title.lower() for v in ['access denied','just a moment','robot or human','javascript is disabled','enable javascript','403 forbidden']): return url,None
   return url,{'title':title.strip()[:250],'description':(m.get('og:description') or m.get('description') or '').strip()[:350]}
 except Exception: return url,None

if __name__=='__main__':
 with urllib.request.urlopen(DATA,timeout=20) as response: rows=json.load(response)
 urls=set()
 for row in rows:
  for key in ['Sources','Additional Coverage']:
   values=row.get(key,[])
   for url in (values if isinstance(values,list) else [values]):
    if isinstance(url,str) and urllib.parse.urlparse(url).scheme in ['http','https']: urls.add(url)
 target=ROOT/'src/lib/coveragePreviews.json'
 cache=json.loads(target.read_text()) if target.exists() else {}
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
  for url,preview in pool.map(fetch,sorted(urls)):
   if preview: cache[url]=preview
 target.write_text(json.dumps({u:cache[u] for u in sorted(urls) if u in cache},ensure_ascii=False,indent=2)+'\n')
 print(f'Cached {len(cache)} article previews from {len(urls)} URLs.')
