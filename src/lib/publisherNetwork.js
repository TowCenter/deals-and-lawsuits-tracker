import { hierarchy, pack } from 'd3-hierarchy';

export const normalizeName = name => String(name || '').trim().toLowerCase();
// Grant coverage is a platform relationship, independent of ownership or card grouping.
export function connectionPublisherNames(row) {
 const names = [...(row.organization_publisher_named_in_deal_suit || [])];
 if ((row.interaction || []).some(kind => String(kind).toLowerCase() === 'grant')) {
  names.push(...(row.grantees || []), ...(row.publications_received_grants || []), ...(row.affected_publications || []));
 }
 return [...new Map(names.filter(Boolean).map(name => [normalizeName(name), name])).values()];
}
export function publisherNames(row) {
 return [...new Set([...connectionPublisherNames(row), ...(row.publishers || []), ...(row.affected_publications || [])].filter(Boolean))];
}

// Join ownership lineages across all records; never infer ownership from co-participation.
const ownershipCache = new WeakMap();
export function buildOwnershipGraph(data) {
 if (ownershipCache.has(data)) return ownershipCache.get(data);
 const graph = new Map();
 const add = name => {
  const key = normalizeName(name);
  if (!key) return null;
  if (!graph.has(key)) graph.set(key, { name: String(name).trim(), neighbors: new Set(), children: new Set() });
  return key;
 };
 for (const row of data) {
  for (const name of publisherNames(row)) add(name);
  for (const match of row.parent_child_matches || []) {
   const lineage = Array.isArray(match.lineage) ? match.lineage.filter(name => normalizeName(name)) : [];
   for (let i = 0; i < lineage.length; i++) {
    const key = add(lineage[i]);
    if (!i) continue;
    const parent = add(lineage[i - 1]);
    if (parent === key) continue;
    graph.get(parent).children.add(key);
    graph.get(parent).neighbors.add(key);
    graph.get(key).neighbors.add(parent);
   }
  }
 }
 ownershipCache.set(data, graph);
 return graph;
}
// Relationships propagate down ownership, never from a child to its parent or siblings.
const ancestorIndexCache = new WeakMap();
export function publisherAndAncestors(graph, name) {
 let parents = ancestorIndexCache.get(graph);
 if (!parents) {
  parents = new Map();
  for (const [parent, node] of graph) {
   for (const child of node.children) {
    if (!parents.has(child)) parents.set(child, new Set());
    parents.get(child).add(parent);
   }
  }
  ancestorIndexCache.set(graph, parents);
 }
 const pending = [normalizeName(name)], ancestors = new Set();
 while (pending.length) {
  const key = pending.pop();
  if (!key || ancestors.has(key)) continue;
  ancestors.add(key);
  pending.push(...(parents.get(key) || []));
 }
 return ancestors;
}

export function ownershipFamily(graph, name) {
 const pending = [normalizeName(name)];
 const seen = new Set();
 while (pending.length) {
  const key = pending.pop();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  for (const neighbor of graph.get(key)?.neighbors || []) pending.push(neighbor);
 }
 return seen;
}

/** Flatten each ownership family once, including cyclic and shared lineages. */
export function layoutOwnership(graph, family) {
 const children = key => [...(graph.get(key)?.children || [])].filter(child => family.has(child));
 const childKeys = new Set([...family].flatMap(children));
 const roots = [...family].filter(key => !childKeys.has(key));
 const nodes = [], visited = new Set();
 const visit = (key, depth) => {
  if (visited.has(key)) return;
  visited.add(key);
  const descendants = children(key);
  nodes.push({key, name:graph.get(key)?.name || key, depth, hasChildren:descendants.length > 0});
  for (const child of descendants) visit(child, depth + 1);
 };
 for (const key of roots) visit(key, 0);
 for (const key of family) if (!visited.has(key)) visit(key, 0);
 return {nodes};
}

// Reuse unchanged layouts and their routes when an organization is reopened.
const packingCache = new Map();
export const networkRouteCache = new WeakMap();
// D3 owns hierarchy packing; Svelte recomputes it as the viewport changes.
export function layoutCirclePacking(nodes, ownershipLinks, width, height, companies) {
 const cacheKey=JSON.stringify([nodes.map(({key,name,hasChildren})=>[key,name,hasChildren]),ownershipLinks,width,height,companies]);
 if(packingCache.has(cacheKey))return packingCache.get(cacheKey);
 const byKey = new Map(nodes.map(node => [node.key, node]));
 const children = new Map(nodes.map(node => [node.key, []]));
 const childKeys = new Set();
 for (const [parent, child] of ownershipLinks) {
  children.get(parent)?.push(child); childKeys.add(child);
 }
 const visited = new Set();
 const build = key => {
  if (visited.has(key)) return null;
  visited.add(key);
  const descendants = (children.get(key) || []).map(build).filter(Boolean);
  return {...byKey.get(key), children: descendants.length ? descendants : undefined};
 };
 const trees = nodes.filter(node => !childKeys.has(node.key)).map(node => build(node.key)).filter(Boolean);
 for (const node of nodes) if (!visited.has(node.key)) trees.push(build(node.key));
 const root = hierarchy({key: '__root', children: trees}).sum(node => node.children ? 0 : Math.max(1, String(node.name || '').length));
 root.sort((a,b) => b.value - a.value || String(a.data.key).localeCompare(String(b.data.key)));
 pack().radius(() => 66).padding(node => node.depth === 0 ? 24 : 64)(root);
 const platformRadius = Math.max(80, ...companies.map(name => String(name).length * 13 * .58 / 1.8 + 14));
 const platformColumns = Math.max(1, Math.ceil(companies.length * (platformRadius * 2 + 24) / Math.max(1, height - 32)));
 const areaWidth = Math.max(width * .45, width - platformColumns * (platformRadius * 2 + 24) - 40);
 const scale = root.r ? Math.min((areaWidth - 32) / (root.r * 2), (height - 32) / (root.r * 2)) : 1;
 const result = root.descendants().filter(node => node !== root).sort((a,b) => a.depth - b.depth).map(node => {
  const r = node.r * scale;
  const cx = areaWidth / 2 + (node.x - root.x) * scale;
  const cy = height / 2 + (node.y - root.y) * scale;
  const headerGap = node.children?.length ? Math.max(1, Math.min(...node.children.map(child => child.y-child.r)) - (node.y-node.r)) * scale : 0;
  const labelInset = headerGap * .2;
  return {...node.data, depth:node.depth - 1, x:cx-r, y:cy-r, width:r*2, height:r*2, r, labelInset};
 });
 const spacing = platformRadius * 2 + 24;
 const columnCount = Math.max(1, Math.ceil(companies.length * spacing / Math.max(1, height - 32)));
 const rowsPerColumn = Math.max(1, Math.ceil(companies.length / columnCount));
 companies.forEach((company,i) => {
  const column = Math.floor(i / rowsPerColumn), row = i % rowsPerColumn;
  const count = Math.min(rowsPerColumn, companies.length - column * rowsPerColumn);
  const radius = platformRadius;
  result.push({key:`platform:${company}`, name:company,
   x:areaWidth + 24 + column * spacing,
   y:Math.max(16, (height - count * spacing) / 2) + row * spacing + 12,
   width:radius*2, height:radius*2, r:radius});
 });
 if(packingCache.size>=12)packingCache.delete(packingCache.keys().next().value);
 packingCache.set(cacheKey,result);
 return result;
}

export function routeCircleConnection(source, target, circles, width, height, retry = false, corridor = null, lane = 0) {
 const center = node => ({x:node.x+node.r,y:node.y+node.r});
 const a=center(source),b=center(target),padding=retry ? 0 : Math.min(8, source.r*.15) + (lane ? 12 + lane : 0);
 const arrivalY=b.y+Math.max(-target.r*.6,Math.min(target.r*.6,lane));
 const end={x:b.x-Math.sqrt(target.r**2-(arrivalY-b.y)**2),y:arrivalY};

 // Ancestor boundaries enclose the source; crossing them is necessary to exit.
 const candidates=circles.filter(node=>node.key!==source.key&&node.key!==target.key)
  .filter(node=> {
   const distance = Math.hypot(center(node).x-a.x,center(node).y-a.y);
   // Ancestors must be crossed to leave the family; descendants are inside
   // the source endpoint and cannot obstruct its outward connection.
   return distance + source.r > node.r + .5 && distance + node.r > source.r + .5;
  });
 // Children fully inside an obstacle add no additional blocked area.
 // Route against enclosing circles once instead of every publication inside them.
 const obstacles=[];
 for(const node of candidates.sort((a,b)=>b.r-a.r)){
  const c=center(node);
  if(!obstacles.some(parent=>Math.hypot(c.x-center(parent).x,c.y-center(parent).y)+node.r<=parent.r+.001))obstacles.push(node);
 }
 // Fit the horizontal approach into the gap before the destination.
 // A full-length approach can land on the preceding platform's boundary.
 let terminalLength=Math.min(24,target.r*.4);
 for(const node of obstacles){
  const c=center(node),radius=node.r+padding,dy=end.y-c.y;
  if(Math.abs(dy)>=radius)continue;
  const right=c.x+Math.sqrt(radius**2-dy**2);
  if(right<end.x)terminalLength=Math.min(terminalLength,(end.x-right)/2);
 }
 const arrival={x:end.x-terminalLength,y:end.y};
 obstacles.push(target);
 const blocked=(x,y)=>obstacles.some(node=>Math.hypot(x-center(node).x,y-center(node).y)<node.r+(node.key===target.key ? 0 : padding));
 // Prefer a single gentle curve when it clears the ownership circles.
 // Avoid forcing every connection through a narrow shared approach corridor.
 if (!corridor && b.x > a.x + source.r + target.r) {
  const dx=arrival.x-a.x,dy=arrival.y-a.y+lane,distance=Math.hypot(dx,dy);
  const start={x:a.x+dx/distance*source.r,y:a.y+dy/distance*source.r};
  const span=arrival.x-start.x;
  const c1={x:start.x+span*.4,y:start.y};
  const c2={x:arrival.x-span*.4,y:arrival.y};
  let collision=false;
  for(let sample=0;sample<=64;sample++){
   const t=sample/64,u=1-t;
   const x=u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*arrival.x;
   const y=u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*arrival.y;
   if(blocked(x,y)){collision=true;break;}
  }
  if(!collision)return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${arrival.x} ${arrival.y} L ${end.x} ${end.y}`;
 }
 // Bound routing work independently of the database or zoomed canvas size.
 const step=retry ? Math.max(3,Math.sqrt(width*height/48000),Math.min(source.r/2,width/256,height/192)) : Math.max(6,width/192,height/128),cols=Math.ceil(width/step),rows=Math.ceil(height/step);
 const index=(x,y)=>y*cols+x;
 const start={x:Math.round(a.x/step),y:Math.round(a.y/step)},goal={x:Math.round(arrival.x/step),y:Math.round(arrival.y/step)};
 // Connections to the same platform converge at a shared, unobstructed
 // junction before their final approach. Each source keeps its own endpoint.
 const approach = corridor ? {x:corridor.x-64,y:corridor.y} : null;
 const corridorClear=approach && Array.from({length:33},(_,i)=>{const t=i/32;return !blocked(approach.x+(b.x-approach.x)*t,approach.y+(b.y-approach.y)*t);}).every(Boolean);
 const gate = corridorClear
  ? {x:Math.round(approach.x/step),y:Math.round(approach.y/step)} : null;
 const clearSegment=(p,q)=>{
  const dx=q.x-p.x,dy=q.y-p.y,length2=dx*dx+dy*dy;
  return !obstacles.some(node=>{
   const c=center(node),t=length2?Math.max(0,Math.min(1,((c.x-p.x)*dx+(c.y-p.y)*dy)/length2)):0;
   return Math.hypot(p.x+t*dx-c.x,p.y+t*dy-c.y)<node.r+(node.key===target.key ? 0 : padding);
  });
 };
 // Most corridors are unobstructed. Only allocate/rasterize a grid when a detour is needed.
 let occupancy;
 const prepareOccupancy=()=>{
  if (occupancy) return;
 occupancy=new Uint8Array(cols*rows);
 for(const node of obstacles) {
  const c=center(node),radius=node.r+(node.key===target.key ? 0 : padding);
  const minX=Math.max(0,Math.floor((c.x-radius)/step)),maxX=Math.min(cols-1,Math.ceil((c.x+radius)/step));
  const minY=Math.max(0,Math.floor((c.y-radius)/step)),maxY=Math.min(rows-1,Math.ceil((c.y+radius)/step));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(Math.hypot(x*step-c.x,y*step-c.y)<radius)occupancy[y*cols+x]=1;
 }
 };
 const search=(start,goal)=>{
  const endpoint = gate && goal === gate ? approach : arrival;
  if (clearSegment(a, endpoint)) return [a, endpoint];
  prepareOccupancy();
  const total=cols*rows,previous=new Int32Array(total),cost=new Int32Array(total),closed=new Uint8Array(total);
  previous.fill(-2);cost.fill(2147483647);
  const first=index(start.x,start.y),last=index(goal.x,goal.y);
  if(first<0||first>=total||last<0||last>=total)return null;
  const heap=[];
  const push=(cell,score)=>{
   let i=heap.length;heap.push({cell,score});
   while(i>0){const parent=(i-1)>>1;if(heap[parent].score<=score)break;heap[i]=heap[parent];i=parent;}
   heap[i]={cell,score};
  };
  const pop=()=>{
   const result=heap[0],tail=heap.pop();
   if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=tail.score)break;heap[i]=heap[child];i=child;}heap[i]=tail;}
   return result.cell;
  };
  previous[first]=-1;cost[first]=0;push(first,0);
  const directions=[[1,0],[0,1],[0,-1],[-1,0]];
  while(heap.length){
   const cell=pop(),x=cell%cols,y=Math.floor(cell/cols);
   if(closed[cell])continue;
   closed[cell]=1;
   if(cell===last){
    const points=[];
    for(let cursor=cell;cursor!==-1;cursor=previous[cursor])points.push({x:(cursor%cols)*step,y:Math.floor(cursor/cols)*step});
    return points.reverse();
   }
   for(const [dx,dy] of directions){
    const nextX=x+dx,nextY=y+dy,key=index(nextX,nextY);
    if(nextX<1||nextY<1||nextX>=cols-1||nextY>=rows-1||closed[key]||occupancy[key]||cost[cell]+1>=cost[key])continue;
    previous[key]=cell;cost[key]=cost[cell]+1;
    const remaining=Math.abs(nextX-goal.x)+Math.abs(nextY-goal.y);
    push(key,cost[key]+remaining+remaining*.0001);
   }
  }
  return null;
 };
 const legs=gate ? [search(start,gate),[approach,corridor,arrival]] : [search(start,goal)];
 if(legs.some(leg=>!leg))return retry ? (corridor ? routeCircleConnection(source,target,circles,width,height,true,null,lane) : '') : routeCircleConnection(source,target,circles,width,height,true,corridor,lane);
 legs[0][0]=a;
 if(gate)legs[0][legs[0].length-1]=approach;
 legs.at(-1)[legs.at(-1).length-1]=arrival;
 const clear = clearSegment;
 const simplified=[];
 for(const points of legs){
  const segment=[points[0]];
  for(let i=0;i<points.length-1;){let j=points.length-1;while(j>i+1&&!clear(points[i],points[j]))j--;segment.push(points[j]);i=j;}
  simplified.push(...(simplified.length ? segment.slice(1) : segment));
 }
 const boundary=(origin,toward,r)=>{const dx=toward.x-origin.x,dy=toward.y-origin.y,d=Math.hypot(dx,dy)||1;return {x:origin.x+dx*r/d,y:origin.y+dy*r/d};};
 // Remove all path portions inside either endpoint circle.
 while(simplified.length>2&&Math.hypot(simplified[1].x-a.x,simplified[1].y-a.y)<source.r)simplified.splice(1,1);
 simplified[0]=boundary(a,simplified[1],source.r);
 simplified.push(end);
 let path = `M ${simplified[0].x} ${simplified[0].y}`;
 for (let i = 1; i < simplified.length - 1; i++) {
  const previous = simplified[i - 1], point = simplified[i], next = simplified[i + 1];
  const incoming = Math.hypot(point.x - previous.x, point.y - previous.y);
  const outgoing = Math.hypot(next.x - point.x, next.y - point.y);
  let radius = Math.min(96, incoming / 2, outgoing / 2);
  let before, after;
  // Use broad curves where there is room; tighten only near obstacles.
  for (;;) {
   before = {x: point.x + (previous.x - point.x) * radius / incoming, y: point.y + (previous.y - point.y) * radius / incoming};
   after = {x: point.x + (next.x - point.x) * radius / outgoing, y: point.y + (next.y - point.y) * radius / outgoing};
   let collision = false;
   for (let sample = 0; sample <= 16; sample++) {
    const t=sample/16,u=1-t;
    if (blocked(u*u*before.x+2*u*t*point.x+t*t*after.x,u*u*before.y+2*u*t*point.y+t*t*after.y)) { collision=true; break; }
   }
   if (!collision || radius <= 2) break;
   radius /= 2;
  }
  path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
 }
 const last = simplified.at(-1);
 return path + ` L ${last.x} ${last.y}`;
}
