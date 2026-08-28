// TODO: Add negative happiness sources such as war weariness and overpopulation.

import { getBuildingById } from '../data/buildings';
import {
  NationHappiness,
  type HappinessState,
  type LuxuryResourceEntry,
} from '../entities/NationHappiness';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import type { PolicySystem } from './PolicySystem';
import { applyCityIntegrationOutput } from './CityIntegrationSystem';

export const BASE_HAPPINESS = 6;
export const CITY_UNHAPPINESS = 1;
export const POPULATION_UNHAPPINESS = 0.5;

/**
 * Each unit of usable luxury resource quantity (1 per tile, 2 with the
 * matching improvement) contributes this much happiness. Keeping this as
 * a coefficient so future tuning is a one-liner.
 */
export const HAPPINESS_PER_LUXURY_QUANTITY = 2;

export type HappinessChangedListener = (nationId: string, state: Readonly<NationHappiness>) => void;
export type AvailableLuxuryResourcesProvider = (
  nationId: string,
) => ReadonlyArray<LuxuryResourceEntry>;
export type CultureHappinessProvider = (nationId: string) => number;
export type CorporationHappinessProvider = (nationId: string) => number;
export type ManufacturedResourceHappinessProvider = (nationId: string) => number;
export type MilitaryUnhappinessProvider = (nationId: string) => number;
export type CityCountPressureProvider = (nationId: string) => number;
export type DistancePressureProvider = (nationId: string) => number;
export type ConqueredCityUnhappinessProvider = (nationId: string) => number;
export type WarWearinessProvider = (nationId: string) => number;

interface TierResult {
  state: HappinessState;
  growthModifier: number;
  productionModifier: number;
  cultureModifier: number;
  goldModifier: number;
}

function resolveTier(netHappiness: number): TierResult {
  if (netHappiness >= 30) {
    return {
      state: 'golden_age',
      growthModifier: 1.15,
      productionModifier: 1.10,
      cultureModifier: 1.15,
      goldModifier: 1.15,
    };
  }
  if (netHappiness >= 15) {
    return {
      state: 'prosperous',
      growthModifier: 1.10,
      productionModifier: 1.0,
      cultureModifier: 1.10,
      goldModifier: 1.10,
    };
  }
  if (netHappiness >= 5) {
    return {
      state: 'happy',
      growthModifier: 1.05,
      productionModifier: 1.0,
      cultureModifier: 1.05,
      goldModifier: 1.0,
    };
  }
  if (netHappiness >= 0) {
    return {
      state: 'stable',
      growthModifier: 1.0,
      productionModifier: 1.0,
      cultureModifier: 1.0,
      goldModifier: 1.0,
    };
  }
  if (netHappiness >= -4) {
    return {
      state: 'unhappy',
      growthModifier: 0.75,
      productionModifier: 1.0,
      cultureModifier: 1.0,
      goldModifier: 1.0,
    };
  }
  if (netHappiness >= -9) {
    return {
      state: 'very_unhappy',
      growthModifier: 0.50,
      productionModifier: 0.90,
      cultureModifier: 1.0,
      goldModifier: 1.0,
    };
  }
  if (netHappiness >= -19) {
    return {
      state: 'unrest',
      growthModifier: 0.0,
      productionModifier: 0.75,
      cultureModifier: 0.75,
      goldModifier: 1.0,
    };
  }
  return {
    state: 'crisis',
    growthModifier: 0.0,
    productionModifier: 0.50,
    cultureModifier: 0.50,
    goldModifier: 0.75,
  };
}

export class HappinessSystem {
  private readonly states = new Map<string, NationHappiness>();
  private readonly listeners: HappinessChangedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly getNationModifiers: (nationId: string) => Readonly<ModifierSet> = () => EMPTY_MODIFIERS,
    private readonly getAvailableLuxuryResources: AvailableLuxuryResourcesProvider = () => [],
    private readonly policySystem?: PolicySystem,
    private readonly getCultureHappinessBonus: CultureHappinessProvider = () => 0,
    private readonly getCorporationHappinessBonus: CorporationHappinessProvider = () => 0,
    private readonly getManufacturedResourceHappinessBonus: ManufacturedResourceHappinessProvider = () => 0,
    private readonly getMilitaryUnhappiness: MilitaryUnhappinessProvider = () => 0,
    private readonly getCityCountPressure: CityCountPressureProvider = () => 0,
    private readonly getDistancePressure: DistancePressureProvider = () => 0,
    private readonly getConqueredCityUnhappiness: ConqueredCityUnhappinessProvider = () => 0,
    private readonly getWarWeariness: WarWearinessProvider = () => 0,
    private readonly getCurrentRound: () => number = () => 0,
  ) {
    this.recalculateAll();
  }

  onChanged(listener: HappinessChangedListener): void {
    this.listeners.push(listener);
  }

  recalculateNation(nationId: string): void {
    const state = this.getOrCreateState(nationId);
    const previous = snapshotState(state);
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const totalPopulation = cities.reduce((sum, city) => sum + city.population, 0);
    const nationModifiers = this.getNationModifiers(nationId);
    // Building Happiness obeys the same occupation/recovery integration model as
    // every other city output: an Occupied city contributes 0%, a Recovering
    // city 50%, and an Integrated city 100%. This prevents a freshly conquered
    // city from becoming an immediate national Happiness windfall while its own
    // recently-conquered penalty is applied separately below.
    const currentRound = this.getCurrentRound();
    const happinessFromBuildings = cities.reduce((sum, city) => {
      const cityBuildingHappiness = this.cityManager.getBuildings(city.id).getAll()
        .reduce((buildingSum, buildingId) => (
          buildingSum + (getBuildingById(buildingId)?.modifiers.happinessPerTurn ?? 0)
        ), 0);
      return sum + applyCityIntegrationOutput(cityBuildingHappiness, city, currentRound);
    }, 0);
    // Nation-scope modifiers currently come only from wonders; if more
    // sources are added, split them with a dedicated getter.
    const happinessFromWonders = nationModifiers.happinessPerTurn ?? 0;

    const happinessFromBase = BASE_HAPPINESS;

    const luxuryEntries = sortedLuxuryEntries(this.getAvailableLuxuryResources(nationId));
    const availableLuxuryResourceIds = luxuryEntries.map((entry) => entry.resourceId);
    const totalLuxuryQuantity = luxuryEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const happinessFromLuxuryResources = totalLuxuryQuantity * HAPPINESS_PER_LUXURY_QUANTITY;
    const happinessFromPolicies =
      this.getPolicyFlat(nationId, 'happinessFlat')
      + (this.getPolicyFlat(nationId, 'happinessPerCity') * cities.length)
      + (this.getPolicyFlat(nationId, 'happinessPerLuxuryResource') * availableLuxuryResourceIds.length);
    const happinessFromCultureEffects = this.getCultureHappinessBonus(nationId);
    const happinessFromCorporations = this.getCorporationHappinessBonus(nationId);
    const happinessFromManufacturedResources = this.getManufacturedResourceHappinessBonus(nationId);

    const totalHappiness = happinessFromBase
      + happinessFromBuildings
      + happinessFromWonders
      + happinessFromLuxuryResources
      + happinessFromPolicies
      + happinessFromCultureEffects
      + happinessFromCorporations
      + happinessFromManufacturedResources;
    const baseUnhappinessFromCities = cities.length * CITY_UNHAPPINESS;
    const policyCityUnhappinessPerCity = this.getPolicyFlat(nationId, 'unhappinessPerCityFlat');
    const adjustedUnhappinessPerCity = Math.max(0, CITY_UNHAPPINESS + policyCityUnhappinessPerCity);
    const adjustedUnhappinessFromCities = cities.length * adjustedUnhappinessPerCity;
    const unhappinessFromPolicyCityModifiers = adjustedUnhappinessFromCities - baseUnhappinessFromCities;
    const baseUnhappinessFromPopulation = totalPopulation * POPULATION_UNHAPPINESS;
    const populationUnhappinessMultiplier = Math.max(
      0,
      1 + (this.getPolicyPercent(nationId, 'unhappinessPerPopulationPercent') / 100),
    );
    const adjustedUnhappinessFromPopulation = Math.round(
      baseUnhappinessFromPopulation * populationUnhappinessMultiplier,
    );
    const unhappinessFromPolicyPopulationModifiers =
      adjustedUnhappinessFromPopulation - baseUnhappinessFromPopulation;
    const unhappinessFromMilitary = this.getMilitaryUnhappiness(nationId);
    const unhappinessFromCityCountPressure = this.getCityCountPressure(nationId);
    const unhappinessFromDistancePressure = this.getDistancePressure(nationId);
    const unhappinessFromConqueredCities = this.getConqueredCityUnhappiness(nationId);
    const unhappinessFromWarWeariness = this.getWarWeariness(nationId);
    const totalUnhappiness = adjustedUnhappinessFromCities
      + adjustedUnhappinessFromPopulation
      + unhappinessFromMilitary
      + unhappinessFromCityCountPressure
      + unhappinessFromDistancePressure
      + unhappinessFromConqueredCities
      + unhappinessFromWarWeariness;
    const netHappiness = totalHappiness - totalUnhappiness;

    const tier = resolveTier(netHappiness);

    state.totalHappiness = totalHappiness;
    state.totalUnhappiness = totalUnhappiness;
    state.netHappiness = netHappiness;
    state.happinessFromBase = happinessFromBase;
    state.happinessFromBuildings = happinessFromBuildings;
    state.happinessFromWonders = happinessFromWonders;
    state.happinessFromLuxuryResources = happinessFromLuxuryResources;
    state.happinessFromPolicies = happinessFromPolicies;
    state.happinessFromCultureEffects = happinessFromCultureEffects;
    state.happinessFromCorporations = happinessFromCorporations;
    state.happinessFromManufacturedResources = happinessFromManufacturedResources;
    state.availableLuxuryResourceIds = availableLuxuryResourceIds;
    state.availableLuxuryResourceQuantities = luxuryEntries;
    state.unhappinessFromCities = adjustedUnhappinessFromCities;
    state.unhappinessFromPopulation = adjustedUnhappinessFromPopulation;
    state.unhappinessFromMilitary = unhappinessFromMilitary;
    state.unhappinessFromCityCountPressure = unhappinessFromCityCountPressure;
    state.unhappinessFromDistancePressure = unhappinessFromDistancePressure;
    state.unhappinessFromConqueredCities = unhappinessFromConqueredCities;
    state.unhappinessFromWarWeariness = unhappinessFromWarWeariness;
    state.unhappinessFromPolicyCityModifiers = unhappinessFromPolicyCityModifiers;
    state.unhappinessFromPolicyPopulationModifiers = unhappinessFromPolicyPopulationModifiers;
    state.state = tier.state;
    state.growthModifier = tier.growthModifier;
    state.productionModifier = tier.productionModifier;
    state.cultureModifier = tier.cultureModifier;
    state.goldModifier = tier.goldModifier;

    if (!statesEqual(previous, state)) {
      this.notifyChanged(nationId, state);
    }
  }

  recalculateAll(): void {
    for (const nation of this.nationManager.getAllNations()) {
      this.recalculateNation(nation.id);
    }
  }

  getNationState(nationId: string): Readonly<NationHappiness> {
    return this.getOrCreateState(nationId);
  }

  getNetHappiness(nationId: string): number {
    return this.getNationState(nationId).netHappiness;
  }

  getHappinessForNation(nationId: string): number {
    return this.getNationState(nationId).netHappiness;
  }

  getGrowthModifier(nationId: string): number {
    return this.getNationState(nationId).growthModifier;
  }

  getProductionModifier(nationId: string): number {
    return this.getNationState(nationId).productionModifier;
  }

  getCultureModifier(nationId: string): number {
    return this.getNationState(nationId).cultureModifier;
  }

  getGoldModifier(nationId: string): number {
    return this.getNationState(nationId).goldModifier;
  }

  private getOrCreateState(nationId: string): NationHappiness {
    let state = this.states.get(nationId);
    if (!state) {
      state = new NationHappiness(nationId);
      this.states.set(nationId, state);
    }
    return state;
  }

  private notifyChanged(nationId: string, state: NationHappiness): void {
    for (const listener of this.listeners) {
      listener(nationId, state);
    }
  }

  private getPolicyFlat(nationId: string, type: Parameters<PolicySystem['getFlatModifierTotal']>[1]): number {
    return this.policySystem?.getFlatModifierTotal(nationId, type) ?? 0;
  }

  private getPolicyPercent(nationId: string, type: Parameters<PolicySystem['getPercentModifierTotal']>[1]): number {
    return this.policySystem?.getPercentModifierTotal(nationId, type) ?? 0;
  }
}

function snapshotState(state: NationHappiness): {
  totalHappiness: number;
  totalUnhappiness: number;
  netHappiness: number;
  happinessFromBase: number;
  happinessFromBuildings: number;
  happinessFromWonders: number;
  happinessFromLuxuryResources: number;
  happinessFromPolicies: number;
  happinessFromCultureEffects: number;
  happinessFromCorporations: number;
  happinessFromManufacturedResources: number;
  availableLuxuryResourceIds: string[];
  availableLuxuryResourceQuantities: LuxuryResourceEntry[];
  unhappinessFromCities: number;
  unhappinessFromPopulation: number;
  unhappinessFromMilitary: number;
  unhappinessFromCityCountPressure: number;
  unhappinessFromDistancePressure: number;
  unhappinessFromConqueredCities: number;
  unhappinessFromWarWeariness: number;
  unhappinessFromPolicyCityModifiers: number;
  unhappinessFromPolicyPopulationModifiers: number;
  state: HappinessState;
  growthModifier: number;
  productionModifier: number;
  cultureModifier: number;
  goldModifier: number;
} {
  return {
    totalHappiness: state.totalHappiness,
    totalUnhappiness: state.totalUnhappiness,
    netHappiness: state.netHappiness,
    happinessFromBase: state.happinessFromBase,
    happinessFromBuildings: state.happinessFromBuildings,
    happinessFromWonders: state.happinessFromWonders,
    happinessFromLuxuryResources: state.happinessFromLuxuryResources,
    happinessFromPolicies: state.happinessFromPolicies,
    happinessFromCultureEffects: state.happinessFromCultureEffects,
    happinessFromCorporations: state.happinessFromCorporations,
    happinessFromManufacturedResources: state.happinessFromManufacturedResources,
    availableLuxuryResourceIds: [...state.availableLuxuryResourceIds],
    availableLuxuryResourceQuantities: state.availableLuxuryResourceQuantities.map((entry) => ({ ...entry })),
    unhappinessFromCities: state.unhappinessFromCities,
    unhappinessFromPopulation: state.unhappinessFromPopulation,
    unhappinessFromMilitary: state.unhappinessFromMilitary,
    unhappinessFromCityCountPressure: state.unhappinessFromCityCountPressure,
    unhappinessFromDistancePressure: state.unhappinessFromDistancePressure,
    unhappinessFromConqueredCities: state.unhappinessFromConqueredCities,
    unhappinessFromWarWeariness: state.unhappinessFromWarWeariness,
    unhappinessFromPolicyCityModifiers: state.unhappinessFromPolicyCityModifiers,
    unhappinessFromPolicyPopulationModifiers: state.unhappinessFromPolicyPopulationModifiers,
    state: state.state,
    growthModifier: state.growthModifier,
    productionModifier: state.productionModifier,
    cultureModifier: state.cultureModifier,
    goldModifier: state.goldModifier,
  };
}

function statesEqual(
  previous: ReturnType<typeof snapshotState>,
  next: NationHappiness,
): boolean {
  return previous.totalHappiness === next.totalHappiness
    && previous.totalUnhappiness === next.totalUnhappiness
    && previous.netHappiness === next.netHappiness
    && previous.state === next.state
    && previous.growthModifier === next.growthModifier
    && previous.productionModifier === next.productionModifier
    && previous.cultureModifier === next.cultureModifier
    && previous.goldModifier === next.goldModifier
    && previous.happinessFromBase === next.happinessFromBase
    && previous.happinessFromBuildings === next.happinessFromBuildings
    && previous.happinessFromWonders === next.happinessFromWonders
    && previous.happinessFromLuxuryResources === next.happinessFromLuxuryResources
    && previous.happinessFromPolicies === next.happinessFromPolicies
    && previous.happinessFromCultureEffects === next.happinessFromCultureEffects
    && previous.happinessFromCorporations === next.happinessFromCorporations
    && previous.happinessFromManufacturedResources === next.happinessFromManufacturedResources
    && previous.unhappinessFromCities === next.unhappinessFromCities
    && previous.unhappinessFromPopulation === next.unhappinessFromPopulation
    && previous.unhappinessFromMilitary === next.unhappinessFromMilitary
    && previous.unhappinessFromCityCountPressure === next.unhappinessFromCityCountPressure
    && previous.unhappinessFromDistancePressure === next.unhappinessFromDistancePressure
    && previous.unhappinessFromConqueredCities === next.unhappinessFromConqueredCities
    && previous.unhappinessFromWarWeariness === next.unhappinessFromWarWeariness
    && previous.unhappinessFromPolicyCityModifiers === next.unhappinessFromPolicyCityModifiers
    && previous.unhappinessFromPolicyPopulationModifiers === next.unhappinessFromPolicyPopulationModifiers
    && stringArraysEqual(previous.availableLuxuryResourceIds, next.availableLuxuryResourceIds)
    && luxuryEntriesEqual(previous.availableLuxuryResourceQuantities, next.availableLuxuryResourceQuantities);
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function luxuryEntriesEqual(
  a: ReadonlyArray<LuxuryResourceEntry>,
  b: ReadonlyArray<LuxuryResourceEntry>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].resourceId !== b[i].resourceId) return false;
    if (a[i].quantity !== b[i].quantity) return false;
  }
  return true;
}

function sortedLuxuryEntries(
  entries: ReadonlyArray<LuxuryResourceEntry>,
): LuxuryResourceEntry[] {
  // Dedupe by resourceId (sum quantities) and sort for stable output.
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    totals.set(entry.resourceId, (totals.get(entry.resourceId) ?? 0) + entry.quantity);
  }
  return Array.from(totals.entries())
    .map(([resourceId, quantity]) => ({ resourceId, quantity }))
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
}
