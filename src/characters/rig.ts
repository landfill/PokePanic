import {
  CapsuleGeometry, CylinderGeometry, Group, LatheGeometry,
  MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry,
  Vector2, type BufferGeometry, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batchStaticSiblings } from '../scene/batching';

export const ACTOR_IDS = ['iron','complaint','manager','action','yoga','guard','walker','referee'] as const;
export type ActorId = typeof ACTOR_IDS[number];

interface ActorShape {
  readonly shirt:number;readonly trouser:number;readonly skin:number;
  readonly chestWidth:number;readonly chestDepth:number;readonly shoulder:number;
  readonly hips:number;readonly arm:number;readonly leg:number;readonly headY:number;
}

const SHAPES:Readonly<Record<ActorId,ActorShape>>=Object.freeze({
  iron:{shirt:0x24334b,trouser:0x33445f,skin:0xc98c68,chestWidth:1.365,chestDepth:.66,shoulder:.72,hips:.8,arm:.21,leg:.27,headY:3.2},
  complaint:{shirt:0x259a9a,trouser:0x315c68,skin:0xa9684c,chestWidth:.846,chestDepth:.58,shoulder:.52,hips:.7,arm:.16,leg:.23,headY:3.19},
  manager:{shirt:0xd8c8aa,trouser:0x344154,skin:0xc18764,chestWidth:1.02,chestDepth:.56,shoulder:.56,hips:.74,arm:.17,leg:.235,headY:3.15},
  action:{shirt:0xef715d,trouser:0x24334b,skin:0xb87554,chestWidth:1.04,chestDepth:.55,shoulder:.58,hips:.72,arm:.17,leg:.24,headY:3.22},
  yoga:{shirt:0x259a9a,trouser:0x58475d,skin:0xc58a66,chestWidth:.86,chestDepth:.5,shoulder:.49,hips:.67,arm:.145,leg:.205,headY:3.27},
  guard:{shirt:0x26354a,trouser:0x1c293b,skin:0x9d6248,chestWidth:1.2,chestDepth:.62,shoulder:.67,hips:.8,arm:.195,leg:.26,headY:3.2},
  walker:{shirt:0xe1d4b8,trouser:0x385b58,skin:0xb97856,chestWidth:1.04,chestDepth:.6,shoulder:.58,hips:.77,arm:.17,leg:.245,headY:3.14},
  referee:{shirt:0x526177,trouser:0x29364a,skin:0xb36f53,chestWidth:.96,chestDepth:.55,shoulder:.54,hips:.71,arm:.16,leg:.225,headY:3.18},
});

export interface ActorRig {
  readonly root: Group;
  readonly pad: Mesh;
  readonly parts: Readonly<{
    head: Group;
    torso: Group;
    leftArm: Group;
    rightArm: Group;
    leftLeg: Group;
    rightLeg: Group;
  }>;
  setPose(revealProgress: number, reactionProgress: number, success: boolean): void;
  dispose(): void;
}

const COLOR = {
  navy: 0x24334b, cream: 0xf4e8cb, coral: 0xef715d, teal: 0x259a9a,
  skin: 0xc98c68, darkSkin: 0xa9684c, hair: 0x202633, sole: 0xe8dfca,
  seam: 0x172337, metal: 0x596274,
} as const;

function material(color: number, roughness = 0.72, metalness = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry: BufferGeometry, mat: Material, name: string): Mesh {
  const result = new Mesh(geometry, mat);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function rounded(width: number, height: number, depth: number, radius: number,
  mat: Material, name: string): Mesh {
  return mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), mat, name);
}

function capsule(radius: number, length: number, mat: Material, name: string): Mesh {
  return mesh(new CapsuleGeometry(radius, length, 6, 12), mat, name);
}

function addShoe(leg: Group, x: number, mat: Material): void {
  const shoe = rounded(0.42, 0.22, 0.62, 0.1, mat, 'shoe');
  shoe.position.set(x, -1.32, -0.09);
  leg.add(shoe);
  const sole = rounded(0.44, 0.06, 0.65, 0.025, material(COLOR.sole), 'shoe-sole');
  sole.position.set(x, -1.45, -0.08);
  leg.add(sole);
}

function addHand(arm: Group, skin: Material, side: number): Group {
  const hand = new Group();
  hand.name = side < 0 ? 'left-hand' : 'right-hand';
  hand.position.set(0, -1.05, 0);
  const palm = rounded(0.27, 0.32, 0.18, 0.075, skin, 'palm');
  hand.add(palm);
  for (let index = 0; index < 4; index++) {
    const finger = capsule(0.038, 0.12, skin, `finger-${index}`);
    finger.scale.z = 0.78;
    finger.position.set(-0.095 + index * 0.063, -0.2, -0.015);
    hand.add(finger);
  }
  const thumb = capsule(0.045, 0.12, skin, 'thumb');
  thumb.rotation.z = side * 0.65;
  thumb.position.set(side * 0.16, -0.02, -0.015);
  hand.add(thumb);
  batchStaticSiblings(hand);
  arm.add(hand);
  return hand;
}

function createHead(skin: Material, id: ActorId): { group: Group; brows: [Mesh, Mesh]; mouth: Mesh } {
  const narrow=['complaint','action','yoga','referee'].includes(id);
  const group = new Group();
  group.name = 'head';
  const profile = narrow
    ? [[0, -0.47], [0.31, -0.4], [0.39, -0.13], [0.38, 0.22], [0.27, 0.46], [0, 0.51]]
    : [[0, -0.49], [0.34, -0.43], [0.41, -0.12], [0.39, 0.23], [0.29, 0.48], [0, 0.54]];
  const head = mesh(new LatheGeometry(profile.map(([x, y]) => new Vector2(x!, y!)), 24), skin, 'sculpted-head');
  head.scale.z = narrow ? 0.88 : 0.93;
  if(id==='manager'||id==='walker')head.scale.y=.96;
  group.add(head);

  const eyeWhite = material(0xf8f1df, 0.5);
  const pupilMat = material(0x182031, 0.36);
  for (const side of [-1, 1] as const) {
    const eye = mesh(new SphereGeometry(0.105, 14, 10), eyeWhite, 'eye-white');
    eye.scale.set(1, 0.68, 0.32);
    eye.position.set(side * 0.145, 0.1, -0.35);
    const pupil = mesh(new SphereGeometry(0.047, 12, 8), pupilMat, 'pupil');
    pupil.scale.z = 0.38;
    pupil.position.set(side * 0.145, 0.1, -0.397);
    group.add(eye, pupil);
  }
  const browMat = material(COLOR.hair);
  const leftBrow = rounded(0.2, 0.035, 0.035, 0.014, browMat, 'left-brow');
  const rightBrow = rounded(0.2, 0.035, 0.035, 0.014, browMat, 'right-brow');
  leftBrow.position.set(-0.145, 0.23, -0.37);
  rightBrow.position.set(0.145, 0.23, -0.37);
  group.add(leftBrow, rightBrow);
  const nose = mesh(new CapsuleGeometry(0.055, 0.09, 4, 10), skin, 'nose');
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.0, -0.41);
  group.add(nose);
  const mouth = mesh(new TorusGeometry(0.1, 0.018, 6, 18, Math.PI), material(COLOR.coral), 'mouth');
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.2, -0.37);
  group.add(mouth);
  const jaw = rounded(narrow ? 0.5 : 0.58, 0.15, narrow ? 0.56 : 0.6,
    0.07, skin, 'defined-jaw');
  jaw.position.set(0, -0.39, -0.015);
  group.add(jaw);
  for (const side of [-1, 1]) {
    const ear = mesh(new SphereGeometry(0.09, 10, 8), skin, 'ear');
    ear.scale.set(0.45, 1, 0.72);
    ear.position.set(side * 0.4, 0.02, 0);
    group.add(ear);
  }
  const bob=['complaint','action','guard','referee'].includes(id);
  const hair = bob
    ? mesh(new SphereGeometry(0.43, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), material(COLOR.hair), 'bob-hair')
    : rounded(0.68, 0.2, 0.66, 0.1, material(COLOR.hair), 'short-hair');
  hair.position.set(0, bob ? 0.22 : 0.43, bob ? 0.08 : 0.04);
  if (bob) hair.scale.z = 0.9;
  group.add(hair);
  if(id==='action'){const pony=capsule(.13,.34,material(COLOR.hair),'action-ponytail');pony.position.set(.29,.12,.22);pony.rotation.z=-.35;group.add(pony);}
  if(id==='yoga'){const bun=mesh(new SphereGeometry(.18,14,10),material(COLOR.hair),'yoga-bun');bun.position.set(0,.62,.12);group.add(bun);}
  if(id==='manager'){hair.scale.x=.72;hair.position.x=.11;}
  if(id==='walker'&&hair.material instanceof MeshStandardMaterial)hair.material.color.setHex(0x8b9195);
  batchStaticSiblings(group,new Set(['left-brow','right-brow','mouth']));
  return { group, brows: [leftBrow, rightBrow], mouth };
}

function addTrouserDetails(pelvis: Group): void {
  // The visible rear seam avoids a thick torus protruding from the actor's front.
  const waistband = rounded(0.82, 0.07, 0.035, 0.018, material(COLOR.seam), 'waistband-seam');
  waistband.position.set(0, 0.27, 0.31);
  pelvis.add(waistband);
  for (const side of [-1, 1]) {
    const pocket = rounded(0.28, 0.32, 0.025, 0.035, material(COLOR.seam), 'back-pocket');
    pocket.position.set(side * 0.24, 0.02, 0.35);
    pocket.rotation.z = side * 0.08;
    pelvis.add(pocket);
    const seam = rounded(0.025, 0.72, 0.025, 0.01, material(COLOR.seam), 'leg-seam');
    seam.position.set(side * 0.43, -0.67, 0.18);
    pelvis.add(seam);
  }
}

export function createActor(id: ActorId): ActorRig {
  if (!(ACTOR_IDS as readonly string[]).includes(id)) throw new RangeError('Unknown actor id');
  const shape=SHAPES[id];
  const complaint = id === 'complaint';
  const root = new Group();
  root.name = `actor-${id}`;
  const skin = material(shape.skin, 0.78);
  const shirt = material(shape.shirt, 0.76);
  const trouser = material(shape.trouser, 0.82);
  const accent = material(COLOR.coral, 0.68);

  const pelvis = new Group();
  pelvis.name = 'pelvis';
  pelvis.position.y = 1.55;
  const hips = rounded(shape.hips, 0.5, 0.58, 0.15, trouser, 'tailored-hips');
  pelvis.add(hips);
  addTrouserDetails(pelvis);
  root.add(pelvis);

  const torso = new Group();
  torso.name = 'torso';
  torso.position.y = 1.72;
  const chest = rounded(shape.chestWidth, 1.1, shape.chestDepth,
    0.22, shirt, complaint ? 'jacket-torso' : `${id}-torso`);
  chest.position.y = 0.48;
  torso.add(chest);
  if(id==='manager')torso.rotation.x=.07;
  const collar = mesh(new TorusGeometry(0.21, 0.045, 8, 24, Math.PI), material(COLOR.cream), 'collar');
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI;
  collar.position.set(0, 1.02, -0.3);
  torso.add(collar);
  if (complaint) {
    const lapelL = rounded(0.18, 0.66, 0.055, 0.025, material(COLOR.cream), 'left-lapel');
    const lapelR = lapelL.clone();
    lapelL.position.set(-0.14, 0.6, -0.315); lapelL.rotation.z = -0.22;
    lapelR.position.set(0.14, 0.6, -0.315); lapelR.rotation.z = 0.22;
    torso.add(lapelL, lapelR);
  }
  root.add(torso);

  const headParts = createHead(skin, id);
  const head = headParts.group;
  head.position.y = shape.headY;
  root.add(head);
  const neck = capsule(shape.arm*.88, 0.28, skin, 'neck');
  neck.position.y = 2.78;
  root.add(neck);

  const createArm = (side: number): { group: Group; hand: Group } => {
    const arm = new Group();
    arm.name = side < 0 ? 'left-arm' : 'right-arm';
    arm.position.set(side * shape.shoulder, id==='manager'?2.47:2.55, 0);
    const sleeve = capsule(shape.arm, 0.48, shirt, 'sleeve');
    sleeve.position.y = -0.32;
    arm.add(sleeve);
    const forearm = capsule(shape.arm*.8, 0.48, skin, 'forearm');
    forearm.position.y = -0.82;
    arm.add(forearm);
    const hand = addHand(arm, skin, side);
    root.add(arm);
    return { group: arm, hand };
  };
  const left = createArm(-1);
  const right = createArm(1);

  const createLeg = (side: number): Group => {
    const leg = new Group();
    leg.name = side < 0 ? 'left-leg' : 'right-leg';
    leg.position.set(side * shape.leg, 1.48, 0);
    const trouserLeg = capsule(shape.leg, 0.86, trouser, 'trouser-leg');
    trouserLeg.position.y = -0.58;
    trouserLeg.scale.z = 0.9;
    leg.add(trouserLeg);
    addShoe(leg, 0, material(complaint ? COLOR.cream : COLOR.teal));
    root.add(leg);
    return leg;
  };
  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

  const padGeometry = new CylinderGeometry(1, 1, 1, 32, 2);
  padGeometry.rotateX(Math.PI / 2);
  padGeometry.scale(0.31, 0.24, 0.09);
  const pad = mesh(padGeometry, material(COLOR.cream, 0.9), 'protective-pad');
  pad.position.set(0, -0.05, 0.39);
  pelvis.add(pad);
  const rim = mesh(new TorusGeometry(1, 0.1, 8, 32), accent, 'protective-pad-rim');
  rim.scale.set(0.31, 0.24, 0.31);
  rim.position.set(0, -0.05, 0.442);
  pelvis.add(rim);
  for (const y of [-0.22, 0.17]) {
    const strap = rounded(0.9, 0.09, 0.045, 0.025, material(COLOR.seam), 'pad-strap');
    strap.position.set(0, y, 0.365);
    pelvis.add(strap);
  }

  if (complaint) {
    const phone = rounded(0.22, 0.4, 0.055, 0.035, material(COLOR.navy, 0.42), 'phone');
    phone.position.set(0.02, -0.02, -0.18);
    right.hand.add(phone);
  } else if(id==='iron') {
    const bag = rounded(0.5, 0.44, 0.22, 0.09, material(COLOR.teal), 'gym-bag');
    bag.position.set(0.43, 0.32, -0.45);
    torso.add(bag);
    const bagStrap = capsule(0.032, 0.82, material(COLOR.seam), 'bag-strap');
    bagStrap.rotation.z = -0.42;
    bagStrap.position.set(0.22, 0.68, -0.365);
    torso.add(bagStrap);
  } else if(id==='manager'){
    const watch=mesh(new TorusGeometry(.12,.035,7,18),material(COLOR.metal,.35,.35),'manager-watch');
    watch.rotation.x=Math.PI/2;watch.position.set(0,-.02,0);left.hand.add(watch);
    const tie=rounded(.12,.62,.035,.018,material(COLOR.coral),'manager-tie');tie.position.set(0,.56,-shape.chestDepth/2-.025);torso.add(tie);
    for(const x of [-.24,.24]){const wrinkle=rounded(.26,.025,.025,.01,material(0xb9aa8d),'shirt-wrinkle');
      wrinkle.position.set(x,.2,-shape.chestDepth/2-.02);wrinkle.rotation.z=x;torso.add(wrinkle);}
  } else if(id==='action'){
    const badge=rounded(.2,.26,.035,.025,material(COLOR.cream),'action-badge');badge.position.set(.28,.62,-shape.chestDepth/2-.03);torso.add(badge);
    const stripe=rounded(.12,.9,.035,.02,material(COLOR.cream),'action-stripe');stripe.position.set(-.34,.42,-shape.chestDepth/2-.025);torso.add(stripe);
  } else if(id==='yoga'){
    const band=mesh(new TorusGeometry(.13,.035,7,20),material(COLOR.coral),'yoga-band');band.name='yoga-band';
    band.rotation.x=Math.PI/2;right.hand.add(band);
    const sash=rounded(.76,.16,.06,.035,material(COLOR.cream),'yoga-sash');sash.position.set(0,.02,-shape.chestDepth/2-.035);torso.add(sash);
  } else if(id==='guard'){
    const earpiece=mesh(new TorusGeometry(.085,.022,6,16,Math.PI*1.5),material(COLOR.metal,.3,.3),'guard-earpiece');
    earpiece.position.set(.39,.05,-.1);earpiece.rotation.y=Math.PI/2;head.add(earpiece);
    const tie=rounded(.11,.66,.035,.018,material(COLOR.teal),'guard-tie');tie.position.set(0,.52,-shape.chestDepth/2-.025);torso.add(tie);
  } else if(id==='walker'){
    const vest=rounded(.36,.92,.08,.05,material(COLOR.teal),'walker-vest');vest.position.set(-.23,.46,-shape.chestDepth/2-.05);torso.add(vest);
    const vestRight=vest.clone();vestRight.name='walker-vest-panel';vestRight.position.x=.23;torso.add(vestRight);
    const pack=rounded(.62,.72,.22,.12,material(COLOR.coral),'walker-backpack');pack.position.set(0,.5,-shape.chestDepth/2-.16);torso.add(pack);
  } else {
    const whistle=mesh(new TorusGeometry(.09,.025,7,18),material(COLOR.metal,.3,.35),'referee-whistle');
    whistle.position.set(0,.66,-shape.chestDepth/2-.05);torso.add(whistle);
    const card=rounded(.24,.34,.035,.025,material(COLOR.coral),'referee-card');card.position.set(0,-.02,-.18);right.hand.add(card);
    const stripe=rounded(.09,.9,.035,.02,material(COLOR.cream),'referee-stripe');stripe.position.set(-.28,.45,-shape.chestDepth/2-.025);torso.add(stripe);
  }

  const parts = Object.freeze({ head, torso, leftArm: left.group, rightArm: right.group, leftLeg, rightLeg });
  let disposed = false;
  const smooth = (value: number): number => {
    const x = MathUtils.clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };

  return {
    root,
    pad,
    parts,
    setPose(revealProgress: number, reactionProgress: number, success: boolean): void {
      if (!Number.isFinite(revealProgress) || !Number.isFinite(reactionProgress)) {
        throw new RangeError('Pose progress must be finite');
      }
      const reveal = smooth(revealProgress);
      const reaction = smooth(reactionProgress);
      root.rotation.y = Math.PI * reveal;
      root.position.y = success ? -0.08 * reaction : 0;
      torso.rotation.z = success ? 0.12 * reaction : -0.025 * reaction;
      const lookDirection=['complaint','action','guard','referee'].includes(id)?-1:1;
      head.rotation.y = lookDirection*(id==='yoga'?.12:.2) * reaction;
      head.rotation.z = success ? 0.08 * reaction : lookDirection*.045 * reaction;
      left.group.rotation.z = success ? -0.16 * reaction : -0.42 * reaction;
      right.group.rotation.z = success ? 0.16 * reaction : 0.42 * reaction;
      left.group.rotation.x = (complaint||id==='guard') && !success ? -0.28 * reaction : 0;
      right.group.rotation.x = (complaint||id==='guard') && !success ? -0.42 * reaction : 0;
      leftLeg.rotation.z = success ? -0.06 * reaction : 0;
      rightLeg.rotation.z = success ? 0.06 * reaction : 0;
      headParts.brows[0].rotation.z = (success ? 0.18 : -0.16) * reaction;
      headParts.brows[1].rotation.z = (success ? -0.18 : 0.16) * reaction;
      headParts.mouth.rotation.x = success ? Math.PI * reaction : 0;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        const assigned = Array.isArray(object.material) ? object.material : [object.material];
        for (const item of assigned) materials.add(item);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const item of materials) item.dispose();
      root.clear();
    },
  };
}
