import { hierarchy, pack } from 'd3-hierarchy';
import { platformConnectionNames } from './entityNetwork.js';
import { normalizeName } from './publisherNetwork.js';
import { vennOwnershipFamilies } from './vennOwnership.js';

export function layoutVennNetwork(focus, entries, ownership) {
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
 const counts = Object.fromEntries(['lawsuit','deal','grant'].map(type=>[type,[...entities.values()].filter(entity=>entity.types.has(type)).length]));
 const trees = focus.type === 'platform' ? vennOwnershipFamilies(entities,ownership) : [...entities.values()];
 const groups = new Map();
 for (const tree of trees) {
  const key = [...tree.types].sort().join('|');
  if (!key) continue;
  if (!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(tree);
 }
 const nodes = [], jobs = [];
 function prepare(items,cx,cy,size) {
  const root = hierarchy({children:items}).sum(node=>node.children ? 0 : 1);
  pack().radius(()=>40).padding(12)(root);
  jobs.push({root,cx,cy,size});
 }
 // Equal leaf radii; ownership containers grow recursively to hold their children.
 for (const [key,items] of groups) prepare(items,0,0,0);
 const ordered = [...groups.keys()];
 const gap = 28;
 const largest = Math.max(60,...jobs.map(job=>job.root.r));
 const anchors = {lawsuit:{x:0,y:0},deal:{x:largest*2+gap,y:0},grant:{x:largest+gap/2,y:largest*1.75+gap}};
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
 const styles = {lawsuit:{label:'Lawsuits',color:'#b4232d',fill:'#fbe9e9'},deal:{label:'Deals',color:'#21823b',fill:'#e8f3e9'},grant:{label:'Grants',color:'#1565c0',fill:'#e5effb'}};
 const circles = Object.keys(styles).filter(type=>counts[type]).map(type=>{
  const members=jobs.filter((job,index)=>ordered[index].split('|').includes(type));
  const weight=members.reduce((sum,job)=>sum+job.root.r**2,0);
  const x=members.reduce((sum,job)=>sum+job.cx*job.root.r**2,0)/weight;
  const y=members.reduce((sum,job)=>sum+job.cy*job.root.r**2,0)/weight;
  const r=Math.max(...members.map(job=>Math.hypot(job.cx-x,job.cy-y)+job.root.r))+24;
  return {type,...styles[type],x,y,r,count:counts[type]};
 });
 const right=Math.max(0,...circles.map(circle=>circle.x+circle.r));
 const centerY=circles.length ? (Math.min(...circles.map(circle=>circle.y-circle.r))+Math.max(...circles.map(circle=>circle.y+circle.r)))/2 : 0;
 if (focus.type === 'publisher') {
  const family=vennOwnershipFamilies(new Map([[normalizeName(focus.name),{name:focus.name,types:new Set()}]]),ownership);
  prepare(family,0,centerY,0);
  jobs[jobs.length-1].cx=right+100+jobs[jobs.length-1].root.r;
 } else nodes.push({key:`platform:${focus.name}`,name:focus.name,x:right+100,y:centerY-76,r:76,width:152,height:152,depth:0,hasChildren:false});
 for (const {root,cx,cy} of jobs) {
  for (const node of root.descendants().slice(1)) {
   const r=node.r;
   const centerX=cx+node.x-root.x, centerY=cy+node.y-root.y;
   nodes.push({key:node.data.key,name:node.data.name,x:centerX-r,y:centerY-r,r,width:2*r,height:2*r,depth:node.depth-1,hasChildren:Boolean(node.children?.length),primary:node.depth===1});
  }
 }
 return {nodes,circles,headings:circles.map(circle=>({key:circle.type,label:circle.label,color:circle.color,x:circle.x,y:circle.type==='grant' ? circle.y+circle.r+15 : circle.y-circle.r-15}))};
}
