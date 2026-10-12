import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../src/lib/trackerData.js';

test('MDL docket in case fields preserves original case links and propagates membership', () => {
 const rows = normalizeData([
  {id:1, Date:'2025-01-01', Interaction:['Lawsuit'], Lawsuit_ID:['a'], 'Case Number':'1:25-cv-00100', Docket:'https://example.com/case'},
  {id:2, Date:'2025-04-03', Interaction:['Lawsuit'], Lawsuit_ID:['a'], MDL:[], Status:'Consolidated into Multi-District Litigation', 'Case Number':'1:25-md-03143', Docket:'https://example.com/mdl'}
 ]);
 assert.equal(rows[1].mdl_number, '3143');
 assert.equal(rows[1].mdl_docket_url, 'https://example.com/mdl');
 assert.deepEqual(rows[1].original_case_dockets, [{number:'1:25-cv-00100',url:'https://example.com/case'}]);
 assert.equal(rows[0].mdl_number, '3143');
});

test('combined consolidation records keep distinct original case dockets', () => {
 const rows = normalizeData([
  {Date:'2025-01-01', Lawsuit_ID:['a'], 'Case Number':'1:25-cv-00100', Docket:'https://example.com/a'},
  {Date:'2025-01-02', Lawsuit_ID:['b'], 'Case Number':'1:25-cv-00200', Docket:'https://example.com/b'},
  {Date:'2025-04-03', Lawsuit_ID:['a','b'], 'Case Number':'1:25-md-03143', Docket:'https://example.com/mdl'}
 ]);
 assert.equal(rows[2].original_case_dockets.length,2);
 assert.equal(rows[2].mdl_docket, '1:25-md-03143');
});
