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
