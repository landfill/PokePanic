import { describe, expect, it } from 'vitest';
import { ReplayRecorder } from '../../src/debug/recorder';
import { assertSessionReplay, type CapturedReplayRound, type ReplayRoundExpected } from '../../src/game/replay';
import { ENDING_IDS, RUNTIME_CHARACTERS } from '../../src/endings/runtime';
import { createDefaultProfile, type ProfileOptions, type ProfileV1 } from '../../src/storage/profile';

const options: ProfileOptions = {
  characterIds: ['iron', 'complaint'],
  endingIds: ['representative-iron', 'representative-complaint', 'false-relief', 'self-own', 'awkward-miss', 'fake-forgiveness'],
  prefersReducedMotion: false,
  initialCharacterRngState: 0,
};
const pad = {
  worldFromLocal: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1],
  radiusX: 0.4,
  radiusY: 0.3,
};

function successCapture(): CapturedReplayRound {
  return {
    roundId: 1,
    prepared: { origin: [0, 0, 0], padSnapshot: pad, powerPeriodMs: 2200, anglePeriodMs: 3000, powerPhase: 0, anglePhase: 0 },
    inputGameTimeMs: [1100, 1850],
    finishPolicy: 'normal',
  };
}

function successExpected(): ReplayRoundExpected {
  return {
    characterId: 'complaint', rawScore: 1000, failureType: null, endingId: null,
    runId: 1, runTotal: 1000, streak: 1, bagCursor: 1,
    unlockedEndingIds: [], seenEndingIds: [],
  };
}

function successFinal(initial: ProfileV1): ProfileV1 {
  return {
    ...initial,
    bestScore: 1000,
    bestStreak: 1,
    discoveredCharacterIds: ['complaint'],
    bag: { order: ['complaint', 'iron'], cursor: 1, previousCharacterId: 'complaint', characterRngState: 1013904223 },
  };
}

describe('development replay recorder', () => {
  it('returns null until a completed round and exports an assertable replay fixture', () => {
    const initial = createDefaultProfile(options);
    const recorder = new ReplayRecorder(initial, 7);
    expect(recorder.export()).toBeNull();
    recorder.recordRound(successCapture(), successExpected(), successFinal(initial), 7);
    expect(assertSessionReplay(recorder.export()!)).toEqual(recorder.export()!.expected);
  });

  it('owns deep immutable copies of caller values and each exported snapshot', () => {
    const initial = JSON.parse(JSON.stringify(createDefaultProfile(options))) as ProfileV1;
    const captured = successCapture() as { prepared: { padSnapshot: { worldFromLocal: number[] } } } & CapturedReplayRound;
    const expected = successExpected() as { unlockedEndingIds: string[] } & ReplayRoundExpected;
    const final = successFinal(initial);
    const recorder = new ReplayRecorder(initial, 7);
    recorder.recordRound(captured, expected, final, 7);
    captured.prepared.padSnapshot.worldFromLocal[14] = -99;
    expected.unlockedEndingIds.push('self-own');
    const first = recorder.export()!;
    expect(first.rounds[0]!.prepared.padSnapshot.worldFromLocal[14]).toBe(-3);
    expect(first.expected.rounds[0]!.unlockedEndingIds).toEqual([]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rounds[0]!.prepared.padSnapshot.worldFromLocal)).toBe(true);
    expect(recorder.export()).not.toBe(first);
  });

  it('marks retry only on the last failed round', () => {
    const initial = createDefaultProfile(options);
    const success = new ReplayRecorder(initial, 7);
    success.recordRound(successCapture(), successExpected(), successFinal(initial), 7);
    success.markRetry();
    expect(success.export()!.rounds[0]!.retryAfter).toBeUndefined();

    const failure = new ReplayRecorder(initial, 7);
    const captured = { ...successCapture(), finishPolicy: 'minimized' as const };
    const expected = { ...successExpected(), rawScore: 570, failureType: 'UNDERPOWER_HIT' as const,
      endingId: 'representative-iron', streak: 0 };
    failure.recordRound(captured, expected, initial, 1025555898);
    failure.markRetry();
    expect(failure.export()!.rounds[0]!.retryAfter).toBe(true);
  });

  it('exports and round-trips a new eight-character recording catalog', () => {
    const expandedOptions: ProfileOptions = {
      characterIds: RUNTIME_CHARACTERS,
      endingIds: ENDING_IDS,
      prefersReducedMotion: false,
      initialCharacterRngState: 0,
    };
    const defaults = createDefaultProfile(expandedOptions);
    const initial: ProfileV1 = {
      ...defaults,
      bag: { order: RUNTIME_CHARACTERS, cursor: 0, previousCharacterId: null, characterRngState: 0 },
    };
    const expected: ReplayRoundExpected = {
      characterId: 'iron', rawScore: 1000, failureType: null, endingId: null,
      runId: 1, runTotal: 1000, streak: 1, bagCursor: 1,
      unlockedEndingIds: [], seenEndingIds: [],
    };
    const final: ProfileV1 = {
      ...initial,
      bestScore: 1000,
      bestStreak: 1,
      discoveredCharacterIds: ['iron'],
      bag: { order: RUNTIME_CHARACTERS, cursor: 1, previousCharacterId: 'iron', characterRngState: 0 },
    };
    const recorder = new ReplayRecorder(initial, 7);
    recorder.recordRound(successCapture(), expected, final, 7);
    const exported = recorder.export()!;
    expect(exported.catalogCharacterIds).toEqual(RUNTIME_CHARACTERS);
    expect(assertSessionReplay(exported)).toEqual(exported.expected);
  });
});
