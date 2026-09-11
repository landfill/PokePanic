import { classifyFailure, type FailureType } from './failure';
import { intersectPad, type PadIntersection, type PadSnapshot } from './geometry';
import { awardedScore, scoreContact, type ScoreResult } from './scoring';
import { TUNING } from './config';

export interface FireAdjudicationInput {
  readonly roundId: number;
  readonly powerPercent: number;
  readonly angleDegrees: number;
  readonly powerLockedAtMs: number;
  readonly firedAtMs: number;
  readonly origin: readonly [number, number, number];
  readonly padSnapshot: PadSnapshot;
}

export interface AdjudicatedShot {
  readonly roundId: number;
  readonly input: Readonly<{
    powerPercent: number;
    angleDegrees: number;
    powerLockedAtMs: number;
    firedAtMs: number;
  }>;
  readonly origin: readonly [number, number, number];
  readonly padSnapshot: PadSnapshot;
  readonly intersection: PadIntersection | null;
  readonly score: ScoreResult;
  readonly failureType: FailureType | null;
}

export interface RunView {
  readonly runId: number;
  readonly status: 'PLAYING' | 'SCENE' | 'GAME_OVER';
  readonly roundNumber: number;
  readonly currentRoundId: number;
  readonly totalScore: number;
  readonly streak: number;
  readonly shot: AdjudicatedShot | null;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Shot input must be finite');
  return value;
}

/**
 * Owns run-local score and transitions only. Character bags, profile records,
 * scene selection and persistence stay with their respective session services.
 */
export class RunController {
  private runId = 1;
  private status: RunView['status'] = 'PLAYING';
  private roundNumber = 1;
  private currentRoundId: number;
  private totalScore = 0;
  private streak = 0;
  private shot: AdjudicatedShot | null = null;

  constructor(firstRoundId = 1) {
    if (!Number.isSafeInteger(firstRoundId) || firstRoundId < 1) {
      throw new RangeError('Invalid first round id');
    }
    this.currentRoundId = firstRoundId;
  }

  view(): Readonly<RunView> {
    return Object.freeze({
      runId: this.runId,
      status: this.status,
      roundNumber: this.roundNumber,
      currentRoundId: this.currentRoundId,
      totalScore: this.totalScore,
      streak: this.streak,
      shot: this.shot,
    });
  }

  adjudicateFire(fire: FireAdjudicationInput): AdjudicatedShot | null {
    if (fire.roundId !== this.currentRoundId) return null;
    if (this.status === 'SCENE') return this.shot;
    if (this.status !== 'PLAYING') return null;

    if (fire.origin.length !== 3
      || !Number.isFinite(fire.powerPercent) || fire.powerPercent < 0 || fire.powerPercent > 100
      || !Number.isFinite(fire.angleDegrees) || Math.abs(fire.angleDegrees) > TUNING.angleLimitDegrees
      || !Number.isFinite(fire.powerLockedAtMs) || fire.powerLockedAtMs < 0
      || !Number.isFinite(fire.firedAtMs) || fire.firedAtMs < fire.powerLockedAtMs) {
      throw new RangeError('Invalid FIRE input');
    }

    const origin = Object.freeze(fire.origin.map(finite) as [number, number, number]);
    const padSnapshot = Object.freeze({
      worldFromLocal: Object.freeze(fire.padSnapshot.worldFromLocal.map(finite)),
      radiusX: finite(fire.padSnapshot.radiusX),
      radiusY: finite(fire.padSnapshot.radiusY),
    });
    const input = Object.freeze({
      powerPercent: finite(fire.powerPercent),
      angleDegrees: finite(fire.angleDegrees),
      powerLockedAtMs: finite(fire.powerLockedAtMs),
      firedAtMs: finite(fire.firedAtMs),
    });
    const intersection = intersectPad(origin, input.angleDegrees, padSnapshot);
    const score = scoreContact({ powerPercent: input.powerPercent, contact: intersection?.contact ?? null });
    const shot = Object.freeze({
      roundId: fire.roundId,
      input,
      origin,
      padSnapshot,
      intersection,
      score,
      failureType: classifyFailure(score),
    });
    this.shot = shot;
    this.status = 'SCENE';
    return shot;
  }

  finishScene(roundId: number): Readonly<RunView> {
    if (roundId !== this.currentRoundId || this.status !== 'SCENE' || this.shot === null) {
      return this.view();
    }
    if (this.shot.score.isSuccess) {
      this.streak += 1;
      this.totalScore += awardedScore(this.shot.score, this.streak);
      this.roundNumber += 1;
      this.currentRoundId += 1;
      this.shot = null;
      this.status = 'PLAYING';
    } else {
      this.streak = 0;
      this.status = 'GAME_OVER';
    }
    return this.view();
  }

  retry(): Readonly<RunView> {
    if (this.status !== 'GAME_OVER') return this.view();
    this.runId += 1;
    this.roundNumber = 1;
    this.currentRoundId += 1;
    this.totalScore = 0;
    this.streak = 0;
    this.shot = null;
    this.status = 'PLAYING';
    return this.view();
  }
}
