export const PROFILE_STORAGE_KEY = 'poke-and-panic.profile.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CharacterBagV1 {
  readonly order: readonly string[];
  readonly cursor: number;
  readonly previousCharacterId: string | null;
  readonly characterRngState: number;
}

export interface ProfileSettingsV1 {
  readonly locale: 'ko' | 'en';
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly screenShake: boolean;
  readonly minimizeScenes: boolean;
}

export interface ProfileV1 {
  readonly schemaVersion: 1;
  readonly bestScore: number;
  readonly bestStreak: number;
  readonly discoveredCharacterIds: readonly string[];
  readonly unlockedEndingIds: readonly string[];
  readonly seenEndingIds: readonly string[];
  readonly bag: CharacterBagV1;
  readonly settings: ProfileSettingsV1;
}

export interface ProfileOptions {
  readonly characterIds: readonly string[];
  readonly endingIds: readonly string[];
  readonly browserLocales?: readonly string[];
  readonly prefersReducedMotion: boolean;
  readonly initialCharacterRngState: number;
}

export type ProfileLoadStatus = 'loaded' | 'missing' | 'recovered' | 'future-schema' | 'unavailable';

export interface ProfilePersistence {
  readonly profile: ProfileV1;
  readonly status: ProfileLoadStatus;
  readonly writable: boolean;
  save(profile: unknown): ProfileV1;
}

interface SanitizedProfile {
  readonly profile: ProfileV1;
  readonly recovered: boolean;
}

const UINT32_MAX = 0xffff_ffff;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

function validateOptions(options: ProfileOptions): void {
  const characterIds = new Set(options.characterIds);
  const endingIds = new Set(options.endingIds);
  if (characterIds.size !== options.characterIds.length || [...characterIds].some(id => id.length === 0)
    || endingIds.size !== options.endingIds.length || [...endingIds].some(id => id.length === 0)) {
    throw new TypeError('Allowed profile IDs must be non-empty and unique');
  }
  if (!validUint32(options.initialCharacterRngState)) {
    throw new RangeError('Initial character RNG state must be a uint32');
  }
}

function defaultLocale(browserLocales: readonly string[] | undefined): 'ko' | 'en' {
  return browserLocales?.some(locale => locale.toLowerCase().split('-')[0] === 'ko') ? 'ko' : 'en';
}

function freezeProfile(profile: ProfileV1): ProfileV1 {
  Object.freeze(profile.discoveredCharacterIds);
  Object.freeze(profile.unlockedEndingIds);
  Object.freeze(profile.seenEndingIds);
  Object.freeze(profile.bag.order);
  Object.freeze(profile.bag);
  Object.freeze(profile.settings);
  return Object.freeze(profile);
}

export function createDefaultProfile(options: ProfileOptions): ProfileV1 {
  validateOptions(options);
  return freezeProfile({
    schemaVersion: 1,
    bestScore: 0,
    bestStreak: 0,
    discoveredCharacterIds: [],
    unlockedEndingIds: [],
    seenEndingIds: [],
    bag: {
      order: [...options.characterIds],
      // Exhausted canonical order makes CharacterBag shuffle before its first reservation.
      cursor: options.characterIds.length,
      previousCharacterId: null,
      characterRngState: options.initialCharacterRngState,
    },
    settings: {
      locale: defaultLocale(options.browserLocales),
      muted: false,
      reducedMotion: options.prefersReducedMotion,
      screenShake: true,
      minimizeScenes: false,
    },
  });
}

function sanitizeIdList(value: unknown, allowed: ReadonlySet<string>): { ids: string[]; recovered: boolean } {
  if (!Array.isArray(value)) return { ids: [], recovered: true };
  const ids: string[] = [];
  const seen = new Set<string>();
  let recovered = false;
  for (const id of value) {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) {
      recovered = true;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return { ids, recovered };
}

function sanitizeNonnegativeInteger(value: unknown): { value: number; recovered: boolean } {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? { value, recovered: false }
    : { value: 0, recovered: true };
}

function sanitizeDetailed(value: unknown, options: ProfileOptions): SanitizedProfile | null {
  validateOptions(options);
  if (!isRecord(value)) return { profile: createDefaultProfile(options), recovered: true };
  if (typeof value.schemaVersion === 'number' && Number.isInteger(value.schemaVersion) && value.schemaVersion > 1) {
    return null;
  }

  let recovered = value.schemaVersion !== 1;
  const bestScore = sanitizeNonnegativeInteger(value.bestScore);
  const bestStreak = sanitizeNonnegativeInteger(value.bestStreak);
  recovered ||= bestScore.recovered || bestStreak.recovered;

  const characters = new Set(options.characterIds);
  const endings = new Set(options.endingIds);
  const discovered = sanitizeIdList(value.discoveredCharacterIds, characters);
  const unlocked = sanitizeIdList(value.unlockedEndingIds, endings);
  const seenRaw = sanitizeIdList(value.seenEndingIds, endings);
  const unlockedSet = new Set(unlocked.ids);
  const seen = seenRaw.ids.filter(id => unlockedSet.has(id));
  recovered ||= discovered.recovered || unlocked.recovered || seenRaw.recovered || seen.length !== seenRaw.ids.length;

  const defaults = createDefaultProfile(options);
  let bag = defaults.bag;
  if (isRecord(value.bag)) {
    const order = value.bag.order;
    const orderSet = Array.isArray(order) ? new Set(order) : null;
    const exactPermutation = Array.isArray(order)
      && order.every(id => typeof id === 'string' && characters.has(id))
      && orderSet?.size === options.characterIds.length
      && order.length === options.characterIds.length;
    const cursor = value.bag.cursor;
    const previous = value.bag.previousCharacterId;
    if (exactPermutation && typeof cursor === 'number' && Number.isInteger(cursor)
      && cursor >= 0 && cursor <= order.length
      && (previous === null || (typeof previous === 'string' && characters.has(previous)))
      && validUint32(value.bag.characterRngState)) {
      bag = {
        order: [...order] as string[],
        cursor,
        previousCharacterId: previous,
        characterRngState: value.bag.characterRngState,
      };
    } else {
      recovered = true;
    }
  } else {
    recovered = true;
  }

  const settingsValue = isRecord(value.settings) ? value.settings : {};
  if (!isRecord(value.settings)) recovered = true;
  const locale = settingsValue.locale === 'ko' || settingsValue.locale === 'en'
    ? settingsValue.locale
    : defaults.settings.locale;
  const booleanSetting = (key: keyof Omit<ProfileSettingsV1, 'locale'>): boolean => {
    const setting = settingsValue[key];
    if (typeof setting === 'boolean') return setting;
    recovered = true;
    return defaults.settings[key];
  };
  if (settingsValue.locale !== 'ko' && settingsValue.locale !== 'en') recovered = true;

  return {
    recovered,
    profile: freezeProfile({
      schemaVersion: 1,
      bestScore: bestScore.value,
      bestStreak: bestStreak.value,
      discoveredCharacterIds: discovered.ids,
      unlockedEndingIds: unlocked.ids,
      seenEndingIds: seen,
      bag,
      settings: {
        locale,
        muted: booleanSetting('muted'),
        reducedMotion: booleanSetting('reducedMotion'),
        screenShake: booleanSetting('screenShake'),
        minimizeScenes: booleanSetting('minimizeScenes'),
      },
    }),
  };
}

/** Returns null only for a valid, unsupported future schema version. */
export function sanitizeProfile(value: unknown, options: ProfileOptions): ProfileV1 | null {
  return sanitizeDetailed(value, options)?.profile ?? null;
}

export function loadProfile(storage: StorageLike, options: ProfileOptions): ProfilePersistence {
  const defaults = createDefaultProfile(options);
  let profile = defaults;
  let status: ProfileLoadStatus = 'missing';
  let writable = true;

  try {
    const serialized = storage.getItem(PROFILE_STORAGE_KEY);
    if (serialized !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        status = 'recovered';
      }
      if (parsed !== undefined) {
        const sanitized = sanitizeDetailed(parsed, options);
        if (sanitized === null) {
          status = 'future-schema';
          writable = false;
        } else {
          profile = sanitized.profile;
          status = sanitized.recovered ? 'recovered' : 'loaded';
        }
      }
    }
  } catch {
    status = 'unavailable';
    writable = false;
  }

  return {
    get profile() { return profile; },
    get status() { return status; },
    get writable() { return writable; },
    save(next: unknown): ProfileV1 {
      const sanitized = sanitizeDetailed(next, options);
      if (sanitized !== null) profile = sanitized.profile;
      if (!writable) return profile;
      try {
        storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } catch {
        status = 'unavailable';
        writable = false;
      }
      return profile;
    },
  };
}
