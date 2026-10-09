import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNetworkConnections } from '../src/lib/networkConnectionGroups.js';
test('line counts retain distinct records per publisher, platform and type',()=>{
 const link=(id,type='grant',company='OpenAI')=>({node:{key:'ajp'},company,entry:{id,type}});
 const groups=groupNetworkConnections([link('1'),link('1'),link('2'),link('3','deal'),link('4','grant','Microsoft')],entry=>entry.type);
 assert.equal(groups.length,3);
 assert.equal(groups[0].count,2);
 assert.deepEqual(groups[0].records.map(record=>record.id),['1','2']);
});
