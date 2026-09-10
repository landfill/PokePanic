import { RULES } from './config';

export interface Contact { readonly u: number; readonly v: number }
export interface ScoreInput { readonly powerPercent: number; readonly contact: Contact | null }
export interface ScoreResult {
  readonly power: number;
  readonly hit: boolean;
  readonly accuracy: number;
  readonly rawScore: number;
  readonly maxRawScore: number;
  readonly canStillSucceed: boolean;
  readonly isSuccess: boolean;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite number');
  return value;
}

export function maxScore(powerPercent: number): number {
  const power = Math.min(1, Math.max(0, finite(powerPercent) / 100));
  return Math.round(1000 * power ** RULES.powerExponent);
}

// The exact rounding boundary is derived, never the display approximation 72.3%.
export function centerSuccessBoundaryPercent(): number {
  return 100 * ((RULES.successScore - 0.5) / 1000) ** (1 / RULES.powerExponent);
}

export function scoreContact(input: ScoreInput): Readonly<ScoreResult> {
  const power = Math.min(1, Math.max(0, finite(input.powerPercent) / 100));
  const distanceSquared = input.contact === null
    ? Infinity
    : finite(input.contact.u) ** 2 + finite(input.contact.v) ** 2;
  const hit = distanceSquared < 1;
  const accuracy = hit ? Math.max(0, 1 - distanceSquared) : 0;
  const rawScore = Math.round(1000 * power ** RULES.powerExponent * accuracy ** RULES.accuracyExponent);
  const maxRawScore = maxScore(input.powerPercent);
  return Object.freeze({ power, hit, accuracy, rawScore, maxRawScore,
    canStillSucceed: maxRawScore >= RULES.successScore, isSuccess: rawScore >= RULES.successScore });
}

export function awardedScore(result: ScoreResult, streakIncludingThisSuccess: number): number {
  if (!result.isSuccess) return 0;
  if (!Number.isInteger(streakIncludingThisSuccess) || streakIncludingThisSuccess < 1) {
    throw new RangeError('Successful streak must be a positive integer');
  }
  return Math.round(result.rawScore * Math.min(1 + 0.1 * (streakIncludingThisSuccess - 1), 2));
}
