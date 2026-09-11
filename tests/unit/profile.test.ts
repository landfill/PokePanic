import { describe, expect, it, vi } from 'vitest';
import {
  PROFILE_STORAGE_KEY,
  createDefaultProfile,
  loadProfile,
  sanitizeProfile,
  type ProfileOptions,
  type StorageLike,
} from '../../src/storage/profile';

const options: ProfileOptions = {
  characterIds: ['alpha', 'bravo', 'charlie'],
  endingIds: ['fall', 'cuffs', 'complaint'],
  browserLocales: ['ko-KR', 'en-US'],
  prefersReducedMotion: true,
  initialCharacterRngState: 0,
};

function memoryStorage(initial: string | null = null): StorageLike & { value: string | null } {
  return {
    value: initial,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
  };
}

describe('R-STORAGE: ProfileV1 persistence', () => {
  it('creates preference-aware defaults without run-local state', () => {
    const profile = createDefaultProfile(options);
    expect(profile).toMatchObject({
      schemaVersion: 1,
      bestScore: 0,
      bestStreak: 0,
      settings: { locale: 'ko', reducedMotion: true, muted: false, screenShake: true, minimizeScenes: false },
      bag: { order: options.characterIds, cursor: options.characterIds.length, previousCharacterId: null, characterRngState: 0 },
    });
    expect(profile).not.toHaveProperty('runId');
    expect(createDefaultProfile({ ...options, browserLocales: ['ja-JP'] }).settings.locale).toBe('en');
  });

  it('recovers corrupted JSON and malformed or missing fields', () => {
    expect(loadProfile(memoryStorage('{oops'), options)).toMatchObject({ status: 'recovered', writable: true });
    const recovered = loadProfile(memoryStorage(JSON.stringify({ schemaVersion: 1, bestScore: -1 })), options);
    expect(recovered.status).toBe('recovered');
    expect(recovered.profile).toEqual(createDefaultProfile(options));
  });

  it('filters unknown and duplicate IDs and keeps seen endings within unlocked endings', () => {
    const profile = sanitizeProfile({
      ...createDefaultProfile(options),
      discoveredCharacterIds: ['bravo', 'unknown', 'bravo', 'alpha'],
      unlockedEndingIds: ['fall', 'unknown', 'fall', 'cuffs'],
      seenEndingIds: ['complaint', 'fall', 'fall'],
    }, options)!;
    expect(profile.discoveredCharacterIds).toEqual(['bravo', 'alpha']);
    expect(profile.unlockedEndingIds).toEqual(['fall', 'cuffs']);
    expect(profile.seenEndingIds).toEqual(['fall']);
  });

  it.each([
    { bestScore: NaN }, { bestScore: 1.5 }, { bestScore: Number.MAX_SAFE_INTEGER + 1 },
    { bestStreak: -1 }, { bestStreak: Infinity },
  ])('defaults invalid score values: %j', override => {
    const profile = sanitizeProfile({ ...createDefaultProfile(options), ...override }, options)!;
    expect(profile.bestScore).toBe(0);
    expect(profile.bestStreak).toBe(0);
  });

  it.each([
    { order: ['alpha', 'bravo', 'bravo'] },
    { order: ['alpha', 'bravo', 'unknown'] },
    { cursor: -1 }, { cursor: 4 }, { cursor: 0.5 },
    { previousCharacterId: 'unknown' },
    { characterRngState: -1 }, { characterRngState: UINT32_OVERFLOW }, { characterRngState: 1.5 },
  ])('replaces an invalid bag atomically: %j', bagOverride => {
    const source = createDefaultProfile(options);
    const profile = sanitizeProfile({ ...source, bag: { ...source.bag, ...bagOverride } }, options)!;
    expect(profile.bag).toEqual(createDefaultProfile(options).bag);
  });

  it('round-trips a consumed shuffled bag including uint32 zero', () => {
    const storage = memoryStorage();
    const persistence = loadProfile(storage, options);
    const bag = { order: ['charlie', 'alpha', 'bravo'], cursor: 2, previousCharacterId: 'alpha', characterRngState: 0 } as const;
    persistence.save({ ...persistence.profile, bestScore: 2100, bestStreak: 2, bag });
    expect(storage.value).not.toBeNull();

    const restored = loadProfile(storage, options);
    expect(restored).toMatchObject({ status: 'loaded', writable: true });
    expect(restored.profile).toMatchObject({ bestScore: 2100, bestStreak: 2, bag });
  });

  it('does not overwrite a future schema and reports memory-only status', () => {
    const storage = memoryStorage(JSON.stringify({ schemaVersion: 2, future: true }));
    const setItem = vi.spyOn(storage, 'setItem');
    const persistence = loadProfile(storage, options);
    expect(persistence).toMatchObject({ status: 'future-schema', writable: false });
    persistence.save({ ...persistence.profile, bestScore: 99 });
    expect(persistence.profile.bestScore).toBe(99);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('recovers from read exceptions and retains later state in memory', () => {
    const storage: StorageLike = {
      getItem() { throw new DOMException('blocked', 'SecurityError'); },
      setItem: vi.fn(),
    };
    const persistence = loadProfile(storage, options);
    expect(persistence).toMatchObject({ status: 'unavailable', writable: false });
    persistence.save({ ...persistence.profile, bestScore: 700 });
    expect(persistence.profile.bestScore).toBe(700);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('recovers from write exceptions after retaining the new state', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem() { throw new DOMException('full', 'QuotaExceededError'); },
    };
    const persistence = loadProfile(storage, options);
    persistence.save({ ...persistence.profile, bestStreak: 4 });
    expect(persistence).toMatchObject({ status: 'unavailable', writable: false });
    expect(persistence.profile.bestStreak).toBe(4);
  });

  it('uses the documented key', () => {
    const getItem = vi.fn(() => null);
    loadProfile({ getItem, setItem: vi.fn() }, options);
    expect(getItem).toHaveBeenCalledWith(PROFILE_STORAGE_KEY);
  });
});

const UINT32_OVERFLOW = 0x1_0000_0000;
