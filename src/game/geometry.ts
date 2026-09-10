import { Matrix4, Ray, Vector3 } from 'three';
import type { Contact } from './scoring';

export interface PadSnapshot {
  readonly worldFromLocal: readonly number[];
  readonly radiusX: number;
  readonly radiusY: number;
}
export interface PadIntersection {
  readonly contact: Contact;
  readonly worldPoint: readonly [number, number, number];
}

// Local XY ellipse on z=0. Its local +Z normal faces the launch origin.
// A plane intersection outside the ellipse is returned so scoring owns the d >= 1 rule.
export function intersectPad(origin: readonly [number, number, number], angleDegrees: number,
  pad: PadSnapshot): PadIntersection | null {
  if (![...origin, angleDegrees, pad.radiusX, pad.radiusY, ...pad.worldFromLocal].every(Number.isFinite)
    || pad.worldFromLocal.length !== 16 || pad.radiusX <= 0 || pad.radiusY <= 0) {
    throw new RangeError('Invalid shot geometry');
  }
  const world = new Matrix4().fromArray(pad.worldFromLocal);
  if (Math.abs(world.determinant()) < 1e-12) throw new RangeError('Singular pad transform');
  const radians = angleDegrees * Math.PI / 180;
  const ray = new Ray(new Vector3(...origin), new Vector3(Math.sin(radians), 0, -Math.cos(radians)))
    .applyMatrix4(world.clone().invert());
  if (ray.direction.z >= -1e-12) return null;
  const distance = -ray.origin.z / ray.direction.z;
  if (distance < 0) return null;
  const local = ray.at(distance, new Vector3());
  const point = local.clone().applyMatrix4(world);
  return Object.freeze({ contact: Object.freeze({ u: local.x / pad.radiusX, v: local.y / pad.radiusY }),
    worldPoint: Object.freeze([point.x, point.y, point.z] as const) });
}
