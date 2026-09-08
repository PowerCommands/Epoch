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
import { distributeGrowthFood, type CityFoodSurplus } from './MilitaryFoodUpkeep';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { HappinessSystem } from './HappinessSystem';
import type { CultureEffectSystem } from './culture/CultureEffectSystem';
import { getGameSpeedById, type GameSpeedDefinition } from '../data/gameSpeeds';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { CityBuildings as MutableCityBuildings } from '../entities/CityBuildings';
import type { BuildingType } from '../entities/Building';
import { getBuildingById } from '../data/buildings';
import type { Nation } from '../entities/Nation';
import type { PolicySystem } from './PolicySystem';
import type { CulturalSphereSystem } from './CulturalSphereSystem';
import type { WonderSystem } from './WonderSystem';
import {
  applyCityIntegrationOutput,
  getNationOccupationGoldCost,
} from './CityIntegrationSystem';
import type { PowerPlantSystem } from './PowerPlantSystem';
import {
  ArchaeologicalCultureSystem,
  applyBuildingCulturePercentages,
  type ArchaeologicalCultureSummary,
} from './ArchaeologicalCultureSystem';

const ENERGY_SHORTAGE_GRACE_TURNS = 5;
const ENERGY_SHORTAGE_DECLINE_INTERVAL = 5;
const EMPTY_YIELD_DISTRIBUTION: ReadonlyMap<string, number> = new Map();

type CityEnergyProvider = Pick<
  PowerPlantSystem,
  'getCityPopulationCapacity' | 'getCityProductionMultiplier'
>;
type CityEnergyLog = (nationId: string, message: string) => void;

/**
 * Per-nation summary of how military food upkeep affected population growth on
 * the nation's most recent turn. Purely diagnostic; not persisted.
 */
export interface NationFoodGrowthBreakdown {
  /** Combined positive city food surplus before military upkeep. */
  readonly civilianSurplus: number;
  /** National military food upkeep subtracted this turn. */
  readonly militaryUpkeep: number;
  /** Growth food remaining after upkeep = max(0, civilianSurplus - upkeep). */
  readonly growthFood: number;
}

/**
 * Per-city working state carried between the two growth passes in
 * {@link ResourceSystem.onTurnStart}: the first pass computes each city's
 * pre-military growth-food contribution, the second applies the nationally
 * pooled-and-reduced growth food back to food storage / population.
 */
interface CityGrowthContext {
  readonly city: City;
  readonly buildings: CityBuildings;
  readonly maritimeBonus: number;
  readonly productionBonus: number;
  readonly populationCapacity: number;
  /** Maritime-adjusted economy used for netFood / foodToGrow. */
  readonly economy: CityEconomySummary;
  /** Economy used for the per-turn display values (recomputed if pop grows). */
  displayEconomy: CityEconomySummary;
  /** Growth food this city would gain before military upkeep (post growth modifier). */
  growthCandidate: number;
}

/**
 * ResourceSystem lyssnar på turnStart och genererar resurser för den
 * aktiva nationen och dess städer.
 */
export class ResourceSystem {
  private historicalGold: (nation: string, value: number) => number = (_n, value) => value;
  private historicalFood: (nation: string, economies: CityEconomySummary[], round: number, commit: boolean) => void = () => {};
  setHistoricalProviders(gold: typeof this.historicalGold, food: typeof this.historicalFood): void {
    this.historicalGold = gold; this.historicalFood = food;
  }

  private readonly nationManager: NationManager;
  private readonly cityManager: CityManager;
  private readonly generator: IResourceGenerator;
  private readonly mapData: MapData;
  private readonly happinessSystem: HappinessSystem;
  private readonly listeners: ResourceListener[] = [];
  private hasSkippedInitialTurnStart = false;
  private readonly cityTerritorySystem: CityTerritorySystem;
  private readonly archaeologicalCultureSystem: ArchaeologicalCultureSystem;
  private cityEnergyProvider?: CityEnergyProvider;
  private cityEnergyLog: CityEnergyLog = () => {};
  /**
   * Per-city Food granted by the nation's available Maritime Goods. The
   * distribution is owned by the manufactured-resource effect layer; this
   * system only folds the resulting Food into the normal city economy.
   */
  private getMaritimeFoodDistribution: (nationId: string) => ReadonlyMap<string, number> =
    () => EMPTY_YIELD_DISTRIBUTION;
  /**
   * Per-city Production granted by the nation's available Production-yielding
   * manufactured resources (Tools, Refined Fuel, Steel Goods, Chips). Added as a
   * flat bonus to final city Production so the assigned total equals the bonus.
   */
  private getManufacturedProductionDistribution: (nationId: string) => ReadonlyMap<string, number> =
    () => EMPTY_YIELD_DISTRIBUTION;
  /** National Gold/turn granted by available Banking Services. */
  private getManufacturedGoldPerTurn: (nationId: string) => number = () => 0;
  /**
   * National military food upkeep, subtracted from the combined positive city
   * food surplus before population-growth food is distributed. Defaults to a
   * no-op so the system works before the provider is wired.
   */
  private getMilitaryFoodUpkeep: (nationId: string) => number = () => 0;
  /**
   * Last-computed food-growth breakdown per nation (populated each turnStart).
   * Live diagnostic state only — never persisted.
   */
  private readonly foodGrowthBreakdown = new Map<string, NationFoodGrowthBreakdown>();
  /** Uses the World Council's existing scheduled/current meeting state; no separate timer is kept here. */
  private isWorldCouncilVoteActive: () => boolean = () => false;

  constructor(
    nationManager: NationManager,
    cityManager: CityManager,
    private readonly turnManager: TurnManager,
    generator: IResourceGenerator,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
    happinessSystem: HappinessSystem,
    private readonly getNationModifiers: (nationId: string) => Readonly<ModifierSet> = () => EMPTY_MODIFIERS,
    gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private readonly getTradeGoldPerTurnDelta: (nationId: string) => number = () => 0,
    private readonly policySystem?: PolicySystem,
    private readonly cultureEffectSystem?: CultureEffectSystem,
    private readonly culturalSphereSystem?: CulturalSphereSystem,
    private readonly wonderSystem?: WonderSystem,
    private readonly onCultureLayerChanged: () => void = () => {},
  ) {
    this.nationManager = nationManager;
    this.cityManager = cityManager;
    this.generator = generator;
    this.mapData = mapData;
    this.happinessSystem = happinessSystem;
    this.cityTerritorySystem = new CityTerritorySystem(gameSpeed, gridSystem);
    this.archaeologicalCultureSystem = new ArchaeologicalCultureSystem(
      mapData,
      cityManager,
      () => turnManager.getCurrentRound(),
    );

    turnManager.on('turnStart', (e) => this.handleTurnStart(e));

    // Räkna ut per-turn-värden direkt så att UI visar korrekta "+X/turn"
    // redan vid spelstart, innan första genereringen.
    this.recalculatePerTurnForAll();
  }

  on(callback: ResourceListener): void {
    this.listeners.push(callback);
  }

  setCityEnergyProvider(
    provider: CityEnergyProvider,
    log: CityEnergyLog = () => {},
  ): void {
    this.cityEnergyProvider = provider;
    this.cityEnergyLog = log;
  }

  /**
   * Inject the Maritime Goods → per-city Food distribution. The provider is
   * expected to be deterministic and based on the nation's current resource
   * access, so imported and domestic Maritime Goods behave identically.
   */
  setMaritimeFoodProvider(provider: (nationId: string) => ReadonlyMap<string, number>): void {
    this.getMaritimeFoodDistribution = provider;
  }

  /**
   * Inject the manufactured-resource → per-city Production distribution. Like
   * the Food provider it must be deterministic and derived from current
   * resource access.
   */
  setManufacturedProductionProvider(provider: (nationId: string) => ReadonlyMap<string, number>): void {
    this.getManufacturedProductionDistribution = provider;
  }

  /**
   * Inject the manufactured-resource → national Gold/turn contribution (Banking
   * Services). Folded into normal national income so gaining or losing access
   * changes income automatically, with no persistent treasury mutation.
   */
  setManufacturedGoldProvider(provider: (nationId: string) => number): void {
    this.getManufacturedGoldPerTurn = provider;
  }

  setWorldCouncilVoteActiveProvider(provider: () => boolean): void {
    this.isWorldCouncilVoteActive = provider;
    this.recalculatePerTurnForAll();
  }

  /**
   * Inject the national military food-upkeep provider. Must be deterministic and
   * derived from the nation's current units; folded into the growth-food pool so
   * a larger military naturally slows population growth for humans and AI alike.
   */
  setMilitaryFoodUpkeepProvider(provider: (nationId: string) => number): void {
    this.getMilitaryFoodUpkeep = provider;
  }

  /**
   * Latest military food-upkeep / growth breakdown for a nation, or undefined if
   * the nation has not yet had a processed turn. Diagnostic use only.
   */
  getFoodGrowthBreakdown(nationId: string): NationFoodGrowthBreakdown | undefined {
    return this.foodGrowthBreakdown.get(nationId);
  }

  /** Live, non-persisted archaeological contribution used by economy and UI. */
  getArchaeologicalCultureBreakdown(nationId: string): ArchaeologicalCultureSummary & {
    readonly culturePerTurn: number;
  } {
    const summary = this.archaeologicalCultureSystem.calculateForNation(nationId);
    return {
      ...summary,
      culturePerTurn: this.applyArchaeologicalCultureModifiers(nationId, summary.baseCulturePerTurn),
    };
  }

  addGold(nationId: string, amount: number): number | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return null;

    const nationRes = this.nationManager.getResources(nationId);
    nationRes.gold += amount;
    this.notify({ nationId });

    return nationRes.gold;
  }

  spendInfluence(nationId: string, amount: number): number {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return 0;

    const nationRes = this.nationManager.getResources(nationId);
    const spent = Math.max(0, Math.min(nationRes.influence, Math.floor(amount)));
    if (spent <= 0) return 0;

    nationRes.influence -= spent;
    this.notify({ nationId });
    return spent;
  }

  setGold(nationId: string, amount: number): number | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return null;

    const nationRes = this.nationManager.getResources(nationId);
    nationRes.gold = amount;
    this.notify({ nationId });

    return nationRes.gold;
  }

  /** Gross Food before historical disruption, aid and domestic consumption. */
  getNationalFoodProduction(nationId: string): number {
    const maritime = this.getMaritimeFoodDistribution(nationId);
    const modifiers = this.getNationModifiers(nationId);
    return this.cityManager.getCitiesByOwner(nationId).reduce((sum, city) => sum
      + this.calculateEconomyForCity(city, modifiers).food + (maritime.get(city.id) ?? 0), 0);
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

    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(nationId, cities);
    nationRes.goldPerTurn = this.getTradeGoldPerTurnDelta(nationId)
      + this.historicalGold(nationId, this.getManufacturedGoldPerTurn(nationId))
      - getNationOccupationGoldCost(nationId, this.cityManager, this.turnManager.getCurrentRound());
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

    const maritimeFood = this.getMaritimeFoodDistribution(nationId);
    const manufacturedProduction = this.getManufacturedProductionDistribution(nationId);

    for (const city of cities) {
      const cityRes = this.cityManager.getResources(city.id);
      const economy = this.calculateIntegratedEconomyForCity(
        city,
        nationModifiers,
        maritimeFood.get(city.id) ?? 0,
        manufacturedProduction.get(city.id) ?? 0,
      );
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
    nationRes.culturePerTurn += this.getArchaeologicalCultureBreakdown(nationId).culturePerTurn;

    const previews = cities.map(city => {
      const res = this.cityManager.getResources(city.id);
      return { food: res.foodPerTurn, foodConsumption: getFoodConsumption(city.population), netFood: 0 } as CityEconomySummary;
    });
    this.historicalFood(nationId, previews, this.turnManager.getCurrentRound(), false);
    cities.forEach((city, i) => { this.cityManager.getResources(city.id).foodPerTurn = previews[i].food; });
    this.happinessSystem.recalculateNation(nationId);
    this.notify({ nationId });
  }

  /**
   * Exact recurring national Gold/turn delta produced by completing a building
   * in this city. This runs the same city economy, policy and integration
   * pipeline used by recalculateForNation without mutating live city state.
   */
  getBuildingGoldPerTurnImprovement(cityId: string, building: BuildingType): number {
    const city = this.cityManager.getCity(cityId);
    if (!city) return 0;
    const current = this.cityManager.getBuildings(cityId);
    if (current.has(building.id)) return 0;

    const projected = new MutableCityBuildings(cityId);
    for (const buildingId of current.getAll()) {
      const existing = getBuildingById(buildingId);
      if (existing) projected.add(existing);
    }
    projected.add(building);

    const nationModifiers = this.getNationModifiers(city.ownerId);
    const before = this.calculateIntegratedEconomyForCity(city, nationModifiers, 0, 0, current).gold;
    const after = this.calculateIntegratedEconomyForCity(city, nationModifiers, 0, 0, projected).gold;
    return after - before;
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
    this.cultureEffectSystem?.beginTurn(nation.id);
    this.happinessSystem.recalculateNation(nation.id);

    const goldModifier = this.happinessSystem.getGoldModifier(nation.id);
    const cultureModifier = this.happinessSystem.getCultureModifier(nation.id);

    // Räkna om per-turn (kan ändras om städer förstörts/skapats)
    const occupationGoldCost = getNationOccupationGoldCost(
      nation.id,
      this.cityManager,
      this.turnManager.getCurrentRound(),
    );
    const baseGoldPerTurn = this.calculateNationGoldPerTurn(
      nation,
      cities,
      lookup,
      nationModifiers,
    );
    nationRes.goldPerTurn = baseGoldPerTurn - occupationGoldCost;
    nationRes.gold += Math.floor(baseGoldPerTurn * goldModifier) - occupationGoldCost;
    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(nation.id, cities);
    nationRes.influence += nationRes.influencePerTurn;
    nationRes.culturePerTurn = 0;
    nationRes.happinessPerTurn = 0;

    const maritimeFood = this.getMaritimeFoodDistribution(nation.id);
    const manufacturedProduction = this.getManufacturedProductionDistribution(nation.id);
    const growthModifier = this.happinessSystem.getGrowthModifier(nation.id);

    // Pass 1 — compute each city's economy and its pre-military growth-food
    // contribution, and apply the food-independent production increment now.
    const contexts: CityGrowthContext[] = [];
    for (const city of cities) {
      const populationCapacity = this.getCityPopulationCapacity(city.id);
      this.updateEnergyShortage(city, populationCapacity);
      const cityRes = this.cityManager.getResources(city.id);
      const buildings = this.cityManager.getBuildings(city.id);
      const maritimeBonus = maritimeFood.get(city.id) ?? 0;
      const productionBonus = manufacturedProduction.get(city.id) ?? 0;
      const economy = this.applyMaritimeFood(
        calculateCityEconomy(city, this.mapData, buildings, this.gridSystem, nationModifiers),
        maritimeBonus,
      );
      const policyEconomy = this.applyFlatProduction(
        this.applyCityEnergyProductionMultiplier(
          city,
          this.applyCityIntegrationMultiplier(
            city,
            this.applyPolicyEconomyModifiers(city.ownerId, economy),
          ),
        ),
        productionBonus,
      );

      cityRes.production += policyEconomy.production;

      const growthCandidate = economy.netFood > 0 && growthModifier > 0
        ? Math.floor(economy.netFood * growthModifier)
        : 0;

      contexts.push({
        city,
        buildings,
        maritimeBonus,
        productionBonus,
        populationCapacity,
        economy,
        displayEconomy: policyEconomy,
        growthCandidate,
      });
    }

    const grossFood = contexts.map(ctx => ctx.economy.food);
    this.historicalFood(nation.id, contexts.map(ctx => ctx.economy), this.turnManager.getCurrentRound(), true);
    const historicallyAdjustedFood = new Set(contexts.filter((ctx, index) => ctx.economy.food !== grossFood[index]).map(ctx => ctx.city.id));
    for (const ctx of contexts) {
      ctx.growthCandidate = ctx.economy.netFood > 0 && growthModifier > 0 ? Math.floor(ctx.economy.netFood * growthModifier) : 0;
      ctx.displayEconomy = { ...ctx.displayEconomy, food: ctx.economy.food, netFood: ctx.economy.netFood };
    }

    // Pool the positive city surplus, subtract national military food upkeep,
    // and distribute the remaining growth food back proportionally. Military
    // upkeep therefore only suppresses growth — it never touches the population
    // × 2 consumption already accounted for in each city's netFood.
    const citySurpluses: CityFoodSurplus[] = contexts.map((ctx) => ({
      cityId: ctx.city.id,
      surplus: ctx.growthCandidate,
    }));
    const militaryUpkeep = this.getMilitaryFoodUpkeep(nation.id);
    const growth = distributeGrowthFood(citySurpluses, militaryUpkeep);
    this.foodGrowthBreakdown.set(nation.id, {
      civilianSurplus: growth.civilianSurplus,
      militaryUpkeep: growth.militaryUpkeep,
      growthFood: growth.growthFood,
    });

    // Pass 2 — apply the allocated growth food to food storage / population and
    // finalize per-turn display, culture and territory for each city.
    for (const ctx of contexts) {
      const { city } = ctx;
      const cityRes = this.cityManager.getResources(city.id);
      const allocatedGrowth = growth.allocations.get(city.id) ?? 0;
      let displayEconomy = ctx.displayEconomy;

      if (allocatedGrowth > 0) {
        city.foodStorage += allocatedGrowth;
        if (city.foodStorage >= ctx.economy.foodToGrow) {
          city.foodStorage = 0;
          if (city.population < ctx.populationCapacity) {
            city.population += 1;
            this.refreshCityPopulationEffects(city);
            displayEconomy = this.applyFlatProduction(
              this.applyCityEnergyProductionMultiplier(
                city,
                this.applyCityIntegrationMultiplier(
                  city,
                  this.applyPolicyEconomyModifiers(
                    city.ownerId,
                    this.applyMaritimeFood(
                      calculateCityEconomy(city, this.mapData, ctx.buildings, this.gridSystem, nationModifiers),
                      ctx.maritimeBonus,
                    ),
                  ),
                ),
              ),
              ctx.productionBonus,
            );
          }
        }
      }

      // This turn's settled Food includes historical losses and conserved aid.
      // A population refresh must not overwrite that settlement with gross yields.
      if (historicallyAdjustedFood.has(city.id)) displayEconomy = { ...displayEconomy, food: ctx.economy.food, netFood: ctx.economy.netFood };
      cityRes.foodPerTurn = displayEconomy.food;
      cityRes.productionPerTurn = displayEconomy.production;
      cityRes.goldPerTurn = this.historicalGold(nation.id, displayEconomy.gold);
      cityRes.sciencePerTurn = displayEconomy.science;
      cityRes.culturePerTurn = displayEconomy.culture;
      cityRes.happinessPerTurn = displayEconomy.happiness;
      city.culture += Math.floor(cityRes.culturePerTurn * cultureModifier);
      this.advanceRecurringCulturalSphere(city);
      this.cityTerritorySystem.tryClaimNextExpansionTile(city, this.mapData);
      nationRes.culturePerTurn += displayEconomy.culture;
      nationRes.happinessPerTurn += displayEconomy.happiness;
      cityRes.food = city.foodStorage;
    }
    nationRes.culturePerTurn += this.getArchaeologicalCultureBreakdown(nation.id).culturePerTurn;
    nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(nation.id, cities);
    nationRes.culture += Math.floor(nationRes.culturePerTurn * cultureModifier);
    this.cultureEffectSystem?.applyTurnStartEffects(nation.id);

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
      ) - getNationOccupationGoldCost(
        nation.id,
        this.cityManager,
        this.turnManager.getCurrentRound(),
      );
      nationRes.influencePerTurn = this.calculateNationInfluencePerTurn(nation.id, cities);
      nationRes.culturePerTurn = 0;
      nationRes.happinessPerTurn = 0;

      const maritimeFood = this.getMaritimeFoodDistribution(nation.id);
      const manufacturedProduction = this.getManufacturedProductionDistribution(nation.id);

      for (const city of cities) {
        const cityRes = this.cityManager.getResources(city.id);
        const buildings = this.cityManager.getBuildings(city.id);
        const economy = this.calculateIntegratedEconomyForCity(
          city,
          nationModifiers,
          maritimeFood.get(city.id) ?? 0,
          manufacturedProduction.get(city.id) ?? 0,
        );
        cityRes.foodPerTurn = economy.food;
        cityRes.productionPerTurn = economy.production;
        cityRes.goldPerTurn = economy.gold;
        cityRes.sciencePerTurn = economy.science;
        cityRes.culturePerTurn = economy.culture;
        cityRes.happinessPerTurn = economy.happiness;
        nationRes.culturePerTurn += cityRes.culturePerTurn;
        nationRes.happinessPerTurn += cityRes.happinessPerTurn;
        cityRes.food = city.foodStorage;
      }
      nationRes.culturePerTurn += this.getArchaeologicalCultureBreakdown(nation.id).culturePerTurn;

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

  private calculateNationInfluencePerTurn(
    nationId: string,
    cities: ReturnType<CityManager['getCitiesByOwner']>,
  ): number {
    const baseInfluence = cities.reduce((sum, city) => sum + city.population * 0.2, 0);
    const withFlat = baseInfluence + this.getPolicyFlat(nationId, 'influenceFlat');
    const councilVotePercent = this.isWorldCouncilVoteActive()
      ? this.getPolicyPercent(nationId, 'activeWorldCouncilVoteInfluencePercent')
      : 0;
    return applyPercent(withFlat, this.getPolicyPercent(nationId, 'influencePercent') + councilVotePercent);
  }

  /**
   * Archaeology is national, so it cannot enter a particular city economy.
   * Apply the same active-building -> nation/wonder -> policy percentage stages
   * exactly once, then add the result to the authoritative national total.
   */
  private applyArchaeologicalCultureModifiers(nationId: string, baseCulture: number): number {
    if (baseCulture <= 0) return 0;
    let culture = applyBuildingCulturePercentages(
      baseCulture,
      nationId,
      this.cityManager,
      this.turnManager.getCurrentRound(),
    );
    const nationPercent = this.getNationModifiers(nationId).culturePercent;
    if (nationPercent !== undefined) culture = Math.floor(culture * (1 + nationPercent / 100));
    return applyPercent(culture, this.getPolicyPercent(nationId, 'culturePercent'));
  }

  private calculateNationGoldPerTurn(
    nation: Nation,
    cities: City[],
    lookup: (cityId: string) => CityBuildings,
    nationModifiers: Readonly<ModifierSet>,
  ): number {
    const baseGoldPerTurn = cities.reduce((sum, city) => {
      const economy = this.calculateIntegratedEconomyForCity(city, nationModifiers);
      return sum + economy.gold;
    }, 0);

    return baseGoldPerTurn
      + this.getTradeGoldPerTurnDelta(nation.id)
      + this.historicalGold(nation.id, this.getManufacturedGoldPerTurn(nation.id));
  }

  private calculateEconomyForCity(
    city: City,
    nationModifiers: Readonly<ModifierSet>,
    buildings: CityBuildings = this.cityManager.getBuildings(city.id),
  ): CityEconomySummary {
    return calculateCityEconomy(
      city,
      this.mapData,
      buildings,
      this.gridSystem,
      nationModifiers,
    );
  }

  private calculateIntegratedEconomyForCity(
    city: City,
    nationModifiers: Readonly<ModifierSet>,
    maritimeFoodBonus = 0,
    manufacturedProductionBonus = 0,
    buildings: CityBuildings = this.cityManager.getBuildings(city.id),
  ): CityEconomySummary {
    const economy = this.applyFlatProduction(
      this.applyCityEnergyProductionMultiplier(
        city,
        this.applyCityIntegrationMultiplier(
          city,
          this.applyPolicyEconomyModifiers(
            city.ownerId,
            this.applyMaritimeFood(this.calculateEconomyForCity(city, nationModifiers, buildings), maritimeFoodBonus),
          ),
        ),
      ),
      manufacturedProductionBonus,
    );
    return { ...economy, gold: this.historicalGold(city.ownerId, economy.gold) };
  }

  /**
   * Fold a flat Maritime Goods Food bonus into a city economy. It behaves like
   * any other flat Food source: it raises Food and net Food, feeding the normal
   * food-storage / growth loop without touching population capacity.
   */
  private applyMaritimeFood(economy: CityEconomySummary, bonus: number): CityEconomySummary {
    if (bonus <= 0) return economy;
    return { ...economy, food: economy.food + bonus, netFood: economy.netFood + bonus };
  }

  /**
   * Fold a manufactured-resource Production bonus into final city Production.
   * Applied after all percentage multipliers so the total Production assigned
   * across cities equals the calculated national bonus, then flows through the
   * normal production progress like any other Production.
   */
  private applyFlatProduction(economy: CityEconomySummary, bonus: number): CityEconomySummary {
    if (bonus <= 0) return economy;
    return { ...economy, production: economy.production + bonus };
  }

  private getCityPopulationCapacity(cityId: string): number {
    return this.cityEnergyProvider?.getCityPopulationCapacity(cityId) ?? Number.POSITIVE_INFINITY;
  }

  private applyCityEnergyProductionMultiplier(
    city: City,
    economy: CityEconomySummary,
  ): CityEconomySummary {
    const multiplier = this.cityEnergyProvider?.getCityProductionMultiplier(city.id) ?? 1;
    if (multiplier === 1) return economy;
    return { ...economy, production: economy.production * multiplier };
  }

  private updateEnergyShortage(city: City, capacity: number): void {
    if (city.population < capacity) {
      if (city.energyShortageTurns !== undefined) {
        city.energyShortageTurns = undefined;
        this.cityEnergyLog(
          city.ownerId,
          `[Energy] Energy shortage resolved in ${city.name}; population ${city.population}, capacity ${capacity}.`,
        );
      }
      return;
    }

    if (city.energyShortageTurns === undefined) {
      city.energyShortageTurns = 1;
      this.cityEnergyLog(
        city.ownerId,
        `[Energy] Energy shortage began in ${city.name}; population ${city.population}, capacity ${capacity}.`,
      );
      return;
    }

    city.energyShortageTurns += 1;
    // At the exact capacity limit, growth is blocked and unhappiness continues
    // to accumulate, but population decline remains exclusive to true over-cap.
    if (city.population <= capacity) return;
    const firstDeclineTurn = ENERGY_SHORTAGE_GRACE_TURNS + ENERGY_SHORTAGE_DECLINE_INTERVAL;
    if (
      city.energyShortageTurns < firstDeclineTurn
      || city.energyShortageTurns % ENERGY_SHORTAGE_DECLINE_INTERVAL !== 0
    ) return;

    city.population -= 1;
    this.refreshCityPopulationEffects(city);
    this.cityEnergyLog(
      city.ownerId,
      `[Energy] ${city.name} lost 1 population to energy shortage; population ${city.population}, capacity ${capacity}.`,
    );

    if (city.population < capacity) {
      city.energyShortageTurns = undefined;
      this.cityEnergyLog(
        city.ownerId,
        `[Energy] Energy shortage resolved in ${city.name}; population ${city.population}, capacity ${capacity}.`,
      );
    }
  }

  private refreshCityPopulationEffects(city: City): void {
    this.cityTerritorySystem.updateWorkedTiles(city, this.mapData);
    this.cityTerritorySystem.refreshNextExpansionTile(city, this.mapData);
    this.happinessSystem.recalculateNation(city.ownerId);
  }

  private applyCityIntegrationMultiplier(city: City, economy: CityEconomySummary): CityEconomySummary {
    const round = this.turnManager.getCurrentRound();
    return {
      ...economy,
      gold: applyCityIntegrationOutput(economy.gold, city, round),
      production: applyCityIntegrationOutput(economy.production, city, round),
      science: applyCityIntegrationOutput(economy.science, city, round),
      culture: applyCityIntegrationOutput(economy.culture, city, round),
    };
  }

  private applyPolicyEconomyModifiers(
    nationId: string,
    economy: CityEconomySummary,
  ): CityEconomySummary {
    return {
      ...economy,
      production: applyPercent(
        economy.production + this.getPolicyFlat(nationId, 'productionFlatPerCity'),
        this.getPolicyPercent(nationId, 'productionPercent'),
      ),
      culture: applyPercent(
        economy.culture + this.getPolicyFlat(nationId, 'cultureFlatPerCity'),
        this.getPolicyPercent(nationId, 'culturePercent'),
      ),
      gold: applyPercent(
        economy.gold + this.getPolicyFlat(nationId, 'goldFlatPerCity'),
        this.getPolicyPercent(nationId, 'goldPercent'),
      ),
      science: applyPercent(
        economy.science + this.getPolicyFlat(nationId, 'scienceFlatPerCity'),
        this.getPolicyPercent(nationId, 'sciencePercent'),
      ),
    };
  }

  private getPolicyFlat(nationId: string, type: Parameters<PolicySystem['getFlatModifierTotal']>[1]): number {
    return this.policySystem?.getFlatModifierTotal(nationId, type) ?? 0;
  }

  private getPolicyPercent(nationId: string, type: Parameters<PolicySystem['getPercentModifierTotal']>[1]): number {
    return this.policySystem?.getPercentModifierTotal(nationId, type) ?? 0;
  }

  private advanceRecurringCulturalSphere(city: City): void {
    if (!this.culturalSphereSystem || !this.wonderSystem) return;

    const rate = this.culturalSphereSystem.getRecurringCulturalExpansionRate(city, {
      cityManager: this.cityManager,
      wonderSystem: this.wonderSystem,
    });
    city.culturalSphereProgress += this.culturalSphereSystem.getRecurringCulturalProgressGain(rate);

    const result = this.culturalSphereSystem.tryClaimNextRecurringCultureTile(
      city,
      this.mapData,
      this.gridSystem,
    );
    if (result.claimedTiles + result.convertedTiles > 0) {
      this.onCultureLayerChanged();
    }
  }
}

function applyPercent(value: number, percent: number): number {
  const multiplier = Math.max(0, 1 + (percent / 100));
  return Math.round(value * multiplier);
}
