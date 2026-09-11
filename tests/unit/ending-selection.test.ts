import { describe, expect, it, vi } from 'vitest';
import { selectEnding } from '../../src/endings/select';
const fallback = { HIGH_POWER_MISS: 'self-own', MISS: 'awkward', NEAR_SUCCESS: 'false-relief', UNDERPOWER_HIT: 'delayed', OFF_CENTER_HIT: 'off-center' };
const options = {
  characterId: 'adult-actor', failureType: 'MISS' as const,
  candidates: [
    { id:'b',characterIds:['adult-actor'],failureTypes:['MISS' as const] },
    { id:'a',characterIds:['adult-actor'],failureTypes:['MISS' as const] },
    { id:'incompatible-unseen',characterIds:['adult-actor'],failureTypes:['HIGH_POWER_MISS' as const] },
  ], seenEndingIds:['a'], fallbackByFailure:fallback, random:()=>0,
};
describe('compatible runtime ending selection', () => {
  it('success never selects or consumes random state', () => {
    const random=vi.fn(); expect(selectEnding({...options,failureType:null,random})).toBeNull(); expect(random).not.toHaveBeenCalled();
  });
  it('prioritizes unseen compatible endings, never incompatible unseen ones', () => {
    expect(selectEnding(options)).toEqual({endingId:'b',usedFallback:false});
  });
  it('canonical ID order yields identical result regardless of manifest order', () => {
    const a={...options,seenEndingIds:[],random:()=>0.8};
    expect(selectEnding(a)).toEqual(selectEnding({...a,candidates:[...a.candidates].reverse()}));
    expect(selectEnding(a)?.endingId).toBe('b');
  });
  it('falls back only within the actual failure type without consuming randomness', () => {
    const random=vi.fn();expect(selectEnding({...options,candidates:[],random})).toEqual({endingId:'awkward',usedFallback:true});expect(random).not.toHaveBeenCalled();
  });
  it('uses compatible seen pool after all have been seen', () => {
    expect(selectEnding({...options,seenEndingIds:['a','b']})?.endingId).toBe('a');
  });
});
