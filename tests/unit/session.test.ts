import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { GameSession, type PreparedRoundInput } from '../../src/game/session';

function prepared(roundId: number, startWallTime = 0): PreparedRoundInput {
  return {
    roundId,
    startWallTime,
    origin: [0, 0, 0],
    padSnapshot: {
      worldFromLocal: new Matrix4().makeTranslation(0, 0, -3).toArray(),
      radiusX: 0.4,
      radiusY: 0.3,
    },
  };
}

describe('M1-03 prepared input and run integration', () => {
  it('does not accept input until the current round geometry is prepared', () => {
    const session = new GameSession(5);
    expect(session.press('a', 0)).toMatchObject({ run: { status: 'PLAYING' }, input: null });
    expect(session.prepareCurrentRound(prepared(4))).toBe(false);
    expect(session.prepareCurrentRound(prepared(5))).toBe(true);
    expect(session.prepareCurrentRound(prepared(5))).toBe(false);
  });

  it('turns two released presses into one immutable adjudicated FIRE snapshot', () => {
    const session = new GameSession();
    const options = prepared(1);
    session.prepareCurrentRound(options);
    session.press('pointer:1', 1100);
    session.release('pointer:1');
    const result = session.press('pointer:2', 1850);
    expect(result.input).toMatchObject({ stage: 'FIRE', powerPercent: 100, angleDegrees: 0 });
    expect(result.run).toMatchObject({ status: 'SCENE', currentRoundId: 1 });
    expect(result.run.shot).toMatchObject({ roundId: 1, score: { rawScore: 1000 }, failureType: null });
    expect(Object.isFrozen(result.run.shot)).toBe(true);
  });

  it('copies prepared geometry before input and ignores stale preparation', () => {
    const session = new GameSession(9);
    const options = prepared(9);
    const world = options.padSnapshot.worldFromLocal as number[];
    expect(session.prepareCurrentRound(options)).toBe(true);
    world[12] = 99;
    session.press('a', 1100);
    session.release('a');
    const result = session.press('b', 1850);
    expect(result.run.shot?.padSnapshot.worldFromLocal[12]).toBe(0);
    expect(session.prepareCurrentRound(prepared(8))).toBe(false);
  });

  it('pauses the common clock and resumes only explicitly', () => {
    const session = new GameSession();
    session.prepareCurrentRound(prepared(1));
    session.press('a', 660);
    session.release('a');
    session.pause(910);
    expect(session.sample(5000).input).toMatchObject({ paused: true, gameTimeMs: 910, stage: 'AIM' });
    session.resume(6000);
    expect(session.press('b', 6500).run.shot?.input.angleDegrees).toBeCloseTo(0);
  });

  it('requires scene finish and fresh preparation for the next round', () => {
    const session = new GameSession();
    session.prepareCurrentRound(prepared(1));
    session.press('a', 1100);
    session.release('a');
    session.press('b', 1850);
    expect(session.press('c', 1900).run.currentRoundId).toBe(1);
    expect(session.finishScene(1)).toMatchObject({ status: 'PLAYING', currentRoundId: 2, totalScore: 1000 });
    expect(session.sample(1900).input).toBeNull();
    expect(session.press('c', 1900).input).toBeNull();
    expect(session.prepareCurrentRound(prepared(2, 1900))).toBe(true);
  });

  it('retries a failed run without retaining prepared input', () => {
    const session = new GameSession(30);
    session.prepareCurrentRound(prepared(30));
    session.press('a', 660);
    session.release('a');
    session.press('b', 660);
    expect(session.finishScene(30)).toMatchObject({ status: 'GAME_OVER', totalScore: 0 });
    expect(session.retry()).toMatchObject({ runId: 2, status: 'PLAYING', currentRoundId: 31, roundNumber: 1 });
    expect(session.sample(660).input).toBeNull();
    expect(session.prepareCurrentRound(prepared(30))).toBe(false);
    expect(session.prepareCurrentRound(prepared(31, 660))).toBe(true);
  });
});
