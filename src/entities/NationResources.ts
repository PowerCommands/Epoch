/**
 * Resursdata per nation. Ren data — mutation görs uteslutande av ResourceSystem.
 */
export class NationResources {
  readonly nationId: string;
  gold = 0;
  goldPerTurn = 0;

  constructor(nationId: string) {
    this.nationId = nationId;
  }
}
