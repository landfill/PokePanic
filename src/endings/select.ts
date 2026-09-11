import type { FailureType } from '../game/failure';

export interface EndingCandidate {
  readonly id: string;
  readonly characterIds: readonly string[];
  readonly failureTypes: readonly FailureType[];
}
export interface EndingSelection {
  readonly endingId: string;
  readonly usedFallback: boolean;
}

/** Accept only produced runtime candidates. The planning manifest is never read.
 * The caller owns the separate ending RNG and reports fallback as a data error. */
export function selectEnding(options: {
  readonly characterId: string;
  readonly failureType: FailureType | null;
  readonly candidates: readonly EndingCandidate[];
  readonly seenEndingIds: readonly string[];
  readonly fallbackByFailure: Readonly<Record<FailureType, string>>;
  readonly random: () => number;
}): Readonly<EndingSelection> | null {
  if (options.failureType === null) return null;
  const compatible = options.candidates.filter(candidate =>
    candidate.characterIds.includes(options.characterId) && candidate.failureTypes.includes(options.failureType!));
  if (compatible.length === 0) {
    const endingId = options.fallbackByFailure[options.failureType];
    if (!endingId) throw new RangeError('Missing same-failure fallback');
    return Object.freeze({ endingId, usedFallback: true });
  }
  const unseen = compatible.filter(candidate => !options.seenEndingIds.includes(candidate.id));
  const pool = (unseen.length ? unseen : compatible).slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(pool.map(candidate => candidate.id)).size !== pool.length) throw new RangeError('Duplicate ending ID');
  const value = options.random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Invalid ending RNG output');
  return Object.freeze({ endingId: pool[Math.floor(value * pool.length)]!.id, usedFallback: false });
}
