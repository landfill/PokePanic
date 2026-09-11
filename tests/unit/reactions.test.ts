import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createReactionEnsemble, type ReactionFrame } from '../../src/scene/reactions';
import { padFrontMatrix } from '../../src/scene/stage';

function snapshot(root: THREE.Group): number[] {
  root.updateMatrixWorld(true);
  const values:number[]=[];
  root.traverse(object=>values.push(...object.matrixWorld.elements.map(value=>Number(value.toFixed(8)))));
  return values;
}

const frame=(elapsedMs:number):ReactionFrame=>({actorId:'iron',failureType:'UNDERPOWER_HIT',
  endingId:'representative-iron',elapsedMs,reducedMotion:false,gripWorldPoint:[-.7,2.1,.1]});

describe('deterministic reaction ensemble',()=>{
  it('has identical transforms after repeated frames and backwards seeking',()=>{
    const ensemble=createReactionEnsemble();
    ensemble.update(frame(4200));const expected=snapshot(ensemble.root);
    for(let count=0;count<100;count++)ensemble.update(frame(4200));
    expect(snapshot(ensemble.root)).toEqual(expected);
    ensemble.update(frame(5700));ensemble.update(frame(2500));ensemble.update(frame(4200));
    expect(snapshot(ensemble.root)).toEqual(expected);ensemble.dispose();
  });

  it('aligns the player collar to the supplied grip and keeps cuffs connected to both wrists',()=>{
    const ensemble=createReactionEnsemble();
    ensemble.update(frame(4700));ensemble.root.updateMatrixWorld(true);
    const collar=ensemble.root.getObjectByName('collar-grip-point')!;
    const grip=new THREE.Vector3(-.7,2.1,.1);
    expect(collar.getWorldPosition(new THREE.Vector3()).distanceTo(grip)).toBeLessThan(.04);
    ensemble.update({actorId:'complaint',failureType:'UNDERPOWER_HIT',endingId:'representative-complaint',
      elapsedMs:5000,reducedMotion:false});ensemble.root.updateMatrixWorld(true);
    const cuffs=['left-wrist-cuff','right-wrist-cuff'].map(name=>ensemble.root.getObjectByName(name)!);
    expect(cuffs.every(cuff=>cuff.visible)).toBe(true);
    const wrists=['left-wrist-socket','right-wrist-socket'].map(name=>ensemble.root.getObjectByName('adult-player')!.getObjectByName(name)!);
    for(let index=0;index<cuffs.length;index++){const cuffNormal=new THREE.Vector3(0,0,1).applyQuaternion(cuffs[index]!.getWorldQuaternion(new THREE.Quaternion()));
      const wristAxis=new THREE.Vector3(0,1,0).applyQuaternion(wrists[index]!.getWorldQuaternion(new THREE.Quaternion()));
      expect(Math.abs(cuffNormal.dot(wristAxis))).toBeCloseTo(1,5);}
    const chain=ensemble.root.getObjectByName('connecting-chain')!;
    const cuffDistance=cuffs[0]!.getWorldPosition(new THREE.Vector3()).distanceTo(cuffs[1]!.getWorldPosition(new THREE.Vector3()));
    expect(chain.scale.x*.36).toBeCloseTo(cuffDistance,5);
    ensemble.update({actorId:'complaint',failureType:'UNDERPOWER_HIT',endingId:'representative-complaint',
      elapsedMs:5800,reducedMotion:false});
    const playerX=ensemble.root.getObjectByName('adult-player')!.position.x;
    const leftX=ensemble.root.getObjectByName('police-left')!.position.x;
    const rightX=ensemble.root.getObjectByName('police-right')!.position.x;
    expect(playerX-leftX).toBeCloseTo(.9);expect(rightX-playerX).toBeCloseTo(.9);
    expect(rightX-leftX).toBeLessThanOrEqual(1.8);ensemble.dispose();
  });

  it('places the scoring plane on the visible front face of the pad',()=>{
    const world=new THREE.Matrix4().makeTranslation(.2,1.5,.39);
    const front=new THREE.Matrix4().fromArray(padFrontMatrix(world));
    const point=new THREE.Vector3().setFromMatrixPosition(front);
    expect(point.x).toBeCloseTo(.2);expect(point.y).toBeCloseTo(1.5);expect(point.z).toBeCloseTo(.435);
  });
});
