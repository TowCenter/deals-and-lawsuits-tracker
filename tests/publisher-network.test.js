import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOwnershipGraph,publisherAndAncestors,layoutOwnership,layoutCirclePacking,routeCircleConnection} from '../src/lib/publisherNetwork.js';
const data=[{organization_publisher_named_in_deal_suit:['Parent'],parent_child_matches:[{lineage:['Parent','Child','Grandchild']},{lineage:['Parent','Sibling']},{lineage:['Other parent','Child']}]}];
test('shared children appear once, with grandchildren inside their parent',()=>{
 const graph=buildOwnershipGraph(data),layout=layoutOwnership(graph,new Set(graph.keys()));
 assert.equal(new Set(layout.nodes.map(n=>n.key)).size,layout.nodes.length);
 const keys=new Set(layout.nodes.map(n=>n.key));
 const links=layout.nodes.flatMap(n=>[...graph.get(n.key).children].filter(k=>keys.has(k)).map(k=>[n.key,k]));
 for(const [width,height]of [[1100,700],[800,650]]){
  const nodes=layoutCirclePacking(layout.nodes,links,width,height,['OpenAI','Perplexity']);
  const child=nodes.find(n=>n.key==='child'),grandchild=nodes.find(n=>n.key==='grandchild');
  assert(Math.hypot(child.x+child.r-grandchild.x-grandchild.r,child.y+child.r-grandchild.y-grandchild.r)+grandchild.r<child.r);
  assert(nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.x>=0&&n.y>=0));
 }
});
test('every platform has a visible route and platforms do not overlap',()=>{
 const companies=['Brave AI','Perplexity','Meta','OpenAI','Factiva/Dow Jones','Google'];
 const nodes=layoutCirclePacking([{key:'news',name:'News Corp'}],[],1300,650,companies);
 for(let i=1;i<nodes.length;i++){
  const path=routeCircleConnection(nodes[0],nodes[i],nodes,1300,650);
  assert(path,`missing ${nodes[i].name}`);assert(!path.includes('NaN'));
  for(let j=i+1;j<nodes.length;j++)assert(Math.hypot(nodes[i].x+nodes[i].r-nodes[j].x-nodes[j].r,nodes[i].y+nodes[i].r-nodes[j].y-nodes[j].r)>=nodes[i].r+nodes[j].r);
 }
});
test('small direct publishers remain connected inside nested parent circles',()=>{
 const parent={key:'parent',x:20,y:20,r:180};
 const publisher={key:'publisher',x:60,y:175,r:12};
 const sibling={key:'sibling',x:95,y:160,r:35};
 const platform={key:'google',x:490,y:160,r:45};
 const path=routeCircleConnection(publisher,platform,[parent,publisher,sibling,platform],620,430);
 assert(path);assert(!path.includes('NaN'));
 const first=path.match(/^M ([\d.]+) ([\d.]+)/);
 assert(Math.abs(Math.hypot(+first[1]-72,+first[2]-187)-12)<.001);
});

test('shared corridors preserve direct endpoints and a common platform approach',()=>{
 const sources=[{key:'first',x:40,y:70,r:20},{key:'second',x:40,y:250,r:20}];
 const platform={key:'platform',x:520,y:170,r:40};
 const corridor={x:424,y:210};
 const circles=[...sources,platform];
 const paths=sources.map(source=>routeCircleConnection(source,platform,circles,650,400,false,corridor));
 for(let i=0;i<paths.length;i++){
  assert(paths[i]);assert(!paths[i].includes('NaN'));
  const first=paths[i].match(/^M ([\d.]+) ([\d.]+)/);
  assert(Math.abs(Math.hypot(+first[1]-sources[i].x-20,+first[2]-sources[i].y-20)-20)<.001);
 }
 assert.equal(paths[0].match(/L [^LQ]+$/)[0],paths[1].match(/L [^LQ]+$/)[0]);
 const obstacle={key:'blocking',x:390,y:170,r:40};
 assert(routeCircleConnection(sources[0],platform,[...circles,obstacle],650,400,false,corridor));
});

 test('relationship inheritance follows parents and grandparents, never children or siblings', () => {
  const graph = buildOwnershipGraph([{parent_child_matches: [{lineage: ['News Corp', 'New York Post', 'Publication']}, {lineage: ['News Corp', 'Dow Jones']}]}]);
  assert.deepEqual([...publisherAndAncestors(graph, 'New York Post')], ['new york post', 'news corp']);
  assert.deepEqual([...publisherAndAncestors(graph, 'Publication')], ['publication', 'new york post', 'news corp']);
  assert.deepEqual([...publisherAndAncestors(graph, 'News Corp')], ['news corp']);
  assert(!publisherAndAncestors(graph, 'Dow Jones').has('new york post'));
 });
