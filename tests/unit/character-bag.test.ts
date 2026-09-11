import { describe, expect, it } from 'vitest';
import { CharacterBag } from '../../src/game/character-bag';
import { SeededRandom } from '../../src/game/random';
const ids = ['a','b','c','d','e','f','g','h'];
function consume(bag: CharacterBag) { const slot = bag.peek(); return bag.commit(slot.token)!; }

describe('session character bag', () => {
  it('uses a fixed uint32 sequence including seed zero', () => {
    const random = new SeededRandom(0);
    random.next(); expect(random.state()).toBe(1013904223);
    random.next(); expect(random.state()).toBe(1196435762);
  });
  it('covers each character once per bag and prevents boundary repeats over 100 bags', () => {
    const bag = new CharacterBag(ids, 1234);
    let previous: string | null = null;
    for (let cycle = 0; cycle < 100; cycle++) {
      const seen = Array.from({ length: 8 }, () => consume(bag));
      expect(new Set(seen)).toEqual(new Set(ids));
      expect(seen[0]).not.toBe(previous);
      previous = seen[7]!;
    }
  });
  it('failed preparation neither consumes a slot nor random state, and stale commit is ignored', () => {
    const bag = new CharacterBag(ids, 88);
    const before = bag.snapshot();
    const slot = bag.peek();
    expect(bag.peek()).toBe(slot);
    expect(bag.snapshot()).toBe(before);
    bag.cancel(slot.token);
    expect(bag.commit(slot.token)).toBeNull();
    const next = bag.peek();
    expect(next.characterId).toBe(slot.characterId);
    expect(bag.snapshot()).toBe(before);
    expect(bag.commit(next.token)).toBe(slot.characterId);
    expect(bag.commit(next.token)).toBeNull();
    expect(bag.snapshot().cursor).toBe(1);
  });
  it('persists across ten failed runs and reloads without reshuffling', () => {
    let bag = new CharacterBag(ids, 19);
    const uninterrupted = new CharacterBag(ids, 19);
    for (let run = 0; run < 10; run++) {
      expect(consume(bag)).toBe(consume(uninterrupted));
      // Failure/retry belongs to RunController. Reconstruct only to simulate reload.
      bag = new CharacterBag(ids, 0, bag.snapshot());
    }
    expect(bag.snapshot()).toEqual(uninterrupted.snapshot());
  });
  it('cannot be changed through caller arrays or a separate effects stream', () => {
    const mutable = [...ids];
    const bag = new CharacterBag(mutable, 9);
    mutable[0] = 'unexpected';
    const control = new CharacterBag(ids, 9);
    const effects = new SeededRandom(9);
    for (let i = 0; i < 17; i++) { effects.next(); expect(consume(bag)).toBe(consume(control)); }
    expect(Object.isFrozen(bag.snapshot().order)).toBe(true);
  });
  it('rejects corrupted restoration', () => {
    const saved = new CharacterBag(ids, 1).snapshot();
    expect(() => new CharacterBag(ids, 0, { ...saved, cursor: -1 })).toThrow(RangeError);
    expect(() => new CharacterBag(ids, 0, { ...saved, order: [...ids.slice(1), 'b'] })).toThrow(RangeError);
  });
});
