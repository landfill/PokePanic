import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { centerSuccessBoundaryPercent } from '../../src/game/scoring';
import { RunController, type FireAdjudicationInput } from '../../src/game/run';

const pad = {
  worldFromLocal: new Matrix4().makeTranslation(0, 0, -3).toArray(),
  radiusX: 0.4,
  radiusY: 0.3,
};

function fire(roundId: number, powerPercent: number, angleDegrees = 0): FireAdjudicationInput {
  return {
    roundId,
    powerPercent,
    angleDegrees,
    powerLockedAtMs: 100,
    firedAtMs: 200,
    origin: [0, 0, 0],
    padSnapshot: pad,
  };
}

describe('R-LOOP / R-COMBO: run controller', () => {
  it('keeps 699 as a failure and waits for scene finish before game over', () => {
    const run = new RunController();
    const boundary = centerSuccessBoundaryPercent();
    const shot = run.adjudicateFire(fire(1, boundary - 0.000001))!;
    expect(shot.score.rawScore).toBe(699);
    expect(shot.score.isSuccess).toBe(false);
    expect(shot.failureType).toBe('NEAR_SUCCESS');
    expect(run.view()).toMatchObject({ status: 'SCENE', totalScore: 0, streak: 0 });

    expect(run.finishScene(1)).toMatchObject({ status: 'GAME_OVER', totalScore: 0, streak: 0 });
  });

  it('awards 700 exactly once and starts the next round only after scene finish', () => {
    const run = new RunController(20);
    const boundary = centerSuccessBoundaryPercent();
    const shot = run.adjudicateFire(fire(20, boundary + 0.000001))!;
    expect(shot.score.rawScore).toBe(700);
    expect(shot.failureType).toBeNull();
    expect(run.view()).toMatchObject({ status: 'SCENE', roundNumber: 1, currentRoundId: 20, totalScore: 0 });

    expect(run.finishScene(20)).toMatchObject({
      status: 'PLAYING', roundNumber: 2, currentRoundId: 21, totalScore: 700, streak: 1, shot: null,
    });
    expect(run.finishScene(20).totalScore).toBe(700);
  });

  it('applies the streak multiplier only to later successful rounds', () => {
    const run = new RunController();
    run.adjudicateFire(fire(1, 100));
    run.finishScene(1);
    run.adjudicateFire(fire(2, 100));
    expect(run.finishScene(2)).toMatchObject({ totalScore: 2100, streak: 2, currentRoundId: 3 });
  });

  it('preserves earlier score but awards nothing for the failing round', () => {
    const run = new RunController();
    run.adjudicateFire(fire(1, 100));
    run.finishScene(1);
    run.adjudicateFire(fire(2, 60));
    expect(run.view()).toMatchObject({ status: 'SCENE', totalScore: 1000, streak: 1 });
    expect(run.finishScene(2)).toMatchObject({ status: 'GAME_OVER', totalScore: 1000, streak: 0 });
  });

  it('ignores duplicate adjudication and stale round callbacks', () => {
    const run = new RunController(7);
    const first = run.adjudicateFire(fire(7, 100))!;
    expect(run.adjudicateFire(fire(7, 0))).toBe(first);
    expect(run.adjudicateFire(fire(6, 100))).toBeNull();
    run.finishScene(6);
    expect(run.view()).toMatchObject({ status: 'SCENE', totalScore: 0, currentRoundId: 7 });
    run.finishScene(7);
    run.finishScene(7);
    expect(run.view()).toMatchObject({ status: 'PLAYING', totalScore: 1000, currentRoundId: 8 });
  });

  it('retries only from game over and resets run state with a monotonic round id', () => {
    const run = new RunController(40);
    expect(run.retry()).toMatchObject({ runId: 1, currentRoundId: 40, roundNumber: 1 });
    run.adjudicateFire(fire(40, 60));
    expect(run.retry().status).toBe('SCENE');
    run.finishScene(40);
    expect(run.retry()).toMatchObject({
      runId: 2, status: 'PLAYING', currentRoundId: 41,
      roundNumber: 1, totalScore: 0, streak: 0, shot: null,
    });
    expect(run.finishScene(40).currentRoundId).toBe(41);
  });

  it('copies and freezes the FIRE geometry snapshot', () => {
    const run = new RunController();
    const mutablePad = { ...pad, worldFromLocal: [...pad.worldFromLocal] };
    const input = { ...fire(1, 100), padSnapshot: mutablePad };
    const shot = run.adjudicateFire(input)!;
    mutablePad.worldFromLocal[12] = 99;
    expect(shot.padSnapshot.worldFromLocal[12]).toBe(0);
    expect(Object.isFrozen(shot)).toBe(true);
    expect(Object.isFrozen(shot.input)).toBe(true);
    expect(Object.isFrozen(shot.padSnapshot.worldFromLocal)).toBe(true);
  });

  it.each([
    { powerPercent: -1 }, { powerPercent: 101 }, { angleDegrees: -60.01 }, { angleDegrees: 60.01 },
    { powerLockedAtMs: -1 }, { firedAtMs: 99 }, { origin: [0, 0] },
  ])('rejects invalid FIRE input without changing run state: %j', override => {
    const run = new RunController();
    const invalid = { ...fire(1, 100), ...override } as FireAdjudicationInput;
    expect(() => run.adjudicateFire(invalid)).toThrow(RangeError);
    expect(run.view()).toMatchObject({ status: 'PLAYING', currentRoundId: 1, totalScore: 0, shot: null });
  });

  it('caps combo rewards and never rescues a later 699 failure', () => {
    const run = new RunController();
    for (let roundId = 1; roundId <= 12; roundId++) {
      run.adjudicateFire(fire(roundId, 100));
      run.finishScene(roundId);
    }
    // 1000 + 1100 + ... + 1900 + 2000 + 2000
    expect(run.view()).toMatchObject({ totalScore: 18500, streak: 12, currentRoundId: 13 });
    run.adjudicateFire(fire(13, centerSuccessBoundaryPercent() - 0.000001));
    expect(run.view().shot?.score.rawScore).toBe(699);
    expect(run.finishScene(13)).toMatchObject({ status: 'GAME_OVER', totalScore: 18500, streak: 0 });
  });
});
