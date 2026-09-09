import assert from 'node:assert/strict';
import test from 'node:test';
import { NUCLEAR_POWER_PLANT, BOMB_SHELTER } from '../src/data/buildings';
import { POWER_PLANTS } from '../src/data/powerPlants';
import { nuclearPlantRoll, nuclearPlantAtRisk, nuclearPlantMaintenancePriority, NUCLEAR_PLANT_MAINTENANCE_TURNS, MAINTAIN_NUCLEAR_PLANT } from '../src/data/nuclearPlants';
import { WORKER, WARRIOR } from '../src/data/units';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { Unit } from '../src/entities/Unit';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { UnitManager } from '../src/systems/UnitManager';
import { TurnManager } from '../src/systems/TurnManager';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem';
import { StrategicWeaponsSystem, cleanNuclearWaste } from '../src/systems/StrategicWeaponsSystem';
import { BuilderSystem } from '../src/systems/BuilderSystem';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { TileType, type MapData } from '../src/types/map';

function harness(id = 'reactor', age = 0, round = 1) {
  const map: MapData = { width: 12, height: 12, tileSize: 1, tiles: Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const grid = new HexGridSystem(), cities = new CityManager(), units = new UnitManager(12, 12), nations = new NationManager();
  nations.addNation(new Nation({ id: 'a', name: 'A', color: 1 }));
  const turns = new TurnManager(nations);
  const city = new City({ id, name: 'Paris', ownerId: 'a', tileX: 5, tileY: 5 });
  city.ownedTileCoords = grid.getTilesInRange({ x: 5, y: 5 }, 3, map, { includeCenter: true }).map(t => ({ x: t.x, y: t.y }));
  for (const c of city.ownedTileCoords) map.tiles[c.y][c.x].ownerId = 'a';
  cities.addCity(city);
  const tile = map.tiles[5][5];
  const logs: string[] = [];
  const power = new PowerPlantSystem(cities, new ResourceAccessSystem(map, { getAllDeals: () => [] }), map, round, (_, message) => logs.push(message));
  power.completeConstruction(id, 'nuclear_plant');
  power.restore([{ id, powerPlantAge: age }], round);
  const worker = new Unit({ id: 'worker', name: 'Worker', ownerId: 'a', tileX: 5, tileY: 5, unitType: WORKER });
  worker.health = 100;
  units.addUnit(worker);
  const weapons = new StrategicWeaponsSystem(units, cities, map, grid);
  const blasts: unknown[] = [];
  weapons.onDetonation(e => blasts.push(e));
  power.setMeltdownEffect((owner, x, y) => { weapons.meltdown(owner, x, y); });
  const builder = new BuilderSystem(units, cities, turns, map, grid);
  builder.setPowerPlantSystem(power);
  const construction = new ImprovementConstructionSystem(map, units, cities);
  construction.setPowerPlantSystem(power);
  const event = { nation: nations.getNation('a')!, round } as never;
  return { map, grid, cities, city, units, worker, power, logs, blasts, weapons, builder, construction, tile, event, turns };
}
function idFor(round: number, failure: boolean) {
  for (let i = 0; ; i++) if ((nuclearPlantRoll('plant' + i, round) < 0.1) === failure) return 'plant' + i;
}

test('new and legacy reactors begin at zero; safe through exactly half the configured lifespan', () => {
  const h = harness();
  assert.equal(h.power.getPowerPlantAge(h.city.id), 0);
  h.power.handleRoundStart(51);
  assert.equal(h.power.getPowerPlantAge(h.city.id), 50);
  assert.equal(h.blasts.length, 0);
  assert.equal(h.logs.filter(l => l.includes('meltdown roll')).length, 0);
  h.power.restore([{ id: h.city.id }], 51);
  assert.equal(h.power.getPowerPlantAge(h.city.id), 0);
});

test('first eligible turn deterministically fails or survives at the 10% boundary', () => {
  for (const failure of [false, true]) {
    const id = idFor(52, failure);
    const h = harness(id, 50, 51);
    h.power.handleRoundStart(52);
    assert.equal(h.blasts.length, Number(failure));
    assert.equal(h.power.getPowerPlantAge(id), failure ? undefined : 51);
    h.power.handleRoundStart(52);
    assert.equal(h.blasts.length, Number(failure));
  }
});

test('every eligible turn rolls separately, while maximum age bypasses the random roll', () => {
  let id = '';
  for (let i = 0; !id; i++) if ([52, 53, 54].every(r => nuclearPlantRoll('s' + i, r) >= 0.1)) id = 's' + i;
  const h = harness(id, 50, 51);
  h.power.handleRoundStart(54);
  assert.equal(h.power.getPowerPlantAge(id), 53);
  assert.equal(h.logs.filter(l => l.includes('meltdown roll')).length, 3);
  h.power.restore([{ id, powerPlantAge: 99 }], 100);
  h.power.handleRoundStart(101);
  assert.equal(h.blasts.length, 1);
  assert.equal(h.logs.filter(l => l.includes('meltdown roll')).length, 3);
  assert.ok(h.logs.some(l => l.includes('maximum lifespan reached')));
  assert.equal(h.cities.getBuildings(id).has('nuclear_plant'), false);
});

test('odd configured lifespan changes the threshold and guaranteed expiration', () => {
  const metadata = POWER_PLANTS.find(p => p.buildingId === 'nuclear_plant')!;
  const original = metadata.lifespanTurns;
  try {
    (metadata as { lifespanTurns: number }).lifespanTurns = 9;
    const h = harness(idFor(6, true));
    h.power.handleRoundStart(5);
    assert.equal(h.power.getPowerPlantAge(h.city.id), 4);
    h.power.handleRoundStart(6);
    assert.equal(h.blasts.length, 1);
    const maximum = harness('max', 8, 8);
    maximum.power.handleRoundStart(9);
    assert.equal(maximum.blasts.length, 1);
    assert.equal(nuclearPlantAtRisk(4, 9), false);
    assert.equal(nuclearPlantAtRisk(5, 9), true);
  } finally { (metadata as { lifespanTurns: number }).lifespanTurns = original; }
});

test('maintenance is a fixed multi-turn Worker job; resets exactly to zero and retains plant benefits and improvements', () => {
  const h = harness('maintain', 45, 46);
  h.tile.improvementId = 'farm';
  const before = h.cities.getBuildings(h.city.id).getAll();
  assert.equal(h.builder.getBuildPreview(h.worker, h.tile).improvementId, MAINTAIN_NUCLEAR_PLANT);
  assert.equal(h.builder.build(h.worker, h.tile)?.requiredTurns, NUCLEAR_PLANT_MAINTENANCE_TURNS);
  assert.equal(h.builder.build(h.worker, h.tile), null);
  for (let i = 0; i < NUCLEAR_PLANT_MAINTENANCE_TURNS; i++) {
    h.power.handleRoundStart(47 + i);
    h.construction.handleTurnStart(h.event);
  }
  assert.equal(h.power.getPowerPlantAge(h.city.id), 0);
  assert.deepEqual(h.cities.getBuildings(h.city.id).getAll(), before);
  assert.equal(h.tile.improvementId, 'farm');
  assert.equal(h.worker.buildAction, undefined);
  h.power.handleRoundStart(50);
  h.construction.handleTurnStart(h.event);
  assert.equal(h.power.getPowerPlantAge(h.city.id), 1);
});

test('maintenance neither freezes aging nor suppresses rolls; failure cancels surviving Worker job', () => {
  const h = harness(idFor(52, true), 50, 51);
  h.cities.getBuildings(h.city.id).add(BOMB_SHELTER);
  h.builder.build(h.worker, h.tile);
  h.power.handleRoundStart(52);
  assert.equal(h.blasts.length, 1);
  assert.ok(h.units.getUnit(h.worker.id));
  assert.equal(h.worker.buildAction, undefined);
  assert.equal(h.tile.improvementConstruction, undefined);
  assert.equal(h.construction.isUnitBusy(h.worker.id), false);
  h.construction.handleTurnStart(h.event);
  assert.equal(h.power.getCityPowerPlant(h.city.id), undefined);
  assert.equal(h.logs.filter(l => l.includes('lifecycle reset')).length, 0);
});

test('risk remains active until maintenance completes successfully', () => {
  let id = '';
  for (let i = 0; !id; i++) if ([52, 53, 54].every(r => nuclearPlantRoll('m' + i, r) >= 0.1)) id = 'm' + i;
  const h = harness(id, 50, 51);
  h.builder.build(h.worker, h.tile);
  for (let i = 0; i < 3; i++) {
    h.power.handleRoundStart(52 + i);
    if (i < 2) assert.equal(h.power.getPowerPlantAge(id), 51 + i);
    h.construction.handleTurnStart(h.event);
  }
  assert.equal(h.power.getPowerPlantAge(id), 0);
  assert.equal(h.logs.filter(l => l.includes('meltdown roll')).length, 3);
});

test('radius two uses shared damage, shelter protection, waste, mountain exemption and cleanup', () => {
  const h = harness('radius', 99, 100);
  const tiles = h.grid.getTilesInRange(h.tile, 2, h.map, { includeCenter: true });
  assert.equal(tiles.length, 19);
  const mountain = tiles.find(t => t.x !== 5)!;
  mountain.type = TileType.Mountain;
  for (const tile of tiles) tile.improvementId = 'farm';
  const outside = h.grid.getTilesInRange(h.tile, 3, h.map).find(t => h.grid.getDistance(t, h.tile) === 3)!;
  outside.improvementId = 'farm';
  const soldier = new Unit({ id: 'outside', name: 'Warrior', ownerId: 'a', tileX: outside.x, tileY: outside.y, unitType: WARRIOR });
  soldier.health = 100;
  h.units.addUnit(soldier);
  h.cities.getBuildings(h.city.id).add(BOMB_SHELTER);
  h.power.handleRoundStart(101);
  assert.equal(h.worker.health, 40);
  assert.equal(soldier.health, 100);
  assert.equal(outside.improvementId, 'farm');
  assert.ok(tiles.every(t => t.improvementId === undefined));
  assert.equal(mountain.type, TileType.Mountain);
  assert.equal(mountain.originalTerrain, undefined);
  assert.equal(h.tile.type, TileType.NuclearWaste);
  assert.equal(h.tile.originalTerrain, TileType.Plains);
  assert.equal(cleanNuclearWaste(h.tile), true);
  assert.equal(h.tile.type, TileType.Plains);
  assert.equal((h.blasts[0] as { accident: boolean }).accident, true);
});

test('existing save serializers preserve maintenance progress and deterministic reactor results', () => {
  const id = idFor(73, false);
  const h = harness(id, 40, 71);
  h.builder.build(h.worker, h.tile);
  h.power.handleRoundStart(72);
  h.construction.handleTurnStart(h.event);
  const savedTiles = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
  const savedCities = JSON.parse(JSON.stringify([{ id, powerPlantAge: h.power.getPowerPlantAge(id) }]));
  const restored = harness(id, 0, 72);
  SaveLoadService.restoreTiles(savedTiles, restored.map);
  restored.power.restore(savedCities, 72);
  restored.construction.syncUnitsFromTiles();
  restored.builder.rebuildConstructionIndex();
  assert.equal(restored.tile.improvementConstruction?.remainingTurns, 2);
  assert.equal(restored.builder.build(restored.worker, restored.tile), null);
  for (const world of [h, restored]) {
    world.power.handleRoundStart(73);
    world.construction.handleTurnStart(world.event);
    world.power.handleRoundStart(74);
    world.construction.handleTurnStart(world.event);
    assert.equal(world.power.getPowerPlantAge(id), 0);
    world.construction.handleTurnStart(world.event);
    assert.equal(world.logs.filter(l => l.includes('lifecycle reset')).length, 1);
  }
  for (const failure of [false, true]) {
    const riskyId = idFor(52, failure);
    const a = harness(riskyId, 50, 51), b = harness(riskyId, 0, 51);
    b.power.restore(JSON.parse(JSON.stringify([{ id: riskyId, powerPlantAge: a.power.getPowerPlantAge(riskyId) }])), 51);
    a.power.handleRoundStart(52); b.power.handleRoundStart(52);
    assert.deepEqual(a.blasts, b.blasts);
    assert.equal(a.power.getPowerPlantAge(riskyId), b.power.getPowerPlantAge(riskyId));
  }
});

test('ownership, worker type, duplicate maintenance and missing reactors gate the action', () => {
  const h = harness();
  h.worker.ownerId = 'b';
  assert.notEqual(h.builder.getBuildPreview(h.worker, h.tile).improvementId, MAINTAIN_NUCLEAR_PLANT);
  h.worker.ownerId = 'a';
  h.builder.build(h.worker, h.tile);
  const second = new Unit({ id: 'second', name: 'Worker', ownerId: 'a', tileX: 5, tileY: 5, unitType: WORKER });
  h.units.addUnit(second);
  assert.equal(h.builder.build(second, h.tile), null);
  h.cities.getBuildings(h.city.id).remove(NUCLEAR_POWER_PLANT.id);
  h.construction.handleTurnStart(h.event);
  assert.equal(h.worker.buildAction, undefined);
  assert.equal(h.tile.improvementConstruction, undefined);
});

test('AI maintenance priority increases from preventative to extreme with reactor age', () => {
  const ages = [0, 29, 30, 40, 49, 50, 51, 80, 91, 99];
  const scores = ages.map(age => nuclearPlantMaintenancePriority(age, 100));
  assert.equal(scores[0], 0); assert.equal(scores[1], 0);
  for (let i = 2; i < scores.length; i++) assert.ok(scores[i] > scores[i - 1]);
  assert.equal(nuclearPlantMaintenancePriority(20, 40), nuclearPlantMaintenancePriority(50, 100));
});

test('real AI chooses preventative maintenance before ordinary improvements', async () => {
  const { AISystem } = await import('../src/systems/AISystem');
  const h = harness('ai', 47);
  const ai = Object.create(AISystem.prototype);
  Object.assign(ai, { builderSystem: h.builder, powerPlantSystem: h.power, cityManager: h.cities,
    gridSystem: h.grid, mapData: h.map });
  ai.runWorker(h.worker, 'a');
  assert.equal(h.tile.improvementConstruction?.improvementId, MAINTAIN_NUCLEAR_PLANT);
});

test('maintenance restores the entire safe half of the lifecycle', () => {
  const h = harness('renewed', 72, 73);
  assert.equal(h.power.maintainNuclearPlant(h.city.id), true);
  h.power.handleRoundStart(123);
  assert.equal(h.power.getPowerPlantAge(h.city.id), 50);
  assert.equal(h.blasts.length, 0);
});

test('maintenance duration is unaffected by ordinary improvement speed policies', () => {
  const h = harness('fixed', 40);
  const jobs = new ImprovementConstructionSystem(h.map, h.units, h.cities,
    { getPercentModifierTotal: () => 1000 } as never);
  jobs.setPowerPlantSystem(h.power);
  h.builder.build(h.worker, h.tile);
  jobs.handleTurnStart(h.event);
  assert.equal(h.tile.improvementConstruction?.remainingTurns, NUCLEAR_PLANT_MAINTENANCE_TURNS - 1);
  assert.equal(h.power.getPowerPlantAge(h.city.id), 40);
});

test('physical reactor tile supplies the blast origin; saved destruction never resurrects it', () => {
  const h = harness('physical', 99, 100);
  const target = h.map.tiles[5][7];
  target.buildingId = 'nuclear_plant';
  assert.equal(h.power.getNuclearPlantTile(h.city.id), target);
  h.power.handleRoundStart(101);
  assert.deepEqual((h.blasts[0] as { target: unknown }).target, { x: 7, y: 5 });
  assert.equal(target.buildingId, undefined);
  const saved = JSON.parse(JSON.stringify({
    tiles: SaveLoadService.serializeTiles(h.map),
    buildings: h.cities.getBuildings(h.city.id).getAll(),
    age: h.power.getPowerPlantAge(h.city.id),
  }));
  const restored = harness(h.city.id, 0, 101);
  SaveLoadService.restoreTiles(saved.tiles, restored.map);
  assert.equal(saved.buildings.includes('nuclear_plant'), false);
  restored.cities.getBuildings(h.city.id).remove('nuclear_plant');
  restored.power.restore([{ id: h.city.id, powerPlantAge: saved.age }], 101);
  restored.power.handleRoundStart(102);
  assert.equal(restored.power.getCityPowerPlant(h.city.id), undefined);
  assert.equal(restored.blasts.length, 0);
  assert.equal(restored.map.tiles[5][7].type, TileType.NuclearWaste);
});

test('Worker HUD names the maintenance action explicitly', async () => {
  const { UnitActionToolbox } = await import('../src/ui/UnitActionToolbox');
  const h = harness();
  const toolbox = new UnitActionToolbox('a');
  toolbox.setBuildAvailabilityProvider(h.builder);
  toolbox.setSelectedUnit(h.worker);
  assert.ok(toolbox.getHudActions().some(action => action.mode === 'build' && action.label === 'Maintain Nuclear Power Plant'));
});
