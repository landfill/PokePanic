import { expect, it } from 'vitest';
import { Matrix4 } from 'three';
import fixtures from '../fixtures/shots.json';
import { intersectPad } from '../../src/game/geometry';
import { scoreContact } from '../../src/game/scoring';
import { classifyFailure } from '../../src/game/failure';

// Partial replay: fixed finalized input + pad geometry. No seeded runtime/ending selection yet.
it.each(fixtures)('R-REPLAY: $id', fixture => {
  const run = () => {
    const intersection = intersectPad([0, 0, 0], fixture.angleDegrees, {
      worldFromLocal: new Matrix4().makeTranslation(fixture.padX, 0, -3).toArray(),
      radiusX: 0.4, radiusY: 0.3,
    });
    const score = scoreContact({ powerPercent: fixture.powerPercent, contact: intersection?.contact ?? null });
    return { rawScore: score.rawScore, failureType: classifyFailure(score) };
  };
  const expected = { rawScore: fixture.rawScore, failureType: fixture.failureType };
  expect(run()).toEqual(expected);
  expect(run()).toEqual(expected);
});
