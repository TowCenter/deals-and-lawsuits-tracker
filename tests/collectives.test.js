import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeData} from '../src/lib/trackerData.js';

test('collective export maps coalition, members, update ID, sources and CSV dates', () => {
 const [record] = normalizeData([{Date:'3/1/2026', Deal_ID:'collective_spur', Interaction:'Collectives', Coalition:'SPUR Coalition', 'News Org(s)':'BBC,Financial Times,The Guardian (UK)', 'Reported Details':'Founding members', 'Primary Sources':'https://example.com/primary', 'Secondary Sources':'https://example.com/secondary'}]);
 assert.equal(record.collective_name,'SPUR Coalition');
 assert.deepEqual(record.collective_ids,['collective_spur']);
 assert.deepEqual(record.collective_publishers,['BBC','Financial Times','The Guardian (UK)']);
 assert.equal(record.date,'2026-03-01');
 assert.equal(record.reported_details,'Founding members');
 assert.deepEqual(record.sources,['https://example.com/primary','https://example.com/secondary']);
 assert.deepEqual(record.platform,[]);
});
