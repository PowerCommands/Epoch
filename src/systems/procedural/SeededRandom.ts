/** Small deterministic PRNG reserved for procedural scenario generation. */
export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = hashSeed(String(seed)) || 0x6d2b79f5;
  }

  next(): number {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x100000000;
  }

  integer(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive <= minInclusive) return minInclusive;
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('SeededRandom.pick requires at least one value.');
    return values[Math.floor(this.next() * values.length)]!;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.integer(0, index);
      [result[index], result[other]] = [result[other]!, result[index]!];
    }
    return result;
  }
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
