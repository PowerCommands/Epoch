import { CITY_POPULATION_CAPACITY_BONUSES } from './populationCapacity';

export interface PowerPlantMetadata {
  readonly buildingId: string;
  readonly requiredResourceId: 'coal' | 'oil' | 'natural_gas' | 'uranium';
  readonly plantsPerResourceSource: 1;
  readonly lifespanTurns: number;
  /** Additive Population Capacity supplied while this plant is active. */
  readonly populationCapacityBonus: number;
  /** City production multiplier provided while this plant is active. */
  readonly futureProductionMultiplier: number;
}

export const POWER_PLANTS: readonly PowerPlantMetadata[] = [
  {
    buildingId: 'coal_power_plant',
    requiredResourceId: 'coal',
    plantsPerResourceSource: 1,
    lifespanTurns: 20,
    populationCapacityBonus: CITY_POPULATION_CAPACITY_BONUSES.coalPowerPlant,
    futureProductionMultiplier: 2,
  },
  {
    buildingId: 'oil_power_plant',
    requiredResourceId: 'oil',
    plantsPerResourceSource: 1,
    lifespanTurns: 40,
    populationCapacityBonus: CITY_POPULATION_CAPACITY_BONUSES.oilPowerPlant,
    futureProductionMultiplier: 3,
  },
  {
    buildingId: 'gas_power_plant',
    requiredResourceId: 'natural_gas',
    plantsPerResourceSource: 1,
    lifespanTurns: 50,
    populationCapacityBonus: CITY_POPULATION_CAPACITY_BONUSES.gasPowerPlant,
    futureProductionMultiplier: 4,
  },
  {
    buildingId: 'nuclear_plant',
    requiredResourceId: 'uranium',
    plantsPerResourceSource: 1,
    lifespanTurns: 100,
    populationCapacityBonus: CITY_POPULATION_CAPACITY_BONUSES.nuclearPowerPlant,
    futureProductionMultiplier: 6,
  },
];

const POWER_PLANT_BY_BUILDING_ID = new Map(
  POWER_PLANTS.map((metadata) => [metadata.buildingId, metadata]),
);

export function isPowerPlantBuilding(buildingId: string): boolean {
  return POWER_PLANT_BY_BUILDING_ID.has(buildingId);
}

export function getPowerPlantMetadata(buildingId: string): PowerPlantMetadata | undefined {
  return POWER_PLANT_BY_BUILDING_ID.get(buildingId);
}
