import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeData} from '../src/lib/trackerData.js';
import {createGrantTimelineIndex} from '../src/lib/grantTimeline.js';

test('explicit grant IDs connect chronological updates without merging repeated statuses', () => {
 const data = normalizeData([
  {id:2, Date:'2026-02-01', Interaction:['Grant'], Grant_ID:'g1', Status:'Awarded'},
  {id:1, Date:'2026-01-01', Interaction:['Grant'], Grant_ID:['g1'], Status:'Awarded'},
  {id:3, Date:'2026-03-01', Interaction:['Deal'], Grant_ID:'g1'},
  {id:4, Date:'2026-03-01', Interaction:['Grant']},
  {id:5, Date:'2026-03-01', Interaction:['Grant'], Grant_ID:'g2'},
 ]);
 const timeline = createGrantTimelineIndex(data);
 assert.deepEqual(data[0].grant_ids,['g1']);
 assert.deepEqual(timeline(data[0]).map(row => row.id),[1,2]);
 assert.deepEqual(timeline(data[1]).map(row => row.id),[1,2]);
 assert.deepEqual(timeline(data[3]),[]);
 assert.deepEqual(timeline(data[4]).map(row => row.id),[5]);
});

test('multiple grant IDs retain each update once and empty IDs stay unlinked', () => {
 const data = normalizeData([
  {id:1, Interaction:['Grant'], Grant_ID:['a','b','a']},
  {id:2, Interaction:['Grant'], 'Grant ID':'b'},
  {id:3, Interaction:['Grant'], Grant_ID:' '},
 ]);
 const timeline = createGrantTimelineIndex(data);
 assert.deepEqual(timeline(data[0]).map(row => row.id),[1,2]);
 assert.deepEqual(timeline(data[2]),[]);
});
