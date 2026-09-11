import{describe,expect,it}from'vitest';
import{ScenePlayback}from'../../src/animation/playback';
import{RunController}from'../../src/game/run';
const pad={worldFromLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-3,1],radiusX:.4,radiusY:.3};
function shot(power=60){return new RunController().adjudicateFire({roundId:1,powerPercent:power,angleDegrees:0,powerLockedAtMs:100,firedAtMs:200,origin:[0,0,0],padSnapshot:pad})!;}
const options={endingId:'representative-iron',alreadySeen:false,minimizeScenes:false};
describe('actual scene lifecycle',()=>{
 it('unlocks only at main entry, marks seen at core and finishes exactly once',()=>{
  const p=new ScenePlayback('iron',shot(),options);
  expect(p.update(1000)).toEqual([]);
  expect(p.skip()).toEqual([]);
  expect(p.update(2100).map(e=>e.type)).toEqual(['DISCOVER','UNLOCK']);
  expect(p.update(5100).map(e=>e.type)).toEqual(['SEEN']);
  expect(p.view().canSkip).toBe(true);
  expect(p.skip().map(e=>e.type)).toEqual(['FINISH']);
  expect(p.update(9999)).toEqual([]);expect(p.skip()).toEqual([]);
 });
 it('minimizing a new scene unlocks without marking seen',()=>{
  const p=new ScenePlayback('iron',shot(),{...options,minimizeScenes:true});
  expect(p.update(2100).map(e=>e.type)).toEqual(['DISCOVER','UNLOCK','FINISH']);
  expect(p.skip()).toEqual([]);
 });
 it('a sparse frame reaches the same ordered lifecycle events',()=>{
  const p=new ScenePlayback('iron',shot(),options);
  expect(p.update(7000).map(e=>e.type)).toEqual(['DISCOVER','UNLOCK','SEEN','FINISH']);
 });
 it('a dropped frame cannot mark a minimized new scene as seen',()=>{
  const p=new ScenePlayback('iron',shot(),{...options,minimizeScenes:true});
  expect(p.update(9000).map(e=>e.type)).toEqual(['DISCOVER','UNLOCK','FINISH']);
 });
 it('success discovers but does not select/unlock a failure ending',()=>{
  const p=new ScenePlayback('iron',shot(100),{...options,endingId:null});
  expect(p.update(4100).map(e=>e.type)).toEqual(['DISCOVER','FINISH']);
 });
 it('rejects mismatched causes and cleanup never finishes a run',()=>{
  expect(()=>new ScenePlayback('iron',shot(),{...options,endingId:'self-own'})).toThrow(RangeError);
  const p=new ScenePlayback('iron',shot(),options);p.update(2100);p.cleanup();expect(p.update(8000)).toEqual([]);
 });
});
