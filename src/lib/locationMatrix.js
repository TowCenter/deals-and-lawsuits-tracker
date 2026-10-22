import { buildCountryIndex, getRowLocations, groupPlacesByContinent } from './utils.js';
import { activitySeries, timelineDate } from './networkTimeline.js';

/** Use explicit record geography; continent totals deduplicate multi-country records. */
export function buildLocationMatrix(records, allData = records) {
 const countryIndex = buildCountryIndex(allData);
 const placesByRecord = new Map(records.map(record => [record, getRowLocations(record, countryIndex)]));
 const places = [...new Set([...placesByRecord.values()].flat())];
 const groups = groupPlacesByContinent(places, countryIndex.flags);
 const months = activitySeries(records, new Map(), 'cards');
 const values = rows => {
  const byMonth = new Map(activitySeries(rows, new Map(), 'cards').map(point => [point.date,point]));
  return months.map(month => ({...month, deal:byMonth.get(month.date)?.deal || 0, grant:byMonth.get(month.date)?.grant || 0, lawsuit:byMonth.get(month.date)?.lawsuit || 0}));
 };
 const regions = groups.map(group => {
  const allPlaces = new Set([...group.options,...group.implied]);
  const selected = records.filter(record => placesByRecord.get(record).some(place => allPlaces.has(place)));
  return {label:group.label, values:values(selected), countries:group.options.map(place => ({key:place,label:String(place).replace(/^region\s*:/i,'').trim(),values:values(records.filter(record=>placesByRecord.get(record).includes(place)))}))};
 });
 const unlocated = records.filter(record=>!placesByRecord.get(record).length);
 if (unlocated.length) regions.push({label:'Unspecified location',values:values(unlocated),countries:[]});
 return {months,regions,undated:records.filter(record=>!timelineDate(record.date)).length};
}
