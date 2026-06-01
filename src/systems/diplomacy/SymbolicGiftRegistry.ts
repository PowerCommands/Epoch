/**
 * SymbolicGiftRegistry — remembers, per nation pair, the one-time "symbolic gift
 * of gesture" milestones:
 *
 *  - whether a nation has already presented its symbolic gift to the other
 *    (so the reward is granted only once), and
 *  - whether the AI has already reciprocated with its own first-meeting gift
 *    (so the courtesy is offered only once).
 *
 * Pure bookkeeping — no diplomacy effects live here; the caller applies the
 * relationship reward through DiplomacyManager when these flags flip.
 */
export class SymbolicGiftRegistry {
  private readonly givers = new Set<string>();        // `${from}->${to}` symbolic gift presented
  private readonly reciprocated = new Set<string>();  // unordered pair key, AI courtesy returned

  private directedKey(from: string, to: string): string {
    return `${from}->${to}`;
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** True once `from` has presented a symbolic gift to `to`. */
  hasGivenSymbolic(from: string, to: string): boolean {
    return this.givers.has(this.directedKey(from, to));
  }

  markGivenSymbolic(from: string, to: string): void {
    this.givers.add(this.directedKey(from, to));
  }

  /** True once the first-meeting symbolic courtesy has been exchanged for this pair. */
  hasReciprocated(a: string, b: string): boolean {
    return this.reciprocated.has(this.pairKey(a, b));
  }

  markReciprocated(a: string, b: string): void {
    this.reciprocated.add(this.pairKey(a, b));
  }

  /** Snapshot for save games. */
  serialize(): { givers: string[]; reciprocated: string[] } {
    return { givers: [...this.givers], reciprocated: [...this.reciprocated] };
  }

  /** Replace state from a save game snapshot. */
  restore(data: { givers?: string[]; reciprocated?: string[] } | undefined): void {
    this.givers.clear();
    this.reciprocated.clear();
    for (const key of data?.givers ?? []) this.givers.add(key);
    for (const key of data?.reciprocated ?? []) this.reciprocated.add(key);
  }
}
