import { routeCircleConnection } from './publisherNetwork.js';

// Keep obstacle routing off the UI thread and stream results as they become available.
self.onmessage = ({data:{nodes,routes,width,height}}) => {
 let paths=[];
 for(const {key,source,target} of routes){
  const corridor={x:target.x-96,y:target.y+target.r};
  paths.push([key,routeCircleConnection(source,target,nodes,width,height,false,corridor)]);
  if(paths.length===4){self.postMessage({paths,complete:false});paths=[];}
 }
 self.postMessage({paths,complete:true});
};
