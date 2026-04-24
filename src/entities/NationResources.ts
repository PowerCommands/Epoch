/**
 * Resursdata per nation. Ren data — mutation görs uteslutande av ResourceSystem.
 */
export class NationResources {
  readonly nationId: string;
  gold = 0;
  goldPerTurn = 0;
  culture = 0;
  culturePerTurn = 0;
  influence = 0;
  influencePerTurn = 0;
  happinessPerTurn = 0;

  constructor(nationId: string) {
    this.nationId = nationId;
  }
}
