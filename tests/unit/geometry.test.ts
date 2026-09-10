import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import { intersectPad } from '../../src/game/geometry';
import { scoreContact } from '../../src/game/scoring';

describe('R-GEOMETRY: world placement drives the real target angle', () => {
  it.each([-0.6, 0, 0.6])('aims at the actual pad center x=%s', x => {
    const world = new Matrix4().makeTranslation(x, 0, -3);
    const pad = { worldFromLocal: world.toArray(), radiusX: 0.4, radiusY: 0.3 };
    const result = intersectPad([0, 0, 0], Math.atan2(x, 3) * 180 / Math.PI, pad);
    expect(result).not.toBeNull();
    expect(result!.contact.u).toBeCloseTo(0, 10);
    expect(result!.worldPoint[0]).toBeCloseTo(x, 10);
    expect(scoreContact({ powerPercent: 100, contact: result!.contact }).rawScore).toBe(1000);
    if (x !== 0) {
      const straight = intersectPad([0, 0, 0], 0, pad);
      expect(scoreContact({ powerPercent: 100, contact: straight!.contact }).hit).toBe(false);
    }
  });

  it('uses local coordinates for a translated and rotated pad', () => {
    const world = new Matrix4().makeTranslation(0, 0, -3)
      .multiply(new Matrix4().makeRotationY(Math.PI / 6));
    const result = intersectPad([0, 0, 0], 0, { worldFromLocal: world.toArray(), radiusX: 0.4, radiusY: 0.3 });
    expect(result!.contact.u).toBeCloseTo(0);
    expect(result!.worldPoint[2]).toBeCloseTo(-3);
  });

  it('rejects a pad behind the launch point and singular transforms', () => {
    expect(intersectPad([0, 0, 0], 0, {
      worldFromLocal: new Matrix4().makeTranslation(0, 0, 3).toArray(), radiusX: 0.4, radiusY: 0.3,
    })).toBeNull();
    expect(() => intersectPad([0, 0, 0], 0, {
      worldFromLocal: new Matrix4().makeScale(0, 1, 1).toArray(), radiusX: 0.4, radiusY: 0.3,
    })).toThrow(RangeError);
  });
});
