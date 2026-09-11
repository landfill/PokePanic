import { ScenePlayback } from '../animation/playback';
import { recordCharacterDiscovery, recordEndingSeen, recordEndingUnlock } from '../endings/collection';
import { ENDINGS, ENDING_IDS, REVEAL_END_MS, RUNTIME_CHARACTERS, SUCCESS_END_MS,
  fallbackFor, getEnding, type RuntimeCharacterId } from '../endings/runtime';
import { selectEnding } from '../endings/select';
import { sanitizeProfile, type ProfileV1 } from '../storage/profile';
import { CharacterBag, type BagSnapshot } from './character-bag';
import type { FailureType } from './failure';
import { SeededRandom } from './random';
import { GameSession, type PreparedRoundInput } from './session';

export const SESSION_REPLAY_SCHEMA_VERSION = 1;
export const SESSION_REPLAY_RULES_VERSION = 1;
export const SESSION_REPLAY_RANDOM_VERSION = 'lcg32-v1' as const;

export type ReplayFinishPolicy = 'normal' | 'skip' | 'minimized';

export interface CapturedReplayRound {
  readonly roundId: number;
  /** Resolved geometry and gauge values captured at PREPARE; no placement/gauge RNG is regenerated. */
  readonly prepared: Omit<PreparedRoundInput, 'roundId' | 'startWallTime'>;
  /** Pause-excluded game times, local to this prepared round. */
  readonly inputGameTimeMs: readonly [number, number];
  readonly finishPolicy: ReplayFinishPolicy;
  readonly retryAfter?: boolean;
  /** Profile preferences captured after this round completed. */
  readonly settingsAfter?: ProfileV1['settings'];
}

export interface ReplayRoundExpected {
  readonly characterId: RuntimeCharacterId;
  readonly rawScore: number;
  readonly failureType: FailureType | null;
  readonly endingId: string | null;
  readonly runId: number;
  readonly runTotal: number;
  readonly streak: number;
  readonly bagCursor: number;
  readonly unlockedEndingIds: readonly string[];
  readonly seenEndingIds: readonly string[];
}

export interface SessionReplayExpected {
  readonly rounds: readonly ReplayRoundExpected[];
  readonly finalProfile: ProfileV1;
  readonly finalBag: BagSnapshot;
  readonly endingRngState: number;
}

export interface SessionReplayFixture {
  readonly schemaVersion: number;
  readonly rulesVersion: number;
  readonly randomVersion: string;
  /** Captured shuffle-bag catalog. Omitted fixtures use the current runtime catalog. */
  readonly catalogCharacterIds?: readonly string[];
  readonly initialProfile: ProfileV1;
  readonly endingRngState: number;
  readonly rounds: readonly CapturedReplayRound[];
  readonly expected: SessionReplayExpected;
}

export interface SessionReplayResult extends SessionReplayExpected {}

function resolveCatalog(fixture: SessionReplayFixture): readonly RuntimeCharacterId[] {
  const source = fixture.catalogCharacterIds ?? RUNTIME_CHARACTERS;
  if (!Array.isArray(source) || source.length < 2 || new Set(source).size !== source.length
    || source.some(id => !RUNTIME_CHARACTERS.includes(id as RuntimeCharacterId))) {
    throw new RangeError('Replay catalogCharacterIds must be unique known runtime IDs with at least two entries');
  }
  return Object.freeze([...source] as RuntimeCharacterId[]);
}

function validateFixture(fixture: SessionReplayFixture, catalog: readonly RuntimeCharacterId[]): ProfileV1 {
  if (fixture.schemaVersion !== SESSION_REPLAY_SCHEMA_VERSION) throw new RangeError('Unsupported replay schemaVersion');
  if (fixture.rulesVersion !== SESSION_REPLAY_RULES_VERSION) throw new RangeError('Unsupported replay rulesVersion');
  if (fixture.randomVersion !== SESSION_REPLAY_RANDOM_VERSION) throw new RangeError('Unsupported replay randomVersion');
  if (fixture.rounds.length === 0) throw new RangeError('Replay requires at least one captured round');
  // Profile validation uses every known runtime content ID. Bag validation is
  // separate so a captured legacy catalog remains replayable after expansion.
  const validationBag = {
    order: RUNTIME_CHARACTERS,
    cursor: RUNTIME_CHARACTERS.length,
    previousCharacterId: null,
    characterRngState: fixture.initialProfile.bag.characterRngState,
  } as const;
  const profile = sanitizeProfile({ ...fixture.initialProfile, bag: validationBag }, {
    characterIds: RUNTIME_CHARACTERS,
    endingIds: ENDING_IDS,
    prefersReducedMotion: fixture.initialProfile.settings.reducedMotion,
    initialCharacterRngState: fixture.initialProfile.bag.characterRngState,
  });
  const originalWithoutBag = { ...fixture.initialProfile, bag: validationBag };
  if (profile === null || firstDifference(profile, originalWithoutBag, 'initialProfile') !== null) {
    throw new RangeError('Replay initialProfile is not a valid runtime ProfileV1');
  }
  // CharacterBag owns exact permutation/cursor/previous/RNG validation against
  // the captured catalog; preserve that legacy snapshot in the validated profile.
  new CharacterBag(catalog, fixture.initialProfile.bag.characterRngState, fixture.initialProfile.bag);
  return Object.freeze({ ...profile, bag: fixture.initialProfile.bag });
}

function applyPlaybackEvents(profile: ProfileV1, events: ReturnType<ScenePlayback['update']>): ProfileV1 {
  let next = profile;
  for (const event of events) {
    if (event.type === 'DISCOVER') next = recordCharacterDiscovery(next, event.characterId, RUNTIME_CHARACTERS);
    else if (event.type === 'UNLOCK') next = recordEndingUnlock(next, event.endingId, ENDING_IDS);
    else if (event.type === 'SEEN') next = recordEndingSeen(next, event.endingId, ENDING_IDS);
  }
  return next;
}

function applySettingsAfter(profile: ProfileV1, settings: ProfileV1['settings'], roundIndex: number): ProfileV1 {
  const validationBag = {
    order: RUNTIME_CHARACTERS,
    cursor: RUNTIME_CHARACTERS.length,
    previousCharacterId: null,
    characterRngState: profile.bag.characterRngState,
  } as const;
  const sanitized = sanitizeProfile({ ...profile, bag: validationBag, settings }, {
    characterIds: RUNTIME_CHARACTERS,
    endingIds: ENDING_IDS,
    prefersReducedMotion: profile.settings.reducedMotion,
    initialCharacterRngState: profile.bag.characterRngState,
  });
  if (sanitized === null || firstDifference(sanitized.settings, settings) !== null) {
    throw new RangeError(`rounds[${roundIndex}].settingsAfter is not a valid ProfileV1 settings snapshot`);
  }
  return Object.freeze({ ...profile, settings: sanitized.settings });
}

function finishPlayback(playback: ScenePlayback, policy: ReplayFinishPolicy): ReturnType<ScenePlayback['update']> {
  const firedAt = playback.shot.input.firedAtMs;
  if (playback.shot.score.isSuccess) return playback.update(firedAt + SUCCESS_END_MS);
  const ending = getEnding(playback.endingId!);
  if (policy === 'minimized') return playback.update(firedAt + REVEAL_END_MS);
  if (policy === 'normal') return playback.update(firedAt + REVEAL_END_MS + ending.durationMs);
  const events = [...playback.update(firedAt + REVEAL_END_MS + ending.coreAtMs), ...playback.skip()];
  return Object.freeze(events);
}

/**
 * Replays resolved PREPARE contexts through production domain objects. The fixture
 * records geometry, gauge periods/phases and pause-excluded input times; this v1
 * format deliberately does not claim to regenerate placement or gauge RNG draws.
 */
export function runSessionReplay(
  fixture: SessionReplayFixture,
  options: { readonly effectRandomCalls?: number; readonly effectRngState?: number } = {},
): SessionReplayResult {
  const catalog = resolveCatalog(fixture);
  let profile = validateFixture(fixture, catalog);
  const effectCalls = options.effectRandomCalls ?? 0;
  if (!Number.isSafeInteger(effectCalls) || effectCalls < 0) throw new RangeError('Invalid effect random call count');
  const effects = new SeededRandom(options.effectRngState ?? 0);
  for (let index = 0; index < effectCalls; index += 1) effects.next();

  const firstRoundId = fixture.rounds[0]!.roundId;
  const session = new GameSession(firstRoundId);
  const bag = new CharacterBag(catalog, profile.bag.characterRngState, profile.bag);
  const endingRandom = new SeededRandom(fixture.endingRngState);
  const rounds: ReplayRoundExpected[] = [];

  for (let index = 0; index < fixture.rounds.length; index += 1) {
    const captured = fixture.rounds[index]!;
    const runBefore = session.runView();
    if (captured.roundId !== runBefore.currentRoundId) {
      throw new RangeError(`rounds[${index}].roundId does not match current round ${runBefore.currentRoundId}`);
    }
    const reservation = bag.peek();
    const characterId = reservation.characterId as RuntimeCharacterId;
    const prepared: PreparedRoundInput = {
      roundId: captured.roundId,
      startWallTime: 0,
      origin: captured.prepared.origin,
      padSnapshot: captured.prepared.padSnapshot,
      ...(captured.prepared.powerPeriodMs === undefined ? {} : { powerPeriodMs: captured.prepared.powerPeriodMs }),
      ...(captured.prepared.anglePeriodMs === undefined ? {} : { anglePeriodMs: captured.prepared.anglePeriodMs }),
      ...(captured.prepared.powerPhase === undefined ? {} : { powerPhase: captured.prepared.powerPhase }),
      ...(captured.prepared.anglePhase === undefined ? {} : { anglePhase: captured.prepared.anglePhase }),
    };
    if (!session.prepareCurrentRound(prepared)) throw new Error(`rounds[${index}] preparation was rejected`);
    if (bag.commit(reservation.token) !== characterId) throw new Error(`rounds[${index}] bag commit failed`);
    profile = Object.freeze({ ...profile, bag: bag.snapshot() });

    const [powerAt, fireAt] = captured.inputGameTimeMs;
    if (!Number.isFinite(powerAt) || !Number.isFinite(fireAt) || powerAt < 0 || fireAt < powerAt) {
      throw new RangeError(`rounds[${index}].inputGameTimeMs must be monotonic pause-excluded times`);
    }
    session.press(`replay:${index}:power`, powerAt);
    session.release(`replay:${index}:power`);
    const fired = session.press(`replay:${index}:fire`, fireAt);
    const shot = fired.run.shot;
    if (shot === null) throw new Error(`rounds[${index}] did not produce a shot`);

    const selection = selectEnding({
      characterId,
      failureType: shot.failureType,
      candidates: ENDINGS,
      seenEndingIds: profile.seenEndingIds,
      fallbackByFailure: fallbackFor(characterId),
      random: () => endingRandom.next(),
    });
    if (selection?.usedFallback) throw new Error(`rounds[${index}] used a runtime ending fallback`);
    const playback = new ScenePlayback(characterId, shot, {
      endingId: selection?.endingId ?? null,
      alreadySeen: selection ? profile.seenEndingIds.includes(selection.endingId) : false,
      minimizeScenes: captured.finishPolicy === 'minimized',
    });
    const playbackEvents = finishPlayback(playback, captured.finishPolicy);
    profile = applyPlaybackEvents(profile, playbackEvents);
    if (!playbackEvents.some(event => event.type === 'FINISH')) {
      throw new Error(`rounds[${index}] finish policy did not finish playback`);
    }
    const after = session.finishScene(captured.roundId);
    profile = Object.freeze({
      ...profile,
      bestScore: Math.max(profile.bestScore, after.totalScore),
      bestStreak: Math.max(profile.bestStreak, after.streak),
    });
    if (captured.settingsAfter !== undefined) {
      profile = applySettingsAfter(profile, captured.settingsAfter, index);
    }
    rounds.push(Object.freeze({
      characterId,
      rawScore: shot.score.rawScore,
      failureType: shot.failureType,
      endingId: selection?.endingId ?? null,
      runId: after.runId,
      runTotal: after.totalScore,
      streak: after.streak,
      bagCursor: bag.snapshot().cursor,
      unlockedEndingIds: Object.freeze([...profile.unlockedEndingIds]),
      seenEndingIds: Object.freeze([...profile.seenEndingIds]),
    }));

    const hasNext = index + 1 < fixture.rounds.length;
    if (captured.retryAfter === true) {
      if (after.status !== 'GAME_OVER') throw new RangeError(`rounds[${index}].retryAfter requires GAME_OVER`);
      session.retry();
    } else if (hasNext && after.status === 'GAME_OVER') {
      throw new RangeError(`rounds[${index}] must set retryAfter before the next captured round`);
    }
  }

  return Object.freeze({
    rounds: Object.freeze(rounds),
    finalProfile: profile,
    finalBag: bag.snapshot(),
    endingRngState: endingRandom.state(),
  });
}

function firstDifference(actual: unknown, expected: unknown, path = 'expected'): string | null {
  if (Object.is(actual, expected)) return null;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return `${path}.length: expected ${expected.length}, received ${actual.length}`;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (typeof actual === 'object' && actual !== null && typeof expected === 'object' && expected !== null) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      const difference = firstDifference((actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return null;
  }
  return `${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`;
}

export function assertSessionReplay(fixture: SessionReplayFixture): SessionReplayResult {
  const actual = runSessionReplay(fixture);
  const difference = firstDifference(actual, fixture.expected);
  if (difference) throw new Error(`Replay mismatch at ${difference}`);
  return actual;
}

/** Concise public aliases for capture/replay harness consumers. */
export const replaySession = runSessionReplay;
export const assertReplay = assertSessionReplay;
