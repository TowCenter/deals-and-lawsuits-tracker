<script>
 import { isMdlConsolidation } from './mdl.js';
 import { onMount } from 'svelte';
 import { formatDate } from './utils.js';
 import { publisherNames as names, normalizeName as normalize, buildOwnershipGraph, ownershipFamily, layoutOwnership, layoutCirclePacking, routeCircleConnection } from './publisherNetwork.js';
 let { row, data, onclose, recordCard } = $props();
 let selectedRecord = $state(null);
 let selectedOrigin = $state(true);
 let selectedPlatform = $state(null);
 let selectedPublisher = $state(null);
 const panelRecords = $derived(selectedPublisher ? entries.filter(entry => connectionNodes(entry).some(node => node.key === selectedPublisher)) : selectedPlatform ? entries.filter(entry => entry.companies.includes(selectedPlatform)) : selectedRecord ? [selectedRecord] : []);
 let expanded = $state(false);
 let dialog;
 let mapViewport;
 let viewportWidth = $state(1100);
 let viewportHeight = $state(460);
 let cameraZoom = $state(1);
 let cameraX = $state(0);
 let cameraY = $state(0);
 let panGesture = null;
 function resetCamera() {
  cameraZoom = 1;
  cameraX = (viewportWidth - graphBounds.width * mapScale) / 2 - graphBounds.left * mapScale;
  cameraY = (viewportHeight - graphBounds.height * mapScale) / 2 - graphBounds.top * mapScale;
 }
 function zoomAt(factor, x = viewportWidth / 2, y = viewportHeight / 2) {
  const next = Math.max(.6, Math.min(6, cameraZoom * factor));
  const ratio = next / cameraZoom;
  cameraX = x - (x - cameraX) * ratio;
  cameraY = y - (y - cameraY) * ratio;
  cameraZoom = next;
 }
 function focusCamera(node) {
  cameraZoom = Math.min(6, Math.max(1, Math.min(viewportWidth, viewportHeight) / (node.r * 2 * mapScale + 80)));
  cameraX = viewportWidth / 2 - (node.x + node.r) * mapScale * cameraZoom;
  cameraY = viewportHeight / 2 - (node.y + node.r) * mapScale * cameraZoom;
 }
 const publishers = $derived(names(row));

 const namedPublishers = $derived(row.organization_publisher_named_in_deal_suit?.length ? row.organization_publisher_named_in_deal_suit : publishers);
 const networkTitle = $derived(namedPublishers.length === 1 ? namedPublishers[0] : namedPublishers.slice(0, 3).join(', ') + (namedPublishers.length > 3 ? ` + ${namedPublishers.length - 3} more` : ''));
 const recordContext = $derived(`${(row.interaction || []).join(' / ')} · ${(row.platform?.length ? row.platform : row.defendant || []).join(', ')} · ${formatDate(row.date)}`);
 const ownership = $derived(buildOwnershipGraph(data));
 const family = $derived(new Set(publishers.flatMap(name => [...ownershipFamily(ownership, name)])));
 const relevantRecordIds = $derived(new Set(data.filter(record => !isMdlConsolidation(record) && names(record).some(name => family.has(normalize(name)))).map(record => record.id)));
 const hierarchy = $derived(layoutOwnership(ownership, family));
 const ownershipLinks = $derived.by(() => {
  const keys = new Set(hierarchy.nodes.map(node => node.key));
  return hierarchy.nodes.flatMap(node => [...(ownership.get(node.key)?.children || [])]
   .filter(key => keys.has(key)).map(key => [node.key, key]));
 });
 let platformPositions = $state(new Map());
 let draggingPlatform = null;
 let suppressPlatformClick = false;
 function startPlatformDrag(event, company) {
  if (event.button !== 0) return;
  const node = platformNodes.get(company);
  draggingPlatform = {company, startX:event.clientX, startY:event.clientY, x:node.x, y:node.y, moved:false};
 }
 const graphNodes = $derived(layoutCirclePacking(hierarchy.nodes, ownershipLinks, graphWidth, height, companies).map(node => {
  const position = platformPositions.get(node.name);
  return node.key.startsWith('platform:') && position ? {...node, x:Math.max(0, Math.min(graphWidth-node.width,position.x)), y:Math.max(0,Math.min(height-node.height,position.y))} : node;
 }));
 const displayNodes = $derived(graphNodes.filter(node => !node.key.startsWith('platform:')));
 const visibleLabels = $derived.by(() => {
  const scale = mapScale * cameraZoom;
  const candidates = graphNodes.filter(node => !node.key.startsWith('platform:')).sort((a,b) => {
   const priority = node => node.key === hoveredPublisher ? 3 : node.depth === 0 || node.width*scale >= 130 ? 2 : 1;
   return priority(b)-priority(a) || b.r-a.r || a.key.localeCompare(b.key);
  });
  const labels = [], boxes = [];
  for (const node of candidates) {
   const font = 14 / scale;
   const width = Math.min(node.name.length * font * .58 + font, 180 / scale);
   const lineCount = Math.max(1, Math.ceil(node.name.length * font * .58 / width));
   const height = font * 1.4 * lineCount;
   let x = node.x+node.r;
   x = Math.max(width/2+8/scale, Math.min(graphWidth-width/2-8/scale,x));
   const y = node.hasChildren ? node.y+(node.labelInset||0) : node.y+node.r;
   const box={left:x-width/2-5/scale,right:x+width/2+5/scale,top:y-height/2-4/scale,bottom:y+height/2+4/scale};
   if (boxes.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top)) continue;
   boxes.push(box);
   labels.push({node,x,y,font,width});
  }
  return labels;
 });
 const platformNodes = $derived(new Map(graphNodes.filter(node => node.key.startsWith('platform:')).map(node => [node.name,node])));
 const nodeByName = $derived(new Map(displayNodes.map(node => [node.key,node])));
 let hoveredConnection = $state(null);
 let selectedConnection = $state(null);
 function selectConnection(connection) { selectedOrigin = false; selectedPublisher = null; selectedPlatform = null; selectedConnection = connection; selectedRecord = connection.entry; }
 function clearSelection() { selectedOrigin = false; selectedRecord = null; selectedPublisher = null; selectedPlatform = null; selectedConnection = null; hoveredConnection = null; hoveredPublisher = null; hoveredPlatform = null; }
 let hoveredPublisher = $state(null);
 let hoveredPlatform = $state(null);
 function activeConnection(entry, node = null, company = null) {
  if (hoveredPlatform != null) return company === hoveredPlatform;
  if (hoveredPublisher != null) return node ? node.key === hoveredPublisher : connectionNodes(entry).some(node => node.key === hoveredPublisher);
  if (hoveredConnection != null) return entry.id === hoveredConnection.entry.id;
  if (selectedPublisher != null) return node?.key === selectedPublisher;
  if (selectedPlatform != null) return company === selectedPlatform;
  if (selectedConnection != null) return entry.id === selectedConnection.entry.id;
  if (selectedOrigin) return entry.id === row.id || Boolean(row.lawsuit_id && entry.lawsuit_id === row.lawsuit_id);
  return false;
 }
 const highlighting = $derived(selectedOrigin || selectedPublisher != null || selectedPlatform != null || selectedConnection != null || hoveredPublisher != null || hoveredPlatform != null || hoveredConnection != null);
 function connectionNodes(entry) {
  const direct = (entry.organization_publisher_named_in_deal_suit || []).map(normalize);
  return [...new Set(direct)].map(key => nodeByName.get(key)).filter(Boolean);
 }
 const entries = $derived.by(() => {
  const groups = new Map();
  for (const item of data) {
   if (isMdlConsolidation(item)) continue;
   if (!relevantRecordIds.has(item.id)) continue;
   const key = item.lawsuit_id ? `case:${item.lawsuit_id}` : `entry:${item.id}`;
   const existing = groups.get(key);
   if (!existing) groups.set(key, { ...item, companies: [...new Set([...(item.platform || []), ...(item.defendant || [])])] });
   else {
    const companies = [...new Set([...existing.companies, ...(item.platform || []), ...(item.defendant || [])])];
    groups.set(key, { ...(String(item.date || '') > String(existing.date || '') ? item : existing), companies });
   }
  }
  return [...groups.values()].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
 });
 const companies = $derived([...new Set(entries
  .filter(entry => (entry.organization_publisher_named_in_deal_suit || []).some(name => family.has(normalize(name))))
  .flatMap(entry => entry.companies))]);
 const height = $derived(Math.max(650, Math.sqrt(hierarchy.nodes.length + companies.length) * 130));
 const platformRadius = $derived(Math.max(80, ...companies.map(name => name.length * 13 * .58 / 1.8 + 14)));
 const platformColumns = $derived(Math.max(1, Math.ceil(companies.length * (platformRadius * 2 + 24) / Math.max(1,height - 32))));
 const graphWidth = $derived(Math.max(1000, (platformColumns * (platformRadius * 2 + 24) + 64) / .5, height * Math.max(1.25, viewportWidth / Math.max(1, viewportHeight))));
 const graphBounds = $derived.by(() => {
  if (!graphNodes.length) return {left:0,top:0,width:graphWidth,height};
  const left=Math.min(...graphNodes.map(node=>node.x))-40;
  const top=Math.min(...graphNodes.map(node=>node.y))-40;
  const right=Math.max(...graphNodes.map(node=>node.x+node.width))+40;
  const bottom=Math.max(...graphNodes.map(node=>node.y+node.height))+40;
  return {left,top,width:right-left,height:bottom-top};
 });
 const mapScale = $derived(Math.min(viewportWidth / graphBounds.width, viewportHeight / graphBounds.height));
 const connections = $derived(entries.flatMap(entry => connectionNodes(entry).flatMap(node => entry.companies.filter(company => companies.includes(company)).map(company => ({entry,node,company})))));
 const drawnConnections = $derived.by(() => {
  const groups = new Map();
  for (const connection of connections) {
   const key = JSON.stringify([connection.node.key,connection.company,kind(connection.entry)]);
   const existing = groups.get(key);
   if (!existing || (!activeConnection(existing.entry,existing.node,existing.company) && activeConnection(connection.entry,connection.node,connection.company))) groups.set(key,connection);
  }
  return [...groups.values()].sort((a,b) => Number(activeConnection(a.entry,a.node,a.company)) - Number(activeConnection(b.entry,b.node,b.company)));
 });
 const highlightedPublishers = $derived.by(() => {
  const keys = new Set(connections.filter(link => activeConnection(link.entry, link.node, link.company)).map(link => link.node.key));
  if (hoveredPublisher) keys.add(hoveredPublisher);
  else if (selectedPublisher) keys.add(selectedPublisher);
  return keys;
 });
 const outlinedDescendants = $derived.by(() => {
  const descendants = new Set();
  const roots = selectedPublisher ? [selectedPublisher] : [...highlightedPublishers];
  const pending = roots.flatMap(key => [...(ownership.get(key)?.children || [])]);
  while (pending.length) {
   const key = pending.pop();
   if (descendants.has(key)) continue;
   descendants.add(key); pending.push(...(ownership.get(key)?.children || []));
  }
  return descendants;
 });
 const highlightedCompanies = $derived(new Set(connections.filter(link => activeConnection(link.entry, link.node, link.company)).map(link => link.company)));
 const routeCache = new WeakMap();
 const routedPaths = $derived.by(() => {
  const paths = new Map();
  let shared = routeCache.get(graphNodes);
  if (!shared) { shared = new Map(); routeCache.set(graphNodes, shared); }
  for (const connection of connections) {
   const key = JSON.stringify([connection.node.key,connection.company]);
   if (!shared.has(key)) {
    const target = platformNodes.get(connection.company);
    const corridor = {x:target.x - 96, y:target.y + target.r};
    shared.set(key, routeCircleConnection(connection.node, target, graphNodes, graphWidth, height, false, corridor));
   }
   paths.set(connection, shared.get(key));
  }
  return paths;
 });
 function curve(connection) { return routedPaths.get(connection) || ''; }
 const kinds = entry => (entry.interaction || []).map(value => String(value).toLowerCase());
 const kind = entry => kinds(entry).some(v => v.includes('lawsuit')) ? 'lawsuit' : kinds(entry).some(v => v.includes('grant')) ? 'grant' : 'deal';
 onMount(() => {
  dialog.showModal();
  const initialFitFrame = requestAnimationFrame(resetCamera);
  const movePlatform = event => {
   if (panGesture) {
    cameraX = panGesture.x + event.clientX - panGesture.startX;
    cameraY = panGesture.y + event.clientY - panGesture.startY;
    return;
   }
   if (!draggingPlatform) return;
   const dx = event.clientX - draggingPlatform.startX, dy = event.clientY - draggingPlatform.startY;
   if (Math.hypot(dx,dy) > 4) draggingPlatform.moved = true;
   if (!draggingPlatform.moved) return;
   platformPositions = new Map(platformPositions).set(draggingPlatform.company, {x:draggingPlatform.x+dx/(mapScale*cameraZoom),y:draggingPlatform.y+dy/(mapScale*cameraZoom)});
  };
  let clickResetTimer;
  const stopDragging = () => {
   panGesture = null;
   suppressPlatformClick = Boolean(draggingPlatform?.moved);
   draggingPlatform = null;
   clearTimeout(clickResetTimer);
   clickResetTimer = setTimeout(() => suppressPlatformClick = false, 0);
  };
  window.addEventListener('pointermove', movePlatform);
  window.addEventListener('pointerup', stopDragging);

  let fitFrame = 0;
  const observer = new ResizeObserver(() => {
   const width = mapViewport.clientWidth, height = mapViewport.clientHeight;
   if (width > 0 && Math.abs(width - viewportWidth) >= 1) viewportWidth = width;
   if (height > 0 && Math.abs(height - viewportHeight) >= 1) viewportHeight = height;
   if (fitFrame) cancelAnimationFrame(fitFrame);
   fitFrame = requestAnimationFrame(resetCamera);
  });
  observer.observe(mapViewport);
  return () => {
   cancelAnimationFrame(initialFitFrame);
   cancelAnimationFrame(fitFrame);
   clearTimeout(clickResetTimer);
   observer.disconnect();
   window.removeEventListener('pointermove', movePlatform);
   window.removeEventListener('pointerup', stopDragging);
   dialog.close();
  };
 });
</script>

<dialog class:expanded bind:this={dialog} onclose={onclose} onclick={event => { if (event.target === dialog) dialog.close(); else if (event.target instanceof Element && event.target.closest('.scroll') && !event.target.closest('g, button, .ownership-node, .company-node')) clearSelection(); }} onkeydown={event => { if (event.key === 'Escape') event.stopPropagation(); }} aria-label="Publisher network map">
 <header><div class="network-heading"><h2 title={namedPublishers.join(', ')}>{networkTitle}</h2><p class="record-context">{recordContext}</p></div><div class="window-controls"><button class="resize" onclick={() => expanded = !expanded} aria-label={expanded ? "Restore popup size" : "Expand popup"} aria-pressed={expanded}>{expanded ? "Restore" : "Expand"}</button><button class="close" onclick={() => dialog.close()} aria-label="Close network map">×</button></div></header>


 <div class="legend"><span class="interaction-tag lawsuit">Lawsuit</span><span class="interaction-tag deal">Deal</span><span class="interaction-tag grant">Grant</span></div>

 <div class="network-content" class:has-selection={panelRecords.length > 0}>
 <div class="scroll" bind:this={mapViewport} onwheel={event => { event.preventDefault(); const bounds = mapViewport.getBoundingClientRect(); zoomAt(event.deltaY < 0 ? 1.12 : 1/1.12, event.clientX-bounds.left, event.clientY-bounds.top); }} onpointerdown={event => { if (event.button === 0 && !event.target.closest('button, g, .ownership-node, .company-node')) { panGesture = {startX:event.clientX,startY:event.clientY,x:cameraX,y:cameraY}; event.preventDefault(); } }}><div class="scaled-area" style:width="{graphWidth * mapScale}px" style:height="{height * mapScale}px"><div class="map" style:width="{graphWidth}px" style:height="{height}px" style:transform="translate({cameraX}px, {cameraY}px) scale({mapScale * cameraZoom})">
 
 <svg width={graphWidth} {height} aria-label="Publisher connections">
  <defs>
   <marker id="lawsuit-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#b4232d" />
   </marker>
   <marker id="lawsuit-arrow-muted" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#f4dee0" />
   </marker>
  </defs>
  {#each drawnConnections as connection}
   <g role="button" tabindex="0" aria-label={`${connection.node.name} — ${connection.entry.interaction.join(' / ')} — ${connection.company}, ${formatDate(connection.entry.date)}`} onpointerenter={() => hoveredConnection = connection} onpointerleave={() => hoveredConnection = null} onfocus={() => hoveredConnection = connection} onblur={() => hoveredConnection = null} onclick={() => selectConnection(connection)} onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectConnection(connection); } }}>
    <path class="hit-area" d={curve(connection)} />
    <path marker-end={kind(connection.entry) === 'lawsuit' ? `url(#${highlighting && !activeConnection(connection.entry, connection.node, connection.company) ? 'lawsuit-arrow-muted' : 'lawsuit-arrow'})` : undefined} class={kind(connection.entry)} class:highlighted={activeConnection(connection.entry, connection.node, connection.company)} class:muted={highlighting && !activeConnection(connection.entry, connection.node, connection.company)} d={curve(connection)} />
   </g>
  {/each}
 </svg>
 {#each displayNodes as node (node.key)}
  <div onpointerenter={() => hoveredPublisher = node.key} onpointerleave={() => { hoveredPublisher = null; }} class="ownership-node" class:muted-node={highlighting && !highlightedPublishers.has(node.key)} class:connected-node={highlighting && highlightedPublishers.has(node.key)} class:outlined-descendant={highlighting && outlinedDescendants.has(node.key) && !highlightedPublishers.has(node.key)}  style:left="{node.x}px" style:top="{node.y}px" style:width="{node.width}px" style:height="{node.height}px" style:z-index={10 + node.depth * 2} class:parent-circle={node.hasChildren} class:alt={node.depth % 2}><button class="publisher-name" aria-label={node.name} ondblclick={() => focusCamera(node)} onclick={() => { clearSelection(); selectedPublisher = node.key; }} onfocus={() => hoveredPublisher = node.key} onblur={() => hoveredPublisher = null} >{node.name}</button></div>
 {/each}
 {#each visibleLabels as label (label.node.key)}
  <div class="floating-node-label" class:muted-label={highlighting && !highlightedPublishers.has(label.node.key)} style:left="{label.x}px" style:top="{label.y}px" style:font-size="{label.font}px" style:width="{label.width}px">{label.node.name}</div>
 {/each}
 {#each companies as company (company)}<div class="company-node" class:muted-node={highlighting && !highlightedCompanies.has(company)} class:connected-node={highlighting && highlightedCompanies.has(company)} style:left="{platformNodes.get(company).x}px" style:top="{platformNodes.get(company).y}px" style:width="{platformNodes.get(company).width}px" style:height="{platformNodes.get(company).height}px"><button class="platform-name" aria-label={company} ondblclick={() => focusCamera(platformNodes.get(company))} onpointerdown={event => startPlatformDrag(event, company)} onclick={() => { if (suppressPlatformClick) return; clearSelection(); selectedPlatform = company; }} onpointerenter={() => hoveredPlatform = company} onpointerleave={() => { hoveredPlatform = null; }} onfocus={() => hoveredPlatform = company} onblur={() => hoveredPlatform = null} >{company}</button></div>{/each}
 {#each companies as company (company)}
  {@const platform = platformNodes.get(company)}
  <div class="floating-node-label platform-label" class:muted-label={highlighting && !highlightedCompanies.has(company)} style:left="{platform.x + platform.r}px" style:top="{platform.y + platform.r}px" style:font-size="{14 / (mapScale * cameraZoom)}px" style:width="{180 / (mapScale * cameraZoom)}px">{company}</div>
 {/each}
 </div></div></div>

 {#if panelRecords.length}
  <section class="selected-record" aria-label="Selected record" aria-live="polite">
   {@render recordCard(panelRecords, selectedPlatform == null && selectedPublisher == null)}
  </section>
 {/if}
 </div>
 {#if !entries.length}<p>No connected records found for this publisher.</p>{/if}
</dialog>

<style>
 dialog { width:calc(100vw - 32px); max-width:1600px; max-height:95dvh; padding:1.5rem; border:1px solid #ddd; background:#fff; color:#111; box-sizing:border-box; font:inherit; box-shadow:0 8px 24px #0002; }
 dialog.expanded { width:calc(100vw - 16px); height:calc(100dvh - 16px); max-width:none; max-height:none; margin:auto; }
 dialog::backdrop { background:#14182048; }
 header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.75rem; }
 .network-heading { min-width:0; }
 h2 { margin:0; font-size:1.4rem; line-height:1.25; font-weight:650; }
 .record-context { margin:.4rem 0 0; font-size:.8rem; color:#555; }
 .window-controls { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }
 .resize { font:inherit; font-size:.75rem; border:1px solid #ddd; background:#fff; color:#254c6f; padding:.25rem .6rem; cursor:pointer; }
 .close { border:0; background:none; font-size:1.2rem; cursor:pointer; }
 .legend { display:flex; gap:.4rem; margin-bottom:.65rem; }
 .interaction-tag { padding:.2rem .5rem; border-radius:3px; font-size:.65rem; text-transform:uppercase; letter-spacing:.5px; }
 .interaction-tag.lawsuit { background:#f5c2c2; color:#8b1a1a; }
 .interaction-tag.deal { background:#c8e6c9; color:#2e7d32; }
 .interaction-tag.grant { background:#bbdefb; color:#1565c0; }
 .network-content { display:grid; grid-template-columns:minmax(0,1fr); gap:1rem; }
 .network-content.has-selection { grid-template-columns:minmax(0,1fr) minmax(320px,35%); }
 .scroll { position:relative; overflow:hidden; height:65dvh; min-height:160px; touch-action:none; cursor:grab; }
 dialog.expanded .scroll { height:calc(100dvh - 210px); }
 .scaled-area,.map { position:relative; }
 .map { transform-origin:top left; }
 svg { position:absolute; inset:0; z-index:25; pointer-events:none; }
 .ownership-node,.company-node { position:absolute; display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:1.5px solid #666; border-radius:50%; clip-path:circle(50%); background:#fff; }
 .ownership-node.parent-circle { background:#f2f2f2; }
 .ownership-node.parent-circle.alt { background:#e5e5e5; }
 .company-node { z-index:30; background:#e8f2fb; border-color:#6b8fae; }
 .ownership-node.connected-node,.ownership-node.connected-node.parent-circle.alt,.company-node.connected-node { background:#fff5c4; border:2px solid #b89a35; }
 .ownership-node.muted-node,.company-node.muted-node { opacity:.8; }
 .ownership-node.outlined-descendant.muted-node { opacity:1; background:transparent; border-color:#777; }
 .publisher-name,.platform-name { width:100%; height:100%; padding:0; border:0; background:none; color:transparent; font-size:0; cursor:pointer; user-select:none; }
 .platform-name { cursor:grab; touch-action:none; }
 .platform-name:active { cursor:grabbing; }
 .publisher-name:focus-visible,.platform-name:focus-visible { outline:2px solid #254c6f; outline-offset:-4px; }
 .floating-node-label { position:absolute; z-index:60; pointer-events:none; white-space:normal; overflow-wrap:break-word; text-align:center; transform:translate(-50%,-50%); line-height:1.2; font-weight:500; color:#111; text-shadow:0 0 2px #fff,0 0 3px #fff; }
 .floating-node-label.platform-label { font-weight:600; }
 .floating-node-label.muted-label { opacity:.3; }
 .floating-node-label.platform-label.muted-label { opacity:.85; }
 g { cursor:pointer; pointer-events:stroke; }
 g:focus { outline:none; }
 svg > g > path { fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
 path.lawsuit { stroke:#b4232d; } path.deal { stroke:#218239; } path.grant { stroke:#176ac1; }
 path.highlighted:not(.hit-area) { stroke-width:2.5; }
 path.lawsuit.muted { stroke:#f4dee0; }
 path.deal.muted { stroke:#deece1; }
 path.grant.muted { stroke:#dce9f6; }
 path.hit-area { stroke:transparent; stroke-width:12; pointer-events:stroke; }
 .selected-record { min-width:0; max-height:65dvh; overflow:auto; }
 dialog.expanded .selected-record { max-height:calc(100dvh - 210px); }
 .selected-record :global(.card-content) { display:flex!important; flex-direction:column!important; }
 .selected-record :global(.card-column.column-1) { padding:0 0 1rem!important; border-right:0; border-bottom:1px solid #ddd; }
 .selected-record :global(.card-column.column-2) { padding:1rem 0 0!important; }
 .selected-record :global(.card-view) { margin-top:0; }
 .selected-record :global(.timeline-container) { display:flex; flex-direction:column; gap:1rem; padding:0; max-width:none; }
 .selected-record :global(.month-group) { gap:1rem; }
 .selected-record :global(.timeline-row) { display:block; margin:0; padding:0; }
 .selected-record :global(.month-label),.selected-record :global(.timeline-divider) { display:none; }
 @media(max-width:700px) { .network-content.has-selection { grid-template-columns:minmax(0,1fr); } dialog { padding:1rem; } }
</style>
