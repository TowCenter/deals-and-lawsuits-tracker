import {normalizeName} from './publisherNetwork.js';

/** Membership is explicit; ownership alone does not make subsidiaries members. */
export function coalitionMembership(data) {
 const members = new Map();
 for (const row of data) {
  if (!(row.interaction || []).some(type => /^(collectives?|coalitions?)$/i.test(String(type).trim()))) continue;
  const coalition = row.collective_name;
  if (!coalition) continue;
  for (const name of row.collective_publishers || row.organization_publisher_named_in_deal_suit || []) {
   const key = normalizeName(name);
   if (!key) continue;
   if (!members.has(key)) members.set(key,new Set());
   members.get(key).add(coalition);
  }
 }
 return new Map([...members].map(([key,names]) => [key,[...names].sort()]));
}
