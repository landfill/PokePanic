import { TUNING } from './config';
import type { ScoreResult } from './scoring';

export const FAILURE_TYPES = ['HIGH_POWER_MISS', 'MISS', 'NEAR_SUCCESS', 'UNDERPOWER_HIT', 'OFF_CENTER_HIT'] as const;
export type FailureType = typeof FAILURE_TYPES[number];

export function classifyFailure(result: ScoreResult): FailureType | null {
  if (result.isSuccess) return null;
  if (!result.hit) return result.power >= TUNING.highPowerMiss ? 'HIGH_POWER_MISS' : 'MISS';
  if (result.rawScore >= TUNING.nearSuccessScore) return 'NEAR_SUCCESS';
  if (!result.canStillSucceed) return 'UNDERPOWER_HIT';
  return 'OFF_CENTER_HIT';
}
