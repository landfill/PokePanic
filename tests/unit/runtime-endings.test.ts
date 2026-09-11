import {describe,expect,it} from 'vitest';
import {FAILURE_TYPES} from '../../src/game/failure';
import {ENDINGS,RUNTIME_CHARACTERS,fallbackFor} from '../../src/endings/runtime';
import {selectEnding} from '../../src/endings/select';

describe('produced scene registry',()=>{
  it('contains the eight runtime actors and twelve product endings',()=>{
    expect(RUNTIME_CHARACTERS).toHaveLength(8);
    expect(ENDINGS).toHaveLength(12);
    expect(ENDINGS.map(ending=>ending.id)).toEqual([
      'representative-iron','representative-complaint','representative-manager','representative-action',
      'representative-yoga','representative-guard','representative-walker','representative-referee',
      'false-relief','self-own','awkward-miss','fake-forgiveness',
    ]);
  });
  for(const characterId of RUNTIME_CHARACTERS)for(const failureType of FAILURE_TYPES){
    it(`covers ${characterId}/${failureType} without a cross-cause fallback`,()=>{
      const choice=selectEnding({characterId,failureType,candidates:ENDINGS,seenEndingIds:[],random:()=>.4,fallbackByFailure:fallbackFor(characterId)});
      expect(choice?.usedFallback).toBe(false);
      const selected=ENDINGS.find(ending=>ending.id===choice?.endingId)!;
      expect(selected.characterIds).toContain(characterId);
      expect(selected.failureTypes).toContain(failureType);
      expect(selected.coreAtMs).toBeLessThanOrEqual(selected.durationMs);
    });
  }
  it('limits fake forgiveness to the three compatible actors and documented causes',()=>{
    const ending=ENDINGS.find(candidate=>candidate.id==='fake-forgiveness')!;
    expect(ending.characterIds).toEqual(['complaint','guard','referee']);
    expect(ending.failureTypes).toEqual(['UNDERPOWER_HIT','OFF_CENTER_HIT','MISS']);
  });
});
