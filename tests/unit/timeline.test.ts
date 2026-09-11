import { describe, expect, it } from 'vitest';
import { FailureTimeline, type TimelineOptions } from '../../src/animation/timeline';

const options = (override: Partial<TimelineOptions> = {}): TimelineOptions => ({
  roundId: 7,
  endingId: 'iron-delayed',
  durationMs: 4000,
  coreAtMs: 3000,
  alreadySeen: false,
  minimizeScenes: false,
  ...override,
});

const types = (events: readonly { type: string }[]) => events.map(item => item.type);

describe('failure scene timeline lifecycle', () => {
  it('unlocks on entry, marks seen at core, and finishes normally once', () => {
    const timeline = new FailureTimeline(options());
    expect(types(timeline.enter(7, 100))).toEqual(['UNLOCK']);
    expect(timeline.update(7, 3099)).toEqual([]);
    expect(types(timeline.update(7, 3100))).toEqual(['CORE', 'SEEN']);
    expect(types(timeline.update(7, 4100))).toEqual(['FINISH']);
    expect(timeline.update(7, 5000)).toEqual([]);
    expect(timeline.finish(7, 'normal')).toEqual([]);
  });

  it('routes skip/completion races through one idempotent finish', () => {
    const skipWins = new FailureTimeline(options({ alreadySeen: true }));
    skipWins.enter(7, 0);
    expect(types(skipWins.finish(7, 'skip'))).toEqual(['FINISH']);
    expect(skipWins.update(7, 4000)).toEqual([]);

    const completionWins = new FailureTimeline(options({ alreadySeen: true }));
    completionWins.enter(7, 0);
    expect(types(completionWins.update(7, 4000))).toEqual(['CORE', 'FINISH']);
    expect(completionWins.finish(7, 'skip')).toEqual([]);
  });

  it('does not allow an unseen scene to skip before its core marker', () => {
    const timeline = new FailureTimeline(options());
    timeline.enter(7, 0);
    expect(timeline.finish(7, 'skip')).toEqual([]);
    expect(types(timeline.update(7, 3000))).toEqual(['CORE', 'SEEN']);
    expect(types(timeline.finish(7, 'skip'))).toEqual(['FINISH']);
  });

  it('lets minimize-scenes skip a new ending but emits unlock only, never seen', () => {
    const timeline = new FailureTimeline(options({ minimizeScenes: true }));
    expect(types(timeline.enter(7, 10))).toEqual(['UNLOCK']);
    const events = timeline.finish(7, 'skip');
    expect(types(events)).toEqual(['FINISH']);
    expect(events.some(item => item.type === 'SEEN')).toBe(false);
  });

  it('lets an already-seen ending skip immediately without duplicate seen', () => {
    const timeline = new FailureTimeline(options({ alreadySeen: true }));
    expect(types(timeline.enter(7, 0))).toEqual(['UNLOCK']);
    expect(types(timeline.finish(7, 'skip'))).toEqual(['FINISH']);
  });

  it('ignores stale round callbacks without affecting the current timeline', () => {
    const timeline = new FailureTimeline(options());
    expect(timeline.enter(6, 0)).toEqual([]);
    expect(types(timeline.enter(7, 100))).toEqual(['UNLOCK']);
    expect(timeline.update(6, 9999)).toEqual([]);
    expect(timeline.finish(6, 'normal')).toEqual([]);
    expect(types(timeline.update(7, 4100))).toEqual(['CORE', 'SEEN', 'FINISH']);
  });

  it('cleanup aborts callbacks without marking seen or finishing', () => {
    const timeline = new FailureTimeline(options());
    timeline.enter(7, 0);
    expect(types(timeline.cleanup(7))).toEqual(['CLEANUP']);
    expect(timeline.cleanup(7)).toEqual([]);
    expect(timeline.update(7, 4000)).toEqual([]);
    expect(timeline.finish(7, 'normal')).toEqual([]);
  });

  it('validates markers and monotonic game-time updates', () => {
    expect(() => new FailureTimeline(options({ durationMs: 0 }))).toThrow(RangeError);
    expect(() => new FailureTimeline(options({ coreAtMs: 4001 }))).toThrow(RangeError);
    const timeline = new FailureTimeline(options());
    expect(() => timeline.enter(7, -1)).toThrow(RangeError);
    timeline.enter(7, 100);
    timeline.update(7, 200);
    expect(() => timeline.update(7, 199)).toThrow(RangeError);
  });
});
