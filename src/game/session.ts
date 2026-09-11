import { intersectPad, type PadSnapshot } from './geometry';
import { RunController, type RunView } from './run';
import { ShotInput, type ShotInputOptions, type ShotInputView } from './shot-input';

export interface PreparedRoundInput extends ShotInputOptions {
  readonly origin: readonly [number, number, number];
  readonly padSnapshot: PadSnapshot;
}

export interface GameSessionView {
  readonly run: Readonly<RunView>;
  readonly input: Readonly<ShotInputView> | null;
}

interface PreparedRound {
  readonly roundId: number;
  readonly origin: readonly [number, number, number];
  readonly padSnapshot: PadSnapshot;
  readonly input: ShotInput;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Prepared geometry must be finite');
  return value;
}

/** Connects one prepared geometry snapshot to input and run adjudication.
 * Asset preparation, character selection and RNG remain outside this class. */
export class GameSession {
  private readonly run: RunController;
  private prepared: PreparedRound | null = null;

  constructor(firstRoundId = 1) {
    this.run = new RunController(firstRoundId);
  }

  runView(): Readonly<RunView> { return this.run.view(); }

  prepareCurrentRound(options: PreparedRoundInput): boolean {
    const run = this.run.view();
    if (run.status !== 'PLAYING' || options.roundId !== run.currentRoundId || this.prepared !== null) return false;

    if (options.origin.length !== 3) throw new RangeError('Prepared origin must have three coordinates');
    const origin = Object.freeze(options.origin.map(finite) as [number, number, number]);
    const padSnapshot = Object.freeze({
      worldFromLocal: Object.freeze(options.padSnapshot.worldFromLocal.map(finite)),
      radiusX: finite(options.padSnapshot.radiusX),
      radiusY: finite(options.padSnapshot.radiusY),
    });
    // Validate the immutable geometry before accepting input for the round.
    intersectPad(origin, 0, padSnapshot);
    const input = new ShotInput(options);
    this.prepared = Object.freeze({ roundId: options.roundId, origin, padSnapshot, input });
    return true;
  }

  sample(wallTime: number): Readonly<GameSessionView> {
    return Object.freeze({ run: this.run.view(), input: this.prepared?.input.sample(wallTime) ?? null });
  }

  press(token: string, wallTime: number): Readonly<GameSessionView> {
    const prepared = this.prepared;
    if (prepared === null || this.run.view().status !== 'PLAYING') return this.sample(wallTime);
    const input = prepared.input.press(token, wallTime);
    if (input.shot !== null) {
      this.run.adjudicateFire({
        ...input.shot,
        origin: prepared.origin,
        padSnapshot: prepared.padSnapshot,
      });
    }
    return Object.freeze({ run: this.run.view(), input });
  }

  release(token: string): void { this.prepared?.input.release(token); }
  pause(wallTime: number): void { this.prepared?.input.pause(wallTime); }
  resume(wallTime: number): void { this.prepared?.input.resume(wallTime); }

  finishScene(roundId: number): Readonly<RunView> {
    const before = this.run.view();
    const after = this.run.finishScene(roundId);
    if (before.status === 'SCENE' && after.status !== 'SCENE') this.prepared = null;
    return after;
  }

  retry(): Readonly<RunView> {
    const before = this.run.view();
    const after = this.run.retry();
    if (after.runId !== before.runId) this.prepared = null;
    return after;
  }
}
