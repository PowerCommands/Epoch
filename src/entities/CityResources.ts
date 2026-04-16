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

  constructor(cityId: string) {
    this.cityId = cityId;
  }
}
