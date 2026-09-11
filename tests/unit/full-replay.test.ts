import { describe, expect, it } from 'vitest';
import fixtureJson from '../fixtures/session-replay.json';
import {
  assertSessionReplay,
  runSessionReplay,
  type SessionReplayFixture,
} from '../../src/game/replay';

const fixture = fixtureJson as unknown as SessionReplayFixture;

describe('R-REPLAY: deterministic captured session replay', () => {
  it('replays success, failure, retry, minimized and skipped scenes against independently recorded expectations', () => {
    expect(assertSessionReplay(fixture)).toEqual(fixture.expected);
  });

  it('returns identical domain output on repeated runs', () => {
    expect(runSessionReplay(fixture)).toEqual(runSessionReplay(fixture));
  });

  it('keeps the captured two-actor catalog sequence after the runtime expands', () => {
    expect(fixture.catalogCharacterIds).toEqual(['iron', 'complaint']);
    expect(runSessionReplay(fixture).rounds.map(round => round.characterId))
      .toEqual(['complaint', 'iron', 'complaint', 'iron']);
  });

  it.each([
    { catalogCharacterIds: ['iron'] },
    { catalogCharacterIds: ['iron', 'iron'] },
    { catalogCharacterIds: ['iron', 'planned-only-character'] },
  ])('rejects invalid captured catalogs: $catalogCharacterIds', ({ catalogCharacterIds }) => {
    expect(() => runSessionReplay({ ...fixture, catalogCharacterIds })).toThrow('catalogCharacterIds');
  });

  it('keeps visual-effect random calls isolated from character and ending streams', () => {
    const control = runSessionReplay(fixture, { effectRandomCalls: 0, effectRngState: 99 });
    const noisyEffects = runSessionReplay(fixture, { effectRandomCalls: 10_000, effectRngState: 99 });
    expect(noisyEffects).toEqual(control);
  });

  it.each([
    ['schemaVersion', 2],
    ['rulesVersion', 2],
    ['randomVersion', 'future-rng'],
  ] as const)('rejects unsupported %s', (field, value) => {
    expect(() => runSessionReplay({ ...fixture, [field]: value })).toThrow(`Unsupported replay ${field}`);
  });

  it('rejects profile IDs outside the runtime registry rather than importing planning data', () => {
    const initialProfile = { ...fixture.initialProfile, discoveredCharacterIds: ['planned-only-character'] };
    expect(() => runSessionReplay({ ...fixture, initialProfile })).toThrow('valid runtime ProfileV1');
  });

  it('reports the first expected mismatch with its field path and values', () => {
    const rounds = fixture.expected.rounds.map((round, index) => index === 0 ? { ...round, rawScore: 999 } : round);
    const changed = { ...fixture, expected: { ...fixture.expected, rounds } };
    expect(() => assertSessionReplay(changed)).toThrow('expected.rounds[0].rawScore: expected 999, received 1000');
  });

  it('uses each captured round gauge configuration independently', () => {
    const actual = runSessionReplay(fixture);
    expect(actual.rounds.map(round => round.rawScore)).toEqual([1000, 570, 1000, 0]);
    expect(fixture.rounds[2]!.inputGameTimeMs).toEqual([0, 0]);
    expect(fixture.rounds[2]!.prepared.powerPhase).toBe(0.5);
  });

  it('applies a validated post-round settings snapshot without changing the shot', () => {
    const settingsAfter = { ...fixture.initialProfile.settings, locale: 'ko' as const, muted: true };
    const rounds = fixture.rounds.map((round, index) => index === 0 ? { ...round, settingsAfter } : round);
    const actual = runSessionReplay({ ...fixture, rounds });
    expect(actual.rounds[0]!.rawScore).toBe(1000);
    expect(actual.finalProfile.settings).toEqual(settingsAfter);
  });

  it('rejects malformed post-round settings instead of silently defaulting them', () => {
    const settingsAfter = { ...fixture.initialProfile.settings, locale: 'unsupported' } as unknown as typeof fixture.initialProfile.settings;
    const rounds = fixture.rounds.map((round, index) => index === 0 ? { ...round, settingsAfter } : round);
    expect(() => runSessionReplay({ ...fixture, rounds })).toThrow('rounds[0].settingsAfter');
  });
});
