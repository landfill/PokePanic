import type { ProfileV1 } from '../storage/profile';

function requireAllowed(id: string, allowedIds: readonly string[], kind: string): void {
  if (!id || !allowedIds.includes(id)) throw new RangeError(`Unknown ${kind} ID`);
}

function appendProfileId(
  profile: ProfileV1,
  field: 'discoveredCharacterIds' | 'unlockedEndingIds' | 'seenEndingIds',
  id: string,
): ProfileV1 {
  const values = Object.freeze([...profile[field], id]);
  return Object.freeze({ ...profile, [field]: values });
}

export function recordCharacterDiscovery(
  profile: ProfileV1,
  characterId: string,
  allowedCharacterIds: readonly string[],
): ProfileV1 {
  requireAllowed(characterId, allowedCharacterIds, 'character');
  if (profile.discoveredCharacterIds.includes(characterId)) return profile;
  return appendProfileId(profile, 'discoveredCharacterIds', characterId);
}

export function recordEndingUnlock(
  profile: ProfileV1,
  endingId: string,
  allowedEndingIds: readonly string[],
): ProfileV1 {
  requireAllowed(endingId, allowedEndingIds, 'ending');
  if (profile.unlockedEndingIds.includes(endingId)) return profile;
  return appendProfileId(profile, 'unlockedEndingIds', endingId);
}

export function recordEndingSeen(
  profile: ProfileV1,
  endingId: string,
  allowedEndingIds: readonly string[],
): ProfileV1 {
  requireAllowed(endingId, allowedEndingIds, 'ending');
  if (!profile.unlockedEndingIds.includes(endingId) || profile.seenEndingIds.includes(endingId)) return profile;
  return appendProfileId(profile, 'seenEndingIds', endingId);
}

export interface CollectionCharacter {
  readonly id: string;
  readonly name: string;
}

export interface CollectionEnding {
  readonly id: string;
  readonly name: string;
  readonly characterIds: readonly string[];
}

export interface CollectionData {
  readonly discoveredCharacterIds: readonly string[];
  readonly unlockedEndingIds: readonly string[];
  readonly seenEndingIds: readonly string[];
  readonly characters: readonly CollectionCharacter[];
  readonly endings: readonly CollectionEnding[];
}

export type CollectionCharacterEntry = Readonly<
  { status: 'undiscovered' } | { status: 'discovered'; id: string; name: string }
>;

export type CollectionEndingEntry = Readonly<
  { status: 'locked' } | {
    status: 'unlocked';
    id: string;
    name: string;
    seen: boolean;
    replayCharacters: readonly CollectionCharacter[];
  }
>;

export interface CollectionView {
  readonly characters: readonly CollectionCharacterEntry[];
  readonly endings: readonly CollectionEndingEntry[];
}

/** Produces display-safe entries: locked content contains neither runtime ID nor title. */
export function buildCollectionView(data: CollectionData): CollectionView {
  const discovered = new Set(data.discoveredCharacterIds);
  const unlocked = new Set(data.unlockedEndingIds);
  const seen = new Set(data.seenEndingIds);
  const charactersById = new Map(data.characters.map(character => [character.id, character]));
  const characters = data.characters.map<CollectionCharacterEntry>(character => discovered.has(character.id)
    ? Object.freeze({ status: 'discovered', id: character.id, name: character.name })
    : Object.freeze({ status: 'undiscovered' }));
  const endings = data.endings.map<CollectionEndingEntry>(ending => {
    if (!unlocked.has(ending.id)) return Object.freeze({ status: 'locked' });
    const replayCharacters = ending.characterIds
      .filter(id => discovered.has(id))
      .map(id => charactersById.get(id))
      .filter((character): character is CollectionCharacter => character !== undefined);
    return Object.freeze({
      status: 'unlocked',
      id: ending.id,
      name: ending.name,
      seen: seen.has(ending.id),
      replayCharacters: Object.freeze(replayCharacters),
    });
  });
  return Object.freeze({ characters: Object.freeze(characters), endings: Object.freeze(endings) });
}
