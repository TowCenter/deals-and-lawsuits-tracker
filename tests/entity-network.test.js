import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../src/lib/trackerData.js';
import { createEntityNetworkIndex, networkEntries, entityKey, platformConnectionNames } from '../src/lib/entityNetwork.js';
const records = [
 {id:1, interaction:['Deal'], organization_publisher_named_in_deal_suit:['Newsday'], platform:['OpenAI']},
 {id:2, interaction:['Grant'], organization_publisher_named_in_deal_suit:['Hearst'], affected_publications:['Publication'], platform:['OpenAI'], parent_child_matches:[{lineage:['Hearst','Publication']}]},
 {id:3, interaction:['Lawsuit'], organization_publisher_named_in_deal_suit:['Newsday'], defendant:['Microsoft']},
 {id:4, interaction:['Deal'], organization_publisher_named_in_deal_suit:['Hearst'], platform:['Google']}
];
test('traversal queries the full network rather than the previous view', () => {
 const index = createEntityNetworkIndex(records);
 const newsday = index.query({type:'publisher', name:'Newsday'});
 assert.deepEqual(newsday.records.map(row => row.id), [1,3]);
 const openai = index.query({type:'platform', name:'OpenAI'});
 assert.deepEqual(openai.records.map(row => row.id), [1,2]);
 assert.deepEqual(openai.companies, ['OpenAI']);
 assert(openai.family.has('publication'));
 const hearst = index.query({type:'publisher', name:'Hearst'});
 assert.deepEqual(hearst.records.map(row => row.id), [2,4]);
 assert.strictEqual(index.query({type:'publisher', name:'Hearst'}), hearst);
 assert.strictEqual(createEntityNetworkIndex(records), index);
});
test('publisher queries inherit ancestors but not descendants or siblings', () => {
 const rows = [...records, {id:5, interaction:['Deal'], organization_publisher_named_in_deal_suit:['Publication'], platform:['Other']}];
 const index = createEntityNetworkIndex(rows);
 assert.deepEqual(index.query({type:'publisher', name:'Hearst'}).records.map(row => row.id), [2,4]);
 assert.deepEqual(index.query({type:'publisher', name:'Publication'}).records.map(row => row.id), [2,5,4]);
 assert.notEqual(entityKey('platform','OpenAI'), entityKey('publisher','OpenAI'));
});
test('case update merging preserves platforms and participants', () => {
 const entries = networkEntries([
  {id:1,date:'2024-01-01',lawsuit_id:'case',organization_publisher_named_in_deal_suit:['A'],defendant:['OpenAI']},
  {id:2,date:'2024-02-01',lawsuit_id:'case',organization_publisher_named_in_deal_suit:['B'],defendant:['Microsoft']}
 ]);
 assert.equal(entries.length,1);
 assert.equal(entries[0].id,2);
 assert.deepEqual(entries[0].companies,['OpenAI','Microsoft']);
 assert.deepEqual(entries[0].organization_publisher_named_in_deal_suit,['A','B']);
});

test('platform views connect to the parent rather than agreement-covered children', () => {
 const rows = [{id:1, interaction:['Grant'], organization_publisher_named_in_deal_suit:['Axios'], affected_publications:['Axios Local'], platform:['OpenAI'], parent_child_matches:[{lineage:['Axios','Axios Local']}]}];
 const index = createEntityNetworkIndex(rows);
 const entry = networkEntries(rows)[0];
 assert.deepEqual(platformConnectionNames(entry, index.ownership), ['Axios']);
 assert.deepEqual(platformConnectionNames({...entry, publications_received_grants:['Axios Local']}, index.ownership), ['Axios','Axios Local']);
});

test('mixed grant/deal entries use parent endpoints even in publisher views', () => {
 const rows = normalizeData([{id:59, Interaction:['Grant','Deal'], 'News Org(s)':['Axios'], Grantees:['Axios'], 'Affected Publications':['Axios Local'], 'AI Company':['OpenAI'], parent_child_matches:[{lineage:['Axios','Axios Local']}]}]);
 const index = createEntityNetworkIndex(rows);
 const view = index.query({type:'publisher',name:'Axios'});
 assert.deepEqual(networkEntries(view.records).flatMap(entry => platformConnectionNames(entry, index.ownership)), ['Axios']);
});
