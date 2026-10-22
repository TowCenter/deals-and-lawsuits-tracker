<script>
 import { buildLocationMatrix } from './locationMatrix.js';
 let {records = [], data = records, cutoff = $bindable(null), metric = $bindable('cards')} = $props();
 let expanded = $state(new Set());
 const kinds = [{key:'deal',label:'Deals',color:'#2e7d32'}, {key:'lawsuit',label:'Disputes',color:'#8b1a1a'}, {key:'grant',label:'Grants',color:'#1565c0'}];
 const visibleKinds = $derived(metric === 'reported' ? kinds.filter(kind=>kind.key !== 'grant') : kinds);
 const matrix = $derived(buildLocationMatrix(records,data,metric));
 const rows = $derived(matrix.regions.flatMap(region => [
  {...region,key:region.label,continent:true},
  ...(expanded.has(region.label) ? region.countries.map(country=>({...country,key:`${region.label}:${country.key}`,continent:false})) : [])
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
  <button type="button" onclick={() => expanded = expanded.size ? new Set() : new Set(matrix.regions.map(region=>region.label))}>{expanded.size ? 'Collapse countries' : 'Expand countries'}</button>
  <button type="button" disabled={cutoff == null} onclick={() => cutoff=null}>All dates</button>
 </div>
 <div class="legend">{#each visibleKinds as kind}<span style:color={kind.color}>■ {kind.label}</span>{/each}<span>Darker = more activity · shared scale 0–{maximum}</span></div>
 {#if matrix.months.length}
  <div class="matrix" role="table" aria-label="Monthly activity matrix" style:--months={matrix.months.length}>
   <div class="matrix-row month-header" role="row"><span class="place" role="columnheader">Location</span>{#each matrix.months as month}<span class="month" role="columnheader" aria-label={month.label}>{new Date(month.date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}</span>{/each}</div>
   <div class="matrix-row year-header" role="row"><span role="columnheader"></span>{#each years as year}<span role="columnheader" style:grid-column={`span ${year.count}`}>{year.year}</span>{/each}</div>
   {#each rows as row (row.key)}
    <div class="matrix-row" class:continent={row.continent} role="row">
     <div class="place" class:country={!row.continent} role="rowheader">
      {#if row.continent && row.countries.length}<button class="place-toggle" type="button" aria-expanded={expanded.has(row.label)} onclick={()=>toggle(row.label)}>{expanded.has(row.label)?'−':'+'} {row.label}</button>{:else}{row.label}{/if}
     </div>
     {#each row.values as point}
      <div class="cell" class:selected={cutoff != null && point.date <= cutoff && point.end >= cutoff} role="cell">
       <button class="month-cell" type="button" aria-label={`${row.label}, ${point.label}: ${visibleKinds.map(kind=>`${kind.label} ${point[kind.key]}`).join(', ')}. Select month.`} onclick={()=>cutoff=point.end}>
        {#each visibleKinds as kind}<span class="heat" style:background={point[kind.key] ? `color-mix(in srgb, ${kind.color} ${18+82*point[kind.key]/maximum}%, white)` : '#ededed'} style:color={point[kind.key]/maximum > .65 ? 'white' : '#333'}>{point[kind.key] || ''}</span>{/each}
       </button>
      </div>
     {/each}
    </div>
   {/each}
  </div>
  <p>{metric === 'cards' ? 'Monthly records by recorded location; grants count once per grant ID.' : metric === 'reported' ? 'Reported totals, with direct-publisher fallback, for records tied to each location; totals are not apportioned among countries.' : 'Unique publishers per category and month for records tied to each location.'} Expand continents to see countries. Records spanning countries appear in each; continent totals count each record once. {#if matrix.undated}{matrix.undated} undated records excluded.{/if}</p>
 {:else}<p>No dated activity matches these filters.</p>{/if}
</section>
<style>
 .location-matrix { padding:.75rem 1rem; font-family:inherit; color:#333; font-size:.75rem; }
 .matrix-controls,.legend { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
 select,button { font:inherit; padding:.35rem .55rem; border:1px solid #ccc; border-radius:0; background:white; color:#254c6f; cursor:pointer; }
 button:disabled { opacity:.5; cursor:default; }
 button:focus-visible,select:focus-visible { outline:2px solid #DE5A35; outline-offset:1px; }
 .legend { font-size:.65rem; margin:.6rem 0; color:#777; }
 .matrix { width:100%; }
 .matrix-row { display:grid; grid-template-columns:minmax(95px,150px) repeat(var(--months),minmax(0,1fr)); align-items:stretch; }
 .month { writing-mode:vertical-rl; transform:rotate(180deg); font-size:.6rem; padding:.25rem 0; justify-self:center; }
 .year-header { font-size:.65rem; text-align:center; color:#777; margin-bottom:.3rem; }
 .year-header span:not(:first-child) { border-top:1px solid #ccc; border-left:1px solid #ccc; }
 .place { display:flex; align-items:center; overflow-wrap:anywhere; padding:.3rem .3rem .3rem 0; font-size:.7rem; }
 .continent { border-top:1px solid #ddd; background:#f1f1f1; font-weight:500; }
 .country { padding-left:1rem; font-weight:400; color:#555; }
 .place-toggle { border:0; padding:.35rem 0; background:transparent; text-align:left; width:100%; }
 .cell { border-left:1px solid white; border-bottom:1px solid white; display:flex; min-width:0; }
 .cell.selected { outline:1px solid #DE5A35; outline-offset:-1px; }
 .month-cell { border:0; background:transparent; padding:3px 1px; display:flex; flex-direction:column; gap:2px; width:100%; min-width:0; min-height:45px; }
 .heat { display:flex; align-items:center; justify-content:center; flex:1; width:100%; min-height:11px; font-size:.55rem; font-variant-numeric:tabular-nums; font-weight:500; line-height:1; }
 p { color:#777; font-size:.65rem; line-height:1.5; margin:.6rem 0 0; }
 @media(max-width:600px) { .location-matrix {padding:.65rem .5rem;} .matrix-row {grid-template-columns:95px repeat(var(--months),minmax(0,1fr));} .month {font-size:.5rem;} .month-cell {padding:3px 0;} }
</style>
