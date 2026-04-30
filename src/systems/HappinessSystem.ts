// TODO: Add negative happiness sources such as war weariness and overpopulation.

import { getBuildingById } from '../data/buildings';
import {
  NationHappiness,
  type HappinessState,
  type LuxuryResourceEntry,
} from '../entities/NationHappiness';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
import type { City } from '../entities/City';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';

export const BASE_HAPPINESS = 6;
export const CITY_UNHAPPINESS = 3;
export const POPULATION_UNHAPPINESS = 1;
export const FOOD_SURPLUS_PER_HAPPINESS = 1;

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
export type CityFoodSurplusProvider = (city: City) => number;

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
    private readonly getCityFoodSurplus: CityFoodSurplusProvider = () => 0,
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
    const happinessFromBuildings = cities.reduce((sum, city) => (
      sum + this.cityManager.getBuildings(city.id).getAll()
        .reduce((buildingSum, buildingId) => (
          buildingSum + (getBuildingById(buildingId)?.modifiers.happinessPerTurn ?? 0)
        ), 0)
    ), 0);
    // Nation-scope modifiers currently come only from wonders; if more
    // sources are added, split them with a dedicated getter.
    const happinessFromWonders = nationModifiers.happinessPerTurn ?? 0;

    const happinessFromBase = BASE_HAPPINESS;
    const unhappinessFromCities = cities.length * CITY_UNHAPPINESS;
    const unhappinessFromPopulation = totalPopulation * POPULATION_UNHAPPINESS;

    const luxuryEntries = sortedLuxuryEntries(this.getAvailableLuxuryResources(nationId));
    const availableLuxuryResourceIds = luxuryEntries.map((entry) => entry.resourceId);
    const totalLuxuryQuantity = luxuryEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const happinessFromLuxuryResources = totalLuxuryQuantity * HAPPINESS_PER_LUXURY_QUANTITY;
    const happinessFromFoodSurplus = cities.reduce((sum, city) => (
      sum + Math.floor(this.getCityFoodSurplus(city) / FOOD_SURPLUS_PER_HAPPINESS)
    ), 0);

    const totalHappiness = happinessFromBase
      + happinessFromBuildings
      + happinessFromWonders
      + happinessFromLuxuryResources
      + happinessFromFoodSurplus;
    const totalUnhappiness = unhappinessFromCities + unhappinessFromPopulation;
    const netHappiness = totalHappiness - totalUnhappiness;

    const tier = resolveTier(netHappiness);

    state.totalHappiness = totalHappiness;
    state.totalUnhappiness = totalUnhappiness;
    state.netHappiness = netHappiness;
    state.happinessFromBase = happinessFromBase;
    state.happinessFromBuildings = happinessFromBuildings;
    state.happinessFromWonders = happinessFromWonders;
    state.happinessFromLuxuryResources = happinessFromLuxuryResources;
    state.happinessFromFoodSurplus = happinessFromFoodSurplus;
    state.availableLuxuryResourceIds = availableLuxuryResourceIds;
    state.availableLuxuryResourceQuantities = luxuryEntries;
    state.unhappinessFromCities = unhappinessFromCities;
    state.unhappinessFromPopulation = unhappinessFromPopulation;
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
}

function snapshotState(state: NationHappiness): {
  totalHappiness: number;
  totalUnhappiness: number;
  netHappiness: number;
  happinessFromBase: number;
  happinessFromBuildings: number;
  happinessFromWonders: number;
  happinessFromLuxuryResources: number;
  happinessFromFoodSurplus: number;
  availableLuxuryResourceIds: string[];
  availableLuxuryResourceQuantities: LuxuryResourceEntry[];
  unhappinessFromCities: number;
  unhappinessFromPopulation: number;
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
    happinessFromFoodSurplus: state.happinessFromFoodSurplus,
    availableLuxuryResourceIds: [...state.availableLuxuryResourceIds],
    availableLuxuryResourceQuantities: state.availableLuxuryResourceQuantities.map((entry) => ({ ...entry })),
    unhappinessFromCities: state.unhappinessFromCities,
    unhappinessFromPopulation: state.unhappinessFromPopulation,
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
    && previous.happinessFromFoodSurplus === next.happinessFromFoodSurplus
    && previous.unhappinessFromCities === next.unhappinessFromCities
    && previous.unhappinessFromPopulation === next.unhappinessFromPopulation
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
