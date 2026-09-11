import { GameClock, oscillate } from './clock';
import { RULES, TUNING } from './config';
import { maxScore } from './scoring';

export interface ShotInputOptions {
  readonly roundId: number;
  readonly startWallTime: number;
  readonly powerPeriodMs?: number;
  readonly anglePeriodMs?: number;
  readonly powerPhase?: number;
  readonly anglePhase?: number;
}

// Geometry and adjudication are attached at the FIRE boundary by M1-02/03.
export interface LockedShotInput {
  readonly roundId: number;
  readonly powerPercent: number;
  readonly angleDegrees: number;
  readonly powerLockedAtMs: number;
  readonly firedAtMs: number;
}

export interface ShotInputView {
  readonly stage: 'POWER' | 'AIM' | 'FIRE';
  readonly paused: boolean;
  readonly gameTimeMs: number;
  readonly powerPercent: number;
  readonly angleDegrees: number;
  readonly maxRawScore: number;
  readonly canStillSucceed: boolean;
  readonly shot: Readonly<LockedShotInput> | null;
}

/** One prepared round. The caller supplies the same monotonic wall clock for
 * render, input and suspension. No DOM, scheduling, scoring side effects or RNG. */
export class ShotInput {
  private readonly clock: GameClock;
  private readonly options: Required<ShotInputOptions>;
  private readonly held = new Set<string>();
  private stage: ShotInputView['stage'] = 'POWER';
  private paused = false;
  private lockedPower = 0;
  private aimStartedAtMs = 0;
  private shot: Readonly<LockedShotInput> | null = null;

  constructor(options: ShotInputOptions) {
    const resolved = {
      powerPeriodMs: TUNING.powerPeriodMs,
      anglePeriodMs: TUNING.anglePeriodMs,
      powerPhase: 0,
      anglePhase: 0,
      ...options,
    };
    if (!Number.isSafeInteger(resolved.roundId) || resolved.roundId < 1
      || ![resolved.powerPhase, resolved.anglePhase, resolved.powerPeriodMs, resolved.anglePeriodMs].every(Number.isFinite)
      || resolved.powerPeriodMs < TUNING.minimumPowerPeriodMs
      || resolved.anglePeriodMs < TUNING.minimumAnglePeriodMs) {
      throw new RangeError('Invalid shot input options');
    }
    this.options = Object.freeze(resolved);
    this.clock = new GameClock(options.startWallTime);
  }

  sample(wallTime: number): Readonly<ShotInputView> {
    const gameTimeMs = this.clock.now(wallTime);
    const powerPercent = this.stage === 'POWER'
      ? 100 * oscillate(gameTimeMs, this.options.powerPeriodMs, this.options.powerPhase)
      : this.lockedPower;
    const angleDegrees = this.shot?.angleDegrees ??
      (2 * oscillate(this.stage === 'POWER' ? 0 : gameTimeMs - this.aimStartedAtMs,
        this.options.anglePeriodMs, this.options.anglePhase) - 1) * TUNING.angleLimitDegrees;
    const maxRawScore = maxScore(powerPercent);
    return Object.freeze({ stage: this.stage, paused: this.paused, gameTimeMs,
      powerPercent, angleDegrees, maxRawScore,
      canStillSucceed: maxRawScore >= RULES.successScore, shot: this.shot });
  }

  press(token: string, wallTime: number): Readonly<ShotInputView> {
    const view = this.sample(wallTime);
    const blocked = this.held.size > 0;
    this.held.add(token);
    if (blocked || this.paused || this.stage === 'FIRE') return view;
    if (this.stage === 'POWER') {
      this.lockedPower = view.powerPercent;
      this.aimStartedAtMs = view.gameTimeMs;
      this.stage = 'AIM';
    } else {
      this.shot = Object.freeze({ roundId: this.options.roundId,
        powerPercent: this.lockedPower, angleDegrees: view.angleDegrees,
        powerLockedAtMs: this.aimStartedAtMs, firedAtMs: view.gameTimeMs });
      this.stage = 'FIRE';
    }
    return this.sample(wallTime);
  }

  release(token: string): void { this.held.delete(token); }

  pause(wallTime: number): void {
    this.clock.pause(wallTime);
    this.paused = true;
    this.held.clear();
  }

  // Visibility/focus returning never invokes this automatically.
  resume(wallTime: number): void {
    this.clock.resume(wallTime);
    this.paused = false;
  }
}
