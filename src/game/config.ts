// Fixed rules require a documented design change; tuning only affects presentation/difficulty.
export const RULES = Object.freeze({ successScore: 700, powerExponent: 1.1, accuracyExponent: 1.6 });
export const TUNING = Object.freeze({
  nearSuccessScore: 650,
  highPowerMiss: 0.85,
  powerPeriodMs: 2200,
  anglePeriodMs: 3000,
  minimumPowerPeriodMs: 1200,
  minimumAnglePeriodMs: 1700,
  angleLimitDegrees: 60,
  targetDirectionLimitDegrees: 12,
  mobileDprCap: 1.5,
  desktopDprCap: 2,
});
