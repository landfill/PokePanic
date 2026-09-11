export interface TimelineOptions {
  readonly roundId: number;
  readonly endingId: string;
  readonly durationMs: number;
  readonly coreAtMs: number;
  readonly alreadySeen: boolean;
  readonly minimizeScenes: boolean;
}

export type TimelineEvent =
  | Readonly<{ type: 'UNLOCK'; roundId: number; endingId: string }>
  | Readonly<{ type: 'CORE'; roundId: number; endingId: string }>
  | Readonly<{ type: 'SEEN'; roundId: number; endingId: string }>
  | Readonly<{ type: 'FINISH'; roundId: number; endingId: string; reason: 'normal' | 'skip' }>
  | Readonly<{ type: 'CLEANUP'; roundId: number; endingId: string }>;

function event<T extends TimelineEvent>(value: T): T { return Object.freeze(value); }

/** Deterministic lifecycle for a failure main scene. The caller supplies game
 * time from the common clock and applies the returned persistence/run events. */
export class FailureTimeline {
  private readonly options: TimelineOptions;
  private enteredAtMs: number | null = null;
  private lastGameTimeMs: number | null = null;
  private coreReached = false;
  private seenEmitted = false;
  private finished = false;
  private cleaned = false;

  constructor(options: TimelineOptions) {
    if (!Number.isSafeInteger(options.roundId) || options.roundId < 1
      || options.endingId.length === 0
      || !Number.isFinite(options.durationMs) || options.durationMs <= 0
      || !Number.isFinite(options.coreAtMs) || options.coreAtMs < 0
      || options.coreAtMs > options.durationMs) {
      throw new RangeError('Invalid failure timeline options');
    }
    this.options = Object.freeze({ ...options });
  }

  enter(roundId: number, gameTimeMs: number): readonly TimelineEvent[] {
    if (roundId !== this.options.roundId || this.enteredAtMs !== null || this.cleaned) return [];
    this.validateTime(gameTimeMs);
    this.enteredAtMs = gameTimeMs;
    this.lastGameTimeMs = gameTimeMs;
    return [event({ type: 'UNLOCK', roundId, endingId: this.options.endingId })];
  }

  update(roundId: number, gameTimeMs: number): readonly TimelineEvent[] {
    if (!this.isActive(roundId)) return [];
    this.validateTime(gameTimeMs);
    if (gameTimeMs < this.lastGameTimeMs!) throw new RangeError('Timeline game time must be monotonic');
    this.lastGameTimeMs = gameTimeMs;
    const elapsed = gameTimeMs - this.enteredAtMs!;
    const events: TimelineEvent[] = [];
    if (!this.coreReached && elapsed >= this.options.coreAtMs) {
      this.coreReached = true;
      events.push(event({ type: 'CORE', roundId, endingId: this.options.endingId }));
      this.emitSeen(events);
    }
    if (elapsed >= this.options.durationMs) events.push(...this.complete('normal'));
    return events;
  }

  finish(roundId: number, reason: 'normal' | 'skip'): readonly TimelineEvent[] {
    if (!this.isActive(roundId)) return [];
    if (reason === 'skip' && !this.canSkip()) return [];
    return this.complete(reason);
  }

  cleanup(roundId: number): readonly TimelineEvent[] {
    if (roundId !== this.options.roundId || this.cleaned) return [];
    this.cleaned = true;
    return [event({ type: 'CLEANUP', roundId, endingId: this.options.endingId })];
  }

  private isActive(roundId: number): boolean {
    return roundId === this.options.roundId && this.enteredAtMs !== null && !this.finished && !this.cleaned;
  }

  private canSkip(): boolean {
    return this.options.alreadySeen || this.options.minimizeScenes || this.coreReached;
  }

  private complete(reason: 'normal' | 'skip'): TimelineEvent[] {
    if (this.finished || this.cleaned) return [];
    const events: TimelineEvent[] = [];
    if (reason === 'normal') this.emitSeen(events);
    this.finished = true;
    events.push(event({ type: 'FINISH', roundId: this.options.roundId,
      endingId: this.options.endingId, reason }));
    return events;
  }

  private emitSeen(events: TimelineEvent[]): void {
    if (this.seenEmitted || this.options.alreadySeen) return;
    this.seenEmitted = true;
    events.push(event({ type: 'SEEN', roundId: this.options.roundId, endingId: this.options.endingId }));
  }

  private validateTime(gameTimeMs: number): void {
    if (!Number.isFinite(gameTimeMs) || gameTimeMs < 0) throw new RangeError('Invalid timeline game time');
  }
}
