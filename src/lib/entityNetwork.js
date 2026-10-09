import { buildOwnershipGraph, connectionPublisherNames, normalizeName, ownershipFamily, publisherAndAncestors } from './publisherNetwork.js';
import { isMdlConsolidation } from './mdl.js';

const cache = new WeakMap();
export const entityKey = (type, name) => `${type}:${normalizeName(name)}`;

/** Build lookups once per immutable dataset; navigation reads the same full network. */
export function createEntityNetworkIndex(data) {
 if (cache.has(data)) return cache.get(data);
 const ownership = buildOwnershipGraph(data);
 const publishers = new Map(), platforms = new Map(), views = new Map();
 const add = (index, name, record) => {
  const key = normalizeName(name);
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(record);
 };
 for (const record of data) {
  if (isMdlConsolidation(record)) continue;
  for (const name of connectionPublisherNames(record)) add(publishers, name, record);
  for (const name of [...(record.platform || []), ...(record.defendant || [])]) add(platforms, name, record);
 }
 const query = focus => {
  const key = entityKey(focus.type, focus.name);
  if (views.has(key)) return views.get(key);
  const records = focus.type === 'platform'
   ? [...(platforms.get(normalizeName(focus.name)) || [])]
   : [...new Set([...publisherAndAncestors(ownership, focus.name)].flatMap(name => [...(publishers.get(name) || [])]))];
  const names = focus.type === 'platform' ? records.flatMap(connectionPublisherNames) : [focus.name];
  const family = new Set(names.flatMap(name => [...ownershipFamily(ownership, name)]));
  const view = { records, family, companies: focus.type === 'platform' ? [focus.name] : [...new Set(records.flatMap(record => [...(record.platform || []), ...(record.defendant || [])]))] };
  views.set(key, view);
  return view;
 };
 const index = { ownership, query };
 cache.set(data, index);
 return index;
}

/** Collapse case updates while preserving all named participants and platforms. */
export function networkEntries(records) {
 const groups = new Map();
 for (const record of records) {
  const key = record.lawsuit_id ? `case:${record.lawsuit_id}` : `entry:${record.id}`;
  const previous = groups.get(key);
  const latest = previous && String(previous.date || '') > String(record.date || '') ? previous : record;
  groups.set(key, {
   ...latest,
   organization_publisher_named_in_deal_suit: [...new Set([...(previous?.organization_publisher_named_in_deal_suit || []), ...(record.organization_publisher_named_in_deal_suit || [])])],
   companies: [...new Set([...(previous?.companies || []), ...(record.platform || []), ...(record.defendant || [])])]
  });
 }
 return [...groups.values()].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/** Omit covered children when the same agreement already connects their ancestor. */
export function platformConnectionNames(record, ownership) {
 const all = connectionPublisherNames(record);
 const keys = new Set(all.map(normalizeName));
 const explicit = new Set([...(record.organization_publisher_named_in_deal_suit || []), ...(record.grantees || []), ...(record.publications_received_grants || [])].map(normalizeName));
 return all.filter(name => {
  const key = normalizeName(name);
  if (explicit.has(key)) return true;
  const ancestors = publisherAndAncestors(ownership, name);
  ancestors.delete(key);
  return ![...ancestors].some(parent => keys.has(parent));
 });
}
