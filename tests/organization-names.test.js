import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../src/lib/trackerData.js';
import { organizationNameAtEvent } from '../src/lib/organizationNames.js';
import { createEntityNetworkIndex } from '../src/lib/entityNetwork.js';

test('historical card names preserve current graph identity', () => {
 const [row] = normalizeData([{
  id: 1, Date: '2024-05-07', Interaction: ['Deal'],
  'AI Company': ['OpenAI'], 'News Org(s)': ['People Inc.'],
  'Organization Previous Names': {'People Inc.': ['Dotdash Meredith']},
  'Organization Name History': {'People Inc.': [{previous_name: 'Dotdash Meredith', name: 'People Inc.', effective_date: '2025-07-31'}]},
  'Organization Names at Event Date': {'People Inc.': 'Dotdash Meredith'}
 }]);
 assert.equal(organizationNameAtEvent(row, 'People Inc.'), 'Dotdash Meredith');
 assert.deepEqual(row.publishers, ['People Inc.']);
 assert.deepEqual(row.organization_previous_names['People Inc.'], ['Dotdash Meredith']);
 assert.equal(row.organization_name_history['People Inc.'][0].name, 'People Inc.');
 assert.equal(createEntityNetworkIndex([row]).query({type: 'publisher', name: 'People Inc.'}).records[0], row);
 assert.equal(organizationNameAtEvent(row, 'OpenAI'), 'OpenAI');
});

test('missing or invalid event-date names fall back to the current name', () => {
 for (const value of [undefined, null, '', 'NaN', [], {}]) {
  assert.equal(organizationNameAtEvent({organization_names_at_event_date: {Gannett: value}}, 'Gannett'), 'Gannett');
 }
 const [row] = normalizeData([{}]);
 assert.equal(organizationNameAtEvent(row, 'USA Today Co.'), 'USA Today Co.');
});
