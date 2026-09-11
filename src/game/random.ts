/** Version 1: uint32 LCG, constants from Numerical Recipes. Non-cryptographic.
 * Separate instances belong to character, placement, gauge, ending and effects. */
export class SeededRandom {
  private value: number;
  constructor(state: number) {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) throw new RangeError('Invalid random state');
    this.value = state;
  }
  state(): number { return this.value; }
  next(): number {
    this.value = (Math.imul(1664525, this.value) + 1013904223) >>> 0;
    return this.value / 0x100000000;
  }
}
