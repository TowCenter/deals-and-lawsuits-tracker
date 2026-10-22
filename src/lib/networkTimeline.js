import { buildOwnershipGraph, connectionPublisherNames, normalizeName } from './publisherNetwork.js';

// Require a real calendar date; unknown dates must not silently become historical.
export function timelineDate(value) {
 const date = String(value || '').slice(0, 10);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
 const parsed = new Date(`${date}T00:00:00Z`);
 return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function throughDate(records, cutoff) {
 return cutoff == null ? records : records.filter(record => {
  const date = timelineDate(record.date);
  return date && date <= cutoff;
 });
}

/** Prefer reported aggregates; otherwise use named direct publishers per agreement/case. */
export function reportedPublisherEvents(records) {
 const events = new Map();
 for (const record of [...records].sort((a,b) => (timelineDate(a.date) || '9999').localeCompare(timelineDate(b.date) || '9999'))) {
  if (!(record.interaction || []).some(kind => /^(deal|lawsuit)$/i.test(String(kind).trim()))) continue;
  const raw = record.reported_numbers;
  const parsed = raw != null && /^\d[\d,]*(?:\.\d+)?$/.test(String(raw).trim()) ? Number(String(raw).replaceAll(',', '')) : null;
  const hasReported = parsed != null && Number.isFinite(parsed) && parsed >= 0;
  const names = new Set(connectionPublisherNames(record).map(normalizeName));
  const lawsuit = (record.interaction || []).some(kind => /^lawsuit$/i.test(String(kind).trim()));
  const id = lawsuit ? record.lawsuit_id || record.lawsuit_ids?.[0] : record.deal_ids?.[0];
  const key = id ? `${lawsuit ? 'lawsuit' : 'deal'}:${id}` : record;
  if (!events.has(key)) events.set(key, {...record, reported_numbers:hasReported ? parsed : names.size, hasReported, directNames:names});
  else {
   const event = events.get(key);
   for (const name of names) event.directNames.add(name);
   if (!event.hasReported && hasReported) { event.reported_numbers = parsed; event.hasReported = true; }
   else if (!event.hasReported) event.reported_numbers = event.directNames.size;
  }
 }
 return [...events.values()];
}

/** Expand only ownership lineages explicitly covered by this record. */
export function coveredPublisherNames(record, metric = 'direct') {
 const names = new Map(connectionPublisherNames(record).map(name => [normalizeName(name), name]));
 if (metric !== 'descendants') return [...names.values()];
 const graph = buildOwnershipGraph([record]);
 const pending = [...names].map(([key]) => [key, 0]);
 const visited = new Set();
 while (pending.length) {
  const [key, depth] = pending.shift();
  if (visited.has(key)) continue;
  visited.add(key);
  if (depth < 2) for (const child of graph.get(key)?.children || []) {
   names.set(child, graph.get(child).name);
   pending.push([child, depth + 1]);
  }
 }
 return [...names.values()];
}

export function timelineSeries(records, ownership, metric = 'cards') {
 const groups = new Map();
 for (const record of metric === 'reported' ? reportedPublisherEvents(records) : records) {
  const date = timelineDate(record.date);
  if (!date) continue;
  if (!groups.has(date)) groups.set(date, []);
  groups.get(date).push(record);
 }
 const publishers = new Set();
 let cards = 0, reported = 0;
 return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => {
  cards += rows.length;
  reported += rows.reduce((sum, row) => sum + (Number(row.reported_numbers) || 0), 0);
  if (metric !== 'cards' && metric !== 'reported') {
   for (const record of rows) {
    for (const name of coveredPublisherNames(record, metric)) publishers.add(normalizeName(name));
   }
  }
  return {date, value: metric === 'reported' ? reported : metric === 'cards' ? cards : publishers.size};
 });
}

/** Count a grant at its earliest dated matching record, keeping ID-less cards distinct. */
export function uniqueGrantEvents(records) {
 const grants = new Map();
 for (const record of [...records].sort((a,b) => (timelineDate(a.date) || '9999').localeCompare(timelineDate(b.date) || '9999'))) {
  const ids = [...new Set([...(record.grant_ids || []), record.grant_id].filter(value => value != null && String(value).trim()).map(value => String(value).trim()))];
  for (const key of ids.length ? ids.map(id => `grant:${id}`) : [record]) {
   if (!grants.has(key)) grants.set(key, record);
  }
 }
 return [...grants.values()];
}

/** Non-cumulative activity, including empty periods for honest comparisons. */
export function activitySeries(records, ownership, metric = 'cards', interval = 'month', smooth = false) {
 const dated = records.filter(record => timelineDate(record.date));
 if (!dated.length) return [];
 const step = interval === 'quarter' ? 3 : 1;
 const bucket = date => {
  const [year, month] = timelineDate(date).split('-').map(Number);
  return new Date(Date.UTC(year, Math.floor((month - 1) / step) * step, 1));
 };
 const first = Math.min(...dated.map(record => +bucket(record.date)));
 const last = Math.max(...dated.map(record => +bucket(record.date)));
 const reportedEvents = metric === 'reported' ? reportedPublisherEvents(dated) : [];
 const grantEvents = uniqueGrantEvents(dated.filter(record => (record.interaction || []).some(kind => String(kind).trim().toLowerCase() === 'grant')));
 const points = [];
 for (let cursor = new Date(first); +cursor <= last; cursor.setUTCMonth(cursor.getUTCMonth() + step)) {
  const next = new Date(cursor);
  next.setUTCMonth(next.getUTCMonth() + step);
  const date = cursor.toISOString().slice(0, 10);
  const end = new Date(+next - 86400000).toISOString().slice(0, 10);
  const rows = dated.filter(record => timelineDate(record.date) >= date && timelineDate(record.date) <= end);
  const point = {date, end, label: step === 3 ? `${cursor.getUTCFullYear()} Q${Math.floor(cursor.getUTCMonth()/3)+1}` : date.slice(0,7)};
  for (const kind of ['deal', 'grant', 'lawsuit']) {
   const matching = rows.filter(record => (record.interaction || []).some(value => String(value).trim().toLowerCase() === kind));
   point[kind] = metric === 'reported' ? reportedEvents.filter(record => timelineDate(record.date) >= date && timelineDate(record.date) <= end && (record.interaction || []).some(value => String(value).trim().toLowerCase() === kind)).reduce((sum,record) => sum + record.reported_numbers,0) : metric === 'cards' ? kind === 'grant' ? grantEvents.filter(record => timelineDate(record.date) >= date && timelineDate(record.date) <= end).length : matching.length : timelineSeries(matching, ownership, metric).at(-1)?.value || 0;
  }
  points.push(point);
 }
 if (!smooth || step !== 1) return points;
 return points.map((point, index) => {
  const window = points.slice(Math.max(0, index - 2), index + 1);
  return {...point, ...Object.fromEntries(['deal','grant','lawsuit'].map(kind => [kind, window.reduce((sum, row) => sum + row[kind], 0) / window.length]))};
 });
}

/** Hit-test the actual calendar-width columns, without native range rounding. */
export function periodAtFraction(periods, fraction) {
 if (!periods.length || !Number.isFinite(fraction)) return -1;
 const start = Date.parse(periods[0].date);
 const end = Date.parse(periods.at(-1).end) + 86400000;
 const time = start + Math.max(0, Math.min(1 - Number.EPSILON, fraction)) * (end - start);
 return Math.max(0, periods.findLastIndex(period => Date.parse(period.date) <= time));
}

/** Running totals at each period end; publishers are unique across periods. */
export function cumulativeActivitySeries(records, ownership, metric = 'cards', interval = 'month') {
 const periods = activitySeries(records, ownership, 'cards', interval);
 const byCategory = Object.fromEntries(['deal','grant','lawsuit'].map(kind => [kind,
  timelineSeries(records.filter(record => (record.interaction || []).some(value => String(value).trim().toLowerCase() === kind)), ownership, metric)
 ]));
 return periods.map(period => ({...period, ...Object.fromEntries(Object.entries(byCategory).map(([kind, points]) => [kind, points.findLast(point => point.date <= period.end)?.value || 0]))}));
}
