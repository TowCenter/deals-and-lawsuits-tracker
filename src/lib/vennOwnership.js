import { normalizeName, ownershipFamily } from './publisherNetwork.js';

/** Keep ownership intact; classify a whole family by its combined direct relationships. */
export function vennOwnershipFamilies(entities, ownership) {
 const family = new Set([...entities.values()].flatMap(entity => [...ownershipFamily(ownership,entity.name)]));
 const children = new Set([...family].flatMap(key => [...(ownership.get(key)?.children || [])]));
 const visited = new Set();
 const build = key => {
  if (visited.has(key)) return null;
  visited.add(key);
  const descendants = [...(ownership.get(key)?.children || [])].filter(child=>family.has(child)).sort().map(build).filter(Boolean);
  const ownTypes = entities.get(normalizeName(key))?.types || new Set();
  const types = new Set([...ownTypes,...descendants.flatMap(child=>[...child.types])]);
  return {name:ownership.get(key)?.name || key,key,ownTypes,types,children:descendants.length ? descendants : undefined};
 };
 const roots = [...family].filter(key=>!children.has(key)).sort().map(build).filter(Boolean);
 for (const key of [...family].sort()) if (!visited.has(key)) roots.push(build(key));
 return roots;
}
