/**
 * Resursdata per stad. Ren data — mutation görs uteslutande av ResourceSystem.
 */
export class CityResources {
  readonly cityId: string;
  food = 0;
  foodPerTurn = 0;
  production = 0;
  productionPerTurn = 0;
  goldPerTurn = 0;
  sciencePerTurn = 0;
  culturePerTurn = 0;
  happinessPerTurn = 0;

  constructor(cityId: string) {
    this.cityId = cityId;
  }
}
