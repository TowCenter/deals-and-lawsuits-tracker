import { routeCircleConnection } from './publisherNetwork.js';

// Compute routes off the UI thread, then publish the complete graph once.
self.onmessage = ({data:{nodes,routes,width,height}}) => {
 let paths=[];
 for(const {key,source,target} of routes){
  paths.push([key,routeCircleConnection(source,target,nodes,width,height)]);
 }
 self.postMessage({paths,complete:true});
};
