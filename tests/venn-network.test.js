import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutVennNetwork } from '../src/lib/vennNetwork.js';
import { buildOwnershipGraph } from '../src/lib/publisherNetwork.js';
const entries = [
 {interaction:['Lawsuit'],organization_publisher_named_in_deal_suit:['Parent'],companies:['OpenAI'],parent_child_matches:[{lineage:['Parent','Child']}]},
 {interaction:['Grant'],organization_publisher_named_in_deal_suit:['Parent'],companies:['OpenAI']},
 {interaction:['Deal'],organization_publisher_named_in_deal_suit:['Other'],companies:['OpenAI']}
];
test('combined Venn network preserves ownership and valid interactive geometry', () => {
 const layout = layoutVennNetwork({type:'platform',name:'OpenAI'},entries,buildOwnershipGraph(entries));
 assert.equal(layout.circles.length,3);
 assert.equal(new Set(layout.nodes.map(node=>node.key)).size,layout.nodes.length);
 const parent = layout.nodes.find(node=>node.key==='parent'), child = layout.nodes.find(node=>node.key==='child');
 assert(parent.hasChildren);
 assert(Math.hypot(child.x+child.r-parent.x-parent.r,child.y+child.r-parent.y-parent.r)+child.r<=parent.r+.001);
 assert(layout.nodes.some(node=>node.key==='platform:OpenAI'));
 assert(layout.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.r)&&node.r>0));
});
test('publisher Venn network keeps platforms keyed correctly and includes focused publisher', () => {
 const layout = layoutVennNetwork({type:'publisher',name:'Parent'},entries,buildOwnershipGraph(entries));
 assert(layout.nodes.some(node=>node.key==='platform:OpenAI'));
 assert(layout.nodes.some(node=>node.key==='parent'));
 assert(layout.nodes.some(node=>node.key==='child'));
});

test('Venn regions use equal leaf radii and larger ownership containers', () => {
 const layout = layoutVennNetwork({type:'platform',name:'OpenAI'},entries,buildOwnershipGraph(entries));
 const leaves = layout.nodes.filter(node=>!node.hasChildren && !node.key.startsWith('platform:'));
 assert(leaves.length>1);
 assert(leaves.every(node=>Math.abs(node.r-leaves[0].r)<.001));
 const extra = Array.from({length:12},(_,index)=>({interaction:['Deal'],organization_publisher_named_in_deal_suit:[`Extra ${index}`],companies:['OpenAI']}));
 const varied=layoutVennNetwork({type:'platform',name:'OpenAI'},[...entries,...extra],buildOwnershipGraph(entries));
 assert(varied.circles.find(circle=>circle.type==='deal').r>varied.circles.find(circle=>circle.type==='grant').r);
 assert(leaves.every(node=>node.r===40));
 assert(layout.nodes.find(node=>node.key==='parent').r>40);
});

test('Venn filter hides unrelated publishers and keeps ownership context', () => {
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},entries,buildOwnershipGraph(entries),'deal');
 assert(layout.nodes.some(node=>node.key==='other'));
 assert(!layout.nodes.some(node=>node.key==='parent' || node.key==='child'));
 assert(layout.nodes.some(node=>node.key==='platform:OpenAI'));
});

test('filtered mixed relationships remain inside every applicable circle', () => {
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},entries,buildOwnershipGraph(entries),'grant');
 const parent=layout.nodes.find(node=>node.key==='parent');
 assert(!layout.nodes.some(node=>node.key==='other'));
 assert.deepEqual(layout.circles.map(circle=>circle.type).sort(),['grant','lawsuit']);
 for (const circle of layout.circles) {
  assert(Math.hypot(parent.x+parent.r-circle.x,parent.y+parent.r-circle.y)+parent.r<=circle.r+.001);
 }
});

test('empty Venn filters produce no relationship regions and finite focus geometry', () => {
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},[],new Map(),'grant');
 assert.equal(layout.circles.length,0);
 assert.equal(layout.headings.length,0);
 assert(layout.nodes.every(node=>[node.x,node.y,node.r].every(Number.isFinite)));
});

test('all seven relationship combinations have unique nodes contained by their categories', () => {
 const types=['Lawsuit','Deal','Grant'];
 const records=Array.from({length:7},(_,index)=>({id:String(index),interaction:types.filter((type,bit)=>(index+1)&(1<<bit)),organization_publisher_named_in_deal_suit:[`Publisher ${index}`],companies:['OpenAI']}));
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},records,buildOwnershipGraph(records));
 assert.equal(new Set(layout.nodes.map(node=>node.key)).size,layout.nodes.length);
 for (const [index,record] of records.entries()) {
  const node=layout.nodes.find(node=>node.name===`Publisher ${index}`);
  assert.equal(node.r,40);
  for (const type of record.interaction) {
   const circle=layout.circles.find(circle=>circle.type===type.toLowerCase());
   assert(Math.hypot(node.x+node.r-circle.x,node.y+node.r-circle.y)+node.r<=circle.r+.001);
  }
 }
});

test('filter retains ownership descendants around matching organizations',()=>{
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},entries,buildOwnershipGraph(entries),'grant');
 const parent=layout.nodes.find(node=>node.key==='parent');
 const child=layout.nodes.find(node=>node.key==='child');
 assert(parent.hasChildren);
 assert(child);
 assert(Math.hypot(child.x+child.r-parent.x-parent.r,child.y+child.r-parent.y-parent.r)+child.r<=parent.r+.001);
 assert(!layout.nodes.some(node=>node.key==='other'));
});

test('disjoint relationship circles do not overlap due to label padding',()=>{
 const records=[['Lawsuit','Deal'],['Lawsuit','Grant']].map((interaction,index)=>({id:index,interaction,organization_publisher_named_in_deal_suit:[`Publisher ${index}`],companies:['OpenAI']}));
 const layout=layoutVennNetwork({type:'platform',name:'OpenAI'},records,buildOwnershipGraph(records));
 const deal=layout.circles.find(circle=>circle.type==='deal'), grant=layout.circles.find(circle=>circle.type==='grant');
 assert(Math.hypot(deal.x-grant.x,deal.y-grant.y)>=deal.r+grant.r);
});
