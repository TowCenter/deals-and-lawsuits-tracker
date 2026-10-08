import { routeCircleConnection } from './publisherNetwork.js';

// Compute routes off the UI thread, then publish the complete graph once.
self.onmessage = ({data:{nodes,routes,width,height}}) => {
 let paths=[];
 for(const {key,source,target} of routes){
  const corridor={x:target.x-96,y:target.y+target.r};
  paths.push([key,routeCircleConnection(source,target,nodes,width,height,false,corridor)]);
 }
 self.postMessage({paths,complete:true});
};
