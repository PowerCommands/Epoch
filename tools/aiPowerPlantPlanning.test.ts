import assert from 'node:assert/strict';
import test from 'node:test';

import { POWER_PLANTS, getPowerPlantMetadata } from '../src/data/powerPlants.ts';
import {
  planAIPowerPlants,
  type AIPowerPlantCityPlanningInput,
} from '../src/systems/ai/AIPowerPlantPlanning.ts';
import type { CityPowerPlantState } from '../src/systems/PowerPlantSystem.ts';

const ALL_RESOURCES = Object.fromEntries(POWER_PLANTS.map((plant) => [plant.requiredResourceId, 1]));

function plant(
  buildingId: string,
  options: { active?: boolean; remaining?: number } = {},
): CityPowerPlantState {
  const metadata = getPowerPlantMetadata(buildingId)!;
  const remaining = options.remaining ?? metadata.lifespanTurns;
  return {
    cityId: 'unused',
    buildingId,
    requiredResourceId: metadata.requiredResourceId,
    age: metadata.lifespanTurns - remaining,
    lifespan: metadata.lifespanTurns,
    remainingLifespan: remaining,
    active: options.active ?? true,
    inactiveReason: options.active === false ? 'missing_resource' : undefined,
  };
}

function city(
  id: string,
  population: number,
  currentPlant?: CityPowerPlantState,
  queuedPowerPlantIds: readonly string[] = [],
  currentCapacity?: number,
): AIPowerPlantCityPlanningInput {
  return { id, name: id, population, currentPlant, currentCapacity, queuedPowerPlantIds, productionAvailable: queuedPowerPlantIds.length === 0 };
}

function plan(options: {
  cities: readonly AIPowerPlantCityPlanningInput[];
  resources?: Record<string, number>;
  unlocked?: readonly string[];
  turns?: number;
  isHuman?: boolean;
}) {
  const unlocked = new Set(options.unlocked ?? POWER_PLANTS.map((entry) => entry.buildingId));
  return planAIPowerPlants({
    nationId: 'ai',
    isHuman: options.isHuman,
    cities: options.cities,
    getResourceCapacity: (resourceId) => options.resources?.[resourceId] ?? ALL_RESOURCES[resourceId] ?? 0,
    canConstruct: (_cityId, buildingId) => unlocked.has(buildingId),
    estimateConstructionTurns: () => options.turns ?? 4,
  });
}

test('first plant is ignored for a small city, considered near 6, and urgent at capacity', () => {
  assert.equal(plan({ cities: [city('small', 3)] }).size, 0);
  assert.equal(plan({ cities: [city('near', 4)] }).get('near')?.reason, 'first_plant_approaching_capacity');
  const shortage = plan({ cities: [city('short', 7)] }).get('short');
  assert.equal(shortage?.reason, 'energy_shortage');
  assert.ok((shortage?.score ?? 0) >= 100);
});

test('sanitation infrastructure shares the planner and becomes urgent only at or near the current cap', () => {
  assert.equal(plan({ cities: [city('small', 3, undefined, [], 6)], unlocked: ['sewers', 'aqueduct'] }).size, 0);
  const near = plan({ cities: [city('near', 5, undefined, [], 6)], unlocked: ['sewers'] }).get('near');
  assert.equal(near?.buildingId, 'sewers');
  assert.equal(near?.reason, 'capacity_progression_approaching');
  assert.ok((near?.score ?? 0) < 100);

  const capped = plan({ cities: [city('capped', 8, undefined, [], 8)], unlocked: ['aqueduct'] }).get('capped');
  assert.equal(capped?.buildingId, 'aqueduct');
  assert.equal(capped?.targetCapacity, 10);
  assert.equal(capped?.reason, 'capacity_progression_at_cap');
  assert.ok((capped?.score ?? 0) >= 150);
});

test('selection respects technology and resource capacity and prefers the strongest valid plant', () => {
  const techLimited = plan({
    cities: [city('a', 8)],
    unlocked: ['coal_power_plant', 'gas_power_plant'],
    resources: { coal: 1, natural_gas: 0 },
  });
  assert.equal(techLimited.get('a')?.buildingId, 'coal_power_plant');

  const strongest = plan({
    cities: [city('a', 15, plant('coal_power_plant'))],
    resources: { coal: 1, oil: 1, natural_gas: 1, uranium: 0 },
  });
  assert.equal(strongest.get('a')?.buildingId, 'gas_power_plant');
});

test('healthy plants are neither pointlessly upgraded nor downgraded', () => {
  assert.equal(plan({ cities: [city('coal', 10, plant('coal_power_plant'))] }).size, 0);
  assert.equal(plan({
    cities: [city('nuclear', 98, plant('nuclear_plant'))],
    resources: { coal: 1, oil: 1, natural_gas: 1, uranium: 1 },
  }).size, 0);
});

test('aging replacement starts within five turns or earlier for construction time', () => {
  assert.equal(plan({ cities: [city('a', 10, plant('coal_power_plant', { remaining: 6 }))], turns: 4 }).size, 0);
  assert.equal(plan({ cities: [city('a', 10, plant('coal_power_plant', { remaining: 5 }))], turns: 4 }).get('a')?.reason, 'aging_replacement');
  assert.equal(plan({ cities: [city('a', 10, plant('coal_power_plant', { remaining: 8 }))], turns: 10 }).get('a')?.reason, 'aging_replacement');
});

test('an inactive endangered city may make a useful emergency downgrade', () => {
  const result = plan({
    cities: [city('a', 13, plant('gas_power_plant', { active: false, remaining: 30 }))],
    unlocked: ['coal_power_plant', 'gas_power_plant'],
    resources: { coal: 1, natural_gas: 0 },
  });
  assert.equal(result.get('a')?.buildingId, 'coal_power_plant');
  assert.equal(result.get('a')?.reason, 'emergency_downgrade');

  assert.equal(plan({
    cities: [city('safe', 4, plant('gas_power_plant', { active: false, remaining: 30 }))],
    resources: { coal: 1, oil: 0, natural_gas: 0, uranium: 0 },
  }).size, 0);
});

test('scarce capacity is reserved once using deterministic city priority', () => {
  const scarce = { coal: 1, oil: 0, natural_gas: 0, uranium: 0 };
  const result = plan({
    cities: [city('smaller', 9), city('larger', 12)],
    resources: scarce,
    unlocked: ['coal_power_plant'],
  });
  assert.deepEqual([...result.keys()], ['larger']);

  const tie = plan({
    cities: [city('city_b', 9), city('city_a', 9)],
    resources: scarce,
    unlocked: ['coal_power_plant'],
  });
  assert.deepEqual([...tie.keys()], ['city_a']);
});

test('queued plants reserve capacity and recalculation releases changed reservations', () => {
  const scarce = { coal: 1, oil: 0, natural_gas: 0, uranium: 0 };
  const reserved = plan({
    cities: [city('building', 8, undefined, ['coal_power_plant']), city('waiting', 9)],
    resources: scarce,
    unlocked: ['coal_power_plant'],
  });
  assert.equal(reserved.has('waiting'), false);

  const released = plan({
    cities: [city('building', 8), city('waiting', 9)],
    resources: scarce,
    unlocked: ['coal_power_plant'],
  });
  assert.equal(released.has('waiting'), true);
});

test('inactive shortage never selects a replacement whose resource is unavailable', () => {
  const result = plan({
    cities: [city('a', 20, plant('coal_power_plant', { active: false }))],
    resources: { coal: 0, oil: 0, natural_gas: 1, uranium: 0 },
  });
  assert.equal(result.get('a')?.buildingId, 'gas_power_plant');
});

test('human cities never receive automatic power-plant plans', () => {
  assert.equal(plan({ cities: [city('human', 20)], isHuman: true }).size, 0);
});
