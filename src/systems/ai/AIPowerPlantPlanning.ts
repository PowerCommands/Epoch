import { getBuildingById } from '../../data/buildings';
import {
  POWER_PLANTS,
  getPowerPlantMetadata,
  type PowerPlantMetadata,
} from '../../data/powerPlants';
import type { CityPowerPlantState } from '../PowerPlantSystem';

export const AI_POWER_PLANT_APPROACHING_MARGIN = 2;
export const AI_POWER_PLANT_REPLACEMENT_WINDOW = 5;
export const UNPOWERED_CITY_POPULATION_CAPACITY = 8;

export type AIPowerPlantDecisionReason =
  | 'first_plant_approaching_capacity'
  | 'energy_shortage'
  | 'aging_replacement'
  | 'capacity_upgrade'
  | 'inactive_replacement'
  | 'emergency_downgrade';

export interface AIPowerPlantCityPlanningInput {
  readonly id: string;
  readonly name: string;
  readonly population: number;
  readonly currentPlant?: CityPowerPlantState;
  readonly queuedPowerPlantIds: readonly string[];
  readonly productionAvailable: boolean;
}

export interface AIPowerPlantPlanningContext {
  readonly nationId: string;
  readonly isHuman?: boolean;
  readonly cities: readonly AIPowerPlantCityPlanningInput[];
  readonly getResourceCapacity: (resourceId: PowerPlantMetadata['requiredResourceId']) => number;
  readonly canConstruct: (cityId: string, buildingId: string) => boolean;
  readonly estimateConstructionTurns: (cityId: string, buildingId: string) => number;
}

export interface AIPowerPlantDecision {
  readonly cityId: string;
  readonly buildingId: string;
  readonly requiredResourceId: PowerPlantMetadata['requiredResourceId'];
  readonly currentCapacity: number;
  readonly score: number;
  readonly reason: AIPowerPlantDecisionReason;
  readonly remainingLifespan?: number;
}

/**
 * Creates one deterministic nation-wide plan. Resource commitments are scoped
 * to this calculation: completed plants and queued plants reserve capacity,
 * while a same-resource replacement in one city counts only once.
 */
export function planAIPowerPlants(
  context: AIPowerPlantPlanningContext,
): ReadonlyMap<string, AIPowerPlantDecision> {
  if (context.isHuman) return new Map();
  const commitments = new Map<string, Set<string>>();
  const commit = (resourceId: string, cityId: string): void => {
    const cityIds = commitments.get(resourceId) ?? new Set<string>();
    cityIds.add(cityId);
    commitments.set(resourceId, cityIds);
  };

  for (const city of context.cities) {
    if (city.currentPlant) commit(city.currentPlant.requiredResourceId, city.id);
    for (const buildingId of city.queuedPowerPlantIds) {
      const metadata = getPowerPlantMetadata(buildingId);
      if (metadata) commit(metadata.requiredResourceId, city.id);
    }
  }

  const orderedCities = context.cities
    .filter((city) => city.productionAvailable && city.queuedPowerPlantIds.length === 0)
    .slice()
    .sort(compareEnergyPriority);
  const decisions = new Map<string, AIPowerPlantDecision>();

  for (const city of orderedCities) {
    const currentCapacity = getSupportedPopulationCapacity(city.currentPlant);
    const options = POWER_PLANTS
      .slice()
      .sort((a, b) => b.futurePopulationCap - a.futurePopulationCap)
      .filter((plant) => context.canConstruct(city.id, plant.buildingId))
      .filter((plant) => hasReservableCapacity(context, commitments, city.id, plant))
      .map((plant) => evaluateOption(context, city, currentCapacity, plant))
      .filter((decision): decision is AIPowerPlantDecision => decision !== undefined);

    const choice = options[0];
    if (!choice) continue;
    decisions.set(city.id, choice);
    commit(choice.requiredResourceId, city.id);
  }

  return decisions;
}

export function getSupportedPopulationCapacity(currentPlant?: CityPowerPlantState): number {
  if (!currentPlant?.active) return UNPOWERED_CITY_POPULATION_CAPACITY;
  return getPowerPlantMetadata(currentPlant.buildingId)?.futurePopulationCap
    ?? UNPOWERED_CITY_POPULATION_CAPACITY;
}

function compareEnergyPriority(
  a: AIPowerPlantCityPlanningInput,
  b: AIPowerPlantCityPlanningInput,
): number {
  const aCapacity = getSupportedPopulationCapacity(a.currentPlant);
  const bCapacity = getSupportedPopulationCapacity(b.currentPlant);
  const shortageDelta = Number(b.population > bCapacity) - Number(a.population > aCapacity);
  if (shortageDelta !== 0) return shortageDelta;
  if (a.population !== b.population) return b.population - a.population;
  const distanceDelta = Math.abs(aCapacity - a.population) - Math.abs(bCapacity - b.population);
  return distanceDelta || a.id.localeCompare(b.id);
}

function hasReservableCapacity(
  context: AIPowerPlantPlanningContext,
  commitments: ReadonlyMap<string, ReadonlySet<string>>,
  cityId: string,
  plant: PowerPlantMetadata,
): boolean {
  const committedCities = commitments.get(plant.requiredResourceId);
  const capacity = context.getResourceCapacity(plant.requiredResourceId);
  if (committedCities?.has(cityId)) return committedCities.size <= capacity;
  return (committedCities?.size ?? 0) < capacity;
}

function evaluateOption(
  context: AIPowerPlantPlanningContext,
  city: AIPowerPlantCityPlanningInput,
  currentCapacity: number,
  candidate: PowerPlantMetadata,
): AIPowerPlantDecision | undefined {
  const current = city.currentPlant;
  const population = city.population;
  const shortage = population > currentCapacity;
  const approaching = population >= currentCapacity - AI_POWER_PLANT_APPROACHING_MARGIN;
  const turns = context.estimateConstructionTurns(city.id, candidate.buildingId);
  const aging = current !== undefined
    && current.remainingLifespan <= Math.max(AI_POWER_PLANT_REPLACEMENT_WINDOW, turns);
  const inactive = current !== undefined && !current.active;
  const candidateIsUpgrade = candidate.futurePopulationCap > currentCapacity;
  const candidateSupportsCity = candidate.futurePopulationCap >= population;

  if (!current) {
    if (!approaching) return undefined;
    return decision(city, candidate, currentCapacity, shortage ? 112 : 82,
      shortage ? 'energy_shortage' : 'first_plant_approaching_capacity');
  }

  // Healthy plants are replaced for concrete growth pressure or aging only.
  if (current.active && !aging && !approaching && !shortage) return undefined;
  if (current.active && !aging && !candidateIsUpgrade) return undefined;
  if (inactive && population < UNPOWERED_CITY_POPULATION_CAPACITY - AI_POWER_PLANT_APPROACHING_MARGIN && !aging) {
    return undefined;
  }

  // A downgrade is only useful as a bridge when the old plant cannot be
  // relied on and the replacement can actually support the present city.
  const currentMetadata = getPowerPlantMetadata(current.buildingId);
  const isDowngrade = currentMetadata !== undefined
    && candidate.futurePopulationCap < currentMetadata.futurePopulationCap;
  if (isDowngrade && (!candidateSupportsCity || (!inactive && !aging))) return undefined;

  let reason: AIPowerPlantDecisionReason;
  let score: number;
  if (isDowngrade) {
    reason = 'emergency_downgrade';
    score = shortage ? 110 : 88;
  } else if (shortage) {
    reason = 'energy_shortage';
    score = 112;
  } else if (inactive) {
    reason = 'inactive_replacement';
    score = approaching ? 96 : 76;
  } else if (aging) {
    reason = 'aging_replacement';
    const urgency = Math.max(0, Math.max(AI_POWER_PLANT_REPLACEMENT_WINDOW, turns) - current.remainingLifespan);
    score = 76 + Math.min(20, urgency * 3) + (approaching ? 8 : 0);
  } else {
    if (!candidateIsUpgrade) return undefined;
    reason = 'capacity_upgrade';
    score = 84;
  }

  return decision(city, candidate, currentCapacity, score, reason, current.remainingLifespan);
}

function decision(
  city: AIPowerPlantCityPlanningInput,
  plant: PowerPlantMetadata,
  currentCapacity: number,
  score: number,
  reason: AIPowerPlantDecisionReason,
  remainingLifespan?: number,
): AIPowerPlantDecision {
  // Guard against stale metadata pointing at a removed building definition.
  if (!getBuildingById(plant.buildingId)) throw new Error(`Missing power plant building: ${plant.buildingId}`);
  return {
    cityId: city.id,
    buildingId: plant.buildingId,
    requiredResourceId: plant.requiredResourceId,
    currentCapacity,
    score,
    reason,
    remainingLifespan,
  };
}
