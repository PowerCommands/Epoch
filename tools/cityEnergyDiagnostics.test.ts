import assert from 'node:assert/strict';
import test from 'node:test';

import { getPowerPlantMetadata, POWER_PLANTS } from '../src/data/powerPlants.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import {
  buildCityEnergyDiagnostics,
  formatCityEnergyDiagnostics,
} from '../src/systems/CityEnergyDiagnostics.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import type { CityPowerPlantState } from '../src/systems/PowerPlantSystem.ts';

function makeCity(id: string, name: string, population: number, shortage?: number): City {
  const city = new City({ id, name, ownerId: 'active', tileX: 0, tileY: 0 });
  city.population = population;
  city.energyShortageTurns = shortage;
  return city;
}

function plantState(cityId: string, buildingId: string, age: number): CityPowerPlantState {
  const metadata = getPowerPlantMetadata(buildingId);
  assert.ok(metadata);
  return {
    cityId,
    buildingId,
    requiredResourceId: metadata.requiredResourceId,
    age,
    lifespan: metadata.lifespanTurns,
    remainingLifespan: metadata.lifespanTurns - age,
    active: true,
  };
}

test('city energy diagnostics use canonical plant state and aggregate every configured type', () => {
  const nation = new Nation({ id: 'active', name: 'England', color: 0xffffff });
  const cities = [
    makeCity('none', 'London', 24),
    makeCity('coal', 'York', 18),
    makeCity('oil', 'Bristol', 20),
    makeCity('gas', 'Leeds', 23, 0),
    makeCity('nuclear', 'Oxford', 31, 9),
  ];
  const states = new Map<string, CityPowerPlantState>([
    ['coal', plantState('coal', 'coal_power_plant', 7)],
    ['oil', plantState('oil', 'oil_power_plant', 11)],
    ['gas', plantState('gas', 'gas_power_plant', 34)],
    ['nuclear', plantState('nuclear', 'nuclear_plant', 88)],
  ]);
  const before = JSON.stringify(cities);

  const diagnostics = buildCityEnergyDiagnostics(
    [nation],
    () => cities,
    {
      getCityPowerPlant: (cityId) => states.get(cityId),
      getCityPopulationCapacity: (cityId) => cityId === 'none' ? 10 : 40,
    },
  );

  assert.equal(JSON.stringify(cities), before, 'diagnostic extraction mutated city state');
  assert.equal(diagnostics.length, 1);
  const summary = diagnostics[0];
  assert.equal(summary.population, 116);
  assert.equal(summary.cityCount, 5);
  assert.equal(summary.plantCount, 4);
  assert.equal(summary.noPlantCount, 1);
  assert.equal(summary.energyShortageCityCount, 2);
  assert.deepEqual(summary.plantCounts.map((entry) => entry.buildingId), POWER_PLANTS.map((plant) => plant.buildingId));
  assert.deepEqual(summary.plantCounts.map((entry) => entry.count), [1, 1, 1, 1]);

  const byId = new Map(summary.cities.map((city) => [city.cityId, city]));
  assert.equal(byId.get('none')?.powerPlant, null);
  assert.equal(byId.get('coal')?.powerPlant?.name, 'Coal Power Plant');
  assert.equal(byId.get('oil')?.powerPlant?.name, 'Oil Power Plant');
  assert.equal(byId.get('gas')?.powerPlant?.name, 'Gas Power Plant');
  assert.equal(byId.get('nuclear')?.powerPlant?.name, 'Nuclear Power Plant');
  assert.equal(byId.get('gas')?.powerPlant?.age, 34);
  assert.equal(byId.get('gas')?.powerPlant?.lifespan, getPowerPlantMetadata('gas_power_plant')?.lifespanTurns);
  assert.equal(byId.get('nuclear')?.energyShortageTurns, 9);
  assert.equal(byId.get('none')?.populationCapacity, 10);
});

test('checkpoint formatting is compact, warns only for current shortages, and omits eliminated nations', () => {
  const active = new Nation({ id: 'active', name: 'England', color: 0xffffff });
  const eliminated = new Nation({ id: 'eliminated', name: 'Eliminated', color: 0x000000 });
  const nations = new NationManager();
  nations.addNation(active);
  nations.addNation(eliminated);
  nations.removeNation(eliminated.id);
  const eliminatedCity = makeCity('gone', 'Lost City', 40, 12);
  const cities = [makeCity('london', 'London', 24), makeCity('leeds', 'Leeds', 23, 0)];
  const gas = plantState('london', 'gas_power_plant', 34);

  const diagnostics = buildCityEnergyDiagnostics(
    nations.getAllNations(),
    (nationId) => nationId === 'active' ? cities : [eliminatedCity],
    {
      getCityPowerPlant: (cityId) => cityId === 'london' ? gas : undefined,
      getCityPopulationCapacity: (cityId) => cityId === 'london' ? 50 : 10,
    },
  );
  const text = formatCityEnergyDiagnostics(diagnostics).join('\n');

  assert.match(text, /\[PowerPlantDiag\] England cities=2 pop=47 plants=1/);
  assert.match(text, /Gas=1/);
  assert.match(text, /None=1 CitiesInEnergyShortage=1/);
  assert.match(text, /London pop=24 capacity=50 plant=Gas Power Plant age=34\/50 shortage=0/);
  assert.match(text, /\[PowerPlantDiag\]\[WARN\] England \/ Leeds: pop=23 capacity=10 plant=None shortage=0/);
  assert.doesNotMatch(text, /Lost City/);
});
