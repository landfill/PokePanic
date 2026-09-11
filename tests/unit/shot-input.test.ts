import { describe, expect, it } from 'vitest';
import { ShotInput } from '../../src/game/shot-input';

const make = () => new ShotInput({ roundId: 1, startWallTime: 0 });

describe('prepared round input', () => {
  it('keeps 60% power in AIM with a 570 maximum, then fires immediately on a fresh press', () => {
    const input = make();
    expect(input.press('pointer:1', 660)).toMatchObject({ stage: 'AIM', maxRawScore: 570, canStillSucceed: false });
    input.release('pointer:1');
    const result = input.press('pointer:2', 660);
    expect(result.stage).toBe('FIRE');
    expect(result.shot?.powerPercent).toBeCloseTo(60);
    expect(result.shot).toMatchObject({ roundId: 1, angleDegrees: -60, firedAtMs: 660 });
  });

  it('requires all held inputs to release and does not add a debounce delay', () => {
    const input = make();
    input.press('key:Space', 0);
    expect(input.press('key:Space', 1).stage).toBe('AIM');
    expect(input.press('pointer:1', 2).stage).toBe('AIM');
    input.release('key:Space');
    expect(input.press('key:Enter', 3).stage).toBe('AIM');
    input.release('pointer:1');
    input.release('key:Enter');
    expect(input.press('key:Enter', 3).stage).toBe('FIRE');
  });

  it('samples the input instant, freezes one shot and ignores all subsequent presses', () => {
    const input = make();
    input.sample(1000);
    input.press('a', 1100);
    input.release('a');
    const shot = input.press('b', 1850).shot;
    expect(shot).toEqual({ roundId: 1, powerPercent: 100, angleDegrees: 0, powerLockedAtMs: 1100, firedAtMs: 1850 });
    expect(Object.isFrozen(shot)).toBe(true);
    input.release('b');
    expect(input.press('c', 4000).shot).toBe(shot);
  });

  it.each([30, 60, 120])('locks identical values at %ifps and without render ticks', fps => {
    const input = make();
    const direct = make();
    for (let frame = 0; frame * 1000 / fps < 660; frame++) input.sample(frame * 1000 / fps);
    input.press('a', 660);
    direct.press('a', 660);
    input.release('a');
    direct.release('a');
    for (let frame = 1; 660 + frame * 1000 / fps < 1410; frame++) input.sample(660 + frame * 1000 / fps);
    expect(input.press('b', 1410)).toEqual(direct.press('b', 1410));
  });

  it('excludes suspended time, ignores paused input, and requires explicit resume', () => {
    const input = make();
    input.press('a', 660);
    input.pause(910);
    expect(input.sample(5000)).toMatchObject({ paused: true, stage: 'AIM', gameTimeMs: 910 });
    expect(input.press('b', 6000).stage).toBe('AIM');
    input.resume(7000);
    // An input held through resume cannot fire.
    expect(input.press('b', 7100).stage).toBe('AIM');
    input.release('b');
    expect(input.press('c', 7500).shot?.angleDegrees).toBeCloseTo(0);
  });

  it('uses separate entry times and configured initial phases', () => {
    const input = new ShotInput({ roundId: 9, startWallTime: 100, powerPhase: 0.5, anglePhase: 0.25 });
    expect(input.press('a', 100)).toMatchObject({ powerPercent: 100, angleDegrees: 0 });
    input.release('a');
    expect(input.press('b', 100).shot).toMatchObject({ roundId: 9, powerPercent: 100, angleDegrees: 0 });
  });

  it('rejects invalid options and nonmonotonic time', () => {
    expect(() => new ShotInput({ roundId: 0, startWallTime: 0 })).toThrow(RangeError);
    expect(() => new ShotInput({ roundId: 1, startWallTime: 0, powerPeriodMs: 1199 })).toThrow(RangeError);
    expect(() => new ShotInput({ roundId: 1, startWallTime: 0, anglePhase: NaN })).toThrow(RangeError);
    const input = make();
    input.sample(10);
    expect(() => input.press('a', 9)).toThrow(RangeError);
    expect(() => input.sample(Infinity)).toThrow(RangeError);
  });
});
