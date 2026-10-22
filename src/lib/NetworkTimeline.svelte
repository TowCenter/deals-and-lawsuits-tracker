<script>
 import { timelineDate, activitySeries, timelineSeries, periodAtFraction, cumulativeActivitySeries, uniqueGrantEvents, reportedPublisherEvents } from './networkTimeline.js';
 let { records = [], ownership = new Map(), cutoff = $bindable(null), cumulative = false, metric = $bindable('cards'), smooth = $bindable(false), showControls = true } = $props();
 const interval = 'month';
 const categories = $derived([{key:'deal',label:'Deals',color:'#2e7d32',background:'#c8e6c9',dash:''},{key:'grant',label:'Grants',color:'#1565c0',background:'#bbdefb',dash:'4 2'},{key:'lawsuit',label:'Lawsuits',color:'#8b1a1a',background:'#f5c2c2',dash:'1 2'}].filter(category => (!cumulative && metric !== 'reported') || category.key !== 'grant'));
 let hovered = $state(null);
 let plot = $state();
 let chartWidth = $state(640);
 const denseLabels = $derived((chartWidth - 44) / Math.max(1, series.length) < 26);
 const series = $derived(cumulative ? cumulativeActivitySeries(records, ownership, metric, interval) : activitySeries(records, ownership, metric, interval));
 const averages = $derived(activitySeries(records, ownership, metric, interval, true));
 const dates = $derived([...new Set(records.map(record => timelineDate(record.date)).filter(Boolean))].sort());
 const unknown = $derived(records.filter(record => !timelineDate(record.date)).length);
 const day = 86400000;
 const sliderMonths = $derived(activitySeries(records, ownership, 'cards', 'month'));
 const selected = $derived(cutoff == null ? sliderMonths.length : Math.max(0, sliderMonths.findLastIndex(month => month.date <= cutoff)));
 const maximum = $derived(Math.max(1, ...series.flatMap(point => categories.map(kind => point[kind.key]))));
 const start = $derived(dates.length ? Date.parse(series[0].date) : 0);
 const span = $derived(dates.length ? Math.max(86400000, Date.parse(series.at(-1).end) - start + day) : 1);
 const x = date => (Date.parse(date) - start) / span * 640;
 const y = value => 22 - value / maximum * 18;
 const path = key => averages.map((point,i) => `${i ? 'L' : 'M'}${x(point.date)},${y(point[key])}`).join(' ');
 const axisTicks = $derived(series.map(point => ({
  date:point.date, end:point.end,
  position: (x(point.date) + x(new Date(Date.parse(point.end) + day).toISOString().slice(0,10))) / 2,
  month: interval === 'quarter' ? `Q${Math.floor((Number(point.date.slice(5,7))-1)/3) + 1}` : new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-US', {month:'short',timeZone:'UTC'}),
  year: point.date.slice(0,4)
 })));
 const yearGroups = $derived.by(() => {
  const groups = [];
  for (const point of series) {
   const year = point.date.slice(0,4);
   const end = x(new Date(Date.parse(point.end) + day).toISOString().slice(0,10));
   const previous = groups.at(-1);
   if (previous?.year === year) previous.end = end;
   else groups.push({year, start:x(point.date), end});
  }
  return groups;
 });
 const number = value => Number((value || 0).toFixed(1));
 const active = $derived(cutoff == null ? series.at(-1) : series.findLast(point => point.date <= cutoff));
 const inspected = $derived(hovered == null ? active : series[hovered]);
 const totals = $derived(Object.fromEntries(categories.map(category => {
   const matching = records.filter(record => (record.interaction || []).some(kind => String(kind).trim().toLowerCase() === category.key));
   return [category.key, metric === 'reported' ? reportedPublisherEvents(matching).reduce((sum,record) => sum + record.reported_numbers,0) : metric === 'cards' ? category.key === 'grant' ? uniqueGrantEvents(matching).length : matching.length : timelineSeries(matching.map(record => ({...record, date:'2000-01-01'})), ownership, metric).at(-1)?.value || 0];
  })));
 const showingTotals = $derived(cutoff == null && hovered == null);
 const displayedCounts = $derived(showingTotals ? totals : inspected);
 function inspect(event) {
  const bounds = plot.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left - 32) / Math.max(1,bounds.width - 44)));
  const date = new Date(start + fraction * span).toISOString().slice(0,10);
  hovered = Math.max(0, series.findLastIndex(point => point.date <= date));
 }
 const label = $derived(metric === 'reported' ? 'Reported publisher counts' : metric === 'cards' ? 'Cards' : 'Unique publishers');
 function selectPointerMonth(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const index = periodAtFraction(sliderMonths, (event.clientX - bounds.left) / Math.max(1,bounds.width));
  if (index >= 0) cutoff = sliderMonths[index].end;
 }
 function beginMonthSelection(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.currentTarget.focus();
  event.currentTarget.setPointerCapture(event.pointerId);
  selectPointerMonth(event);
 }
 function update(event) {
  const index = Number(event.currentTarget.value);
  cutoff = index >= sliderMonths.length ? null : sliderMonths[index].end;
 }
</script>

<section class="timeline" style="--plot-height:72px" aria-label="Visualization timeline">
 {#if showControls}
 <div class="controls">
  <label>
   <select aria-label="Chart counts" bind:value={metric}>
    <option value="cards">Cards</option>
    <option value="direct">Publishers — direct</option>
    <option value="descendants">Publishers + children</option>
    <option value="reported">Reported publisher counts</option>
   </select>
  </label>
  {#if !cumulative}<label title="Trailing three-month average; initial periods use available months"><input type="checkbox" bind:checked={smooth} disabled={interval !== 'month'} />3-mo avg</label>{/if}
  <button type="button" onclick={() => cutoff = null} disabled={cutoff == null}>All dates</button>
 </div>
 {/if}
 {#if metric === 'reported'}<p class="reported-note">Uses Reported Numbers when available; otherwise direct publisher counts. Counts may overlap across records.</p>{/if}
 {#if series.length}
  <div class="readout" aria-live="polite" aria-label={showingTotals ? 'Totals across filtered records' : `${cumulative ? 'Running totals through' : 'Activity for'} ${inspected?.label}`} title={showingTotals ? 'Totals across filtered records, including undated records; publishers counted once per category' : `${cumulative ? 'Running totals through' : 'Counts for'} ${inspected?.label}`}>{#each categories as category}<span class="category-stat" style:color={category.color} style:background-color={category.background}>{category.label} {number(displayedCounts?.[category.key])}</span>{/each}</div>
  <div class="chart-scroll">
  <div class="chart-canvas" bind:clientWidth={chartWidth}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="plot" bind:this={plot} onpointermove={inspect} onpointerleave={() => hovered = null}>
   <div class="chart-row">
    <div class="y-axis" aria-hidden="true"><span>{number(maximum)}</span><span>0</span></div>
    <svg preserveAspectRatio="none" viewBox="0 0 640 24" role="img" aria-label={`${cumulative ? 'Cumulative line' : 'Grouped bar'} chart: ${label.toLowerCase()} ${cumulative ? 'through each' : 'per'} ${interval}, comparing ${cumulative ? 'deals and lawsuits' : 'deals, grants and lawsuits'} on a shared scale 0 to ${number(maximum)}`}>
     <line x1="0" y1="4" x2="640" y2="4" stroke="#eee" />
     <line x1="0" y1="22" x2="640" y2="22" stroke="#ccc" />
     {#each series as point, periodIndex}
      {@const width = Math.max(1, x(new Date(Date.parse(point.end) + day).toISOString().slice(0,10)) - x(point.date))}
      <rect x={x(point.date)} y="0" width={width} height="24" fill={cutoff != null && point.date <= cutoff && point.end >= cutoff ? '#fbece6' : periodIndex % 2 ? '#254c6f06' : 'transparent'} />
      <line x1={x(point.date)} x2={x(point.date)} y1="0" y2="24" stroke="#ddd" stroke-width=".5" vector-effect="non-scaling-stroke" />
      {#if !cumulative}
      {#each categories as category, index}
       <rect x={x(point.date) + width * (.12 + index * (.76 / categories.length))} y={y(point[category.key])} width={width * (.68 / categories.length)} height={22-y(point[category.key])} fill={category.color} opacity={cutoff != null && !(point.date <= cutoff && point.end >= cutoff) ? .3 : !cumulative && smooth && interval === 'month' ? .55 : 1} />
      {/each}
      {/if}
     {/each}
     {#if cumulative}
      {#each categories as category}
       <path d={series.map((point,index) => `${index ? 'L' : 'M'}${(x(point.date)+x(new Date(Date.parse(point.end)+day).toISOString().slice(0,10)))/2},${y(point[category.key])}`).join(' ')} fill="none" stroke={category.color} stroke-width="2" vector-effect="non-scaling-stroke" />
       {#if active}<circle cx={(x(active.date)+x(new Date(Date.parse(active.end)+day).toISOString().slice(0,10)))/2} cy={y(active[category.key])} r="1.2" fill={category.color} />{/if}
      {/each}
     {/if}
     {#if !cumulative && smooth && interval === 'month'}
      {#each categories as category}<path d={path(category.key)} fill="none" stroke={category.color} stroke-width="1.5" vector-effect="non-scaling-stroke" />{/each}
     {/if}
    </svg>
   </div>
   <input class="chart-slider" type="range" min="0" max={sliderMonths.length} step="1" value={selected} oninput={update} onpointerdown={beginMonthSelection} onpointermove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) selectPointerMonth(event); }} aria-label="Show records through date" aria-valuetext={cutoff ? `Through ${sliderMonths[selected]?.label || cutoff}, end of month` : 'All dates, including undated records'} />
  </div>
  <div class="date-axis" class:dense={denseLabels} aria-label="Activity dates">
   {#each axisTicks as tick}<button type="button" class="axis-tick" onclick={() => cutoff = tick.end} aria-label={`Select ${tick.month} ${tick.year}`} class:selected-month={cutoff != null && series[axisTicks.indexOf(tick)]?.date <= cutoff && series[axisTicks.indexOf(tick)]?.end >= cutoff} style:left={`${tick.position/640*100}%`}><span>{tick.month}</span></button>{/each}
   <div class="year-axis" aria-label="Years">
    {#each yearGroups as group}<span class="year-group" style:left={`${group.start/640*100}%`} style:width={`${(group.end-group.start)/640*100}%`}>{group.year}</span>{/each}
   </div>
  </div>
  </div>
  </div>

 {:else}
  <p>No dated cards in this view.{#if unknown} {unknown} undated cards available at All dates.{/if}</p>
 {/if}
</section>

<style>
 .timeline { flex:none; padding:.75rem 1rem; border:1px solid #e0e0e0; background:#fafafa; font-family:inherit; color:#333; font-size:.75rem; line-height:1.4; }
 .controls { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
 label { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; }
 select,button { font:inherit; padding:.35rem .55rem; max-width:100%; border:1px solid #ccc; border-radius:0; background:#fff; color:#333; line-height:1.2; }
 select { cursor:pointer; }
 select:hover,button:hover:not(:disabled) { border-color:#999; }
 button { color:#254c6f; }
 select:focus-visible,button:focus-visible { outline:2px solid #DE5A35; outline-offset:2px; }
 label input { width:13px; height:13px; margin:0; accent-color:#DE5A35; }
 .category-stat { padding:.2rem .5rem; border-radius:3px; font-size:.65rem; font-weight:500; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; }
 button { cursor:pointer; } button:disabled { opacity:.5; cursor:default; }
 svg { display:block; width:100%; min-width:0; height:72px; }
 .chart-row { display:flex; align-items:center; padding-right:12px; }
 .y-axis { flex:0 0 32px; height:54px; display:flex; flex-direction:column; justify-content:space-between; font-size:.6rem; color:#777; padding-right:6px; box-sizing:border-box; text-align:right; }
 .date-axis { position:relative; margin-left:32px; margin-right:12px; height:56px; font-size:.65rem; color:#777; }
 .axis-tick { padding:0; border:0; border-radius:0; background:transparent; color:inherit; font:inherit; position:absolute; top:3px; white-space:nowrap; text-align:center; writing-mode:vertical-rl; transform:translateX(-50%) rotate(180deg); line-height:1.3; }
 .chart-scroll { overflow:hidden; }
 .date-axis.dense { height:56px; }
 .dense .axis-tick { transform:translateX(-50%) rotate(180deg); font-size:.6rem; }
 .year-axis { position:absolute; left:0; right:0; bottom:0; height:19px; }
 .year-group { position:absolute; text-align:center; border-top:1px solid #ccc; padding-top:3px; box-sizing:border-box; font-size:.65rem; font-weight:500; color:#555; }
 .year-group + .year-group { border-left:1px solid #ccc; }
 .axis-tick.selected-month { color:#9c3e23; font-weight:600; background:#fbece6; }
 .chart-canvas { width:100%; min-width:0; }
 .axis-tick::before { content:""; position:absolute; left:50%; top:-5px; height:4px; border-left:1px solid #aaa; }
 .readout { display:flex; gap:.4rem; flex-wrap:wrap; color:#666; font-size:.65rem; margin:.6rem 0 .3rem; }
 .plot { position:relative; }
 .plot:has(.chart-slider:focus-visible) { outline:2px solid #DE5A35; outline-offset:2px; }
 .chart-slider { appearance:none; -webkit-appearance:none; position:absolute; left:32px; top:0; width:calc(100% - 44px); height:var(--plot-height); margin:0; background:transparent; cursor:pointer; }
 .chart-slider:focus { outline:none; }
 .chart-slider::-webkit-slider-runnable-track { background:transparent; height:var(--plot-height); }
 .chart-slider::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:10px; height:8px; background:#DE5A35; border:0; border-radius:0; opacity:0; }
 .chart-slider:hover::-webkit-slider-thumb { background:#b34426; }
 .chart-slider:focus-visible::-webkit-slider-thumb { background:#DE5A35; }
 .chart-slider::-moz-range-track { background:transparent; }
 .chart-slider::-moz-range-thumb { width:10px; height:8px; background:#DE5A35; border:0; border-radius:0; opacity:0; }
 .chart-slider:hover::-moz-range-thumb { background:#b34426; }
 .chart-slider:focus-visible::-moz-range-thumb { background:#DE5A35; }
 p { margin:.25rem 0 0; color:#555; font-size:.68rem; }
</style>
