import { describe, expect, it } from 'vitest';
import { awardedScore, centerSuccessBoundaryPercent, maxScore, scoreContact } from '../../src/game/scoring';
import { classifyFailure } from '../../src/game/failure';

const center = { u: 0, v: 0 };

describe('R-SCORE / R-POWER: scoring reference', () => {
  it.each([[60, 570], [70, 675], [75, 729], [100, 1000]])('power %s has center maximum %s', (power, expected) => {
    expect(maxScore(power)).toBe(expected);
    expect(scoreContact({ powerPercent: power, contact: center }).rawScore).toBe(expected);
  });

  it('checks both sides of the rounding boundary, independent of display rounding', () => {
    const boundary = centerSuccessBoundaryPercent();
    expect(maxScore(boundary - 0.000001)).toBe(699);
    expect(maxScore(boundary + 0.000001)).toBe(700);
    expect(scoreContact({ powerPercent: boundary - 0.000001, contact: center }).isSuccess).toBe(false);
    expect(scoreContact({ powerPercent: boundary + 0.000001, contact: center }).isSuccess).toBe(true);
  });

  it('treats an ellipse boundary as a miss, including maximum power', () => {
    for (const contact of [null, { u: 1, v: 0 }, { u: 0, v: -1 }, { u: 1.1, v: 0 }]) {
      const result = scoreContact({ powerPercent: 100, contact });
      expect(result.hit).toBe(false);
      expect(result.rawScore).toBe(0);
      expect(result.accuracy).toBe(0);
    }
  });

  it('distinguishes a zero-power geometric contact from a miss', () => {
    const result = scoreContact({ powerPercent: 0, contact: center });
    expect(result.hit).toBe(true);
    expect(result.rawScore).toBe(0);
    expect(classifyFailure(result)).toBe('UNDERPOWER_HIT');
    expect(classifyFailure(scoreContact({ powerPercent: 0, contact: null }))).toBe('MISS');
  });

  it('is bounded, symmetric and monotonic over a representative input grid', () => {
    for (let power = 0; power <= 100; power += 5) {
      let previous = 1001;
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const result = scoreContact({ powerPercent: power, contact: { u, v: 0 } });
        expect(result.rawScore).toBeGreaterThanOrEqual(0);
        expect(result.rawScore).toBeLessThanOrEqual(previous);
        expect(result.rawScore).toBeLessThanOrEqual(result.maxRawScore);
        expect(result.rawScore).toBe(scoreContact({ powerPercent: power, contact: { u: -u, v: 0 } }).rawScore);
        previous = result.rawScore;
      }
    }
  });

  it('clamps finite power but rejects invalid numeric inputs', () => {
    expect(maxScore(-1)).toBe(0);
    expect(maxScore(101)).toBe(1000);
    expect(() => maxScore(NaN)).toThrow(RangeError);
    expect(() => scoreContact({ powerPercent: 50, contact: { u: Infinity, v: 0 } })).toThrow(RangeError);
  });

  it('returns an immutable result', () => {
    expect(Object.isFrozen(scoreContact({ powerPercent: 75, contact: center }))).toBe(true);
  });
});

describe('R-COMBO: raw success before reward multiplier', () => {
  it('awards successful rounds and caps the multiplier', () => {
    const result = scoreContact({ powerPercent: 75, contact: center });
    expect(awardedScore(result, 1)).toBe(729);
    expect(awardedScore(result, 2)).toBe(802);
    expect(awardedScore(result, 11)).toBe(1458);
    expect(awardedScore(result, 99)).toBe(1458);
    expect(() => awardedScore(result, 0)).toThrow(RangeError);
  });

  it('does not turn 699 into a win through combo', () => {
    const failure = scoreContact({ powerPercent: 72.2, contact: center });
    const success = scoreContact({ powerPercent: 72.3, contact: center });
    expect(failure.rawScore).toBe(699);
    expect(failure.isSuccess).toBe(false);
    expect(awardedScore(failure, 11)).toBe(0);
    expect(success.rawScore).toBe(700);
    expect(success.isSuccess).toBe(true);
  });
});

describe('R-FAILURE: first matching cause', () => {
  it.each([
    [85, null, 'HIGH_POWER_MISS'],
    [84.99, null, 'MISS'],
    [70, center, 'NEAR_SUCCESS'],
    [60, center, 'UNDERPOWER_HIT'],
    [100, { u: 0.8, v: 0 }, 'OFF_CENTER_HIT'],
    [100, center, null],
  ])('power %s and contact %j give %s', (powerPercent, contact, expected) => {
    expect(classifyFailure(scoreContact({ powerPercent, contact }))).toBe(expected);
  });

  it('classifies 649 as underpower and 650 as near-success', () => {
    const powerForScore = (score: number) => 100 * (score / 1000) ** (1 / 1.1);
    expect(classifyFailure(scoreContact({ powerPercent: powerForScore(649), contact: center }))).toBe('UNDERPOWER_HIT');
    expect(classifyFailure(scoreContact({ powerPercent: powerForScore(650), contact: center }))).toBe('NEAR_SUCCESS');
  });
});
