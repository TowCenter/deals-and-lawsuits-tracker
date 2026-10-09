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
