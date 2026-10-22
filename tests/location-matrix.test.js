import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocationMatrix} from '../src/lib/locationMatrix.js';

test('continent totals do not double-count records spanning multiple countries', () => {
 const records=[
  {id:1,date:'2024-01-01',interaction:['Deal'],location:['France','Germany'],country_flags:{France:'🇫🇷',Germany:'🇩🇪'}},
  {id:2,date:'2024-03-01',interaction:['Lawsuit'],location:['United States']},
  {id:3,date:null,interaction:['Deal'],location:['France']}
 ];
 const result=buildLocationMatrix(records);
 const europe=result.regions.find(region=>region.label==='Europe');
 assert.equal(result.months.length,3);
 assert.equal(result.undated,1);
 assert.equal(europe.values[0].deal,1);
 assert.equal(europe.values[1].deal,0);
 assert.equal(europe.countries.find(row=>row.label==='France').values[0].deal,1);
 assert.equal(europe.countries.find(row=>row.label==='Germany').values[0].deal,1);
});
test('grant updates count once per row and unlocated records remain visible', () => {
 const result=buildLocationMatrix([
  {id:1,date:'2024-01-01',interaction:['Grant'],grant_id:'X',location:['Region: Nordics']},
  {id:2,date:'2024-02-01',interaction:['Grant'],grant_id:'X',location:['Region: Nordics']},
  {id:3,date:'2024-01-01',interaction:['Lawsuit'],location:[]}
 ]);
 const europe=result.regions.find(row=>row.label==='Europe');
 assert.deepEqual(europe.values.map(row=>row.grant),[1,0]);
 assert.equal(europe.countries[0].label,'Nordics');
 assert.equal(result.regions.find(row=>row.label==='Unspecified location').values[0].lawsuit,1);
 assert.deepEqual(buildLocationMatrix([]).regions,[]);
});

test('matrix supports direct, child and reported publisher metrics', () => {
 const records=[{id:1,date:'2024-01-01',interaction:['Deal'],location:['France'],organization_publisher_named_in_deal_suit:['Parent'],reported_numbers:'200',parent_child_matches:[{lineage:['Parent','Child','Grandchild']}]}];
 const count = metric => buildLocationMatrix(records,records,metric).regions.find(row=>row.label==='Europe').values[0].deal;
 assert.equal(count('cards'),1);
 assert.equal(count('direct'),1);
 assert.equal(count('descendants'),3);
 assert.equal(count('reported'),200);
});
