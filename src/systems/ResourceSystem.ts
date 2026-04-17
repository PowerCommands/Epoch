import { NationManager } from './NationManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { IResourceGenerator } from './ResourceGenerator';
import type { TurnStartEvent } from '../types/events';
import type { ResourceChangedEvent, ResourceListener } from '../types/resources';
import { calculateCityEconomy } from './CityEconomy';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

/**
 * ResourceSystem lyssnar på turnStart och genererar resurser för den
 * aktiva nationen och dess städer.
 */
export class ResourceSystem {
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly generator: IResourceGenerator;
  private readonly mapData: MapData;
  private readonly listeners: ResourceListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    turnManager: TurnManager,
    generator: IResourceGenerator,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.generator = generator;
    this.mapData = mapData;

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

    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.goldPerTurn = this.generator.calculateCityGoldPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.food = city.foodStorage;
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
    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);
    nationRes.gold += nationRes.goldPerTurn;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      const economy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem);

      let displayEconomy = economy;
      cityRes.production += economy.production;

      if (economy.netFood > 0) {
        city.foodStorage += economy.netFood;
        if (city.foodStorage >= economy.foodToGrow) {
          city.population += 1;
          city.foodStorage = 0;
          displayEconomy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem);
        }
      }

      cityRes.foodPerTurn = displayEconomy.food;
      cityRes.productionPerTurn = displayEconomy.production;
      cityRes.goldPerTurn = displayEconomy.gold;
      cityRes.food = city.foodStorage;
    }

    this.notify({ nationId: nation.id });
  }

  private recalculatePerTurnForAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      const cities = this.cityManager.getCitiesByOwner(nation.id);
      const nationRes = this.nationManager.getResources(nation.id);
      const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);

      nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        const buildings = this.cityManager.getBuildings(city.id);
        cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.goldPerTurn = this.generator.calculateCityGoldPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.food = city.foodStorage;
      }
    }
  }

  private notify(e: ResourceChangedEvent): void {
    for (const cb of this.listeners) cb(e);
  }
}
