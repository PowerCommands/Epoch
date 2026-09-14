import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City';
import { CityBuildings } from '../src/entities/CityBuildings';
import { ALL_TECHNOLOGIES } from '../src/data/technologies';
import { getSettlementProgress } from '../src/systems/SettlementProgress';
import { CITY_POPULATION_CAPACITY_BONUS, URBAN_SLOTS, getSettlementStage } from '../src/systems/UrbanDevelopment';

const makeCity = () => new City({ id: 'test', name: 'Malmö', ownerId: 'human', tileX: 4, tileY: 4 });
test('progress matches completion rules and the canonical bonus', () => {
  const city = makeCity(), buildings = new CityBuildings(city.id);
  let progress = getSettlementProgress(city, buildings, () => false);
  assert.equal(progress.completed, 0);
  assert.equal(progress.populationBonus, CITY_POPULATION_CAPACITY_BONUS);
  assert.equal(progress.possible, true);
  for (const slot of URBAN_SLOTS) buildings.addEntry(slot.buildingId, true);
  progress = getSettlementProgress(city, buildings, () => false);
  assert.equal(progress.completed, 6);
  assert.equal(progress.stage, getSettlementStage(buildings, city));
  assert.equal(progress.stage, 'City');
  assert.deepEqual(progress.missingTechs, []);
});
test('coastal blueprint and upgraded damaged buildings retain completion', () => {
  const city = makeCity(), buildings = new CityBuildings(city.id);
  city.urbanDevelopment = { requirements: ['dock', 'lighthouse', 'harbor', 'water_mill', 'market', 'sewers'], waterMask: 7 };
  buildings.addEntry('seaport', true);
  const progress = getSettlementProgress(city, buildings, () => true);
  assert.equal(progress.slots[2].name, 'Harbor');
  assert.equal(progress.slots[2].complete, true);
  assert.equal(progress.slots[2].spriteId, 'seaport');
  assert.equal(progress.slots[2].broken, true);
  assert.equal(progress.possible, true);
  assert.deepEqual(progress.missingTechs, []);
});
test('blocked founding geography never suggests a reachable City', () => {
  const city = makeCity(), buildings = new CityBuildings(city.id);
  city.urbanDevelopment = { requirements: Array(6).fill(null), waterMask: 15 };
  for (const slot of URBAN_SLOTS) buildings.addEntry(slot.buildingId, false);
  const progress = getSettlementProgress(city, buildings, () => false);
  assert.equal(progress.possible, false);
  assert.equal(progress.stage, 'Village');
  assert.deepEqual(progress.missingTechs, []);
});
test('research includes unmet prerequisite chains and excludes researched technologies', () => {
  const city = makeCity(), buildings = new CityBuildings(city.id);
  const researched = new Set(['pottery', 'mining']);
  const progress = getSettlementProgress(city, buildings, id => researched.has(id));
  const missing = new Set(progress.missingTechs.map(t => t.id));
  assert.ok(missing.size > 0);
  for (const id of researched) assert.equal(missing.has(id), false);
  for (const tech of ALL_TECHNOLOGIES.filter(t => missing.has(t.id))) {
    for (const prerequisite of tech.prerequisites) assert.ok(researched.has(prerequisite) || missing.has(prerequisite));
  }
});
