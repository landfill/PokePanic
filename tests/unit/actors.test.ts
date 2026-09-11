import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ACTOR_IDS, createActor, type ActorId } from '../../src/characters/rig';

const props:Readonly<Record<ActorId,string>>={
  iron:'gym-bag',complaint:'phone',manager:'manager-watch',action:'action-badge',
  yoga:'yoga-band',guard:'guard-earpiece',walker:'walker-vest',referee:'referee-whistle',
};

describe('M3 adult actor rigs',()=>{
  it.each(ACTOR_IDS)('%s has the full hierarchy, signature prop and standard pad',id=>{
    const actor=createActor(id);actor.root.updateMatrixWorld(true);
    expect(actor.root.name).toBe(`actor-${id}`);
    for(const [name,part] of Object.entries(actor.parts)){expect(part).toBeInstanceOf(THREE.Group);expect(part.name).toBe(name.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`));}
    expect(actor.root.getObjectByName(props[id])).toBeDefined();
    actor.pad.geometry.computeBoundingBox();const size=actor.pad.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(.62,5);expect(size.y).toBeCloseTo(.48,5);expect(size.z).toBeCloseTo(.09,5);
    expect(actor.pad.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0,1.5,.39]);
    const bounds=new THREE.Box3().setFromObject(actor.root);expect(bounds.min.y).toBeCloseTo(0,5);
    expect(bounds.max.y).toBeGreaterThan(3.5);expect(bounds.max.y).toBeLessThan(4.1);
    let meshes=0;actor.root.traverse(object=>{if(object instanceof THREE.Mesh)meshes++;});expect(meshes).toBeLessThanOrEqual(45);
    actor.dispose();actor.dispose();expect(actor.root.children).toHaveLength(0);
  });

  it('uses eight distinct full-body silhouette signatures rather than color-only copies',()=>{
    const signatures=new Set<string>();
    for(const id of ACTOR_IDS){const actor=createActor(id);const size=new THREE.Box3().setFromObject(actor.root).getSize(new THREE.Vector3());
      signatures.add([size.x,size.y,size.z].map(value=>value.toFixed(3)).join(':'));actor.dispose();}
    expect(signatures.size).toBe(ACTOR_IDS.length);
  });

  it('rejects an unknown runtime id instead of silently creating a default actor',()=>{
    expect(()=>createActor('unknown' as ActorId)).toThrow(RangeError);
  });
});
