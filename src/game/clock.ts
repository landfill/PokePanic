export class GameClock {
  private lastWallTime: number;
  private elapsed = 0;
  private paused = false;

  constructor(startWallTime: number) {
    if (!Number.isFinite(startWallTime)) throw new RangeError('Invalid clock time');
    this.lastWallTime = startWallTime;
  }

  now(wallTime: number): number {
    if (!Number.isFinite(wallTime) || wallTime < this.lastWallTime) throw new RangeError('Clock must be monotonic');
    if (!this.paused) this.elapsed += wallTime - this.lastWallTime;
    this.lastWallTime = wallTime;
    return this.elapsed;
  }

  pause(wallTime: number): void { this.now(wallTime); this.paused = true; }
  resume(wallTime: number): void { this.now(wallTime); this.paused = false; }
}

// 0 -> 1 -> 0 over one whole period. Use the same call in RAF and the input handler.
export function oscillate(gameTimeMs: number, periodMs: number, phase = 0): number {
  if (![gameTimeMs, periodMs, phase].every(Number.isFinite) || periodMs <= 0) {
    throw new RangeError('Invalid oscillator arguments');
  }
  const cycle = ((gameTimeMs / periodMs + phase) % 1 + 1) % 1;
  return 1 - Math.abs(2 * cycle - 1);
}
