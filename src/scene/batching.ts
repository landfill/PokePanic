import { Group, Mesh, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface BatchResult { readonly before: number; readonly after: number }

/** Merges direct, static mesh children by shared material. Each geometry is
 * copied and baked into parent-local space; named/dynamic children can be kept. */
export function batchStaticSiblings(parent: Group, keepNames: ReadonlySet<string> = new Set()): BatchResult {
  const candidates:Mesh[]=[];
  const groups=new Map<Material,Mesh[]>();
  for(const child of parent.children){if(!(child instanceof Mesh)||keepNames.has(child.name)||Array.isArray(child.material))continue;
    candidates.push(child);const material=child.material as Material;const siblings=groups.get(material)??[];
    siblings.push(child);groups.set(material,siblings);}
  let after=candidates.length;
  for(const [material,items] of groups){
    if(items.length<2)continue;
    const geometries:BufferGeometry[]=items.map(item=>{item.updateMatrix();const copy=item.geometry.index
      ?item.geometry.toNonIndexed():item.geometry.clone();return copy.applyMatrix4(item.matrix);});
    const combined=mergeGeometries(geometries,false);
    geometries.forEach(geometry=>geometry.dispose());
    if(combined===null)continue;
    const merged=new Mesh(combined,material);merged.name=`static-batch-${items[0]!.name}`;
    merged.castShadow=items.some(item=>item.castShadow);merged.receiveShadow=items.some(item=>item.receiveShadow);
    for(const item of items){parent.remove(item);item.geometry.dispose();}
    parent.add(merged);after-=items.length-1;
  }
  return Object.freeze({before:candidates.length,after});
}
