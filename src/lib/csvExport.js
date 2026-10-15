const common = [['Date','date'],['AI Company','platform'],['News Organization(s)','named_organizations'],['Affected Publications','affected_publications'],['Type','type'],['Reported Details','reported_details'],['Read More','sources'],['Location','location']];
export const exportColumns = {
 deal:[['Interaction','interaction'],['Deal ID','deal_ids'],...common],
 grant:[['Interaction','interaction'],['grant ID','grant_ids'],...common],
 lawsuit:[['Interaction','interaction'],['Lawsuit ID','lawsuit_ids'],['Date','date'],['Defendant','defendant'],['Plaintiff','plaintiff'],['Status','status'],['Case Number','case_number'],['Case Filing','case_filing'],['Docket','docket'],...['number','name','court','docket','docket_url','initiated_date','joined_date','source'].map(field=>[`MDL ${field.replaceAll('_',' ')}`,`mdl_${field}`]),['Location','location'],['Additional Coverage','additional_coverage']],
 collective:[['Interaction','interaction'],['Deal ID','deal_ids'],['Date','date'],['Coalition','collective_name'],['News Organization(s)','named_organizations'],['Affected Publications','affected_publications'],['Reported Details','reported_details'],['Primary Sources','primary_sources']]
};
const typeKey = value => ({deals:'deal',grants:'grant',lawsuits:'lawsuit',collectives:'collective',coalitions:'collective',coalition:'collective'}[String(value).trim().toLowerCase()] || String(value).trim().toLowerCase());
const quote = value => `"${String(Array.isArray(value) ? value.filter(item=>item != null && String(item).trim()).join('; ') : value ?? '').replaceAll('"','""')}"`;
export function buildCsvExports(selected, data = selected) {
 const rows = new Map();
 for (const row of selected) {
  const entries = row.lawsuit_id ? data.filter(entry=>entry.lawsuit_id === row.lawsuit_id) : [row];
  for (const entry of entries) rows.set(entry.id,entry);
 }
 const files=[];
 for (const [type,columns] of Object.entries(exportColumns)) {
  const entries=[...rows.values()].filter(row=>(row.interaction || []).some(value=>typeKey(value) === type)).sort((a,b)=>String(b.date || '').localeCompare(String(a.date || '')));
  if (!entries.length) continue;
  const lines=entries.map(row=>columns.map(([,key])=>{
   let value=row[key];
   if (key === 'plaintiff' && (!value || (Array.isArray(value) && !value.some(item => String(item ?? '').trim())))) value = row.named_organizations?.length ? row.named_organizations : row.organization_publisher_named_in_deal_suit;
   if (key === 'named_organizations') value=value ?? row.organization_publisher_named_in_deal_suit;
   if (key === 'grant_ids') value=value ?? row.grant_id;
   if (key === 'lawsuit_ids') value=value ?? row.lawsuit_id;
   return quote(value);
  }).join(','));
  files.push({filename:`${type === 'collective' ? 'coalitions' : type+'s'}-data.csv`,csv:'\uFEFF'+[columns.map(([label])=>quote(label)).join(','),...lines].join('\r\n')});
 }
 return files;
}
export function downloadCsvExports(selected,data) {
 for (const file of buildCsvExports(selected,data)) {
  const url=URL.createObjectURL(new Blob([file.csv],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');
  link.href=url; link.download=file.filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
}

/** One readable file, with ordered fields and native arrays for multivalue data. */
export function buildJsonExport(selected, data = selected) {
 const rows = new Map();
 for (const row of selected) {
  const entries = row.lawsuit_id ? data.filter(entry => entry.lawsuit_id === row.lawsuit_id) : [row];
  for (const entry of entries) rows.set(entry.id,entry);
 }
 const result = {};
 for (const [type, columns] of Object.entries(exportColumns)) {
  const entries = [...rows.values()].filter(row => (row.interaction || []).some(value => typeKey(value) === type)).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!entries.length) continue;
  result[type === 'collective' ? 'Coalitions' : type.charAt(0).toUpperCase()+type.slice(1)+'s'] = entries.map(row => Object.fromEntries(columns.map(([label,key]) => {
   let value = row[key];
   if (key === 'plaintiff' && (!value || (Array.isArray(value) && !value.some(item => String(item ?? '').trim())))) value = row.named_organizations?.length ? row.named_organizations : row.organization_publisher_named_in_deal_suit;
   if (key === 'named_organizations') value = value ?? row.organization_publisher_named_in_deal_suit;
   if (key === 'grant_ids') value = value ?? row.grant_id;
   if (key === 'lawsuit_ids') value = value ?? row.lawsuit_id;
   if (['deal_ids','grant_ids','lawsuit_ids'].includes(key)) {
    const ids = (Array.isArray(value) ? value : value == null ? [] : [value]);
    value = ids.length ? ids.join('; ') : null;
   }
   return [label,value ?? null];
  })));
 }
 return result;
}
export function downloadJsonExport(selected,data) {
 if (!selected?.length) return;
 const url = URL.createObjectURL(new Blob([JSON.stringify(buildJsonExport(selected,data),null,2)+'\n'],{type:'application/json;charset=utf-8;'}));
 const link = document.createElement('a');
 link.href = url; link.download = 'deals-and-disputes-data.json';
 document.body.appendChild(link); link.click(); link.remove();
 setTimeout(() => URL.revokeObjectURL(url),1000);
}
