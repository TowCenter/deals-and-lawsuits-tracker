import { buildCountryIndex, getCountriesForName, getRowLocations, groupPlacesByContinent } from './utils.js';
import { buildOwnershipGraph } from './publisherNetwork.js';
import { coveredPublisherNames, activitySeries, timelineSeries, timelineDate, uniqueGrantEvents, reportedPublisherEvents } from './networkTimeline.js';

/** Attribute publishers individually; record metrics retain record geography. */
export function buildLocationMatrix(records, allData = records, metric = 'cards') {
 const ownership = buildOwnershipGraph(allData);
 const countryIndex = buildCountryIndex(allData);
 const publisherMetric = metric === 'direct' || metric === 'descendants';
 const entities = new Map(records.map(record => [record,
  coveredPublisherNames(record, metric).map(name => ({name, places:getCountriesForName(countryIndex, record, name)}))
 ]));
 const scoped = (rows, places) => !publisherMetric ? rows : rows.map(record => ({
  ...record,
  organization_publisher_named_in_deal_suit:entities.get(record).filter(entity => !places || entity.places.some(place => places.has(place)) || (places.has(null) && !entity.places.length)).map(entity => entity.name),
  grantees:[], publications_received_grants:[], affected_publications:[]
 }));
 const countMetric = publisherMetric ? 'direct' : metric;
 const placesByRecord = new Map(records.map(record => [record, publisherMetric ? [...new Set(entities.get(record).flatMap(entity => entity.places))] : getRowLocations(record, countryIndex)]));
 const places = [...new Set([...placesByRecord.values()].flat())];
 const groups = groupPlacesByContinent(places, countryIndex.flags);
 const months = activitySeries(records, new Map(), 'cards');
 const values = (rows, places) => {
  const byMonth = new Map(activitySeries(scoped(rows, places), ownership, countMetric).map(point => [point.date,point]));
  return months.map(month => ({...month, deal:byMonth.get(month.date)?.deal || 0, grant:byMonth.get(month.date)?.grant || 0, lawsuit:byMonth.get(month.date)?.lawsuit || 0}));
 };
 const totals = (rows, places) => Object.fromEntries(['deal','lawsuit','grant'].map(kind => {
  const matching = scoped(rows, places).filter(record=>timelineDate(record.date) && (record.interaction || []).some(value=>String(value).trim().toLowerCase()===kind));
  const value = metric === 'cards' ? (kind === 'grant' ? uniqueGrantEvents(matching).length : matching.length) : metric === 'reported' ? reportedPublisherEvents(matching).reduce((sum,record)=>sum+record.reported_numbers,0) : timelineSeries(matching,ownership,countMetric).at(-1)?.value || 0;
  return [kind,value];
 }));
 const makeRow = (label, selected, places) => ({label, records:selected, totals:totals(selected, places), values:values(selected, places)});
 const regions = groups.map(group => {
  const allPlaces = new Set([...group.options,...group.implied]);
  const selected = records.filter(record => placesByRecord.get(record).some(place => allPlaces.has(place)));
  return {...makeRow(group.label, selected, allPlaces), countries:group.options.map(place => ({
   ...makeRow(String(place).replace(/^region\s*:/i,'').trim(), records.filter(record=>placesByRecord.get(record).includes(place)), new Set([place])), key:place
  }))};
 });
 const unlocated = records.filter(record=>publisherMetric ? entities.get(record).some(entity=>!entity.places.length) : !placesByRecord.get(record).length);
 if (unlocated.length) regions.push({...makeRow('Unspecified location',unlocated,new Set([null])),countries:[]});
 return {months,regions,total:{key:'__all__',label:'All locations',records,values:values(records),totals:totals(records)},undated:records.filter(record=>!timelineDate(record.date)).length};
}

/** Match a clicked band using the same per-category counting rules as its cell. */
export function matrixCellRecords(records, start, end, kind, metric = 'cards') {
 let matching = records.filter(record => (record.interaction || []).some(value=>String(value).trim().toLowerCase()===kind));
 if (metric === 'reported') matching = reportedPublisherEvents(matching);
 else if (metric === 'cards' && kind === 'grant') matching = uniqueGrantEvents(matching);
 return matching.filter(record => {const date=timelineDate(record.date);return date && date >= start && date <= end;});
}
