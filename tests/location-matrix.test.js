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
  {id:3,date:'2024-01-01',interaction:['Lawsuit'],lawsuit_id:'unlocated-case',location:[]}
 ]);
 const europe=result.regions.find(row=>row.label==='Europe');
 assert.deepEqual(europe.values.map(row=>row.grant),[1,0]);
 assert.equal(europe.countries[0].label,'Nordics');
 assert.equal(result.regions.find(row=>row.label==='Unspecified location').values[0].lawsuit,1);
 assert.deepEqual(buildLocationMatrix([]).regions,[]);
});

test('matrix supports direct, child and reported publisher metrics', () => {
 const records=[{id:1,date:'2024-01-01',interaction:['Deal'],location:['France'],organization_publisher_named_in_deal_suit:['Parent'],reported_numbers:'200',publication_countries:{Parent:['France'],Child:['France'],Grandchild:['France']},parent_child_matches:[{lineage:['Parent','Child','Grandchild']}]}];
 const count = metric => buildLocationMatrix(records,records,metric).regions.find(row=>row.label==='Europe').values[0].deal;
 assert.equal(count('cards'),1);
 assert.equal(count('direct'),1);
 assert.equal(count('descendants'),3);
 assert.equal(count('reported'),200);
});

test('matrix cell records intersect month and category, retaining geographic subset', async () => {
 const {matrixCellRecords} = await import('../src/lib/locationMatrix.js');
 const records=[
  {id:1,date:'2024-01-01',interaction:['Deal'],location:['France']},
  {id:2,date:'2024-02-01',interaction:['Deal'],location:['France']},
  {id:3,date:'2024-01-01',interaction:['Lawsuit'],location:['France']},
  {id:4,date:'2024-01-01',interaction:['Deal'],location:['United States']}
 ];
 const row=buildLocationMatrix(records).regions.find(row=>row.label==='Europe');
 assert.deepEqual(matrixCellRecords(row.records,'2024-01-01','2024-01-31','deal').map(row=>row.id),[1]);
 assert.deepEqual(matrixCellRecords(row.records,'2024-03-01','2024-03-31','deal'),[]);
});

test('matrix totals deduplicate geography and unique publishers across months', () => {
 const records=[
  {id:1,date:'2024-01-01',interaction:['Deal'],location:['France','United States'],organization_publisher_named_in_deal_suit:['Same publisher'],publication_countries:{'Same publisher':['France','United States']}},
  {id:2,date:'2024-02-01',interaction:['Deal'],location:['France'],organization_publisher_named_in_deal_suit:['Same publisher'],publication_countries:{'Same publisher':['France','United States']}}
 ];
 const cards=buildLocationMatrix(records);
 assert.equal(cards.total.totals.deal,2);
 assert.deepEqual(cards.total.values.map(row=>row.deal),[1,1]);
 assert.equal(cards.regions.find(row=>row.label==='Europe').totals.deal,2);
 const publishers=buildLocationMatrix(records,records,'direct');
 assert.equal(publishers.total.totals.deal,1);
 assert.equal(publishers.regions.find(row=>row.label==='Europe').totals.deal,1);
});


test('publisher children are attributed to their own country, with unknown parents separate', () => {
 const record={id:181,date:'2023-12-13',interaction:['Deal'],organization_publisher_named_in_deal_suit:['Axel Springer'],location:['Germany','United States'],country_flags:{Germany:'🇩🇪','United States':'🇺🇸'},publication_countries:{'Axel Springer':[],BILD:['Germany'],WELT:['Germany'],'Business Insider':['United States'],Politico:['United States']},parent_child_matches:['BILD','WELT','Business Insider','Politico'].map(name=>({lineage:['Axel Springer',name]}))};
 const matrix=buildLocationMatrix([record],[record],'descendants');
 const countries=matrix.regions.flatMap(region=>region.countries);
 for(const country of ['Germany','United States']) {
  const row=countries.find(row=>row.label===country);
  assert.equal(row.values[0].deal,2);
  assert.equal(row.totals.deal,2);
  assert.deepEqual(row.records,[record]);
 }
 assert.equal(matrix.regions.find(row=>row.label==='Unspecified location').totals.deal,1);
 assert.equal(matrix.total.totals.deal,5);
 const direct=buildLocationMatrix([record],[record],'direct');
 assert.equal(direct.regions.find(row=>row.label==='Unspecified location').totals.deal,1);
 assert.equal(direct.regions.some(row=>row.label==='Europe'),false);
});


test('matrix excludes children covered only by other records', () => {
 const first={id:1,date:'2023-07-13',interaction:['Deal'],organization_publisher_named_in_deal_suit:['AP'],publication_countries:{AP:['United States']}};
 const later={id:2,date:'2025-06-08',interaction:['Deal'],organization_publisher_named_in_deal_suit:['AP'],parent_child_matches:[{lineage:['AP','Child']}],publication_countries:{AP:['United States'],Child:['Germany']},country_flags:{Germany:'🇩🇪'}};
 const matrix=buildLocationMatrix([first],[first,later],'descendants');
 assert.equal(matrix.total.totals.deal,1);
 assert.equal(matrix.regions.some(row=>row.label==='Europe'),false);
 assert.equal(matrix.regions.flatMap(row=>row.countries).find(row=>row.label==='United States').totals.deal,1);
});

test('country publisher list deduplicates names and respects coverage, category and date', async () => {
 const {locationPublishers}=await import('../src/lib/locationMatrix.js');
 const records=[
  {id:1,date:'2023-07-13',interaction:['Deal'],organization_publisher_named_in_deal_suit:['AP'],publication_countries:{AP:['United States']}},
  {id:2,date:'2025-06-08',interaction:['Grant'],organization_publisher_named_in_deal_suit:['AP'],parent_child_matches:[{lineage:['AP','Child']}],publication_countries:{AP:['United States'],Child:['Germany']},country_flags:{Germany:'🇩🇪'}},
  {id:3,date:'2024-01-01',interaction:['Deal'],organization_publisher_named_in_deal_suit:['AP'],publication_countries:{AP:['United States']}}
 ];
 const matrix=buildLocationMatrix(records,records,'descendants');
 const countries=matrix.regions.flatMap(row=>row.countries);
 const us=countries.find(row=>row.label==='United States'), germany=countries.find(row=>row.label==='Germany');
 assert.deepEqual(locationPublishers(us,records,'descendants'),['AP']);
 assert.deepEqual(locationPublishers(germany,records,'descendants'),['Child']);
 assert.deepEqual(locationPublishers(germany,records,'descendants','deal'),[]);
 assert.deepEqual(locationPublishers(germany,records,'descendants',null,'2024-12-31'),[]);
 assert.deepEqual(locationPublishers(germany,records,'direct'),[]);
});

test('country lawsuit totals and cell selections count each lawsuit ID once',async()=>{
 const {matrixCellRecords}=await import('../src/lib/locationMatrix.js');
 const records=[{id:1,date:'2024-01-01',interaction:['Lawsuit'],lawsuit_id:'A',location:['United States']},{id:2,date:'2024-02-01',interaction:['Lawsuit'],lawsuit_id:'A',location:['United States']}];
 const matrix=buildLocationMatrix(records);
 const row=matrix.regions.flatMap(region=>region.countries)[0];
 assert.equal(row.totals.lawsuit,1);
 assert.deepEqual(row.values.map(point=>point.lawsuit),[1,0]);
 assert.equal(matrix.total.totals.lawsuit,1);
 assert.deepEqual(matrixCellRecords(row.records,'2024-02-01','2024-02-29','lawsuit'),[]);
});

test('publisher totals and popup lists count repeated names and shared children once',async()=>{
 const {locationPublishers}=await import('../src/lib/locationMatrix.js');
 const base={interaction:['Lawsuit'],lawsuit_id:'A',location:['United States','Canada'],organization_publisher_named_in_deal_suit:[' Parent ','PARENT','Child'],parent_child_matches:[{lineage:['Parent','Child']},{lineage:['Other Parent','Child']}],publication_countries:{Parent:['United States'],Child:['United States']}};
 const records=[{...base,id:1,date:'2024-01-01'},{...base,id:2,date:'2024-02-01',lawsuit_id:' A '},{...base,id:3,date:'2024-02-10',lawsuit_id:'B'}];
 for(const metric of ['direct','descendants']){
  const matrix=buildLocationMatrix(records,records,metric);
  const us=matrix.regions.flatMap(row=>row.countries).find(row=>row.label==='United States');
  assert.equal(us.totals.lawsuit,2);
  assert.equal(matrix.total.totals.lawsuit,2);
  assert.equal(locationPublishers(us,records,metric,'lawsuit').length,2);
 }
 const cases=buildLocationMatrix(records);
 assert.equal(cases.total.totals.lawsuit,2);
 assert.equal(cases.regions.flatMap(row=>row.countries).find(row=>row.label==='United States').totals.lawsuit,2);
});

test('multi-country cases count once globally, and missing lawsuit IDs do not become invented cases',()=>{
 const records=[{id:1,date:'2024-01-01',interaction:['Lawsuit'],lawsuit_id:' A ',lawsuit_ids:['A'],location:['United States','Canada']},{id:2,date:'2024-02-01',interaction:['Lawsuit'],lawsuit_ids:['A'],location:['United States','Canada']},{id:3,date:'2024-02-01',interaction:['Lawsuit'],location:['United States']}];
 const matrix=buildLocationMatrix(records);
 assert.equal(matrix.total.totals.lawsuit,1);
 for(const row of matrix.regions.flatMap(row=>row.countries))assert.equal(row.totals.lawsuit,1);
});
