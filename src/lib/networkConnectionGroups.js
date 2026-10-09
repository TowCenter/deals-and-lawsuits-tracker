/** One line per pair/type; retain distinct records for counts and card selection. */
export function groupNetworkConnections(connections, kind, active = () => false) {
 const groups=new Map();
 for (const connection of connections) {
  const key=JSON.stringify([connection.node.key,connection.company,kind(connection.entry)]);
  let group=groups.get(key);
  if (!group) {
   group={...connection,key,records:[],count:0};
   groups.set(key,group);
  }
  if (!group.records.some(record=>record.id===connection.entry.id)) group.records.push(connection.entry);
  if (!active(group.entry,group.node,group.company) && active(connection.entry,connection.node,connection.company)) group.entry=connection.entry;
  group.count=group.records.length;
 }
 return [...groups.values()];
}
