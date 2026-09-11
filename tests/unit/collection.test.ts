import { describe, expect, it } from 'vitest';
import {
  buildCollectionView,
  recordCharacterDiscovery,
  recordEndingSeen,
  recordEndingUnlock,
} from '../../src/endings/collection';
import { createDefaultProfile, type ProfileOptions } from '../../src/storage/profile';

const options: ProfileOptions = {
  characterIds: ['iron', 'complaint'],
  endingIds: ['representative-iron', 'representative-complaint'],
  prefersReducedMotion: false,
  initialCharacterRngState: 0,
};

describe('R-COLLECTION: immutable collection records', () => {
  it('records discovery, unlock, and seen separately while preserving the seen subset', () => {
    const empty = createDefaultProfile(options);
    const discovered = recordCharacterDiscovery(empty, 'iron', options.characterIds);
    const unlocked = recordEndingUnlock(discovered, 'representative-iron', options.endingIds);
    const seen = recordEndingSeen(unlocked, 'representative-iron', options.endingIds);
    expect(empty.discoveredCharacterIds).toEqual([]);
    expect(seen).toMatchObject({
      discoveredCharacterIds: ['iron'],
      unlockedEndingIds: ['representative-iron'],
      seenEndingIds: ['representative-iron'],
    });
    expect(recordEndingSeen(empty, 'representative-iron', options.endingIds)).toBe(empty);
  });

  it('returns the same profile for repeat records so persistence can skip writes', () => {
    const empty = createDefaultProfile(options);
    const discovered = recordCharacterDiscovery(empty, 'iron', options.characterIds);
    expect(recordCharacterDiscovery(discovered, 'iron', options.characterIds)).toBe(discovered);
    const unlocked = recordEndingUnlock(discovered, 'representative-iron', options.endingIds);
    expect(recordEndingUnlock(unlocked, 'representative-iron', options.endingIds)).toBe(unlocked);
    const seen = recordEndingSeen(unlocked, 'representative-iron', options.endingIds);
    expect(recordEndingSeen(seen, 'representative-iron', options.endingIds)).toBe(seen);
  });

  it('rejects IDs outside the injected runtime manifests', () => {
    const profile = createDefaultProfile(options);
    expect(() => recordCharacterDiscovery(profile, 'planned-only', options.characterIds)).toThrow(RangeError);
    expect(() => recordEndingUnlock(profile, 'planned-only', options.endingIds)).toThrow(RangeError);
    expect(() => recordEndingSeen(profile, 'planned-only', options.endingIds)).toThrow(RangeError);
  });

  it('does not expose locked ending IDs, titles, or undiscovered character names in preview entries', () => {
    const view = buildCollectionView({
      discoveredCharacterIds: ['iron'],
      unlockedEndingIds: ['representative-iron'],
      seenEndingIds: [],
      characters: [{ id: 'iron', name: '철근 씨' }, { id: 'complaint', name: '민원인' }],
      endings: [
        { id: 'representative-iron', name: '대표 철근 난투', characterIds: ['iron'] },
        { id: 'representative-complaint', name: '대표 민원 수갑', characterIds: ['complaint'] },
      ],
    });
    expect(view.characters).toEqual([
      { status: 'discovered', id: 'iron', name: '철근 씨' },
      { status: 'undiscovered' },
    ]);
    expect(view.endings[0]).toMatchObject({
      status: 'unlocked', id: 'representative-iron', name: '대표 철근 난투', seen: false,
      replayCharacters: [{ id: 'iron', name: '철근 씨' }],
    });
    expect(view.endings[1]).toEqual({ status: 'locked' });
    expect(JSON.stringify(view.endings[1])).not.toContain('representative-complaint');
    expect(JSON.stringify(view.endings[1])).not.toContain('민원 수갑');
  });
});
