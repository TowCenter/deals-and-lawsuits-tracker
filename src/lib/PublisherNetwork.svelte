<script>
 import { createEntityNetworkIndex, entityKey, networkEntries, platformConnectionNames } from './entityNetwork.js';
 import RelationshipOutline from './RelationshipOutline.svelte';
 import { isMdlConsolidation } from './mdl.js';
 import { onMount, untrack } from 'svelte';
 import { formatDate } from './utils.js';
 import { publisherNames as names, connectionPublisherNames, normalizeName as normalize, ownershipFamily, publisherAndAncestors, layoutOwnership, layoutCirclePacking, networkRouteCache, routeCircleConnection } from './publisherNetwork.js';
 let { row, data = [], onclose, recordCard, entityName = null, entityPlatform = null } = $props();
 const componentId = $props.id();
 const arrowId = `${componentId}-lawsuit-arrow`;
 const mutedArrowId = `${componentId}-lawsuit-arrow-muted`;
 let selectedRecord = $state(null);
 let selectedOrigin = $state(untrack(() => !entityName));
 let focusedEntity = $state(untrack(() => entityName ? {type: entityPlatform ? 'platform' : 'publisher', name: entityPlatform || entityName} : null));
 let navigationHistory = $state([]);
 let selectedEntity = $state(untrack(() => entityName ? {type: entityPlatform ? 'platform' : 'publisher', name: entityPlatform || entityName} : null));
 const selectedPlatform = $derived(selectedEntity?.type === 'platform' ? selectedEntity.name : null);
 const selectedPublisher = $derived(selectedEntity?.type === 'publisher' ? normalize(selectedEntity.name) : null);
 const canFocusSelection = $derived(selectedEntity && (!focusedEntity || entityKey(selectedEntity.type, selectedEntity.name) !== entityKey(focusedEntity.type, focusedEntity.name)));
 function selectEntity(type, name) {
  clearSelection();
  selectedEntity = {type, name};
 }
 function focusSelection() {
  if (selectedEntity) navigateTo(selectedEntity.type, selectedEntity.name);
 }
 function navigateTo(type, name) {
  if (focusedEntity && entityKey(type, name) === entityKey(focusedEntity.type, focusedEntity.name)) return;
  navigationHistory = [...navigationHistory, focusedEntity];
  clearSelection();
  platformPositions = new Map();
  focusedEntity = {type, name};
  selectedEntity = focusedEntity;
 }
 function navigateBack() {
  if (!navigationHistory.length) return;
  clearSelection();
  platformPositions = new Map();
  focusedEntity = navigationHistory.at(-1);
  navigationHistory = navigationHistory.slice(0, -1);
  selectedEntity = focusedEntity;
 }
 const selectedRecords = $derived(selectedRecord ? [selectedRecord]
  : selectedPublisher ? entries.filter(entry => connectionNodes(entry).some(node => selectedPublisherAncestors.has(node.key)))
  : selectedPlatform ? entries.filter(entry => entry.companies.includes(selectedPlatform))
  : focusedEntity || selectedKind ? entries : []);
 const panelRecords = $derived(selectedKind ? selectedRecords.filter(entry => kinds(entry).includes(selectedKind)) : selectedRecords);

 let expanded = $state(false);
 let dialog;
 let mapViewport;
 let viewportWidth = $state(1100);
 let viewportHeight = $state(460);
 let cameraZoom = $state(1);
 let cameraX = $state(0);
 let cameraY = $state(0);
 let panGesture = null;
 const touches = new Map();
 let pinchGesture = null;
 let suppressGraphClick = false;
 let gestureResetTimer;
 function beginGesture(event) {
  if (event.pointerType === 'touch') {
   touches.set(event.pointerId, {x:event.clientX,y:event.clientY});
   draggingPlatform = null;
   if (touches.size === 2) {
    const [a,b] = [...touches.values()];
    pinchGesture = {distance:Math.hypot(a.x-b.x,a.y-b.y), zoom:cameraZoom};
    panGesture = null;
    suppressGraphClick = true;
   } else if (touches.size === 1) {
    panGesture = {startX:event.clientX,startY:event.clientY,x:cameraX,y:cameraY};
   }
  } else if (event.button === 0 && !event.target.closest('button, g, .ownership-node, .company-node')) {
   panGesture = {startX:event.clientX,startY:event.clientY,x:cameraX,y:cameraY};
   event.preventDefault();
  }
 }
 function handleMapKey(event) {
  if (event.target !== mapViewport) return;
  const offsets = {ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};
  if (offsets[event.key]) {
   event.preventDefault();
   cameraX += offsets[event.key][0]; cameraY += offsets[event.key][1];
  } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(1.12); }
  else if (event.key === '-') { event.preventDefault(); zoomAt(1/1.12); }
  else if (event.key === 'Home') { event.preventDefault(); resetCamera(); }
 }
 function handleMapClick(event) {
  if (suppressGraphClick) { event.preventDefault(); event.stopPropagation(); }
 }

 function resetCamera() {
  cameraZoom = 1;
  cameraX = (viewportWidth - graphBounds.width * mapScale) / 2 - graphBounds.left * mapScale;
  cameraY = (viewportHeight - graphBounds.height * mapScale) / 2 - graphBounds.top * mapScale;
 }
 $effect(() => {
  focusedEntity;
  const frame = requestAnimationFrame(() => untrack(resetCamera));
  return () => cancelAnimationFrame(frame);
 });
 function zoomAt(factor, x = viewportWidth / 2, y = viewportHeight / 2) {
  const next = Math.max(.6, Math.min(6, cameraZoom * factor));
  const ratio = next / cameraZoom;
  cameraX = x - (x - cameraX) * ratio;
  cameraY = y - (y - cameraY) * ratio;
  cameraZoom = next;
 }
 const networkIndex = $derived(createEntityNetworkIndex(data));
 const entityView = $derived(focusedEntity ? networkIndex.query(focusedEntity) : null);
 const publishers = $derived(entityView ? [...entityView.family].map(key => ownership.get(key)?.name || key) : names(row));

 const namedPublishers = $derived(row.organization_publisher_named_in_deal_suit?.length ? row.organization_publisher_named_in_deal_suit : publishers);
 const networkTitle = $derived(focusedEntity?.name || (namedPublishers.length === 1 ? namedPublishers[0] : namedPublishers.slice(0, 3).join(', ') + (namedPublishers.length > 3 ? ` + ${namedPublishers.length - 3} more` : '')));
 const recordContext = $derived(`${(row.interaction || []).join(' / ')} · ${(row.platform?.length ? row.platform : row.defendant || []).join(', ')} · ${formatDate(row.date)}`);
 const ownership = $derived(networkIndex.ownership);
 const family = $derived(entityView?.family || new Set(publishers.flatMap(name => [...ownershipFamily(ownership, name)])));
 const viewRecords = $derived(entityView?.records || data.filter(record => !isMdlConsolidation(record) && names(record).some(name => family.has(normalize(name)))));
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
  if (event.button !== 0 || event.pointerType === 'touch') return;
  const node = platformNodes.get(company);
  draggingPlatform = {company, startX:event.clientX, startY:event.clientY, x:node.x, y:node.y, moved:false};
 }
 const graphNodes = $derived.by(() => {
  const packed=layoutCirclePacking(hierarchy.nodes,ownershipLinks,graphWidth,height,companies);
  if(!platformPositions.size)return packed;
  return packed.map(node => {
  const position = platformPositions.get(node.name);
  return node.key.startsWith('platform:') && position ? {...node, x:Math.max(0, Math.min(graphWidth-node.width,position.x)), y:Math.max(0,Math.min(height-node.height,position.y))} : node;
  });
 });
 const displayNodes = $derived(graphNodes.filter(node => !node.key.startsWith('platform:')));
 const visibleLabels = $derived.by(() => {
  const scale = mapScale * cameraZoom;
  const candidates = graphNodes.filter(node => !node.key.startsWith('platform:')).sort((a,b) => {
   const priority = node => node.key === hoveredPublisher ? 4 : node.key === selectedPublisher ? 3 : node.depth === 0 || node.width*scale >= 130 ? 2 : 1;
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
 let hoveredKind = $state(null);
 let selectedKind = $state(null);
 let hoveredConnection = $state(null);
 let selectedConnection = $state(null);
 function selectConnection(connection) { if (suppressGraphClick) return; selectedOrigin = false; selectedConnection = connection; selectedRecord = connection.entry; }
 function clearSelection() { selectedEntity = null; selectedKind = null; selectedOrigin = false; selectedRecord = null; selectedConnection = null; hoveredConnection = null; hoveredPublisher = null; hoveredPlatform = null; }
 let hoveredPublisher = $state(null);
 let hoveredPlatform = $state(null);
 function activeConnection(entry, node = null, company = null) {
  const interactionKind = hoveredKind || selectedKind;
  if (interactionKind) return kind(entry) === interactionKind;
  if (hoveredPlatform != null) return company === hoveredPlatform;
  if (hoveredPublisher != null) return node ? node.key === hoveredPublisher : connectionNodes(entry).some(node => node.key === hoveredPublisher);
  if (hoveredConnection != null) return entry.id === hoveredConnection.entry.id;
  if (selectedPublisher != null) return node?.key === selectedPublisher;
  if (selectedPlatform != null) return company === selectedPlatform;
  if (selectedConnection != null) return entry.id === selectedConnection.entry.id;
  if (selectedOrigin) return entry.id === row.id || Boolean(row.lawsuit_id && entry.lawsuit_id === row.lawsuit_id);
  return false;
 }
 const inheritedAncestorKeys = $derived.by(() => {
  if (focusedEntity?.type === 'platform' || hoveredKind || selectedKind || selectedPlatform || hoveredPlatform || hoveredConnection) return new Set();
  const publisher = hoveredPublisher || selectedPublisher;
  if (!publisher) return new Set();
  const ancestors = publisherAndAncestors(ownership, publisher);
  ancestors.delete(publisher);
  return ancestors;
 });
 function inheritedConnection(connection) {
  return inheritedAncestorKeys.has(connection.node.key);
 }
 function emphasizedConnection(connection) {
  return inheritedConnection(connection) || activeConnection(connection.entry, connection.node, connection.company);
 }
 const highlighting = $derived(hoveredKind != null || selectedKind != null || selectedOrigin || selectedPublisher != null || selectedPlatform != null || selectedConnection != null || hoveredPublisher != null || hoveredPlatform != null || hoveredConnection != null);
 const selectedPublisherAncestors = $derived(selectedPublisher ? publisherAndAncestors(ownership, selectedPublisher) : new Set());
 const connectionNodeIndex = $derived.by(() => {
  const index = new Map();
  for (const entry of entries) {
   const keys = new Set(platformConnectionNames(entry, ownership).map(normalize));
   index.set(entry.id, [...keys].map(key => nodeByName.get(key)).filter(Boolean));
  }
  return index;
 });
 function connectionNodes(entry) {
  return connectionNodeIndex.get(entry.id) || [];
 }
 const entries = $derived(networkEntries(viewRecords));
 const companies = $derived(entityView?.companies || [...new Set(entries.flatMap(entry => entry.companies))]);
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
 // Summarize every relationship type to the selected entity without rerouting nodes.
 const relationshipOutlines = $derived.by(() => {
  const outlines = new Map();
  if (!selectedPlatform && !selectedPublisher) return outlines;
  for (const link of connections) {
   if (selectedPlatform ? link.company !== selectedPlatform : !selectedPublisherAncestors.has(link.node.key)) continue;
   const key = selectedPlatform ? link.node.key : `platform:${link.company}`;
   if (!outlines.has(key)) outlines.set(key, new Set());
   for (const type of kinds(link.entry)) {
    const normalized = type.includes('lawsuit') ? 'lawsuit' : type.includes('grant') ? 'grant' : type.includes('deal') ? 'deal' : null;
    if (normalized && (!selectedKind || selectedKind === normalized)) outlines.get(key).add(normalized);
   }
  }
  return new Map([...outlines].map(([key, types]) => [key, ['lawsuit', 'deal', 'grant'].filter(type => types.has(type))]));
 });
 const drawnConnections = $derived.by(() => {
  const groups = new Map();
  for (const connection of connections) {
   const key = JSON.stringify([connection.node.key,connection.company,kind(connection.entry)]);
   const existing = groups.get(key);
   if (!existing || (!activeConnection(existing.entry,existing.node,existing.company) && activeConnection(connection.entry,connection.node,connection.company))) groups.set(key,connection);
  }
  return [...groups.values()].sort((a,b) => Number(emphasizedConnection(a)) - Number(emphasizedConnection(b)));
 });
 const highlightedPublishers = $derived.by(() => {
  const keys = new Set(connections.filter(link => activeConnection(link.entry, link.node, link.company)).map(link => link.node.key));
  if (hoveredPublisher) keys.add(hoveredPublisher);
  else if (selectedPublisher) keys.add(selectedPublisher);
  return keys;
 });
 // Shared routes need separate lanes when the same pair has several interaction types.
 const connectionLanes = $derived.by(() => {
  const pairs = new Map();
  for (const link of drawnConnections) {
   const key = routeKey(link);
   if (!pairs.has(key)) pairs.set(key, new Set());
   pairs.get(key).add(kind(link.entry));
  }
  return new Map([...pairs].map(([key, types]) => [key, ['lawsuit', 'deal', 'grant'].filter(type => types.has(type))]));
 });
 function laneOffset(connection) {
  const types = connectionLanes.get(routeKey(connection)) || [];
  return (types.indexOf(kind(connection.entry)) - (types.length - 1) / 2) * 10 / mapScale;
 }
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
 const highlightedCompanies = $derived(new Set(connections.filter(emphasizedConnection).map(link => link.company)));
 const routeKey = connection => JSON.stringify([connection.node.key,connection.company]);
 let routedPaths = $state(new Map());
 let routing = $state(false);
 let routingError = $state(false);
 const routeCache = networkRouteCache;
 $effect(() => {
  const nodes=graphNodes;
  const geometry=node=>({key:node.key,x:node.x,y:node.y,r:node.r});
  const workerNodes=nodes.map(geometry);
  const links=connections;
  const width=graphWidth,canvasHeight=height;
  const cached=routeCache.get(nodes);
  if(cached && links.every(link => cached.has(routeKey(link)))){routedPaths=cached;routing=false;routingError=false;return;}
  const routes=new Map();
  for(const connection of links){
   const key=routeKey(connection);
   if(routes.has(key))continue;
   routes.set(key,{key,source:geometry(connection.node),target:geometry(platformNodes.get(connection.company))});
  }
  routedPaths=new Map();routing=routes.size>0;routingError=false;
  if(!routes.size)return;
  let worker, fallbackTimer, cancelled=false;
  const accumulated=new Map(),pending=[...routes.values()];
  const publish=complete=>{
   if(cancelled)return;
   if(complete){routedPaths=new Map(accumulated);routeCache.set(nodes,routedPaths);routing=false;worker?.terminate();}
  };
  // Worker startup or cloning failures must not leave the graph without lines.
  const fallback=()=>{
   worker?.terminate();
   let index=0;
   const step=()=>{
    if(cancelled)return;
    const start=performance.now();
    try {
     do {
      const {key,source,target}=pending[index++];
      accumulated.set(key,routeCircleConnection(source,target,workerNodes,width,canvasHeight,false,{x:target.x-96,y:target.y+target.r}));
     } while(index<pending.length && performance.now()-start<8);
     publish(index===pending.length);
     if(index<pending.length)fallbackTimer=setTimeout(step,0);
    } catch {routing=false;routingError=true;}
   };
   fallbackTimer=setTimeout(step,0);
  };
  try {
   worker=new Worker(new URL('./publisherNetwork.worker.js',import.meta.url),{type:'module'});
   worker.onmessage=event=>{
    for(const [key,path] of event.data.paths)accumulated.set(key,path);
    publish(event.data.complete);
   };
   worker.onerror=fallback;
   worker.onmessageerror=fallback;
   worker.postMessage({nodes:workerNodes,routes:pending,width,height:canvasHeight});
  } catch {fallback();}
  return ()=>{cancelled=true;worker?.terminate();clearTimeout(fallbackTimer);};
 });
 function curve(connection) { return routedPaths.get(routeKey(connection)) || ''; }
 const kinds = entry => (entry.interaction || []).map(value => String(value).toLowerCase());
 const kind = entry => kinds(entry).some(v => v.includes('lawsuit')) ? 'lawsuit' : kinds(entry).some(v => v.includes('grant')) ? 'grant' : 'deal';
 onMount(() => {
  dialog.showModal();
  const initialFitFrame = requestAnimationFrame(resetCamera);
  const movePlatform = event => {
   if (touches.has(event.pointerId)) {
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pinchGesture && touches.size === 2) {
     const [a,b] = [...touches.values()],bounds=mapViewport.getBoundingClientRect();
     const distance=Math.hypot(a.x-b.x,a.y-b.y);
     if (pinchGesture.distance > 0) zoomAt((pinchGesture.zoom * distance / pinchGesture.distance) / cameraZoom,(a.x+b.x)/2-bounds.left,(a.y+b.y)/2-bounds.top);
     return;
    }
   }
   if (panGesture) {
    if (Math.hypot(event.clientX-panGesture.startX,event.clientY-panGesture.startY)>6) suppressGraphClick = true;
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
  const stopDragging = event => {
   touches.delete(event.pointerId);
   pinchGesture = null;
   clearTimeout(gestureResetTimer);
   if (touches.size === 1) {
    const [remaining]=touches.values();
    panGesture={startX:remaining.x,startY:remaining.y,x:cameraX,y:cameraY};
   } else {
    panGesture = null;
    gestureResetTimer=setTimeout(() => suppressGraphClick=false,0);
   }
   suppressPlatformClick = Boolean(draggingPlatform?.moved);
   draggingPlatform = null;
   clearTimeout(clickResetTimer);
   clickResetTimer = setTimeout(() => suppressPlatformClick = false, 0);
  };
  window.addEventListener('pointermove', movePlatform);
  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);

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
   clearTimeout(gestureResetTimer);
   touches.clear();
   observer.disconnect();
   window.removeEventListener('pointermove', movePlatform);
   window.removeEventListener('pointerup', stopDragging);
   window.removeEventListener('pointercancel', stopDragging);
   dialog.close();
  };
 });
</script>

<dialog class:expanded bind:this={dialog} onclose={onclose} onclick={event => { if (event.target === dialog) dialog.close(); else if (!suppressGraphClick && event.target instanceof Element && event.target.closest('.scroll') && !event.target.closest('g, button, .ownership-node, .company-node')) clearSelection(); }} onkeydown={event => { if (event.key === 'Escape') event.stopPropagation(); }} aria-label="Publisher network map">
 <header><div class="network-heading"><h2 title={namedPublishers.join(', ')}>{networkTitle}</h2>{#if !focusedEntity}<p class="record-context">{recordContext}</p>{/if}</div><div class="window-controls">{#if canFocusSelection}<button class="resize" onclick={focusSelection} aria-label={`Focus network on ${selectedEntity.name}`}>Focus on {selectedEntity.name}</button>{/if}{#if navigationHistory.length}<button class="resize" onclick={navigateBack} aria-label="Return to previous network">Back</button>{/if}<button class="resize" onclick={() => expanded = !expanded} aria-label={expanded ? "Restore popup size" : "Expand popup"} aria-pressed={expanded}>{expanded ? "Restore" : "Expand"}</button><button class="close" onclick={() => dialog.close()} aria-label="Close network map">×</button></div></header>


 <div class="legend" aria-label="Filter relationship types">
  <span class="legend-hint">Filter relationships:</span>
  {#each ['lawsuit', 'deal', 'grant'] as interaction}
   <button type="button" title={`Filter ${interaction}s; click again to show all`} class="interaction-tag {interaction}" aria-pressed={selectedKind === interaction}
    onpointerenter={event => { if(event.pointerType !== 'touch') hoveredKind = interaction; }}
    onpointerleave={() => hoveredKind = null}
    onfocus={() => hoveredKind = interaction} onblur={() => hoveredKind = null}
    onclick={() => selectedKind = selectedKind === interaction ? null : interaction}>
    {interaction === 'lawsuit' ? 'Lawsuit' : interaction === 'deal' ? 'Deal' : 'Grant'}
   </button>
  {/each}
  {#if inheritedAncestorKeys.size}<span class="inheritance-key">Dashed = inherited from parent</span>{/if}
 </div>

 {#if routing}<p class="routing-status" role="status">Drawing connections…</p>{/if}
 {#if routingError}<p class="routing-status" role="alert">Connections could not be drawn. Close and reopen the network to retry.</p>{/if}
 <div class="network-content" class:has-selection={panelRecords.length > 0}>
 <!-- This application surface deliberately handles pan/zoom and implements its documented keyboard controls. -->
 <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
 <div class="scroll" role="application" tabindex="0" aria-label="Relationship graph. Drag to pan, pinch to zoom. Keyboard: arrows to pan, plus or minus to zoom, Home to fit." onkeydown={handleMapKey} bind:this={mapViewport} onwheel={event => { event.preventDefault(); const bounds = mapViewport.getBoundingClientRect(); zoomAt(event.deltaY < 0 ? 1.12 : 1/1.12, event.clientX-bounds.left, event.clientY-bounds.top); }} onpointerdown={beginGesture} onclickcapture={handleMapClick}><div class="scaled-area" style:width="{graphWidth * mapScale}px" style:height="{height * mapScale}px"><div class="map" style:width="{graphWidth}px" style:height="{height}px" style:transform="translate({cameraX}px, {cameraY}px) scale({mapScale * cameraZoom})">
 
 <svg width={graphWidth} {height} aria-label="Publisher connections">
  <defs>
   <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#b4232d" />
   </marker>
   <marker id={mutedArrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#f4dee0" />
   </marker>
  </defs>
  {#each drawnConnections as connection}
   <g transform={`translate(0 ${laneOffset(connection)})`} role="button" tabindex="0" aria-label={`${connection.node.name} — ${connection.entry.interaction.join(' / ')} — ${connection.company}, ${formatDate(connection.entry.date)}`} onpointerenter={event => { if (event.pointerType !== 'touch') hoveredConnection = connection; }} onpointerleave={() => hoveredConnection = null} onfocus={() => hoveredConnection = connection} onblur={() => hoveredConnection = null} onclick={() => selectConnection(connection)} onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectConnection(connection); } }}>
    <path class="hit-area" d={curve(connection)} />
    <path marker-end={kind(connection.entry) === 'lawsuit' ? `url(#${highlighting && !emphasizedConnection(connection) ? mutedArrowId : arrowId})` : undefined} class={kind(connection.entry)} class:inherited={inheritedConnection(connection)} class:highlighted={emphasizedConnection(connection)} class:muted={highlighting && !emphasizedConnection(connection)} d={curve(connection)} />
   </g>
  {/each}
 </svg>
 {#each displayNodes as node (node.key)}
  <div role="presentation" onpointerenter={event => { if (event.pointerType !== 'touch') hoveredPublisher = node.key; }} onpointerleave={() => { hoveredPublisher = null; }} class="ownership-node" class:relationship-outlined={relationshipOutlines.get(node.key)?.length > 0} class:muted-node={highlighting && !highlightedPublishers.has(node.key)} class:selected-node={selectedPublisher === node.key} class:hovered-node={hoveredPublisher === node.key} class:outlined-descendant={highlighting && outlinedDescendants.has(node.key) && !highlightedPublishers.has(node.key)}  style:left="{node.x}px" style:top="{node.y}px" style:width="{node.width}px" style:height="{node.height}px" style:z-index={10 + node.depth * 2} class:parent-circle={node.hasChildren} class:alt={node.depth % 2}><RelationshipOutline types={relationshipOutlines.get(node.key) || []} /><button class="publisher-name" aria-label={node.name} onclick={() => { if (suppressGraphClick) return; selectEntity('publisher', node.name); }} onfocus={() => hoveredPublisher = node.key} onblur={() => hoveredPublisher = null} >{node.name}</button></div>
 {/each}
 {#each visibleLabels as label (label.node.key)}
  <div class="floating-node-label" class:muted-label={highlighting && !highlightedPublishers.has(label.node.key)} style:left="{label.x}px" style:top="{label.y}px" style:font-size="{label.font}px" style:width="{label.width}px">{label.node.name}</div>
 {/each}
 {#each companies as company (company)}<div class="company-node" class:relationship-outlined={relationshipOutlines.get(`platform:${company}`)?.length > 0} class:muted-node={highlighting && !highlightedCompanies.has(company)} class:selected-node={selectedPlatform === company} class:hovered-node={hoveredPlatform === company} style:left="{platformNodes.get(company).x}px" style:top="{platformNodes.get(company).y}px" style:width="{platformNodes.get(company).width}px" style:height="{platformNodes.get(company).height}px"><RelationshipOutline types={relationshipOutlines.get(`platform:${company}`) || []} /><button class="platform-name" aria-label={company} onpointerdown={event => startPlatformDrag(event, company)} onclick={() => { if (suppressPlatformClick || suppressGraphClick) return; selectEntity('platform', company); }} onpointerenter={event => { if (event.pointerType !== 'touch') hoveredPlatform = company; }} onpointerleave={() => { hoveredPlatform = null; }} onfocus={() => hoveredPlatform = company} onblur={() => hoveredPlatform = null} >{company}</button></div>{/each}
 {#each companies as company (company)}
  {@const platform = platformNodes.get(company)}
  <div class="floating-node-label platform-label" class:muted-label={highlighting && !highlightedCompanies.has(company)} style:left="{platform.x + platform.r}px" style:top="{platform.y + platform.r}px" style:font-size="{14 / (mapScale * cameraZoom)}px" style:width="{180 / (mapScale * cameraZoom)}px">{company}</div>
 {/each}
 </div></div></div>

 {#if panelRecords.length}
  <section class="selected-record" aria-label="Selected record" aria-live="polite">
   {@render recordCard(panelRecords, selectedKind == null && selectedPlatform == null && selectedPublisher == null)}
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
 .window-controls { display:flex; flex-wrap:wrap; align-items:center; gap:.75rem; flex-shrink:0; }
 .resize { min-height:36px; font:inherit; font-size:.75rem; border:1px solid #ddd; background:#fff; color:#254c6f; padding:.25rem .6rem; cursor:pointer; }
 .close { min-width:40px; min-height:40px; border:0; background:none; font-size:1.2rem; cursor:pointer; }
 .routing-status { margin:0 0 .5rem; font-size:.8rem; color:#555; }
 .legend { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; margin-bottom:.65rem; }
 .legend-hint,.inheritance-key {font-size:.75rem;color:#555;margin-right:.35rem;}
 .inheritance-key {margin-left:.5rem;}
 .interaction-tag { display:inline-flex;align-items:center;gap:.5rem;min-height:34px; font-family:inherit; border:1px solid currentColor; cursor:pointer; padding:.2rem .5rem; border-radius:3px; font-size:.65rem; text-transform:uppercase; letter-spacing:.5px; }
 .interaction-tag:hover {filter:brightness(.95);box-shadow:0 1px 3px #0002;}
 .interaction-tag:focus-visible { outline:2px solid #254c6f; outline-offset:3px; }
 .interaction-tag[aria-pressed="true"] { box-shadow:inset 0 0 0 1px currentColor; }
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
 .ownership-node.selected-node,.ownership-node.selected-node.parent-circle.alt,.company-node.selected-node,.ownership-node.hovered-node,.ownership-node.hovered-node.parent-circle.alt,.company-node.hovered-node { background:#fff5c4; border:2px solid #b89a35; }
 .ownership-node.selected-node,.company-node.selected-node,.ownership-node.hovered-node,.company-node.hovered-node { opacity:1; }
 .ownership-node.relationship-outlined,.company-node.relationship-outlined { border-color:transparent; }
 .ownership-node.muted-node,.company-node.muted-node { opacity:.8; }
 .ownership-node.outlined-descendant.muted-node { opacity:1; background:transparent; border-color:#777; }
 .publisher-name,.platform-name { border-radius:50%; width:100%; height:100%; padding:0; border:0; background:none; color:transparent; font-size:0; cursor:pointer; user-select:none; }
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
 path.inherited {stroke-dasharray:7 5;}
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
 @media(max-width:700px) {
  dialog,dialog.expanded { width:100%; height:100dvh; max-height:100dvh; max-width:none; margin:0; padding:1rem; overflow-y:auto; overscroll-behavior:contain; }
  header { gap:.5rem; }
  h2 { font-size:1.1rem; overflow-wrap:anywhere; }
  .window-controls { gap:.25rem; }
  .resize,.close { min-height:44px; }
  .routing-status { margin:0 0 .5rem; font-size:.8rem; color:#555; }
 .legend { flex-wrap:wrap; }
  .network-content.has-selection { grid-template-columns:minmax(0,1fr); }
  .scroll,dialog.expanded .scroll { height:60dvh; min-height:240px; }
  .network-content.has-selection .scroll { height:45dvh; }
  .selected-record,dialog.expanded .selected-record { max-height:none; overflow:visible; }
  .selected-record :global(.card-header) { flex-wrap:wrap; }
  .selected-record :global(.header-content) { min-width:0; overflow-wrap:anywhere; }
  path.hit-area { stroke-width:20; }
 }

</style>
