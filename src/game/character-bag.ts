import { SeededRandom } from './random';

export interface BagSnapshot {
  readonly order: readonly string[];
  readonly cursor: number;
  readonly previousCharacterId: string | null;
  readonly characterRngState: number;
}
export interface CharacterReservation {
  readonly token: number;
  readonly characterId: string;
}

/** Session-owned: retry never constructs a new bag. A reservation does not
 * consume a slot or RNG; only committing successfully prepared assets does. */
export class CharacterBag {
  private readonly ids: readonly string[];
  private state: BagSnapshot;
  private reservation: Readonly<CharacterReservation> | null = null;
  private pendingState: BagSnapshot | null = null;
  private token = 0;

  constructor(ids: readonly string[], seed: number, saved?: BagSnapshot) {
    if (ids.length < 2 || new Set(ids).size !== ids.length || ids.some(id => !id)) {
      throw new RangeError('Bag requires distinct character IDs');
    }
    new SeededRandom(seed);
    this.ids = Object.freeze([...ids]);
    if (saved) {
      new SeededRandom(saved.characterRngState);
      if (saved.order.length !== ids.length || new Set(saved.order).size !== ids.length
        || saved.order.some(id => !ids.includes(id)) || !Number.isInteger(saved.cursor)
        || saved.cursor < 0 || saved.cursor > ids.length
        || (saved.previousCharacterId !== null && !ids.includes(saved.previousCharacterId))) {
        throw new RangeError('Invalid saved bag');
      }
      this.state = this.freeze(saved);
    } else {
      // An exhausted canonical order defers the first shuffle to preparation.
      this.state = this.freeze({ order: ids, cursor: ids.length, previousCharacterId: null, characterRngState: seed });
    }
  }

  snapshot(): BagSnapshot { return this.state; }

  peek(): Readonly<CharacterReservation> {
    if (this.reservation) return this.reservation;
    let candidate = this.state;
    if (candidate.cursor === candidate.order.length) {
      const random = new SeededRandom(candidate.characterRngState);
      const order = [...this.ids];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random.next() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      if (order[0] === candidate.previousCharacterId) {
        const swap = 1 + Math.floor(random.next() * (order.length - 1));
        [order[0], order[swap]] = [order[swap]!, order[0]!];
      }
      candidate = this.freeze({ ...candidate, order, cursor: 0, characterRngState: random.state() });
    }
    this.pendingState = candidate;
    this.reservation = Object.freeze({ token: ++this.token, characterId: candidate.order[candidate.cursor]! });
    return this.reservation;
  }

  commit(token: number): string | null {
    if (!this.reservation || !this.pendingState || token !== this.reservation.token) return null;
    const id = this.reservation.characterId;
    this.state = this.freeze({ ...this.pendingState, cursor: this.pendingState.cursor + 1, previousCharacterId: id });
    this.reservation = null;
    this.pendingState = null;
    return id;
  }

  /** Cancel an obsolete preparation callback, retaining the same candidate/RNG. */
  cancel(token: number): void {
    if (this.reservation?.token !== token) return;
    this.reservation = null;
    this.pendingState = null;
  }

  private freeze(state: BagSnapshot): BagSnapshot {
    return Object.freeze({ ...state, order: Object.freeze([...state.order]) });
  }
}
