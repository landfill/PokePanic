import { describe, expect, it } from 'vitest';
import { GameClock, oscillate } from '../../src/game/clock';

describe('R-CLOCK: input sampling is independent of render frequency', () => {
  it('has the specified full round-trip period', () => {
    expect(oscillate(0, 2200)).toBe(0);
    expect(oscillate(1100, 2200)).toBe(1);
    expect(oscillate(2200, 2200)).toBe(0);
  });

  it('samples the same input timestamp at 30/60/120fps', () => {
    const results = [30, 60, 120].map(fps => {
      const clock = new GameClock(0);
      for (let frame = 0; frame * 1000 / fps < 1234; frame++) clock.now(frame * 1000 / fps);
      return oscillate(clock.now(1234), 2200, 0.1);
    });
    expect(results[0]).toBeCloseTo(results[1]!, 12);
    expect(results[1]).toBeCloseTo(results[2]!, 12);
  });

  it('excludes pause time and tolerates repeated pause/resume notifications', () => {
    const clock = new GameClock(0);
    clock.pause(500);
    clock.pause(1500);
    expect(clock.now(2000)).toBe(500);
    clock.resume(3000);
    clock.resume(3100);
    expect(clock.now(3500)).toBe(1000);
  });

  it('rejects backwards and invalid wall times', () => {
    const clock = new GameClock(10);
    expect(() => clock.now(9)).toThrow(RangeError);
    expect(() => clock.now(Infinity)).toThrow(RangeError);
    expect(() => oscillate(0, 0)).toThrow(RangeError);
  });
});
