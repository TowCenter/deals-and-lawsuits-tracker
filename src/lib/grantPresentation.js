import {normalizeName} from './publisherNetwork.js';
import {grantChildPublishers} from './publisherRelationships.js';

const uniqueNames = names => [...new Map(names.filter(Boolean).map(name => [normalizeName(name), String(name).trim()])).values()];

/** Keep direct, downstream and agreement-covered roles separate; render each recipient once. */
export function buildGrantPresentation(row, graph) {
 const roots = uniqueNames([...(row.named_organizations || []), ...(row.grantees || [])]);
 if (!roots.length) roots.push(...uniqueNames(row.organization_publisher_named_in_deal_suit || []));
 const funded = new Set((row.publications_received_grants || []).map(normalizeName));
 const covered = new Set((row.affected_publications || []).map(normalizeName));
 const shown = new Set(roots.map(normalizeName));
 const groups = roots.map(name => ({name, items: []}));
 for (const group of groups) {
  // Only explicitly covered children belong in the ownership hierarchy.
  for (const child of grantChildPublishers(graph, group.name)) {
   const key = normalizeName(child.name);
   if (!covered.has(key) || shown.has(key)) continue;
   shown.add(key);
   group.items.push({name: child.name, depth: child.depth, isGrantee: funded.has(key)});
  }
 }
 const remaining = uniqueNames([...(row.publications_received_grants || []), ...(row.affected_publications || [])])
  .filter(name => !shown.has(normalizeName(name)))
  .map(name => ({name, depth: 1, isGrantee: funded.has(normalizeName(name))}));
 // With several direct recipients, the export does not identify which one funded an unlinked recipient.
 // Display them once without inventing a parent relationship.
 if (groups.length === 1) groups[0].items.push(...remaining);
 return {groups, unassigned: groups.length === 1 ? [] : remaining};
}
