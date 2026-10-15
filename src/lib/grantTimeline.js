/** Group explicit grant IDs only; keep every update, even repeated statuses. */
export function createGrantTimelineIndex(data) {
 const groups = new Map();
 for (const row of data) {
  if (!(row.interaction || []).some(type => String(type).toLowerCase() === 'grant')) continue;
  for (const id of new Set(row.grant_ids || (row.grant_id != null ? [row.grant_id] : []))) {
   const key = String(id).trim();
   if (!key) continue;
   if (!groups.has(key)) groups.set(key, []);
   groups.get(key).push(row);
  }
 }
 for (const entries of groups.values()) entries.sort((a,b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || String(a.id).localeCompare(String(b.id)));
 return row => {
  const entries = [...new Set((row.grant_ids || (row.grant_id != null ? [row.grant_id] : [])).flatMap(id => groups.get(String(id).trim()) || []))];
  return entries.sort((a,b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || String(a.id).localeCompare(String(b.id)));
 };
}
