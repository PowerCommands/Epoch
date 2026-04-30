import { NationManager } from './NationManager';
import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { IResourceGenerator } from './ResourceGenerator';
import type { TurnStartEvent } from '../types/events';
import type { ResourceChangedEvent, ResourceListener } from '../types/resources';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
import {
  calculateCityEconomy,
  getFoodConsumption,
  getPositiveFoodSurplus,
  type CityEconomySummary,
} from './CityEconomy';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { HappinessSystem } from './HappinessSystem';
import { getGameSpeedById, type GameSpeedDefinition } from '../data/gameSpeeds';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import type { Nation } from '../entities/Nation';

/**
 * ResourceSystem lyssnar på turnStart och genererar resurser för den
 * aktiva nationen och dess städer.
 */
export class ResourceSystem {
  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly generator: IResourceGenerator;
  private readonly mapData: MapData;
  private readonly happinessSystem: HappinessSystem;
  private readonly listeners: ResourceListener[] = [];
  private hasSkippedInitialTurnStart = false;
  private readonly cityTerritorySystem: CityTerritorySystem;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    turnManager: TurnManager,
    generator: IResourceGenerator,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
    happinessSystem: HappinessSystem,
    private readonly getNationModifiers: (nationId: string) => Readonly<ModifierSet> = () => EMPTY_MODIFIERS,
    gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private readonly getTradeGoldPerTurnDelta: (nationId: string) => number = () => 0,
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.generator = generator;
    this.mapData = mapData;
    this.happinessSystem = happinessSystem;
    this.cityTerritorySystem = new CityTerritorySystem(gameSpeed, gridSystem);

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

  getFoodSurplus(city: City): number {
    const cityRes = this.cityManager.getResources(city.id);
    return getPositiveFoodSurplus(
      cityRes.foodPerTurn,
      getFoodConsumption(city.population),
    );
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
    const nationModifiers = this.getNationModifiers(nationId);

    this.updateWorkedTiles(cities);

    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(cities);
    nationRes.goldPerTurn = this.getTradeGoldPerTurnDelta(nationId);
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const economy = this.calculateEconomyForCity(city, nationModifiers);
      cityRes.foodPerTurn = economy.food;
      cityRes.productionPerTurn = economy.production;
      cityRes.goldPerTurn = economy.gold;
      cityRes.sciencePerTurn = economy.science;
      cityRes.culturePerTurn = economy.culture;
      cityRes.happinessPerTurn = economy.happiness;
      nationRes.goldPerTurn += cityRes.goldPerTurn;
      nationRes.culturePerTurn += cityRes.culturePerTurn;
      nationRes.happinessPerTurn += cityRes.happinessPerTurn;
      cityRes.food = city.foodStorage;
    }

    this.happinessSystem.recalculateNation(nationId);
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
    const nationModifiers = this.getNationModifiers(nation.id);

    this.updateWorkedTiles(cities);
    this.happinessSystem.recalculateNation(nation.id);

    const goldModifier = this.happinessSystem.getGoldModifier(nation.id);
    const cultureModifier = this.happinessSystem.getCultureModifier(nation.id);

    // Räkna om per-turn (kan ändras om städer förstörts/skapats)
    nationRes.goldPerTurn = this.calculateNationGoldPerTurn(
      nation,
      cities,
      lookup,
      nationModifiers,
    );
    nationRes.gold += Math.floor(nationRes.goldPerTurn * goldModifier);
    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(cities);
    nationRes.influence += nationRes.influencePerTurn;
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      const economy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem, nationModifiers);
      const growthModifier = this.happinessSystem.getGrowthModifier(nation.id);

      let displayEconomy = economy;
      cityRes.production += economy.production;

      if (economy.netFood > 0 && growthModifier > 0) {
        const adjustedGrowth = Math.floor(economy.netFood * growthModifier);
        city.foodStorage += adjustedGrowth;
        if (city.foodStorage >= economy.foodToGrow) {
          city.population += 1;
          city.foodStorage = 0;
          this.cityTerritorySystem.updateWorkedTiles(city, this.mapData);
          this.cityTerritorySystem.refreshNextExpansionTile(city, this.mapData);
          this.happinessSystem.recalculateNation(city.ownerId);
          displayEconomy = calculateCityEconomy(city, this.mapData, buildings, this.gridSystem, nationModifiers);
        }
      }

      cityRes.foodPerTurn = displayEconomy.food;
      cityRes.productionPerTurn = displayEconomy.production;
      cityRes.goldPerTurn = displayEconomy.gold;
      cityRes.sciencePerTurn = displayEconomy.science;
      cityRes.culturePerTurn = displayEconomy.culture;
      cityRes.happinessPerTurn = displayEconomy.happiness;
      city.culture += Math.floor(cityRes.culturePerTurn * cultureModifier);
      this.cityTerritorySystem.tryClaimNextExpansionTile(city, this.mapData);
      nationRes.culturePerTurn += displayEconomy.culture;
      nationRes.happinessPerTurn += displayEconomy.happiness;
      cityRes.food = city.foodStorage;
    }
    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(cities);
    nationRes.culture += Math.floor(nationRes.culturePerTurn * cultureModifier);

    this.happinessSystem.recalculateNation(nation.id);
    this.notify({ nationId: nation.id });
  }

  private recalculatePerTurnForAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      const cities = this.cityManager.getCitiesByOwner(nation.id);
      const nationRes = this.nationManager.getResources(nation.id);
      const lookup = (cityId: string) => this.cityManager.getBuildings(cityId);
      const nationModifiers = this.getNationModifiers(nation.id);

      this.updateWorkedTiles(cities);

      nationRes.goldPerTurn = this.calculateNationGoldPerTurn(
        nation,
        cities,
        lookup,
        nationModifiers,
      );
      nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(cities);
      nationRes.culturePerTurn = 0;
      nationRes.happinessPerTurn = 0;

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        const buildings = this.cityManager.getBuildings(city.id);
        cityRes.foodPerTurn = this.generator.calculateCityFoodPerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        cityRes.productionPerTurn = this.generator.calculateCityProductionPerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        cityRes.goldPerTurn = this.generator.calculateCityGoldPerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        cityRes.sciencePerTurn = this.generator.calculateCitySciencePerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        cityRes.culturePerTurn = this.generator.calculateCityCulturePerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        cityRes.happinessPerTurn = this.generator.calculateCityHappinessPerTurn(city, buildings, this.mapData, this.gridSystem, nationModifiers);
        nationRes.culturePerTurn += cityRes.culturePerTurn;
        nationRes.happinessPerTurn += cityRes.happinessPerTurn;
        cityRes.food = city.foodStorage;
      }

      this.happinessSystem.recalculateNation(nation.id);
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

  private calculateNationInfluencePerTurn(cities: ReturnType<CityManager['getCitiesByOwner']>): number {
    return cities.reduce((sum, city) => sum + city.population, 0);
  }

  private calculateNationGoldPerTurn(
    nation: Nation,
    cities: City[],
    lookup: (cityId: string) => CityBuildings,
    nationModifiers: Readonly<ModifierSet>,
  ): number {
    const baseGoldPerTurn = this.generator.calculateNationGoldPerTurn(
      nation,
      cities,
      lookup,
      this.mapData,
      this.gridSystem,
      nationModifiers,
    );

    return baseGoldPerTurn + this.getTradeGoldPerTurnDelta(nation.id);
  }

  private calculateEconomyForCity(
    city: City,
    nationModifiers: Readonly<ModifierSet>,
  ): CityEconomySummary {
    return calculateCityEconomy(
      city,
      this.mapData,
      this.cityManager.getBuildings(city.id),
      this.gridSystem,
      nationModifiers,
    );
  }
}
