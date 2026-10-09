import { hierarchy, pack } from 'd3-hierarchy';
import { platformConnectionNames } from './entityNetwork.js';
import { normalizeName } from './publisherNetwork.js';
import { vennOwnershipFamilies } from './vennOwnership.js';

const layoutCache = new WeakMap();

// Dataset and ownership maps are immutable during a network session.
export function layoutVennNetwork(focus, entries, ownership, filter = null) {
 let byOwnership=layoutCache.get(entries);
 if (!byOwnership) {byOwnership=new WeakMap();layoutCache.set(entries,byOwnership);}
 let views=byOwnership.get(ownership);
 if (!views) {views=new Map();byOwnership.set(ownership,views);}
 const key=JSON.stringify([focus.type,normalizeName(focus.name),filter]);
 if (!views.has(key)) views.set(key,buildVennLayout(focus,entries,ownership,filter));
 return views.get(key);
}

function buildVennLayout(focus, entries, ownership, filter) {
 const entities = new Map();
 for (const entry of entries) {
  const names = focus.type === 'platform' ? platformConnectionNames(entry,ownership) : entry.companies;
  for (const name of names) {
   const key = focus.type === 'platform' ? normalizeName(name) : `platform:${name}`;
   if (!entities.has(key)) entities.set(key,{key,name,types:new Set()});
   for (const value of entry.interaction || []) {
    const type = String(value).toLowerCase();
    if (['lawsuit','deal','grant'].includes(type)) entities.get(key).types.add(type);
   }
  }
 }
 if (filter) for (const [key,entity] of entities) if (!entity.types.has(filter)) entities.delete(key);
 const counts = Object.fromEntries(['lawsuit','deal','grant'].map(type=>[type,[...entities.values()].filter(entity=>entity.types.has(type)).length]));
 // Filter direct participants, then retain their ownership families as context.
 const trees = focus.type === 'platform' ? vennOwnershipFamilies(entities,ownership) : [...entities.values()];
 const groups = new Map();
 for (const tree of trees.slice().sort((a,b)=>a.key.localeCompare(b.key))) {
  const key = [...tree.types].sort().join('|');
  if (!key) continue;
  if (!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(tree);
 }
 const nodes = [], jobs = [];
 function prepare(items,cx,cy) {
  const root = hierarchy({children:items}).sum(node=>node.children ? 0 : 1).sort((a,b)=>String(a.data.key || '').localeCompare(String(b.data.key || '')));
  pack().radius(()=>40).padding(12)(root);
  jobs.push({root,cx,cy});
 }
 // Equal leaf radii; ownership containers grow recursively to hold their children.
 const ordered = [...groups.keys()].sort();
 for (const key of ordered) prepare(groups.get(key),0,0);
 const gap = 28;
 const radiusFor = type => jobs[ordered.indexOf(type)]?.root.r || 60;
 const lawsuitRadius=radiusFor('lawsuit'), dealRadius=radiusFor('deal'), grantRadius=radiusFor('grant');
 const horizontal=lawsuitRadius+dealRadius+gap;
 const fromLawsuits=lawsuitRadius+grantRadius+gap;
 const fromDeals=dealRadius+grantRadius+gap;
 const grantX=(horizontal**2+fromLawsuits**2-fromDeals**2)/(2*horizontal);
 const grantY=Math.sqrt(Math.max(0,fromLawsuits**2-grantX**2));
 const anchors={lawsuit:{x:0,y:0},deal:{x:horizontal,y:0},grant:{x:grantX,y:grantY}};
 // Exclusive groups sit outside, while shared groups sit between their categories.
 for (let i=0;i<jobs.length;i++) {
  const types = ordered[i].split('|');
  jobs[i].cx = types.reduce((sum,type)=>sum+anchors[type].x,0)/types.length;
  jobs[i].cy = types.reduce((sum,type)=>sum+anchors[type].y,0)/types.length;
 }
 // Resolve packed-group collisions without shrinking any publisher bubbles.
 for (let iteration=0;iteration<120;iteration++) {
  for (let i=0;i<jobs.length;i++) for (let j=i+1;j<jobs.length;j++) {
   const a=jobs[i], b=jobs[j], dx=b.cx-a.cx, dy=b.cy-a.cy;
   const distance=Math.hypot(dx,dy), required=a.root.r+b.root.r+gap;
   if (distance>=required) continue;
   const ux=distance ? dx/distance : 1, uy=distance ? dy/distance : 0;
   const shift=(required-distance)/2;
   a.cx-=ux*shift; a.cy-=uy*shift; b.cx+=ux*shift; b.cy+=uy*shift;
  }
 }
 const styles = {lawsuit:{label:'Lawsuits',color:'#b4232d'},deal:{label:'Deals',color:'#21823b'},grant:{label:'Grants',color:'#1565c0'}};
 const makeCircles = () => Object.keys(styles).filter(type=>counts[type]).map(type=>{
  const members=jobs.filter((job,index)=>ordered[index].split('|').includes(type));
  const weight=members.reduce((sum,job)=>sum+job.root.r**2,0);
  const x=members.reduce((sum,job)=>sum+job.cx*job.root.r**2,0)/weight;
  const y=members.reduce((sum,job)=>sum+job.cy*job.root.r**2,0)/weight;
  const r=Math.max(Math.max(...members.map(job=>Math.hypot(job.cx-x,job.cy-y)+job.root.r))+24, Math.max(0,...jobs.map(job=>job.root.r))*0.14);
  return {type,...styles[type],x,y,r,count:counts[type]};
 });
 let circles=makeCircles();
 // Padding and minimum title sizes must not create overlaps between disjoint sets.
 for (let iteration=0;iteration<60;iteration++) {
  let moved=false;
  for (let i=0;i<circles.length;i++) for (let j=i+1;j<circles.length;j++) {
   const a=circles[i], b=circles[j];
   if (ordered.some(key=>key.split('|').includes(a.type) && key.split('|').includes(b.type))) continue;
   const dx=b.x-a.x, dy=b.y-a.y, distance=Math.hypot(dx,dy);
   const required=a.r+b.r+12;
   if (distance>=required-.01) continue;
   const ux=distance ? dx/distance : 1, uy=distance ? dy/distance : 0;
   const shift=(required-distance)/2;
   jobs.forEach((job,index)=>{
    const types=ordered[index].split('|');
    if (types.includes(a.type)) {job.cx-=ux*shift;job.cy-=uy*shift;}
    if (types.includes(b.type)) {job.cx+=ux*shift;job.cy+=uy*shift;}
   });
   moved=true;
  }
  if (!moved) break;
  circles=makeCircles();
 }
 const right=Math.max(0,...circles.map(circle=>circle.x+circle.r));
 const centerY=circles.length ? (Math.min(...circles.map(circle=>circle.y-circle.r))+Math.max(...circles.map(circle=>circle.y+circle.r)))/2 : 0;
 if (focus.type === 'publisher') {
  const family=vennOwnershipFamilies(new Map([[normalizeName(focus.name),{name:focus.name,types:new Set()}]]),ownership);
  prepare(family,0,centerY);
  jobs[jobs.length-1].cx=right+100+jobs[jobs.length-1].root.r;
 } else nodes.push({key:`platform:${focus.name}`,name:focus.name,x:right+100,y:centerY-76,r:76,width:152,height:152,depth:0,hasChildren:false});
 for (const {root,cx,cy} of jobs) {
  for (const node of root.descendants().slice(1)) {
   const r=node.r;
   const centerX=cx+node.x-root.x, centerY=cy+node.y-root.y;
   nodes.push({key:node.data.key,name:node.data.name,x:centerX-r,y:centerY-r,r,width:2*r,height:2*r,depth:node.depth-1,hasChildren:Boolean(node.children?.length),hasDirectRelationship:Boolean(node.data.ownTypes?.size || (!node.data.ownTypes && node.data.types?.size)),primary:node.depth===1});
  }
 }
 return {nodes,circles,headings:circles.map(circle=>({key:circle.type,label:circle.label,color:circle.color,x:circle.x,y:circle.type==='grant' ? circle.y+circle.r+15 : circle.y-circle.r-15}))};
}
