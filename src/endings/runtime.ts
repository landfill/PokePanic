import type { FailureType } from '../game/failure';
import type { EndingCandidate } from './select';

export const RUNTIME_CHARACTERS = ['iron', 'complaint', 'manager', 'action', 'yoga', 'guard', 'walker', 'referee'] as const;
export type RuntimeCharacterId = typeof RUNTIME_CHARACTERS[number];
export const REVEAL_END_MS = 1900;
export const SUCCESS_END_MS = 3900;

export interface RuntimeEnding extends EndingCandidate {
  readonly characterIds: readonly RuntimeCharacterId[];
  readonly durationMs: number;
  readonly coreAtMs: number;
}

function ending(id: string, characterIds: readonly RuntimeCharacterId[], failureTypes: readonly FailureType[]): RuntimeEnding {
  return Object.freeze({id, characterIds:Object.freeze([...characterIds]), failureTypes:Object.freeze([...failureTypes]),
    durationMs:4000,coreAtMs:3000});
}

// Explicit registry of the currently implemented scene modules. Never import
// the eight-character planning manifest as executable asset/ending data.
export const ENDINGS: readonly RuntimeEnding[] = Object.freeze([
  ending('representative-iron',['iron'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-complaint',['complaint'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-manager',['manager'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-action',['action'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-yoga',['yoga'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-guard',['guard'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-walker',['walker'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('representative-referee',['referee'],['UNDERPOWER_HIT','OFF_CENTER_HIT']),
  ending('false-relief',RUNTIME_CHARACTERS,['NEAR_SUCCESS']),
  ending('self-own',RUNTIME_CHARACTERS,['HIGH_POWER_MISS']),
  ending('awkward-miss',RUNTIME_CHARACTERS,['MISS']),
  ending('fake-forgiveness',['complaint','guard','referee'],['UNDERPOWER_HIT','OFF_CENTER_HIT','MISS']),
]);
export const ENDING_IDS: readonly string[] = Object.freeze(ENDINGS.map(ending=>ending.id));
export function fallbackFor(characterId: RuntimeCharacterId): Readonly<Record<FailureType,string>> {
  return Object.freeze({HIGH_POWER_MISS:'self-own',MISS:'awkward-miss',NEAR_SUCCESS:'false-relief',
    UNDERPOWER_HIT:`representative-${characterId}`,OFF_CENTER_HIT:`representative-${characterId}`});
}
export function getEnding(id:string): RuntimeEnding {
  const result=ENDINGS.find(ending=>ending.id===id);
  if(!result)throw new RangeError('Unknown runtime ending');
  return result;
}
