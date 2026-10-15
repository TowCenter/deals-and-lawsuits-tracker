import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCsvExports,exportColumns} from '../src/lib/csvExport.js';
import {normalizeData} from '../src/lib/trackerData.js';
test('exports each interaction separately with exact ordered columns and source fields',()=>{
 const data=normalizeData([
  {id:1,Interaction:['Deal'],Deal_ID:'d1','News Org(s)':['Publisher'],Sources:['https://example.com']},
  {id:2,Interaction:['Grant'],Grant_ID:'g1'},
  {id:3,Interaction:['Lawsuit'],Lawsuit_ID:'l1'},
  {id:4,Interaction:['Collectives'],Deal_ID:'c1',Coalition:'Coalition','Primary Sources':'https://primary.example','Secondary Sources':'https://secondary.example'}
 ]);
 const files=buildCsvExports(data);
 assert.equal(files.length,4);
 for (const [index,type] of ['deal','grant','lawsuit','collective'].entries()) {
  assert.equal(files[index].csv.slice(1).split('\r\n')[0],exportColumns[type].map(([label])=>`"${label}"`).join(','));
 }
 assert(files[0].csv.includes('Deal ID'));
 assert(files[1].csv.includes('"g1"'));
 assert(files[3].csv.includes('https://primary.example'));
 assert(!files[3].csv.includes('https://secondary.example'));
});
test('merged lawsuits export every update once and preserve CSV escaping',()=>{
 const rows=[{id:1,lawsuit_id:'case',interaction:['Lawsuit'],plaintiff:['A, B','C "D"']},{id:2,lawsuit_id:'case',interaction:['Lawsuit']}];
 const [file]=buildCsvExports(rows,rows);
 assert.equal(file.csv.split('\r\n').length,3);
 assert(file.csv.includes('"A, B; C ""D"""'));
 assert.deepEqual(buildCsvExports([]),[]);
});

test('JSON keeps requested fields and native arrays in a single grouped file',async()=>{
 const {buildJsonExport}=await import('../src/lib/csvExport.js');
 const rows=normalizeData([{id:1,Interaction:['Deal'],Deal_ID:'d1','News Org(s)':['A','B']},{id:2,Interaction:['Collectives'],Deal_ID:'c1',Coalition:'SPUR'}]);
 const result=buildJsonExport(rows);
 assert.deepEqual(Object.keys(result),['Deals','Coalitions']);
 assert.deepEqual(Object.keys(result.Deals[0]),exportColumns.deal.map(([label])=>label));
 assert.deepEqual(result.Deals[0]['News Org(s)'],['A','B']);
 assert.equal(Object.hasOwn(result.Deals[0],'Deal ID'),true);
 assert.equal(result.Coalitions[0].Coalition,'SPUR');
 assert.deepEqual(buildJsonExport([]),{});
});

test('deal and coalition exports include Deal ID',async()=>{
 const {buildJsonExport}=await import('../src/lib/csvExport.js');
 const rows=normalizeData([{id:1,Interaction:['Deal'],Deal_ID:['recQ1FaNe9jEguUGA']},{id:2,Interaction:['Collectives'],Deal_ID:['collective_spur'],Coalition:'SPUR'}]);
 const result=buildJsonExport(rows);
 assert.equal(Object.hasOwn(result.Deals[0],'Deal ID'),true);
 assert.equal(Object.hasOwn(result.Coalitions[0],'Deal ID'),true);
 assert.equal(result.Deals[0]['Deal ID'],'recQ1FaNe9jEguUGA');
});

test('empty lawsuit plaintiffs fall back to News Org(s) and existing plaintiffs remain',async()=>{
 const {buildJsonExport}=await import('../src/lib/csvExport.js');
 const rows=normalizeData([
  {id:1,Interaction:['Lawsuit'],Plaintiff:[], 'News Org(s)':['Publisher A']},
  {id:2,Interaction:['Lawsuit'],Plaintiff:['Named plaintiff'], 'News Org(s)':['Publisher B']},
  {id:3,Interaction:['Lawsuit'],Plaintiff:null, 'News Org(s)':['Publisher C']}
 ]);
 assert.deepEqual(buildJsonExport(rows).Lawsuits.map(row=>row.Plaintiff),[['Publisher A'],['Named plaintiff'],['Publisher C']]);
});
