import { NationManager } from './NationManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { IResourceGenerator } from './ResourceGenerator';
import type { TurnStartEvent } from '../types/events';
import type { ResourceChangedEvent, ResourceListener } from '../types/resources';
import { calculateCityEconomy } from './CityEconomy';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';

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
  private readonly cityTerritorySystem = new CityTerritorySystem();

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

  addGold(nationId: string, amount: number): number | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return null;

    const nationRes = this.nationManager.getResources(nationId);
    nationRes.gold += amount;
    this.notify({ nationId });

    return nationRes.gold;
  }

  setGold(nationId: string, amount: number): number | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return null;

    const nationRes = this.nationManager.getResources(nationId);
    nationRes.gold = amount;
    this.notify({ nationId });

    return nationRes.gold;
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

    this.updateWorkedTiles(cities);

    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.goldPerTurn = this.generator.calculateCityGoldPerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.sciencePerTurn = this.generator.calculateCitySciencePerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.culturePerTurn = this.generator.calculateCityCulturePerTurn(city, buildings, this.mapData, this.gridSystem);
      cityRes.happinessPerTurn = this.generator.calculateCityHappinessPerTurn(city, buildings, this.mapData, this.gridSystem);
      nationRes.culturePerTurn += cityRes.culturePerTurn;
      nationRes.happinessPerTurn += cityRes.happinessPerTurn;
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

    this.updateWorkedTiles(cities);

    // Räkna om per-turn (kan ändras om städer förstörts/skapats)
    nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);
    nationRes.gold += nationRes.goldPerTurn;
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

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
          this.cityTerritorySystem.updateWorkedTiles(city, this.mapData);
          this.cityTerritorySystem.refreshNextExpansionTile(city, this.mapData);
          displayEconomy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem);
        }
      }

      cityRes.foodPerTurn = displayEconomy.food;
      cityRes.productionPerTurn = displayEconomy.production;
      cityRes.goldPerTurn = displayEconomy.gold;
      cityRes.sciencePerTurn = displayEconomy.science;
      cityRes.culturePerTurn = displayEconomy.culture;
      cityRes.happinessPerTurn = displayEconomy.happiness;
      city.culture += cityRes.culturePerTurn;
      this.cityTerritorySystem.tryClaimNextExpansionTile(city, this.mapData);
      nationRes.culturePerTurn += displayEconomy.culture;
      nationRes.happinessPerTurn += displayEconomy.happiness;
      cityRes.food = city.foodStorage;
    }
    nationRes.culture += nationRes.culturePerTurn;

    this.notify({ nationId: nation.id });
  }

  private recalculatePerTurnForAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      const cities = this.cityManager.getCitiesByOwner(nation.id);
      const nationRes = this.nationManager.getResources(nation.id);
      const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);

      this.updateWorkedTiles(cities);

      nationRes.goldPerTurn = this.generator.calculateNationGoldPerTurn(nation, cities, lookup, this.mapData, this.gridSystem);
      nationRes.culturePerTurn = 0;
      nationRes.happinessPerTurn = 0;

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        const buildings = this.cityManager.getBuildings(city.id);
        cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.goldPerTurn = this.generator.calculateCityGoldPerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.sciencePerTurn = this.generator.calculateCitySciencePerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.culturePerTurn = this.generator.calculateCityCulturePerTurn(city, buildings, this.mapData, this.gridSystem);
        cityRes.happinessPerTurn = this.generator.calculateCityHappinessPerTurn(city, buildings, this.mapData, this.gridSystem);
        nationRes.culturePerTurn += cityRes.culturePerTurn;
        nationRes.happinessPerTurn += cityRes.happinessPerTurn;
        cityRes.food = city.foodStorage;
      }
    }
  }

  private notify(e: ResourceChangedEvent): void {
    for (const cb of this.listeners) cb(e);
  }

  private updateWorkedTiles(cities: ReturnType<CityManager['getCitiesByOwner']>): void {
    for (const city of cities) {
      this.cityTerritorySystem.updateWorkedTiles(city, this.mapData);
      this.cityTerritorySystem.refreshNextExpansionTile(city, this.mapData);
    }
  }
}
