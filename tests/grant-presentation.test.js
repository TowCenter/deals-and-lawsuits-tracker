import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOwnershipGraph} from '../src/lib/publisherNetwork.js';
import {buildGrantPresentation} from '../src/lib/grantPresentation.js';
const graph = buildOwnershipGraph([{parent_child_matches:[{lineage:['School','Center']},{lineage:['School','Other child']}]}]);
test('only covered children enter grant hierarchy and funding labels follow explicit roles', () => {
 const presentation=buildGrantPresentation({named_organizations:['School'],grantees:['School'],affected_publications:['Center'],publications_received_grants:['Recipient']},graph);
 assert.deepEqual(presentation.groups[0].items,[{name:'Center',depth:1,isGrantee:false},{name:'Recipient',depth:1,isGrantee:true}]);
});
test('recipient in both fields appears once with its funding role', () => {
 const presentation=buildGrantPresentation({grantees:['School'],affected_publications:['Center',' center '],publications_received_grants:['CENTER']},graph);
 assert.equal(presentation.groups[0].items.length,1);
 assert.equal(presentation.groups[0].items[0].isGrantee,true);
});
test('multiple direct grantees do not hide unassigned recipients or invent ownership', () => {
 const presentation=buildGrantPresentation({named_organizations:['School'],grantees:['School','Second school'],publications_received_grants:['Recipient']},graph);
 assert.equal(presentation.groups.length,2);
 assert.deepEqual(presentation.unassigned,[{name:'Recipient',depth:1,isGrantee:true}]);
});
