import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createActor, type ActorId } from '../characters/rig';
import type { AdjudicatedShot } from '../game/run';
import type { PadSnapshot } from '../game/geometry';
import { createReactionEnsemble } from './reactions';
import { batchStaticSiblings } from './batching';

const PAD_FRONT_OFFSET = 0.045;
export function padFrontMatrix(matrixWorld: THREE.Matrix4): readonly number[] {
  return matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,PAD_FRONT_OFFSET)).toArray();
}

export class GameStage {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(25, 1, 0.05, 60);
  private actor: ReturnType<typeof createActor> | null = null;
  private readonly glove = new THREE.Group();
  private readonly origin = new THREE.Vector3(0, 1.5, 1.3);
  private readonly target = new THREE.Vector3(0, 1.5, 0.36);
  private readonly aimCamera = new THREE.Vector3(0, 1.72, 3.6);
  private readonly wideCamera = new THREE.Vector3(0, 2.7, 8.9);
  private readonly payoffCamera = new THREE.Vector3(0, 2.35, 13.5);
  private readonly observer: ResizeObserver;
  private readonly reactions = createReactionEnsemble();
  private actorId: ActorId = 'iron';
  private actorX = 0;
  private disposed = false;
  private readonly handleContextLost: (event: Event) => void;
  private readonly handleContextRestored: () => void;

  constructor(private readonly host: HTMLElement, onLost: () => void, onRestored: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
    this.renderer.setClearColor('#d9ded6');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.append(this.renderer.domElement);
    this.handleContextLost=event=>{event.preventDefault();if(!this.disposed)onLost();};
    this.handleContextRestored=()=>{if(!this.disposed)onRestored();};
    this.renderer.domElement.addEventListener('webglcontextlost',this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.handleContextRestored);
    this.scene.add(new THREE.HemisphereLight('#fff8e7', '#536474', 2.5));
    const light = new THREE.DirectionalLight('#fff4dc', 3.2);
    light.position.set(-3, 7, 5); light.castShadow = true;
    light.shadow.mapSize.set(1024,1024); light.shadow.camera.left=-5;light.shadow.camera.right=5;
    light.shadow.camera.top=6;light.shadow.camera.bottom=-4;light.shadow.bias=-0.001;
    this.scene.add(light);
    const fill = new THREE.DirectionalLight('#c5eff2',1.5); fill.position.set(4,3,-3);this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#d5d9c8',roughness:0.92}));
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30,16),new THREE.MeshStandardMaterial({color:'#dce5df',roughness:1}));
    wall.position.set(0,6,-5);this.scene.add(wall);
    const mat = new THREE.Mesh(new RoundedBoxGeometry(4,0.12,3,3,0.06),new THREE.MeshStandardMaterial({color:'#259a9a',roughness:0.82}));
    mat.position.set(0,0.02,0.5);mat.receiveShadow=true;this.scene.add(mat);
    this.makeGlove();this.glove.scale.setScalar(.55);this.scene.add(this.glove);this.scene.add(this.reactions.root);
    this.observer = new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  }

  prepare(id: ActorId, targetX = 0): {origin: readonly [number,number,number];padSnapshot:PadSnapshot} {
    if (this.actor) { this.scene.remove(this.actor.root); this.actor.dispose(); }
    this.actorId=id;this.actorX=targetX;this.reactions.reset();this.reactions.root.position.x=targetX;
    this.actor=createActor(id);this.actor.root.position.x=targetX;this.scene.add(this.actor.root);
    this.actor.setPose(0,0,false); this.actor.root.updateMatrixWorld(true);
    const frontMatrix=new THREE.Matrix4().fromArray(padFrontMatrix(this.actor.pad.matrixWorld));
    const center=new THREE.Vector3().setFromMatrixPosition(frontMatrix);this.target.copy(center);
    this.glove.visible=true;this.glove.scale.setScalar(.55);this.glove.position.copy(this.origin);this.glove.rotation.set(0,0,0);
    return {origin:[this.origin.x,this.origin.y,this.origin.z], padSnapshot:{
      worldFromLocal:frontMatrix.toArray(),radiusX:0.31,radiusY:0.24,
    }};
  }

  draw(angleDegrees: number, shot: AdjudicatedShot|null, elapsedMs = 0, reducedMotion = false,
    screenShake = false, endingId?: string): void {
    const reveal = shot ? THREE.MathUtils.smoothstep(elapsedMs,850,1900) : 0;
    const mainElapsed=Math.max(0,elapsedMs-1900);
    const reaction = shot ? THREE.MathUtils.clamp(mainElapsed/(shot.score.isSuccess?1800:3600),0,1) : 0;
    if(this.actor){this.actor.root.position.x=this.actorX;this.actor.root.rotation.x=0;this.actor.root.rotation.z=0;
      this.actor.parts.leftLeg.scale.set(1,1,1);this.actor.parts.rightLeg.scale.set(1,1,1);
      const bag=this.actor.root.getObjectByName('gym-bag');if(bag){bag.position.y=.32;bag.rotation.set(0,0,0);bag.visible=reveal>=.6;}
      const phone=this.actor.root.getObjectByName('phone');if(phone){phone.rotation.set(0,0,0);phone.visible=reveal>=.6;}}
    this.actor?.setPose(reveal,reaction,shot?.score.isSuccess ?? false);
    if(this.actor&&shot?.failureType==='NEAR_SUCCESS'){
      const bend=Math.sin(THREE.MathUtils.clamp(mainElapsed/1300,0,1)*Math.PI);
      this.actor.root.position.y-=bend*.18;
      this.actor.parts.leftLeg.scale.y=1-bend*.12;this.actor.parts.rightLeg.scale.y=1-bend*.12;
      this.actor.parts.leftLeg.rotation.z=-bend*.08;this.actor.parts.rightLeg.rotation.z=bend*.08;
    }
    if(this.actor&&this.actorId==='iron'&&shot&&shot.failureType!==null&&!shot.score.isSuccess&&mainElapsed>900
      &&shot.failureType!=='HIGH_POWER_MISS'&&shot.failureType!=='MISS'){
      const grip=THREE.MathUtils.smoothstep(mainElapsed,900,1700);
      this.actor.parts.rightArm.rotation.x=-.72*grip;this.actor.parts.rightArm.rotation.z=.72*grip;
    }
    if(this.actor&&this.actorId==='complaint'&&shot&&shot.failureType!==null&&!shot.score.isSuccess){
      const phone=this.actor.root.getObjectByName('phone');if(phone){const tap=THREE.MathUtils.smoothstep(mainElapsed,450,900);
        phone.rotation.x=-.35*Math.sin(tap*Math.PI);}
    }
    if(this.actor&&shot){
      const active=THREE.MathUtils.smoothstep(mainElapsed,350,1400);
      const payoff=THREE.MathUtils.smoothstep(mainElapsed,1600,3300);
      const parts=this.actor.parts;
      if(this.actorId==='manager'){
        parts.leftArm.rotation.x=.8*active;parts.rightArm.rotation.x=.35*active;parts.head.rotation.x=.18*active;
        for(const arm of [parts.leftArm,parts.rightArm]){const sleeve=arm.getObjectByName('sleeve');if(sleeve)sleeve.scale.y=1-.4*active;}
      }else if(this.actorId==='action'){
        parts.rightArm.rotation.x=1.25*active;parts.leftArm.rotation.z=-.8*payoff;
      }else if(this.actorId==='yoga'){
        parts.leftArm.rotation.z=-1.5*active;parts.rightArm.rotation.z=1.5*active;parts.torso.rotation.z=.18*Math.sin(payoff*Math.PI);
      }else if(this.actorId==='guard'){
        parts.leftArm.rotation.z=-1.7*active;parts.leftArm.rotation.x=.6*active;parts.rightArm.rotation.x=.75*payoff;
      }else if(this.actorId==='walker'){
        parts.rightArm.rotation.x=.9*active;parts.rightArm.rotation.z=.4*Math.sin(payoff*Math.PI);
      }else if(this.actorId==='referee'){
        parts.leftArm.rotation.z=-1.2*active;parts.rightArm.rotation.z=2*payoff;
        const card=this.actor.root.getObjectByName('referee-card');if(card)card.visible=mainElapsed>1400;
      }
    }
    if(this.actor&&shot?.score.isSuccess){
      const collapse=THREE.MathUtils.smoothstep(mainElapsed,450,1850);
      this.actor.root.rotation.z+=(this.actorId==='iron'?.88:-.78)*collapse;
      this.actor.root.position.x+=(this.actorId==='iron'?.34:-.3)*collapse;
      this.actor.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(this.actor.root);
      if(bounds.min.y<0)this.actor.root.position.y-=bounds.min.y;
      const phone=this.actor.root.getObjectByName('phone');if(phone&&phone.parent){this.actor.root.updateMatrixWorld(true);const parentRotation=phone.parent.getWorldQuaternion(new THREE.Quaternion());phone.quaternion.copy(parentRotation.invert()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)));}
      const bag=this.actor.root.getObjectByName('gym-bag');if(bag){const delayed=THREE.MathUtils.smoothstep(mainElapsed,1150,1900);bag.position.y=.32-delayed*.72;bag.rotation.z=delayed*.5;}
    }
    let gripWorldPoint:readonly[number,number,number]|undefined;
    if(this.actor&&this.actorId==='iron'){this.actor.root.updateMatrixWorld(true);const hand=this.actor.root.getObjectByName('right-hand');
      if(hand){const point=hand.getWorldPosition(new THREE.Vector3());gripWorldPoint=[point.x,point.y,point.z];}}
    this.reactions.update({actorId:this.actorId,failureType:shot?.failureType??null,
      ...(endingId===undefined?{}:{endingId}),...(gripWorldPoint===undefined?{}:{gripWorldPoint}),elapsedMs,reducedMotion});
    this.camera.position.copy(this.aimCamera).lerp(this.wideCamera,reveal);
    const payoff=shot?THREE.MathUtils.smoothstep(mainElapsed,350,1500):0;
    this.camera.position.lerp(this.payoffCamera,payoff);
    let focusX=this.target.x;
    if(this.actor&&shot?.score.isSuccess&&payoff>0){this.actor.root.updateMatrixWorld(true);
      focusX=new THREE.Box3().setFromObject(this.actor.root).getCenter(new THREE.Vector3()).x;
      this.camera.position.x=THREE.MathUtils.lerp(this.camera.position.x,focusX,payoff);}
    this.camera.fov=22+6*reveal+6*payoff;this.camera.updateProjectionMatrix();
    if(screenShake && !reducedMotion && shot?.score.hit && elapsedMs>420 && elapsedMs<550) this.camera.position.x+=Math.sin(elapsedMs*.12)*.018;
    const look = this.target.clone().lerp(new THREE.Vector3(this.target.x,1.65,0),reveal)
      .lerp(new THREE.Vector3(focusX,1.75,0),payoff);
    this.camera.lookAt(look);
    this.glove.visible=true;this.glove.scale.setScalar(.55);this.glove.rotation.set(0,-angleDegrees*Math.PI/180,0);
    this.glove.position.copy(this.origin);
    if (shot) {
      const direction = new THREE.Vector3(Math.sin(angleDegrees*Math.PI/180),0,-Math.cos(angleDegrees*Math.PI/180));
      const distance = shot.score.hit && shot.intersection
        ? this.origin.distanceTo(new THREE.Vector3(...shot.intersection.worldPoint)) : 3.1;
      const travel=THREE.MathUtils.smoothstep(elapsedMs,0,450);
      this.glove.position.addScaledVector(direction,distance*travel);
      if (elapsedMs>600) {
        const drop=THREE.MathUtils.clamp((elapsedMs-600)/900,0,1);
        this.glove.position.y-=drop*1.14;
        if(!reducedMotion) this.glove.rotation.z=drop*(shot.score.hit?0.45:2.5);
      }
      if(shot.failureType==='HIGH_POWER_MISS'&&elapsedMs>450){const recoil=THREE.MathUtils.smoothstep(elapsedMs,450,1800);
        this.glove.position.x-=Math.sin(recoil*Math.PI)*.8;this.glove.rotation.z+=recoil*Math.PI*2;}
      if(shot.failureType==='MISS'&&elapsedMs>2100){const hide=THREE.MathUtils.smoothstep(elapsedMs,2100,3300);
        this.glove.position.set(-1.4-hide*.8,.8-hide*.4,.5);this.glove.scale.setScalar(.55*(1-hide*.55));}
    }
    if(this.actor&&shot&&!shot.score.isSuccess&&shot.score.hit&&mainElapsed>1400&&(this.actorId==='action'||this.actorId==='yoga')){
      const hand=this.actor.root.getObjectByName('right-hand');if(hand){this.actor.root.updateMatrixWorld(true);this.glove.position.copy(hand.getWorldPosition(new THREE.Vector3()));this.glove.scale.setScalar(.42);}
    }
    this.renderer.render(this.scene,this.camera);
  }

  dispose(): void {
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored',this.handleContextRestored);
    if(this.actor){this.scene.remove(this.actor.root);this.actor.dispose();}this.reactions.dispose();
    this.scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
  private resize():void {
    const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight);
    this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }
  private makeGlove():void {
    const cream=new THREE.MeshStandardMaterial({color:'#f4e8cb',roughness:0.64});
    const coral=new THREE.MeshStandardMaterial({color:'#ef715d',roughness:0.75});
    const teal=new THREE.MeshStandardMaterial({color:'#259a9a',roughness:0.7});
    const part=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{
      const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,Math.min(w,h,d)*0.35),material);
      mesh.position.set(x,y,z);mesh.castShadow=true;this.glove.add(mesh);return mesh;
    };
    // Local (0,0,0) is the rounded forward fingertip used by the shot ray.
    part(.16,.16,.45,0,0,.225,cream);
    for(const side of [-1,1]){
      part(.27,.29,.33,side*.13,-.26,.43,side<0?coral:cream);
      for(let finger=0;finger<3;finger++)part(.085,.13,.24,side*(.045+finger*.07),-.10,.46,cream);
      const thumb=part(.13,.21,.22,side*.22,-.14,.32,cream);thumb.rotation.z=side*.45;
      part(.23,.18,.19,side*.14,-.4,.55,teal);
      part(.2,.24,.24,side*.14,-.55,.61,coral);
    }
    batchStaticSiblings(this.glove);
  }
}
