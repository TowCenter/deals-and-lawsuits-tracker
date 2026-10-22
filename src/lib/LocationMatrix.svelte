<script>
 import { buildLocationMatrix, matrixCellRecords } from './locationMatrix.js';
 let {records = [], data = records, cutoff = $bindable(null), metric = $bindable('cards'), onSelectionChange = () => {}} = $props();
 let legendCategory = $state(null);
 let locationView = $state('countries');
 let sortField = $state(null);
 let sortDirection = $state('desc');
 let sortCategory = $state('all');
 let selectedCell = $state(null);
 let expanded = $state(new Set());
 const kinds = [{key:'deal',label:'Deals',color:'#2e7d32'}, {key:'lawsuit',label:'Disputes',color:'#8b1a1a'}, {key:'grant',label:'Grants',color:'#1565c0'}];
 const availableKinds = $derived(metric === 'reported' ? kinds.filter(kind=>kind.key !== 'grant') : kinds);
 const visibleKinds = $derived(legendCategory && availableKinds.some(kind=>kind.key===legendCategory) ? availableKinds.filter(kind=>kind.key===legendCategory) : availableKinds);
 const matrix = $derived(buildLocationMatrix(records,data,metric));
 function valueForSort(row) {
  const values = sortField === 'total' ? row.totals : row.values.find(point=>point.date===sortField);
  return visibleKinds.filter(kind=>sortCategory==='all' || kind.key===sortCategory).reduce((sum,kind)=>sum+(values?.[kind.key] || 0),0);
 }
 function sorted(items) {
  if (!sortField) return items;
  return [...items].sort((a,b)=> {
   const comparison = sortField === 'location' ? a.label.localeCompare(b.label) : valueForSort(a)-valueForSort(b);
   return (sortDirection==='asc' ? comparison : -comparison) || a.label.localeCompare(b.label);
  });
 }
 function sortBy(field) {
  if(sortField===field)sortDirection=sortDirection==='asc'?'desc':'asc';
  else {sortField=field;sortDirection=field==='location'?'asc':'desc';}
 }
 const arrow = field => sortField === field ? sortDirection === 'asc' ? ' ↑' : ' ↓' : '';
 const countryRows = $derived(matrix.regions.flatMap(region => region.countries.length
  ? region.countries.map(country=>({...country,key:`${region.label}:${country.key}`,continent:false}))
  : [{...region,key:region.label,continent:false}]));
 const rows = $derived(locationView === 'countries' ? sorted(countryRows) : sorted(matrix.regions).flatMap(region => [
  {...region,key:region.label,continent:true},
  ...(expanded.has(region.label) ? sorted(region.countries).map(country=>({...country,key:`${region.label}:${country.key}`,continent:false})) : [])
 ]));
 const maximum = $derived(Math.max(1,...rows.flatMap(row=>row.values.flatMap(point=>visibleKinds.map(kind=>point[kind.key])))));
 const years = $derived.by(() => {
  const result=[];
  for (const month of matrix.months) {
   const year=month.date.slice(0,4);
   if(result.at(-1)?.year===year)result.at(-1).count++;
   else result.push({year,count:1});
  }
  return result;
 });
 const allRows = $derived([matrix.total,...matrix.regions.flatMap(region=>[ {...region,key:region.label}, ...region.countries.map(country=>({...country,key:`${region.label}:${country.key}`})) ])]);
 $effect(() => {
  const row = selectedCell && allRows.find(row=>row.key===selectedCell.rowKey);
  onSelectionChange(row ? {...selectedCell, ids:matrixCellRecords(row.records,selectedCell.start,selectedCell.end,selectedCell.kind,metric).map(record=>record.id)} : null);
 });
 function selectCell(row,point,kind) {
  cutoff=null;
  selectedCell={rowKey:row.key,location:row.label,start:point.date,end:point.end,month:point.label,kind:kind.key,category:kind.label};
 }
 function toggle(key) {
  const next = new Set(expanded);
  if(next.has(key))next.delete(key); else next.add(key);
  expanded=next;
 }
</script>
<section class="location-matrix" aria-label="Activity by continent and country over time">
 <div class="matrix-controls">
  <select aria-label="Chart counts" bind:value={metric}>
   <option value="cards">Cards</option>
   <option value="direct">Publishers — direct</option>
   <option value="descendants">Publishers + children</option>
   <option value="reported">Reported publisher counts</option>
  </select>
  <select aria-label="Group matrix locations" bind:value={locationView}>
   <option value="countries">Countries</option>
   <option value="continents">Continents and countries</option>
  </select>
  <select aria-label="Sort matrix counts by category" bind:value={sortCategory}><option value="all">Sort: all categories</option>{#each visibleKinds as kind}<option value={kind.key}>Sort: {kind.label}</option>{/each}</select>
  {#if locationView === 'continents'}<button type="button" onclick={() => expanded = expanded.size ? new Set() : new Set(matrix.regions.map(region=>region.label))}>{expanded.size ? 'Collapse countries' : 'Expand countries'}</button>{/if}
  <button type="button" disabled={cutoff == null && selectedCell == null} onclick={() => {cutoff=null; selectedCell=null;}}>All dates</button>
 </div>
 {#if selectedCell}<div class="selection-summary" role="status">{selectedCell.location} · {selectedCell.month} · {selectedCell.category}<button type="button" onclick={()=>selectedCell=null}>Clear selection</button></div>{/if}
 <div class="legend" role="group" aria-label="Filter matrix by category">{#each availableKinds as kind}<button type="button" class:legend-muted={legendCategory != null && legendCategory !== kind.key} aria-pressed={legendCategory === kind.key} onclick={()=> {legendCategory=legendCategory===kind.key?null:kind.key; selectedCell=null; sortCategory='all';}} style:color={kind.color}>■ {kind.label}</button>{/each}</div>
 {#if matrix.months.length}
  <div class="matrix" role="table" aria-label="Monthly activity matrix" style:--months={matrix.months.length}>
   <div class="matrix-row month-header" role="row">
    <span class="place" role="columnheader" aria-sort={sortField==='location' ? sortDirection==='asc'?'ascending':'descending' : 'none'}><button class="sort-heading" type="button" onclick={()=>sortBy('location')}>Location{arrow('location')}</button></span>
    {#each matrix.months as month}<span class="month" role="columnheader" aria-sort={sortField===month.date ? sortDirection==='asc'?'ascending':'descending' : 'none'}><button class="sort-heading" type="button" aria-label={`Sort by ${month.label}${arrow(month.date)}`} onclick={()=>sortBy(month.date)}>{new Date(month.date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}{arrow(month.date)}</button></span>{/each}
    <span class="total-heading" role="columnheader" aria-sort={sortField==='total' ? sortDirection==='asc'?'ascending':'descending' : 'none'}><button class="sort-heading" type="button" onclick={()=>sortBy('total')}>Total{arrow('total')}</button></span>
   </div>
   <div class="matrix-row year-header" role="row"><span role="columnheader"></span>{#each years as year}<span role="columnheader" style:grid-column={`span ${year.count}`}>{year.year}</span>{/each}<span role="columnheader"></span></div>
   {#each rows as row (row.key)}
    <div class="matrix-row" class:continent={row.continent} role="row">
     <div class="place" class:country={!row.continent && locationView === 'continents'} role="rowheader">
      {#if row.continent && row.countries.length}<button class="place-toggle" type="button" aria-expanded={expanded.has(row.label)} onclick={()=>toggle(row.label)}>{expanded.has(row.label)?'−':'+'} {row.label}</button>{:else}{row.label}{/if}
     </div>
     {#each row.values as point}
      <div class="cell" role="cell">
        {#each visibleKinds as kind}<button class="heat" class:selected={selectedCell?.rowKey === row.key && selectedCell?.start === point.date && selectedCell?.kind === kind.key} type="button" aria-pressed={selectedCell?.rowKey === row.key && selectedCell?.start === point.date && selectedCell?.kind === kind.key} aria-label={`${row.label}, ${point.label}, ${kind.label}: ${point[kind.key]}. Show matching cards.`} onclick={()=>selectCell(row,point,kind)} style:background={point[kind.key] ? `color-mix(in srgb, ${kind.color} ${18+82*point[kind.key]/maximum}%, white)` : '#ededed'} style:color={point[kind.key]/maximum > .65 ? 'white' : '#333'}>{point[kind.key] || ''}</button>{/each}
      </div>
     {/each}
     <div class="cell row-total" role="cell">
      {#each visibleKinds as kind}<button class="heat" type="button" aria-label={`${row.label}, all months, ${kind.label}: ${row.totals[kind.key]}. Show matching cards.`} onclick={()=>selectCell(row,{date:matrix.months[0].date,end:matrix.months.at(-1).end,label:'All months'},kind)} style:color={kind.color}>{row.totals[kind.key]}</button>{/each}
     </div>
    </div>
   {/each}
   <div class="matrix-row totals-row" role="row">
    <div class="place" role="rowheader">All locations</div>
    {#each matrix.total.values as point}
     <div class="cell" role="cell">{#each visibleKinds as kind}<button class="heat" type="button" style:color={kind.color} aria-label={`All locations, ${point.label}, ${kind.label}: ${point[kind.key]}. Show matching cards.`} onclick={()=>selectCell(matrix.total,point,kind)}>{point[kind.key]}</button>{/each}</div>
    {/each}
    <div class="cell row-total" role="cell">{#each visibleKinds as kind}<button class="heat" type="button" style:color={kind.color} aria-label={`All locations, all months, ${kind.label}: ${matrix.total.totals[kind.key]}. Show matching cards.`} onclick={()=>selectCell(matrix.total,{date:matrix.months[0].date,end:matrix.months.at(-1).end,label:'All months'},kind)}>{matrix.total.totals[kind.key]}</button>{/each}</div>
   </div>
  </div>

 {:else}<p>No dated activity matches these filters.</p>{/if}
</section>
<style>
 .location-matrix { padding:.75rem 1rem; font-family:inherit; color:#333; font-size:.75rem; }
 .selection-summary { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; margin:.5rem 0; color:#254c6f; }
 .matrix-controls,.legend { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
 select,button { font:inherit; padding:.35rem .55rem; border:1px solid #ccc; border-radius:0; background:white; color:#254c6f; cursor:pointer; }
 button:disabled { opacity:.5; cursor:default; }
 button:focus-visible,select:focus-visible { outline:2px solid #DE5A35; outline-offset:1px; }
 .legend { font-size:.65rem; margin:.6rem 0; color:#777; }
 .legend button { padding:.15rem .3rem; border:1px solid transparent; background:transparent; font:inherit; }
 .legend button[aria-pressed="true"] { border-color:currentColor; background:#fff; }
 .legend button.legend-muted { opacity:.4; }
 .matrix { width:100%; }
 .matrix-row { display:grid; grid-template-columns:minmax(95px,150px) repeat(var(--months),minmax(0,1fr)) 42px; align-items:stretch; }
 .sort-heading { border:0; padding:0; background:transparent; color:inherit; font:inherit; cursor:pointer; }
 .sort-heading:hover { color:#DE5A35; }
 .total-heading { font-size:.65rem; align-self:end; text-align:center; }
 .row-total { border-left:1px solid #ccc; background:#f2f2f2; }
 .totals-row { border-top:2px solid #ccc; background:#f2f2f2; font-weight:600; }
 .month { writing-mode:vertical-rl; transform:rotate(180deg); font-size:.6rem; padding:.25rem 0; justify-self:center; }
 .year-header { font-size:.65rem; text-align:center; color:#777; margin-bottom:.3rem; }
 .year-header span:not(:first-child) { border-top:1px solid #ccc; border-left:1px solid #ccc; }
 .place { display:flex; align-items:center; overflow-wrap:anywhere; padding:.3rem .3rem .3rem 0; font-size:.7rem; }
 .continent { border-top:1px solid #ddd; background:#f1f1f1; font-weight:500; }
 .country { padding-left:1rem; font-weight:400; color:#555; }
 .place-toggle { border:0; padding:.35rem 0; background:transparent; text-align:left; width:100%; }
 .cell { border-left:1px solid white; border-bottom:1px solid white; display:flex; flex-direction:column; gap:2px; padding:3px 1px; min-width:0; }
 .heat.selected { outline:1px solid #DE5A35; outline-offset:-1px; }

 .heat { border:0; border-radius:0; padding:0; display:flex; align-items:center; justify-content:center; flex:1; width:100%; min-height:11px; font-size:.55rem; font-variant-numeric:tabular-nums; font-weight:500; line-height:1; }
 p { color:#777; font-size:.65rem; line-height:1.5; margin:.6rem 0 0; }
 @media(max-width:600px) { .location-matrix {padding:.65rem .5rem;} .matrix-row {grid-template-columns:95px repeat(var(--months),minmax(0,1fr)) 42px;} .month {font-size:.5rem;} .cell {padding:3px 0;} }
</style>
