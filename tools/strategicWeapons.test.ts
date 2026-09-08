import assert from 'node:assert/strict';
import test from 'node:test';
import { STRATEGIC_WEAPONS, NUCLEAR_CLEANUP_TURNS } from '../src/data/strategicWeapons';
import { ATOMIC_BOMB, NUCLEAR_MISSILE, GUIDED_MISSILE, NUCLEAR_SUBMARINE, BOMBER, STEALTH_BOMBER, WARRIOR, WORKER, canCarryUnitType } from '../src/data/units';
import { BOMB_SHELTER, NUCLEAR_SILO, GRANARY, MARKET } from '../src/data/buildings';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { TileType, type MapData } from '../src/types/map';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { StrategicWeaponsSystem, getBlastTiles, contaminateTile, cleanNuclearWaste } from '../src/systems/StrategicWeaponsSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { BuilderSystem } from '../src/systems/BuilderSystem';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem';
import { UnitBoardingManager } from '../src/systems/UnitBoardingManager';
import { getNuclearCapability, runStrategicWeaponsAI, type StrategicAIContext } from '../src/systems/ai/AIStrategicWeapons';
import { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem';
import { getTileYield } from '../src/systems/CityEconomy';
import { getTileResourceQuantity } from '../src/systems/resource/ResourceQuantity';
import { getNaturalResourceById } from '../src/data/naturalResources';

function harness() {
  const map: MapData = { width: 24, height: 24, tileSize: 1, tiles: Array.from({ length: 24 }, (_, y) => Array.from({ length: 24 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const grid = new HexGridSystem();
  const units = new UnitManager(24, 24);
  const cities = new CityManager();
  const nations = new NationManager();
  for (const id of ['a', 'b', 'c']) nations.addNation(new Nation({ id, name: id, color: 1 }));
  const turns = new TurnManager(nations);
  const diplomacy = new DiplomacyManager(); diplomacy.declareWar('a', 'b');
  const system = new StrategicWeaponsSystem(units, cities, map, grid, diplomacy);
  const unit = (type = WARRIOR, ownerId = 'a', x = 2, y = 10) => { const u = new Unit({ id: `u${units.getAllUnits().length}`, name: type.name, ownerId, tileX: x, tileY: y, unitType: type }); units.addUnit(u); return u; };
  const city = (ownerId = 'b', x = 10, y = 10) => { const c = new City({ id: `c${cities.getAllCities().length}`, name: ownerId, ownerId, tileX: x, tileY: y }); c.population = 20; c.health = 400; c.ownedTileCoords = [{ x, y }]; cities.addCity(c); map.tiles[y][x].ownerId = ownerId; return c; };
  return { map, grid, units, cities, nations, turns, diplomacy, system, unit, city };
}

for (const [id, radius, count] of [['guided_missile', 1, 7], ['atomic_bomb', 3, 37], ['nuclear_missile', 4, 61]] as const) {
  test(`${id}: radius ${radius} includes center and all ${count} axial hexes`, () => {
    const h = harness(); assert.equal(STRATEGIC_WEAPONS[id].radius, radius);
    const tiles = getBlastTiles(h.map, h.grid, 10, 10, radius);
    assert.equal(tiles.length, count);
    assert.ok(tiles.every(tile => h.grid.getDistance(tile, { x: 10, y: 10 }) <= radius));
    assert.ok(tiles.some(tile => tile.x === 10 && tile.y === 10));
  });
}
test('map edges clip area effects, never wrap or duplicate tiles', () => {
  const h = harness();
  assert.equal(getBlastTiles(h.map, h.grid, 0, 0, 4).length, 15);
  assert.equal(getBlastTiles(h.map, h.grid, 23, 23, 1).length, 3);
});

test('atomic delivery requires real bomber cargo, consumes bomb and platform action', () => {
  const h = harness(); h.city(); const bomb = h.unit(ATOMIC_BOMB);
  assert.match(h.system.getLaunchFailure(bomb, 10, 10)!, /Bomber/);
  assert.equal(h.system.launch(bomb, 10, 10), false);
  const bomber = h.unit(BOMBER);
  assert.equal(h.units.boardUnit(bomb.id, bomber.id, 0), true);
  assert.equal(h.system.launch(bomb, 10, 10), true);
  assert.equal(h.units.getUnit(bomb.id), undefined);
  assert.deepEqual(bomber.cargoUnitIds, []); assert.equal(bomber.movementPoints, 0);
  assert.equal(h.system.launch(bomb, 10, 10), false);
});

test('nuclear missile requires an owned working silo; storage and damage disable launch', () => {
  const h = harness(); h.city(); const base = h.city('a', 2, 10); const missile = h.unit(NUCLEAR_MISSILE);
  assert.match(h.system.getLaunchFailure(missile, 10, 10)!, /Nuclear Silo/);
  h.cities.getBuildings(base.id).add(NUCLEAR_SILO);
  assert.equal(h.system.getLaunchFailure(missile, 10, 10), undefined);
  h.cities.getBuildings(base.id).setBroken('nuclear_silo', true);
  assert.equal(h.system.launch(missile, 10, 10), false);
  h.cities.getBuildings(base.id).setBroken('nuclear_silo', false);
  assert.equal(h.system.launch(missile, 10, 10), true);
  assert.equal(h.units.getUnit(missile.id), undefined);
});

test('submarine cargo accepts three missiles, rejects aircraft and atomic bombs; launches at sea', () => {
  const h = harness(); h.city(); h.map.tiles[10][2].type = TileType.Ocean;
  const sub = h.unit(NUCLEAR_SUBMARINE);
  const missiles = [h.unit(GUIDED_MISSILE), h.unit(NUCLEAR_MISSILE), h.unit(GUIDED_MISSILE)];
  for (const missile of missiles) assert.equal(h.units.boardUnit(missile.id, sub.id, 0), true);
  assert.equal(h.units.boardUnit(h.unit(GUIDED_MISSILE).id, sub.id), false);
  assert.equal(canCarryUnitType(NUCLEAR_SUBMARINE, ATOMIC_BOMB), false);
  assert.equal(canCarryUnitType(NUCLEAR_SUBMARINE, BOMBER), false);
  assert.equal(canCarryUnitType(STEALTH_BOMBER, ATOMIC_BOMB), true);
  assert.equal(h.system.launch(missiles[1], 10, 10), true);
  assert.equal(sub.cargoUnitIds.length, 2);
});

test('boarding manager supports adjacent bomber loading on land', () => {
  const h = harness(); const bomber = h.unit(BOMBER, 'a', 3, 10); const bomb = h.unit(ATOMIC_BOMB);
  const boarding = new UnitBoardingManager(h.units, h.map, h.grid, h.nations);
  assert.equal(boarding.board(bomb, bomber), true);
});

test('nuclear blast damages all stacks, civilians and naval units; ruins improvements; exempts mountain/water from waste', () => {
  const h = harness(); h.city(); const base = h.city('a', 2, 10); h.cities.getBuildings(base.id).add(NUCLEAR_SILO);
  const missile = h.unit(NUCLEAR_MISSILE);
  const naval = h.unit(NUCLEAR_SUBMARINE, 'b', 11, 10); const worker = h.unit(WORKER, 'b', 10, 10);
  const military = h.unit(WARRIOR, 'b', 10, 10);
  const types = [TileType.Mountain, TileType.Coast, TileType.Ocean, TileType.Meadow];
  types.forEach((type, i) => { h.map.tiles[11][9 + i].type = type; h.map.tiles[11][9 + i].improvementId = 'mine'; });
  assert.equal(h.system.launch(missile, 10, 10), true);
  for (const u of [naval, worker, military]) assert.equal(h.units.getUnit(u.id), undefined);
  types.forEach((type, i) => { const tile = h.map.tiles[11][9 + i]; assert.equal(tile.improvementId, undefined); assert.equal(tile.type, i < 3 ? type : TileType.NuclearWaste); });
  assert.equal(h.map.tiles[11][12].originalTerrain, TileType.Meadow);
});

for (const type of [GUIDED_MISSILE, ATOMIC_BOMB, NUCLEAR_MISSILE]) test(`${type.name}: shelter applies 50% only to nuclear city and unit damage`, () => {
  function strike(shelter: boolean) {
    const h = harness(); const city = h.city(); const garrison = h.unit(WARRIOR, 'b', 10, 10); garrison.health = 300;
    const buildings = h.cities.getBuildings(city.id); buildings.add(GRANARY); buildings.add(MARKET); if (shelter) buildings.add(BOMB_SHELTER);
    const weapon = h.unit(type);
    if (type === ATOMIC_BOMB) h.units.boardUnit(weapon.id, h.unit(BOMBER).id, 0);
    if (type === NUCLEAR_MISSILE) h.cities.getBuildings(h.city('a', 2, 10).id).add(NUCLEAR_SILO);
    assert.equal(h.system.launch(weapon, 10, 10), true);
    return { cityDamage: 400 - city.health, unitDamage: 300 - garrison.health, populationLoss: 20 - city.population, waste: h.map.tiles[10][10].type, broken: buildings.getBrokenBuildingIds().length };
  }
  const plain = strike(false), sheltered = strike(true);
  const multiplier = type === GUIDED_MISSILE ? 1 : 0.5;
  assert.equal(sheltered.cityDamage, plain.cityDamage * multiplier);
  assert.equal(sheltered.unitDamage, plain.unitDamage * multiplier);
  assert.equal(sheltered.waste, type === GUIDED_MISSILE ? TileType.Plains : TileType.NuclearWaste);
  if (type === GUIDED_MISSILE) assert.deepEqual(sheltered, plain);
});

test('neutral collateral blocks launch without consuming weapon', () => {
  const h = harness(); h.city(); h.map.tiles[10][11].ownerId = 'c'; const missile = h.unit(GUIDED_MISSILE);
  assert.match(h.system.getLaunchFailure(missile, 10, 10)!, /not at war/);
  assert.equal(h.system.launch(missile, 10, 10), false); assert.ok(h.units.getUnit(missile.id));
});

test('waste, exact original terrain, and timed cleanup survive save/load and repeated contamination', () => {
  const h = harness(); const owner = h.turns.getCurrentNation().id; const city = h.city(owner, 5, 5);
  const worker = h.unit(WORKER, owner, 5, 5); const tile = h.map.tiles[5][5]; tile.type = TileType.Jungle;
  contaminateTile(tile); contaminateTile(tile); assert.equal(tile.originalTerrain, TileType.Jungle);
  const builder = new BuilderSystem(h.units, h.cities, h.turns, h.map, h.grid);
  const construction = new ImprovementConstructionSystem(h.map, h.units, h.cities);
  assert.equal(builder.canNationImproveLandTile(owner, tile), true);
  assert.equal(builder.build(worker, tile)?.requiredTurns, NUCLEAR_CLEANUP_TURNS);
  const event = { nation: h.nations.getNation(owner)!, round: 1 } as never;
  construction.handleTurnStart(event);
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
  const copy = harness(); copy.city(owner, 5, 5); const restoredWorker = copy.unit(WORKER, owner, 5, 5); // stable fixture id
  assert.equal(restoredWorker.id, worker.id);
  SaveLoadService.restoreTiles(saved, copy.map);
  const resumed = new ImprovementConstructionSystem(copy.map, copy.units, copy.cities);
  assert.equal(copy.map.tiles[5][5].type, TileType.NuclearWaste);
  assert.equal(copy.map.tiles[5][5].originalTerrain, TileType.Jungle);
  for (let i = 1; i < NUCLEAR_CLEANUP_TURNS; i++) resumed.handleTurnStart(event);
  assert.equal(copy.map.tiles[5][5].type, TileType.Jungle);
  assert.equal(copy.map.tiles[5][5].improvementId, undefined);
  assert.equal(copy.map.tiles[5][5].originalTerrain, undefined);
  assert.equal(restoredWorker.buildAction, undefined);
  SaveLoadService.restoreTiles(JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(copy.map))), h.map);
  assert.equal(h.map.tiles[5][5].type, TileType.Jungle);
  assert.equal(cleanNuclearWaste(h.map.tiles[5][5]), false);
});

test('contamination suppresses economic yields and Uranium quantity', () => {
  const h = harness(); const tile = h.map.tiles[3][3]; tile.resourceId = 'uranium'; contaminateTile(tile);
  assert.deepEqual(getTileYield(tile), { food: 0, production: 0, gold: 0, science: 0, culture: 0, happiness: 0 });
  assert.equal(getTileResourceQuantity(tile, getNaturalResourceById), 0);
  cleanNuclearWaste(tile); assert.equal(getTileResourceQuantity(tile, getNaturalResourceById), 1);
});

test('AI launches conventional area attack, avoids casual nuclear use and derives deterrence from real delivery', () => {
  const h = harness(); h.city(); const missile = h.unit(GUIDED_MISSILE);
  const context: StrategicAIContext = { nationId: 'a', units: h.units, cities: h.cities, map: h.map, grid: h.grid, weapons: h.system,
    atWar: id => id === 'b', known: () => true, aggression: 0.5, warTolerance: 0.5,
    relation: () => ({ hostility: 80, trust: 0, fear: 20 }), move: () => {}, log: () => {}, round: 20 };
  runStrategicWeaponsAI(context); assert.equal(h.units.getUnit(missile.id), undefined);
  const bomb = h.unit(ATOMIC_BOMB); const bomber = h.unit(BOMBER); h.units.boardUnit(bomb.id, bomber.id, 0);
  runStrategicWeaponsAI(context); assert.ok(h.units.getUnit(bomb.id));
  assert.equal(getNuclearCapability('a', h.units, h.cities).ready, 1);
  const evaluation = new AIMilitaryEvaluationSystem(h.units, h.cities);
  assert.ok(evaluation.getDefensiveWarPowerAgainst('b', 'a') > evaluation.getMilitaryStrength('a').totalStrength);
  h.units.removeUnit(bomber.id);
  assert.equal(getNuclearCapability('a', h.units, h.cities).ready, 0);
});

test('AI can choose exceptional atomic use against a concentrated force while conventionally outmatched', () => {
  const h = harness(); h.city(); const bomb = h.unit(ATOMIC_BOMB); const bomber = h.unit(BOMBER);
  h.units.boardUnit(bomb.id, bomber.id, 0);
  for (let i = 0; i < 24; i++) h.unit(WARRIOR, 'b', 10, 10);
  runStrategicWeaponsAI({ nationId: 'a', units: h.units, cities: h.cities, map: h.map, grid: h.grid, weapons: h.system,
    atWar: id => id === 'b', known: () => true, aggression: 1, warTolerance: 1,
    relation: () => ({ hostility: 100, trust: 0, fear: 0 }), move: () => {}, log: () => {}, round: 20 });
  assert.equal(h.units.getUnit(bomb.id), undefined);
  assert.ok(h.map.tiles.flat().some(tile => tile.type === TileType.NuclearWaste));
});

test('AI never targets unexplored enemy locations', () => {
  const h = harness(); h.city(); const missile = h.unit(GUIDED_MISSILE);
  runStrategicWeaponsAI({ nationId: 'a', units: h.units, cities: h.cities, map: h.map, grid: h.grid, weapons: h.system,
    atWar: id => id === 'b', known: () => false, aggression: 1, warTolerance: 1,
    relation: () => ({ hostility: 100, trust: 0, fear: 0 }), move: () => {}, log: () => {}, round: 20 });
  assert.ok(h.units.getUnit(missile.id));
});

test('real Worker AI starts cleanup on owned contaminated city terrain', async () => {
  const { AISystem } = await import('../src/systems/AISystem');
  const h = harness(); const owner = h.turns.getCurrentNation().id; h.city(owner, 5, 5);
  const worker = h.unit(WORKER, owner, 5, 5); const tile = h.map.tiles[5][5]; contaminateTile(tile);
  const builder = new BuilderSystem(h.units, h.cities, h.turns, h.map, h.grid);
  const ai = Object.create(AISystem.prototype);
  Object.assign(ai, { builderSystem: builder, mapData: h.map, gridSystem: h.grid });
  ai.runWorker(worker, owner);
  assert.equal(tile.improvementConstruction?.improvementId, 'clean_nuclear_waste');
  assert.equal(worker.isBuildingImprovement(), true);
});

test('turn and combat blockers apply before strategic attacks', async () => {
  const { CombatSystem } = await import('../src/systems/CombatSystem');
  const h = harness(); const owner = h.turns.getCurrentNation().id; h.city(owner === 'a' ? 'b' : 'a');
  const missile = h.unit(GUIDED_MISSILE, owner);
  const blocked = new CombatSystem(h.units, h.turns, h.cities, {} as never, h.map, h.diplomacy, h.grid, () => true);
  assert.equal(blocked.tryAttack(missile, 10, 10), false);
  const wrongTurn = h.unit(GUIDED_MISSILE, owner === 'a' ? 'b' : 'a');
  const combat = new CombatSystem(h.units, h.turns, h.cities, {} as never, h.map, h.diplomacy, h.grid);
  assert.equal(combat.tryAttack(wrongTurn, 10, 10), false);
  assert.equal(combat.tryAttack(missile, 10, 10), true);
});

test('submarine cargo rehydrates through the existing saved unit restoration path', () => {
  const h = harness(); const sub = h.unit(NUCLEAR_SUBMARINE); const missile = h.unit(NUCLEAR_MISSILE);
  h.units.boardUnit(missile.id, sub.id, 0);
  const saved = JSON.parse(JSON.stringify(h.units.getAllUnits().map(u => ({ id: u.id, name: u.name, ownerId: u.ownerId,
    unitTypeId: u.unitType.id, tileX: u.tileX, tileY: u.tileY, health: u.health, movementPoints: u.movementPoints,
    carriedByUnitId: u.carriedByUnitId, cargoUnitIds: u.cargoUnitIds, actionStatus: u.actionStatus }))));
  const copy = harness();
  (SaveLoadService as unknown as { applyUnits(saved: unknown, units: UnitManager): void }).applyUnits(saved, copy.units);
  assert.equal(copy.units.getTransportForUnit(copy.units.getUnit(missile.id)!)?.id, sub.id);
  assert.deepEqual(copy.units.getUnit(sub.id)?.cargoUnitIds, [missile.id]);
  assert.equal(getNuclearCapability('a', copy.units, copy.cities).submarineWeapons, 1);
});

test('HUD exposes launch for zero-strength atomic ordnance and a brush-labelled Worker cleanup action', async () => {
  const { UnitActionToolbox } = await import('../src/ui/UnitActionToolbox');
  const h = harness(); const owner = h.turns.getCurrentNation().id;
  const toolbox = new UnitActionToolbox(owner); const bomb = h.unit(ATOMIC_BOMB, owner);
  toolbox.setSelectedUnit(bomb);
  assert.ok(toolbox.getHudActions().some(a => a.mode === 'ranged' && a.label === 'Launch'));
  assert.ok(toolbox.getHudActions().some(a => a.mode === 'loadWeapon'));
  const worker = h.unit(WORKER, owner, 5, 5); h.city(owner, 5, 5); contaminateTile(h.map.tiles[5][5]);
  const builder = new BuilderSystem(h.units, h.cities, h.turns, h.map, h.grid);
  toolbox.setBuildAvailabilityProvider(builder); toolbox.setSelectedUnit(worker);
  assert.ok(toolbox.getHudActions().some(a => a.mode === 'build' && a.label === '🖌 Clean Nuclear Waste'));
});

test('loading a legacy tile save discards current contamination without new terrain fields', () => {
  const h = harness(); const tile = h.map.tiles[4][4]; tile.type = TileType.Beach; contaminateTile(tile);
  SaveLoadService.restoreTiles([{ q: 4, r: 4, ownerId: 'a', improvementId: 'farm' }], h.map);
  assert.equal(tile.type, TileType.Beach);
  assert.equal(tile.originalTerrain, undefined);
  assert.equal(tile.improvementId, 'farm');
});

test('exhausted strategic cargo rearms on its owner’s next turn and can launch', () => {
  const h = harness();
  const sub = h.unit(NUCLEAR_SUBMARINE);
  const missile = h.unit(NUCLEAR_MISSILE);
  h.city('b', 10, 10);
  h.units.boardUnit(missile.id, sub.id, 0);
  missile.movementPoints = 0;
  assert.match(h.system.getLaunchFailure(missile, 10, 10)!, /no actions/);
  h.units.resetMovementForOwner('b');
  assert.equal(missile.movementPoints, 0);
  h.units.resetMovementForOwner('a');
  assert.equal(h.system.getLaunchFailure(missile, 10, 10), undefined);
  assert.equal(h.system.launch(missile, 10, 10), true);
  assert.equal(h.units.getUnit(missile.id), undefined);
});

test('exhausted missile keeps a disabled Launch control with a next-turn explanation', async () => {
  const { UnitActionToolbox } = await import('../src/ui/UnitActionToolbox');
  const h = harness(); const missile = h.unit(NUCLEAR_MISSILE);
  const toolbox = new UnitActionToolbox('a');
  missile.movementPoints = 0; toolbox.setSelectedUnit(missile);
  const action = toolbox.getHudActions().find(a => a.mode === 'ranged');
  assert.equal(action?.isAvailable, false);
  assert.match(action?.tooltip ?? '', /next turn/);
  h.units.resetMovementForOwner('a');
  assert.equal(toolbox.getHudActions().find(a => a.mode === 'ranged')?.isAvailable, true);
});
