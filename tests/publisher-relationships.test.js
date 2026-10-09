import {buildOwnershipGraph, connectionPublisherNames} from '../src/lib/publisherNetwork.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublisherRelationshipIndex, buildRelationshipPreview, grantChildPublishers } from '../src/lib/publisherRelationships.js';
import { normalizeData } from '../src/lib/trackerData.js';

const records = [
 { id: 1, organization_publisher_named_in_deal_suit: ['Parent'], platform: ['OpenAI'], parent_child_matches: [{lineage:['Parent', 'Child', 'Grandchild']}, {lineage:['Parent', 'Sibling']}] },
 { id: 2, organization_publisher_named_in_deal_suit: ['Child'], defendant: ['Microsoft'], lawsuit_ids: ['case'], lawsuit_id: 'case' },
 { id: 3, organization_publisher_named_in_deal_suit: ['Child'], defendant: ['Microsoft'], lawsuit_ids: ['case'], lawsuit_id: 'case' },
 { id: 4, organization_publisher_named_in_deal_suit: ['Sibling'], platform: ['Google'] },
 { id: 5, organization_publisher_named_in_deal_suit: ['Child'], defendant: ['Microsoft'], status: 'Consolidated into Multi-District Litigation' }
];
test('indexed queries inherit ancestors, excluding descendants, siblings and same-case updates', () => {
 const index = createPublisherRelationshipIndex(records);
 assert.deepEqual(index.other(1, 'Parent'), []);
 assert.deepEqual(index.other(2, 'Child').map(row => row.id), [1]);
 assert.deepEqual(index.other(2, 'Grandchild').map(row => row.id), [1]);
 assert(!index.includes(records[1], 'Parent'));
 assert(index.includes(records[0], 'Grandchild'));
 assert.strictEqual(index.other(2, 'Child'), index.other(2, 'Child'));
 assert.strictEqual(index, createPublisherRelationshipIndex(records));
});
test('normalization preserves named parties, defendants and case identity for indexed queries', () => {
 const [row] = normalizeData([{id:9, 'News Org(s)':['Child'], Defendant:['OpenAI'], Interaction:['Lawsuit'], Lawsuit_ID:['case'], linked_entry_ids:'1, 2'}]);
 assert.deepEqual(row.organization_publisher_named_in_deal_suit, ['Child']);
 assert.deepEqual(row.defendant, ['OpenAI']);
 assert.deepEqual(row.lawsuit_ids, ['case']);
 assert.deepEqual(row.linked_entry_ids, [1, 2]);
});

test('preview includes the current lawsuit and an inherited deal without duplicate edges', () => {
 const rows = [
  {...records[0], interaction:['Deal']},
  {...records[1], interaction:['Lawsuit']},
  {...records[2], interaction:['Lawsuit']}
 ];
 const preview = buildRelationshipPreview(createPublisherRelationshipIndex(rows), 2, 'Child');
 assert.deepEqual(preview.platforms, ['Microsoft', 'OpenAI']);
 assert.deepEqual(preview.edges.map(edge => [edge.platform, edge.kind]), [['Microsoft', 'lawsuit'], ['OpenAI', 'deal']]);
});

test('grant recipients combine grantees and affected publications without creating ownership', () => {
 const [grant, deal] = normalizeData([
  {Interaction:['Grant'], 'News Org(s)':['Lenfest'], Grantees:['Newsroom A'], 'Affected Publications':['Newsroom A', 'Newsroom B'], 'AI Company':['OpenAI']},
  {Interaction:['Deal'], 'News Org(s)':['Owner'], 'Affected Publications':['Publication']}
 ]);
 assert.deepEqual(grant.organization_publisher_named_in_deal_suit, ['Lenfest', 'Newsroom A']);
 assert.deepEqual(grant.publishers, ['Lenfest', 'Newsroom A', 'Newsroom B']);
 assert.deepEqual(grant.named_organizations, ['Lenfest']);
 assert.deepEqual(grant.grantees, ['Newsroom A']);
 assert.deepEqual(grant.parent_child_matches, []);
 assert.deepEqual(deal.organization_publisher_named_in_deal_suit, ['Owner']);
 const index = createPublisherRelationshipIndex([grant]);
 assert(index.includes(grant, 'Newsroom B'));
});

test('grant child expansion includes recorded descendants without unrelated grant recipients', () => {
 const graph = buildOwnershipGraph([{parent_child_matches:[{lineage:['Medill','Knight Lab','Project']}], organization_publisher_named_in_deal_suit:['Medill','Unrelated recipient']}]);
 assert.deepEqual(grantChildPublishers(graph, 'Medill').map(child => child.name), ['Knight Lab','Project']);
 assert.deepEqual(grantChildPublishers(graph, 'Unrelated recipient'), []);
});

test('grant normalization preserves direct, downstream and agreement-covered recipient roles', () => {
 const [row] = normalizeData([{Interaction:['Grant'], Grantees:['Lenfest'], 'Publications Received Grants':['Newsroom A'], 'Affected Publications':['Newsroom B'], 'AI Company':['OpenAI']}]);
 assert.deepEqual(row.grantees, ['Lenfest']);
 assert.deepEqual(row.publications_received_grants, ['Newsroom A']);
 assert.deepEqual(row.affected_publications, ['Newsroom B']);
 assert.deepEqual(row.publishers, ['Lenfest','Newsroom A','Newsroom B']);
});

test('grant-covered children create direct platform connections without changing named parties', () => {
 const rows = normalizeData([{id:1, Interaction:['Grant'], 'AI Company':['OpenAI'], 'News Org(s)':['Craig Newmark'], Grantees:['Craig Newmark'], 'Affected Publications':['Tow-Knight'], parent_child_matches:[{lineage:['Craig Newmark','Tow-Knight']}]}]);
 const index = createPublisherRelationshipIndex(rows);
 assert.deepEqual(rows[0].organization_publisher_named_in_deal_suit, ['Craig Newmark']);
 assert.deepEqual(connectionPublisherNames(rows[0]), ['Craig Newmark', 'Tow-Knight']);
 assert(index.includes(rows[0], 'Tow-Knight'));
 assert.deepEqual(rows[0].affected_publications, ['Tow-Knight']);
});

test('downstream grant recipients have platform relationships without ownership links', () => {
 const rows = normalizeData([{id:1, Interaction:['Grant'], Grantees:['Lenfest'], 'Publications Received Grants':['Newsroom'], 'AI Company':['OpenAI']}]);
 assert.deepEqual(connectionPublisherNames(rows[0]), ['Lenfest', 'Newsroom']);
 const index = createPublisherRelationshipIndex(rows);
 assert(index.includes(rows[0], 'Newsroom'));
 assert.deepEqual(buildRelationshipPreview(index, 1, 'Newsroom').edges.map(edge => edge.platform), ['OpenAI']);
 assert.deepEqual(rows[0].parent_child_matches, []);
});
