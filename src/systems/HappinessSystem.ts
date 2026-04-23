import { getBuildingById } from '../data/buildings';
import { NationHappiness, type HappinessBreakdown } from '../entities/NationHappiness';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';

export const BASE_HAPPINESS = 6;
export const CITY_UNHAPPINESS = 3;
export const POPULATION_UNHAPPINESS = 1;
export const NO_PENALTY_THRESHOLD = 0;
export const SEVERE_UNHAPPINESS_THRESHOLD = -10;
export const NORMAL_GROWTH_MODIFIER = 1.0;
export const REDUCED_GROWTH_MODIFIER = 0.5;
export const STOPPED_GROWTH_MODIFIER = 0.0;
export const NORMAL_PRODUCTION_MODIFIER = 1.0;
export const REDUCED_PRODUCTION_MODIFIER = 0.75;

export type HappinessChangedListener = (nationId: string, state: Readonly<NationHappiness>) => void;

export class HappinessSystem {
  private readonly states = new Map<string, NationHappiness>();
  private readonly listeners: HappinessChangedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly getNationModifiers: (nationId: string) => Readonly<ModifierSet> = () => EMPTY_MODIFIERS,
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
    const buildingHappiness = cities.reduce((sum, city) => (
      sum + this.cityManager.getBuildings(city.id).getAll()
        .reduce((buildingSum, buildingId) => (
          buildingSum + (getBuildingById(buildingId)?.modifiers.happinessPerTurn ?? 0)
        ), 0)
    ), 0);
    const policyHappiness = nationModifiers.happinessPerTurn ?? 0;

    const breakdown: HappinessBreakdown = {
      baseHappiness: BASE_HAPPINESS,
      buildingHappiness,
      policyHappiness,
      cityUnhappiness: cities.length * CITY_UNHAPPINESS,
      populationUnhappiness: totalPopulation * POPULATION_UNHAPPINESS,
    };
    const totalHappiness = breakdown.baseHappiness + breakdown.buildingHappiness + breakdown.policyHappiness;
    const totalUnhappiness = breakdown.cityUnhappiness + breakdown.populationUnhappiness;
    const netHappiness = totalHappiness - totalUnhappiness;

    state.totalHappiness = totalHappiness;
    state.totalUnhappiness = totalUnhappiness;
    state.netHappiness = netHappiness;
    state.breakdown = breakdown;

    if (netHappiness >= NO_PENALTY_THRESHOLD) {
      state.growthModifier = NORMAL_GROWTH_MODIFIER;
      state.productionModifier = NORMAL_PRODUCTION_MODIFIER;
    } else if (netHappiness > SEVERE_UNHAPPINESS_THRESHOLD) {
      state.growthModifier = REDUCED_GROWTH_MODIFIER;
      state.productionModifier = NORMAL_PRODUCTION_MODIFIER;
    } else {
      state.growthModifier = STOPPED_GROWTH_MODIFIER;
      state.productionModifier = REDUCED_PRODUCTION_MODIFIER;
    }

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

  getGrowthModifier(nationId: string): number {
    return this.getNationState(nationId).growthModifier;
  }

  getProductionModifier(nationId: string): number {
    return this.getNationState(nationId).productionModifier;
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
  breakdown: HappinessBreakdown;
  growthModifier: number;
  productionModifier: number;
} {
  return {
    totalHappiness: state.totalHappiness,
    totalUnhappiness: state.totalUnhappiness,
    netHappiness: state.netHappiness,
    breakdown: { ...state.breakdown },
    growthModifier: state.growthModifier,
    productionModifier: state.productionModifier,
  };
}

function statesEqual(
  previous: ReturnType<typeof snapshotState>,
  next: NationHappiness,
): boolean {
  return previous.totalHappiness === next.totalHappiness
    && previous.totalUnhappiness === next.totalUnhappiness
    && previous.netHappiness === next.netHappiness
    && previous.growthModifier === next.growthModifier
    && previous.productionModifier === next.productionModifier
    && previous.breakdown.baseHappiness === next.breakdown.baseHappiness
    && previous.breakdown.buildingHappiness === next.breakdown.buildingHappiness
    && previous.breakdown.policyHappiness === next.breakdown.policyHappiness
    && previous.breakdown.cityUnhappiness === next.breakdown.cityUnhappiness
    && previous.breakdown.populationUnhappiness === next.breakdown.populationUnhappiness;
}
