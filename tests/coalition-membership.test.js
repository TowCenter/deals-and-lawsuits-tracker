import test from 'node:test';
import assert from 'node:assert/strict';
import {coalitionMembership} from '../src/lib/coalitionMembership.js';
test('membership combines coalition updates without inheriting membership or counting deals', () => {
 const members=coalitionMembership([
  {interaction:['Collectives'], collective_name:'SPUR', collective_publishers:[' BBC ','Parent']},
  {interaction:['Collectives'], collective_name:'SPUR', collective_publishers:['BBC']},
  {interaction:['Collectives'], collective_name:'Other', collective_publishers:['BBC']},
  {interaction:['Deal'], collective_name:'Ignored', collective_publishers:['Child']}
 ]);
 assert.deepEqual(members.get('bbc'),['Other','SPUR']);
 assert.deepEqual(members.get('parent'),['SPUR']);
 assert.equal(members.has('child'),false);
});
