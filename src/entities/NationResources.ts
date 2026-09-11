/**
 * Resursdata per nation. Ren data — mutation görs uteslutande av ResourceSystem.
 */
export class NationResources {
  readonly nationId: string;
  gold = 0;
  /** Ordinary income; Mutual Foe transfers never change the contribution basis. */
  goldPerTurn = 0;
  /** Derived preview only, rebuilt from live crises; never saved as economic state. */
  mutualFoeGoldIncomingPerTurn = 0;
  mutualFoeGoldOutgoingPerTurn = 0;
  get effectiveGoldPerTurn(): number {
    return this.goldPerTurn + this.mutualFoeGoldIncomingPerTurn - this.mutualFoeGoldOutgoingPerTurn;
  }
  culture = 0;
  culturePerTurn = 0;
  influence = 0;
  influencePerTurn = 0;
  happinessPerTurn = 0;

  constructor(nationId: string) {
    this.nationId = nationId;
  }
}
