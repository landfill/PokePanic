import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticSiblings } from '../../src/scene/batching';
import { createActor } from '../../src/characters/rig';

describe('static scene batching',()=>{
  it('preserves parent-local/world bounds and named dynamic sockets',()=>{
    const parent=new THREE.Group();parent.position.set(3,2,-1);parent.rotation.y=.3;
    const material=new THREE.MeshStandardMaterial({color:'red'});
    for(const x of [-1,1]){const item=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.75),material);item.position.set(x,.4,.2);parent.add(item);}
    const socket=new THREE.Group();socket.name='wrist-socket';socket.position.set(.2,1.5,.1);parent.add(socket);
    parent.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(parent);const socketBefore=socket.getWorldPosition(new THREE.Vector3());
    expect(batchStaticSiblings(parent)).toEqual({before:2,after:1});parent.updateMatrixWorld(true);
    const after=new THREE.Box3().setFromObject(parent);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6);expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6);
    expect(socket.getWorldPosition(new THREE.Vector3()).distanceTo(socketBefore)).toBeLessThan(1e-9);
    expect(parent.getObjectByName('wrist-socket')).toBe(socket);
    parent.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});material.dispose();
  });
  it('keeps actor hand groups and animated face parts after reducing static meshes',()=>{
    const actor=createActor('iron');let meshes=0;actor.root.traverse(object=>{if(object instanceof THREE.Mesh)meshes++;});
    expect(meshes).toBeLessThanOrEqual(36);
    expect(actor.root.getObjectByName('right-hand')).toBeInstanceOf(THREE.Group);
    expect(actor.root.getObjectByName('left-brow')).toBeInstanceOf(THREE.Mesh);
    expect(actor.root.getObjectByName('mouth')).toBeInstanceOf(THREE.Mesh);actor.dispose();
  });
});
