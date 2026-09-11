import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ActorId } from '../characters/rig';
import type { FailureType } from '../game/failure';
import { batchStaticSiblings } from './batching';

export interface ReactionFrame {
  readonly actorId: ActorId;
  readonly failureType: FailureType | null;
  readonly endingId?: string;
  readonly elapsedMs: number;
  readonly reducedMotion: boolean;
  readonly gripWorldPoint?: readonly [number, number, number];
}

export interface ReactionEnsemble {
  readonly root: THREE.Group;
  update(frame: ReactionFrame): void;
  reset(): void;
  dispose(): void;
}

const rounded = (w:number,h:number,d:number,r:number,colorOrMaterial:number|THREE.Material,name:string) => {
  const material=typeof colorOrMaterial==='number'
    ?new THREE.MeshStandardMaterial({color:colorOrMaterial,roughness:.78}):colorOrMaterial;
  const item=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),material);
  item.name=name;item.castShadow=true;item.receiveShadow=true;return item;
};

function adult(name:string,uniform=false): {root:THREE.Group;leftWrist:THREE.Group;rightWrist:THREE.Group;
  leftArm:THREE.Group;rightArm:THREE.Group;collar:THREE.Mesh} {
  const root=new THREE.Group();root.name=name;
  const navy=uniform?0x24334b:0xef715d, trouser=uniform?0x18263c:0x315c68, skin=0xb97856;
  const mats={navy:new THREE.MeshStandardMaterial({color:navy,roughness:.78}),trouser:new THREE.MeshStandardMaterial({color:trouser,roughness:.78}),
    skin:new THREE.MeshStandardMaterial({color:skin,roughness:.78}),cream:new THREE.MeshStandardMaterial({color:0xf4e8cb,roughness:.78}),
    hair:new THREE.MeshStandardMaterial({color:0x202633,roughness:.78}),dark:new THREE.MeshStandardMaterial({color:0x172337,roughness:.78})};
  const torso=rounded(uniform ? .82 : .9,1.02,.5,.17,mats.navy,'clothed-torso');torso.position.y=2.2;root.add(torso);
  const collar=rounded(.42,.1,.08,.025,mats.cream,'collar-grip-point');collar.position.set(0,2.68,-.27);root.add(collar);
  const pelvis=rounded(.7,.42,.54,.13,mats.trouser,'trouser-pelvis');pelvis.position.y=1.53;root.add(pelvis);
  const head=rounded(.55,.68,.5,.2,mats.skin,'adult-head');head.position.y=3.08;root.add(head);
  const jaw=rounded(.4,.14,.43,.06,mats.skin,'adult-jaw');jaw.position.set(0,2.8,-.02);root.add(jaw);
  const hair=rounded(.56,.16,.51,.07,mats.hair,'hair');hair.position.y=3.38;root.add(hair);
  for(const side of [-1,1]){const white=rounded(.1,.07,.025,.02,mats.cream,'eye-white');white.position.set(side*.13,3.14,-.257);root.add(white);
    const pupil=rounded(.035,.04,.018,.008,mats.dark,'pupil');pupil.position.set(side*.13,3.14,-.276);root.add(pupil);}
  const nose=rounded(.09,.12,.09,.035,mats.skin,'nose');nose.position.set(0,3.02,-.29);root.add(nose);
  for(const side of [-1,1]){
    const leg=rounded(.25,1.22,.32,.11,mats.trouser,'trouser-leg');leg.position.set(side*.2,.74,0);root.add(leg);
    const shoe=rounded(.3,.16,.48,.07,uniform?mats.dark:mats.cream,'shoe');shoe.position.set(side*.2,.08,-.06);root.add(shoe);
  }
  const wrists:[THREE.Group,THREE.Group]=[new THREE.Group(),new THREE.Group()];
  const arms:[THREE.Group,THREE.Group]=[new THREE.Group(),new THREE.Group()];
  for(const [index,side] of ([-1,1] as const).entries()){
    const arm=arms[index]!;arm.position.set(side*.57,2.55,0);root.add(arm);
    const sleeve=rounded(.24,.62,.3,.1,mats.navy,'sleeve');sleeve.position.y=-.3;arm.add(sleeve);
    const forearm=rounded(.19,.55,.22,.08,mats.skin,'forearm');forearm.position.y=-.85;arm.add(forearm);
    const wrist=wrists[index]!;wrist.name=side<0?'left-wrist-socket':'right-wrist-socket';wrist.position.y=-1.16;arm.add(wrist);
    const hand=rounded(.22,.28,.16,.07,mats.skin,'hand');wrist.add(hand);
  }
  if(uniform){const badge=rounded(.13,.16,.03,.02,mats.cream,'police-badge');badge.position.set(-.22,2.35,-.27);root.add(badge);
    const cap=rounded(.65,.13,.58,.05,mats.dark,'police-cap');cap.position.y=3.46;root.add(cap);}
  batchStaticSiblings(root,new Set(['collar-grip-point']));
  return {root,leftWrist:wrists[0],rightWrist:wrists[1],leftArm:arms[0],rightArm:arms[1],collar};
}

export function createReactionEnsemble(): ReactionEnsemble {
  const root=new THREE.Group();root.name='reaction-ensemble';
  const player=adult('adult-player');player.root.position.set(-1.7,0,1);root.add(player.root);
  const policeLeft=adult('police-left',true);policeLeft.root.position.set(-3.1,0,.85);root.add(policeLeft.root);
  const policeRight=adult('police-right',true);policeRight.root.position.set(3.1,0,.85);root.add(policeRight.root);
  const cuffRoot=new THREE.Group();cuffRoot.name='prop-cuffs';root.add(cuffRoot);
  const cuffMaterial=new THREE.MeshStandardMaterial({color:0xadb7c4,roughness:.35,metalness:.55});
  const cuffs=[-1,1].map(side=>{const cuff=new THREE.Mesh(new THREE.TorusGeometry(.14,.035,7,18),cuffMaterial);
    cuff.name=side<0?'left-wrist-cuff':'right-wrist-cuff';cuffRoot.add(cuff);return cuff;});
  const chain=new THREE.Group();chain.name='connecting-chain';cuffRoot.add(chain);
  for(let i=0;i<5;i++){const link=new THREE.Mesh(new THREE.TorusGeometry(.055,.014,5,10),cuffMaterial);
    link.position.x=(i-2)*.09;link.rotation.y=(i%2)*Math.PI/2;chain.add(link);}
  batchStaticSiblings(chain);
  const dust=new THREE.Group();dust.name='cartoon-dust';root.add(dust);
  const dustMaterial=new THREE.MeshStandardMaterial({color:0xd8c8aa,roughness:1});
  for(let i=0;i<8;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.22+i%3*.05,10,8),dustMaterial);
    puff.position.set(Math.cos(i*.9)*.55,1.05+Math.sin(i*.7)*.35,Math.sin(i*.9)*.2);dust.add(puff);}
  batchStaticSiblings(dust);
  const stars=new THREE.Group();stars.name='dizzy-stars';root.add(stars);
  const starMaterial=new THREE.MeshStandardMaterial({color:0xf4cf55,roughness:.78});
  for(let i=0;i<3;i++){const star=rounded(.13,.13,.04,.025,starMaterial,'star');star.position.set(Math.cos(i*2.1)*.4,.3,Math.sin(i*2.1)*.2);stars.add(star);}
  batchStaticSiblings(stars);

  const hide=()=>{player.root.visible=false;policeLeft.root.visible=false;policeRight.root.visible=false;cuffRoot.visible=false;dust.visible=false;stars.visible=false;};
  const resetTransforms=()=>{hide();player.root.position.set(-1.7,0,1);player.root.rotation.set(0,0,0);player.root.scale.set(1,1,1);
    player.leftArm.rotation.set(0,0,0);player.rightArm.rotation.set(0,0,0);
    policeLeft.root.position.set(-3.1,0,.85);policeLeft.root.rotation.set(0,0,0);policeLeft.root.scale.set(1,1,1);
    policeRight.root.position.set(3.1,0,.85);policeRight.root.rotation.set(0,0,0);policeRight.root.scale.set(1,1,1);
    cuffRoot.position.set(0,0,0);cuffRoot.rotation.set(0,0,0);cuffRoot.scale.set(1,1,1);
    chain.position.set(0,0,0);chain.rotation.set(0,0,0);chain.scale.set(1,1,1);
    dust.position.set(0,0,0);dust.rotation.set(0,0,0);dust.scale.set(1,1,1);
    stars.position.set(0,0,0);stars.rotation.set(0,0,0);stars.scale.set(1,1,1);};
  const wristWorld=(wrist:THREE.Group)=>wrist.getWorldPosition(new THREE.Vector3());
  const updateCuffs=()=>{root.updateMatrixWorld(true);const wrists=[player.leftWrist,player.rightWrist] as const;
    cuffs[0]!.position.copy(root.worldToLocal(wristWorld(wrists[0])));cuffs[1]!.position.copy(root.worldToLocal(wristWorld(wrists[1])));
    for(let index=0;index<cuffs.length;index++){const wristRotation=wrists[index]!.getWorldQuaternion(new THREE.Quaternion());
      const wristAxis=new THREE.Vector3(0,1,0).applyQuaternion(wristRotation).normalize();
      cuffs[index]!.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),wristAxis);}
    const delta=cuffs[1]!.position.clone().sub(cuffs[0]!.position);
    chain.position.copy(cuffs[0]!.position).lerp(cuffs[1]!.position,.5);chain.rotation.z=Math.atan2(delta.y,delta.x);
    chain.scale.x=Math.max(1,delta.length()/.36);};

  hide();
  return {root,
    reset():void{resetTransforms();},
    update(frame):void{
      resetTransforms();const main=Math.max(0,frame.elapsedMs-1900);if(main<=0||frame.failureType===null)return;
      const t=(start:number,end:number)=>THREE.MathUtils.smoothstep(main,start,end);
      player.root.visible=true;
      if(frame.failureType==='HIGH_POWER_MISS'){
        const spin=t(200,2100);player.root.position.x=-2.05+spin*.8;player.root.rotation.y=spin*Math.PI*2;
        player.root.rotation.z=-t(1500,2600)*1.35;player.root.position.y=t(1500,2400)*.35;stars.visible=main>2800;stars.position.set(-.8,.45,.1);return;
      }
      if(frame.failureType==='MISS'&&!frame.endingId?.includes('forgive')){
        const exit=t(1900,3900);player.root.position.x=-1.7-exit*2.3;player.root.rotation.y=-.3*exit;
        stars.visible=main>1200&&main<1800;stars.position.set(-1.15,2.15,.05);return;
      }
      if(frame.failureType==='NEAR_SUCCESS'){
        const celebrate=Math.sin(THREE.MathUtils.clamp(main/1500,0,1)*Math.PI);
        player.leftArm.rotation.z=-2.25*celebrate;player.rightArm.rotation.z=2.25*celebrate;
      }
      const late=frame.failureType==='NEAR_SUCCESS'?1800:700;
      if(frame.actorId==='manager'){
        const panic=t(late+400,late+1700);player.root.position.set(-1.1,0,.65);
        player.root.scale.y=1-.55*panic;player.root.rotation.z=-.13*panic;
        player.leftArm.rotation.z=-1.4*panic;player.rightArm.rotation.z=1.4*panic;return;
      }
      if(frame.actorId==='action'){
        const spin=t(late,late+1600);player.root.position.set(-.85,Math.sin(spin*Math.PI)*.45,.65);
        player.root.rotation.y=spin*Math.PI*4;player.leftArm.rotation.z=-1.5*spin;player.rightArm.rotation.z=1.5*spin;
        const land=t(late+1600,3900);player.root.rotation.z=-land*Math.PI/2;player.root.scale.y=1-.4*land;player.root.position.y=.14*land;return;
      }
      if(frame.actorId==='yoga'){
        const knot=t(late,late+1400);player.root.position.set(-1.15,0,.75);player.root.rotation.y=.55*knot;
        player.leftArm.rotation.z=-2.25*knot;player.rightArm.rotation.z=2.25*knot;
        player.leftArm.rotation.x=-.8*knot;player.rightArm.rotation.x=.8*knot;
        player.root.scale.y=1-.18*knot;stars.visible=main>late+1900;stars.position.set(-1.15,2.8,.75);return;
      }
      if(frame.actorId==='walker'){
        const wobble=t(late+600,late+2000);player.root.position.set(-1.05,.12*wobble,.7);
        player.root.rotation.z=-wobble*1.15;player.root.scale.y=1-.28*wobble;
        player.leftArm.rotation.z=-1.4*wobble;player.rightArm.rotation.z=1.4*wobble;return;
      }
      const policeEnding=frame.actorId==='complaint'||frame.actorId==='referee'||frame.actorId==='guard'||frame.endingId?.includes('forgive');
      if(policeEnding){
        const arrival=t(frame.endingId?.includes('forgive')||frame.failureType==='NEAR_SUCCESS'?1700:900,2600);
        policeLeft.root.visible=arrival>0;policeRight.root.visible=arrival>0;
        const escort=t(2700,3900)*1.15;const playerX=-1.25+escort;player.root.position.set(playerX,0,1);
        const cuffsAttached=main>2100?THREE.MathUtils.smoothstep(main,2100,2450):0;
        player.leftArm.rotation.x=-.48*cuffsAttached;player.rightArm.rotation.x=-.48*cuffsAttached;
        policeLeft.root.position.x=THREE.MathUtils.lerp(-3.1,playerX-.9,arrival);
        policeRight.root.position.x=THREE.MathUtils.lerp(3.1,playerX+.9,arrival);
        policeLeft.root.position.z=.85;policeRight.root.position.z=.85;
        cuffRoot.visible=main>2300&&frame.actorId!=='guard';
        if(frame.actorId==='guard'){player.root.position.y=arrival*.3;player.leftArm.rotation.z=-arrival*.8;player.rightArm.rotation.z=arrival*.8;}
        updateCuffs();return;
      }
      // Iron's delayed notice: collar lift is followed by an obscured toy scuffle and safe-mat flattening.
      const liftStart=frame.failureType==='NEAR_SUCCESS'?1800:1000;
      const lift=t(liftStart,liftStart+900);player.root.position.set(-1.25,lift*1.05,.15);player.root.rotation.z=-.12*lift;
      if(frame.gripWorldPoint&&lift>0){root.updateMatrixWorld(true);const grip=root.worldToLocal(new THREE.Vector3(...frame.gripWorldPoint));
        const collarOffset=player.collar.position.clone().multiply(player.root.scale).applyQuaternion(player.root.quaternion);
        const aligned=grip.sub(collarOffset);player.root.position.lerp(aligned,lift);}
      dust.visible=main>1900&&main<3200;dust.position.set(-.7,.2,.1);
      if(dust.visible&&!frame.reducedMotion)dust.rotation.y=main*.006;
      const flat=t(3000,3700);if(main>=3000){player.root.position.set(-.7,flat*.12,.25);player.root.rotation.z=-flat*Math.PI/2;
        player.root.scale.y=1-.68*flat;}stars.visible=flat>.65;stars.position.set(-.7,.48,.2);
    },
    dispose():void{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();},
  };
}
