import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnershipGraph } from '../src/lib/publisherNetwork.js';
import { timelineDate, timelineSeries, throughDate } from '../src/lib/networkTimeline.js';

const rows = [
 {id:1, date:'2024-01-01', organization_publisher_named_in_deal_suit:['Parent'], parent_child_matches:[{lineage:['Parent','Child','Grandchild','Great-grandchild']}]},
 {id:2, date:'2024-02-01', organization_publisher_named_in_deal_suit:['Child','PARENT']},
 {id:3, date:'2024-02-01', interaction:['Grant'], organization_publisher_named_in_deal_suit:['Fund'], grantees:['Grantee']},
 {id:4, date:null, organization_publisher_named_in_deal_suit:['Unknown date']}
];
const graph = buildOwnershipGraph(rows);
test('date selection includes boundary and excludes unknown dates until All dates', () => {
 assert.deepEqual(throughDate(rows,'2024-01-01').map(row=>row.id),[1]);
 assert.deepEqual(throughDate(rows,'2024-02-01').map(row=>row.id),[1,2,3]);
 assert.strictEqual(throughDate(rows,null),rows);
 assert.equal(timelineDate('2024-02-30'),null);
 assert.equal(timelineDate('not a date'),null);
 assert.equal(timelineDate('2024-02-29'), '2024-02-29');
});
test('cumulative cards share dates, sort chronologically and omit undated records', () => {
 assert.deepEqual(timelineSeries([...rows].reverse(),graph),[{date:'2024-01-01',value:1},{date:'2024-02-01',value:3}]);
});
test('publisher counts deduplicate across cards and include explicit grant beneficiaries', () => {
 assert.deepEqual(timelineSeries(rows,graph,'direct').map(point=>point.value),[1,4]);
});
test('descendants propagate down two generations, never to siblings or ancestors', () => {
 assert.deepEqual(timelineSeries(rows.slice(0,1),graph,'descendants').map(point=>point.value),[3]);
 assert.deepEqual(timelineSeries([{date:'2024-01-01',organization_publisher_named_in_deal_suit:['Grandchild'],parent_child_matches:rows[0].parent_child_matches}],graph,'descendants').map(point=>point.value),[2]);
});
test('ownership cycles do not inflate counts or loop forever', () => {
 const cycle = new Map([['parent',{children:new Set(['child'])}],['child',{children:new Set(['parent'])}]]);
 assert.equal(timelineSeries([{...rows[0],parent_child_matches:[{lineage:['Parent','Child','Parent']}]}],cycle,'descendants')[0].value,2);
 assert.deepEqual(timelineSeries([],cycle),[]);
});

test('activity counts categories independently, resets publishers and fills missing months', async () => {
 const {activitySeries} = await import('../src/lib/networkTimeline.js');
 const records = [
  {...rows[0], interaction:['Deal','Grant']},
  {...rows[1], date:'2024-03-01', interaction:['Deal']},
  {...rows[1], id:6, date:'2024-03-15', interaction:['Deal']},
  {...rows[3], interaction:['Lawsuit']}
 ];
 const activity = activitySeries(records,graph);
 assert.deepEqual(activity.map(row=>[row.deal,row.grant,row.lawsuit]),[[1,1,0],[0,0,0],[2,0,0]]);
 assert.deepEqual(activitySeries(records,graph,'direct').map(row=>row.deal),[1,0,2]);
 assert.equal(activitySeries(records,graph,'descendants')[0].deal,3);
 assert.equal(activitySeries(records,graph,'cards','quarter')[0].deal,3);
 assert.equal(activitySeries(records,graph,'cards','month',true)[2].deal,1);
 assert.deepEqual(activitySeries([],graph),[]);
});
test('activity crosses year and quarter boundaries and retains leap-day events', async () => {
 const {activitySeries} = await import('../src/lib/networkTimeline.js');
 const records = ['2023-12-31','2024-02-29','2024-04-01'].map(date=>({date,interaction:['Lawsuit']}));
 const activity = activitySeries(records,graph,'cards','quarter');
 assert.deepEqual(activity.map(row=>row.label),['2023 Q4','2024 Q1','2024 Q2']);
 assert.deepEqual(activity.map(row=>row.lawsuit),[1,1,1]);
});

test('month hit testing selects every calendar column, including unequal month lengths', async () => {
 const {activitySeries, periodAtFraction} = await import('../src/lib/networkTimeline.js');
 const months = activitySeries([{date:'2024-01-01',interaction:['Deal']},{date:'2024-12-31',interaction:['Deal']}],graph);
 const start = Date.parse(months[0].date), end = Date.parse(months.at(-1).end)+86400000;
 for (let index=0; index<months.length; index++) {
  const a = Date.parse(months[index].date), b = Date.parse(months[index].end)+86400000;
  for (const time of [a+1, (a+b)/2, b-1]) assert.equal(periodAtFraction(months,(time-start)/(end-start)),index);
 }
 assert.equal(periodAtFraction(months,0),0);
 assert.equal(periodAtFraction(months,1),11);
 assert.equal(periodAtFraction([],0),-1);
});

test('cumulative activity carries totals through empty months and deduplicates publishers over time', async () => {
 const {cumulativeActivitySeries} = await import('../src/lib/networkTimeline.js');
 const records = [
  {...rows[0],interaction:['Deal','Grant']},
  {...rows[0],id:5,date:'2024-03-01',interaction:['Deal']},
  {...rows[3],interaction:['Deal']}
 ];
 assert.deepEqual(cumulativeActivitySeries(records,graph).map(row=>[row.deal,row.grant,row.lawsuit]),[[1,1,0],[1,1,0],[2,1,0]]);
 assert.deepEqual(cumulativeActivitySeries(records,graph,'direct').map(row=>row.deal),[1,1,1]);
 assert.deepEqual(cumulativeActivitySeries(records,graph,'descendants').map(row=>row.deal),[3,3,3]);
 assert.equal(cumulativeActivitySeries(records,graph,'cards','quarter')[0].deal,2);
});

test('grant IDs count once across updates, at the earliest matching month', async () => {
 const {activitySeries, uniqueGrantEvents} = await import('../src/lib/networkTimeline.js');
 const records = [
  {id:1,date:'2024-01-05',interaction:['Grant'],grant_id:'A'},
  {id:2,date:'2024-01-20',interaction:['Grant'],grant_ids:['A']},
  {id:3,date:'2024-03-01',interaction:['Grant'],grant_ids:['A','B']},
  {id:4,date:'2024-03-05',interaction:['Grant']},
  {id:5,date:null,interaction:['Grant'],grant_id:'B'}
 ];
 assert.deepEqual(activitySeries(records,graph).map(row=>row.grant),[1,0,2]);
 assert.equal(uniqueGrantEvents(records).length,3);
 assert.equal(activitySeries(records.slice(2),graph)[0].grant,3);
});

test('reported metric uses aggregates with direct-publisher fallback and deduplicates updates', async () => {
 const {activitySeries,cumulativeActivitySeries,reportedPublisherEvents} = await import('../src/lib/networkTimeline.js');
 const records = [
  {id:1,date:'2024-01-01',interaction:['Lawsuit'],lawsuit_id:'A',reported_numbers:'400'},
  {id:2,date:'2024-02-01',interaction:['Lawsuit'],lawsuit_id:'A',reported_numbers:'400'},
  {id:3,date:'2024-02-01',interaction:['Deal'],deal_ids:['B'],reported_numbers:'8,000'},
  {id:4,date:'2024-02-01',interaction:['Deal'],reported_numbers:null,organization_publisher_named_in_deal_suit:['A','a','B']},
  {id:5,date:'2024-02-01',interaction:['Grant'],reported_numbers:'200'},
  {id:6,date:'2024-02-01',interaction:['Deal'],reported_numbers:'unknown',organization_publisher_named_in_deal_suit:['C']}
 ];
 assert.equal(reportedPublisherEvents(records).length,4);
 assert.deepEqual(activitySeries(records,graph,'reported').map(row=>[row.deal,row.lawsuit,row.grant]),[[0,400,0],[8003,0,0]]);
 assert.deepEqual(cumulativeActivitySeries(records,graph,'reported').map(row=>row.lawsuit),[400,400]);
});
test('normalization preserves the Reported Numbers field', async () => {
 const {normalizeData} = await import('../src/lib/trackerData.js');
 assert.equal(normalizeData([{'Reported Numbers':'400'}])[0].reported_numbers,'400');
});

test('reported counts override direct fallback across updates without counting the case twice', async () => {
 const {reportedPublisherEvents} = await import('../src/lib/networkTimeline.js');
 const events = reportedPublisherEvents([
  {date:'2024-01-01',interaction:['Lawsuit'],lawsuit_id:'X',organization_publisher_named_in_deal_suit:['Parent']},
  {date:'2024-02-01',interaction:['Lawsuit'],lawsuit_id:'X',reported_numbers:'400'}
 ]);
 assert.equal(events.length,1);
 assert.equal(events[0].reported_numbers,400);
 assert.equal(events[0].date,'2024-01-01');
});


test('children from other records never enter monthly or cumulative publisher counts', async () => {
 const {activitySeries,cumulativeActivitySeries} = await import('../src/lib/networkTimeline.js');
 for (const kind of ['Deal','Lawsuit','Grant']) {
  const first={id:1,date:'2023-07-13',interaction:[kind],organization_publisher_named_in_deal_suit:['AP']};
  const later={id:2,date:'2025-06-08',interaction:[kind],organization_publisher_named_in_deal_suit:['AP'],parent_child_matches:[{lineage:['AP','AP Business News']}]};
  const records=[first,later], graph=buildOwnershipGraph(records);
  assert.equal(timelineSeries([first],graph,'descendants')[0].value,1);
  assert.equal(activitySeries(records,graph,'descendants')[0][kind.toLowerCase()],1);
  const cumulative=cumulativeActivitySeries(records,graph,'descendants');
  assert.equal(cumulative[0][kind.toLowerCase()],1);
  assert.equal(cumulative.at(-1)[kind.toLowerCase()],2);
 }
});
