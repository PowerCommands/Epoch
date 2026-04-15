import { NationManager } from './NationManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { IResourceGenerator } from './ResourceGenerator';
import type { TurnStartEvent } from '../types/events';
import type { ResourceChangedEvent, ResourceListener } from '../types/resources';

/**
 * ResourceSystem lyssnar på turnStart och genererar resurser för den
 * aktiva nationen och dess städer.
 */
export class ResourceSystem {
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly generator: IResourceGenerator;
  private readonly listeners: ResourceListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    turnManager: TurnManager,
    generator: IResourceGenerator,
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.generator = generator;

    turnManager.on('turnStart', (e) => this.handleTurnStart(e));

    // Räkna ut per-turn-värden direkt så att UI visar korrekta "+X/turn"
    // redan vid spelstart, innan första genereringen.
    this.recalculatePerTurnForAll();
  }

  on(callback: ResourceListener): void {
    this.listeners.push(callback);
  }

  /**
   * Räkna om per-turn-värden för en specifik nation och dess städer.
   * Anropas när en byggnad blir klar så att UI uppdateras direkt.
   */
  recalculateForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return;

    const cities = this.cityManager.getCitiesByOwner(nationId);
    const nationRes = this.nationManager.getResources(nationId);
    const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);

    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup);

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings);
      cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings);
    }

    this.notify({ nationId });
  }

  private handleTurnStart(e: TurnStartEvent): void {
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }

    this.onTurnStart(e);
  }

  private onTurnStart(e: TurnStartEvent): void {
    const nation = e.nation;
    const cities = this.cityManager.getCitiesByOwner(nation.id);
    const nationRes = this.nationManager.getResources(nation.id);
    const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);

    // Räkna om per-turn (kan ändras om städer förstörts/skapats)
    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup);
    nationRes.gold += nationRes.goldPerTurn;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings);
      cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings);
      cityRes.food += cityRes.foodPerTurn;
      cityRes.production += cityRes.productionPerTurn;
    }

    this.notify({ nationId: nation.id });
  }

  private recalculatePerTurnForAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      const cities = this.cityManager.getCitiesByOwner(nation.id);
      const nationRes = this.nationManager.getResources(nation.id);
      const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);

      nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup);

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        const buildings = this.cityManager.getBuildings(city.id);
        cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings);
        cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings);
      }
    }
  }

  private notify(e: ResourceChangedEvent): void {
    for (const cb of this.listeners) cb(e);
  }
}
