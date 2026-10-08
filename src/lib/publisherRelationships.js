import { buildOwnershipGraph, normalizeName, publisherAndAncestors } from './publisherNetwork.js';
import { isMdlConsolidation } from './mdl.js';
import { parseArray } from './utils.js';

const indexCache = new WeakMap();

/** Index named parties once per dataset, then cache each publisher/card query. */
export function createPublisherRelationshipIndex(data) {
 if (indexCache.has(data)) return indexCache.get(data);
 const graph = buildOwnershipGraph(data);
 const sources = new Map(data.map(record => [record.id, record]));
 const recordsByPublisher = new Map();
 const queryCache = new Map();
 const ancestorCache = new Map();
 const ancestors = name => {
  const key = normalizeName(name);
  if (!ancestorCache.has(key)) ancestorCache.set(key, publisherAndAncestors(graph, name));
  return ancestorCache.get(key);
 };
 const caseIds = record => new Set([...parseArray(record?.lawsuit_ids), ...parseArray(record?.lawsuit_id)]);
 for (const record of data) {
  if (isMdlConsolidation(record) || ![...parseArray(record.platform), ...parseArray(record.defendant)].length) continue;
  for (const name of record.organization_publisher_named_in_deal_suit || []) {
   const key = normalizeName(name);
   if (!recordsByPublisher.has(key)) recordsByPublisher.set(key, new Set());
   recordsByPublisher.get(key).add(record);
  }
 }
 const index = {
  source: id => sources.get(id),
  includes: (record, name) => (record.organization_publisher_named_in_deal_suit || []).some(publisher => ancestors(name).has(normalizeName(publisher))),
  other(rowId, name) {
   if (!queryCache.has(rowId)) queryCache.set(rowId, new Map());
   const queries = queryCache.get(rowId), key = normalizeName(name);
   if (!queries.has(key)) {
    const excludedCases = caseIds(sources.get(rowId));
    const candidates = new Set([...ancestors(name)].flatMap(parent => [...(recordsByPublisher.get(parent) || [])]));
    queries.set(key, [...candidates].filter(record => record.id !== rowId && ![...caseIds(record)].some(id => excludedCases.has(id))));
   }
   return queries.get(key);
  }
 };
 indexCache.set(data, index);
 return index;
}

/** Build one edge per platform/type in a single pass, retaining the current card for context. */
export function buildRelationshipPreview(index, rowId, name) {
 const source = index.source(rowId);
 const records = [...(source && index.includes(source, name) ? [source] : []), ...index.other(rowId, name)];
 const edgesByPlatform = new Map();
 for (const record of records) {
  const platforms = new Set([...parseArray(record.platform), ...parseArray(record.defendant)]);
  for (const platform of platforms) {
   if (!edgesByPlatform.has(platform)) edgesByPlatform.set(platform, new Map());
   for (const interaction of parseArray(record.interaction)) {
    const kind = String(interaction).toLowerCase();
    const color = kind === 'lawsuit' ? '#b62230' : kind === 'grant' ? '#2878bb' : '#278442';
    edgesByPlatform.get(platform).set(kind, {platform, kind, color});
   }
  }
 }
 const platforms = [...edgesByPlatform.keys()].sort();
 return {name, platforms, edges: platforms.flatMap(platform => [...edgesByPlatform.get(platform).values()]), height: Math.max(180, platforms.length * 64)};
}

/** Expand only recorded ownership children, never funding beneficiaries. */
export function grantChildPublishers(graph, name) {
 const children = [];
 const seen = new Set([normalizeName(name)]);
 const visit = (key, lineage) => {
  for (const childKey of graph.get(key)?.children || []) {
   if (seen.has(childKey)) continue;
   seen.add(childKey);
   const child = graph.get(childKey);
   const childLineage = [...lineage, child.name];
   children.push({name: child.name, depth: childLineage.length - 1, lineage: childLineage});
   visit(childKey, childLineage);
  }
 };
 visit(normalizeName(name), [name]);
 return children;
}
