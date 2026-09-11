import type {
  CapturedReplayRound,
  ReplayRoundExpected,
  SessionReplayFixture,
} from '../game/replay';
import {
  SESSION_REPLAY_RANDOM_VERSION,
  SESSION_REPLAY_RULES_VERSION,
  SESSION_REPLAY_SCHEMA_VERSION,
} from '../game/replay';
import type { ProfileV1 } from '../storage/profile';

function cloneFrozen<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(item => cloneFrozen(item))) as T;
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = cloneFrozen(item);
    return Object.freeze(copy) as T;
  }
  return value;
}

/** Development capture buffer. It owns copies of every supplied value and has
 * no storage, clock, random, DOM, or live-session side effects. */
export class ReplayRecorder {
  private readonly initialProfile: ProfileV1;
  private readonly initialEndingRngState: number;
  private readonly rounds: CapturedReplayRound[] = [];
  private readonly expectedRounds: ReplayRoundExpected[] = [];
  private finalProfile: ProfileV1 | null = null;
  private finalEndingRngState: number | null = null;

  constructor(initialProfile: ProfileV1, endingRngState: number) {
    this.initialProfile = cloneFrozen(initialProfile);
    this.initialEndingRngState = endingRngState;
  }

  recordRound(
    captured: CapturedReplayRound,
    expected: ReplayRoundExpected,
    finalProfile: ProfileV1,
    endingRngState: number,
  ): void {
    this.rounds.push(cloneFrozen(captured));
    this.expectedRounds.push(cloneFrozen(expected));
    this.finalProfile = cloneFrozen(finalProfile);
    this.finalEndingRngState = endingRngState;
  }

  /** Retry belongs to the last completed failure and never creates a round. */
  markRetry(): void {
    const index = this.rounds.length - 1;
    if (index < 0 || this.expectedRounds[index]?.failureType === null) return;
    this.rounds[index] = cloneFrozen({ ...this.rounds[index]!, retryAfter: true });
  }

  export(): SessionReplayFixture | null {
    if (this.finalProfile === null || this.finalEndingRngState === null || this.rounds.length === 0) return null;
    return cloneFrozen({
      schemaVersion: SESSION_REPLAY_SCHEMA_VERSION,
      rulesVersion: SESSION_REPLAY_RULES_VERSION,
      randomVersion: SESSION_REPLAY_RANDOM_VERSION,
      catalogCharacterIds: this.initialProfile.bag.order,
      initialProfile: this.initialProfile,
      endingRngState: this.initialEndingRngState,
      rounds: this.rounds,
      expected: {
        rounds: this.expectedRounds,
        finalProfile: this.finalProfile,
        finalBag: this.finalProfile.bag,
        endingRngState: this.finalEndingRngState,
      },
    });
  }
}
