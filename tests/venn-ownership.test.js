import test from 'node:test';
import assert from 'node:assert/strict';
import { vennOwnershipFamilies } from '../src/lib/vennOwnership.js';
import { buildOwnershipGraph } from '../src/lib/publisherNetwork.js';
test('Venn families preserve nested ownership and combine relationship types without duplication', () => {
 const graph = buildOwnershipGraph([{organization_publisher_named_in_deal_suit:['Parent','Child'],parent_child_matches:[{lineage:['Parent','Child','Grandchild']}]}]);
 const entities = new Map([['parent',{name:'Parent',types:new Set(['deal'])}],['child',{name:'Child',types:new Set(['lawsuit'])}]]);
 const trees = vennOwnershipFamilies(entities,graph);
 assert.equal(trees.length,1);
 assert.deepEqual([...trees[0].types].sort(),['deal','lawsuit']);
 assert.equal(trees[0].children[0].children[0].name,'Grandchild');
 assert.deepEqual([...trees[0].children[0].ownTypes],['lawsuit']);
 assert.equal(trees[0].children[0].children[0].ownTypes.size,0);
});

 test('default Venn labels identify the highest directly connected organization',async()=>{
 const {layoutVennNetwork}=await import('../src/lib/vennNetwork.js');
 const record={id:'1',organization_publisher_named_in_deal_suit:['Parent','Child'],parent_child_matches:[{lineage:['Parent','Child','Grandchild']}],interaction:['Deal'],companies:['OpenAI']};
 const ownership=buildOwnershipGraph([record]);
 const nodes=layoutVennNetwork({type:'platform',name:'OpenAI'},[record],ownership).nodes;
 assert.equal(nodes.find(node=>node.key==='parent').hasDirectAncestor,false);
 assert.equal(nodes.find(node=>node.key==='child').hasDirectAncestor,true);
 const childOnly={...record,organization_publisher_named_in_deal_suit:['Child']};
 const childNodes=layoutVennNetwork({type:'platform',name:'OpenAI'},[childOnly],ownership).nodes;
 assert.equal(childNodes.find(node=>node.key==='parent').hasDirectRelationship,false);
 assert.equal(childNodes.find(node=>node.key==='child').hasDirectRelationship,true);
 assert.equal(childNodes.find(node=>node.key==='child').hasDirectAncestor,false);
});
