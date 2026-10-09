/** Display the exported event-date name without changing canonical entity identity. */
export function organizationNameAtEvent(row, currentName) {
 const name = row?.organization_names_at_event_date?.[currentName];
 return typeof name === 'string' && name.trim() && !/^nan$/i.test(name.trim())
  ? name.trim() : currentName;
}
