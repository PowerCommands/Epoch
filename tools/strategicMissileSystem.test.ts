import assert from 'node:assert/strict';
import test from 'node:test';
import { MISSILE_LAUNCH_PAD, PATRIOT_MISSILE_BATTERY, NUCLEAR_SILO, BOMB_SHELTER } from '../src/data/buildings';
import { ICBM, NUCLEAR_MISSILE, GUIDED_MISSILE, WARRIOR, MUSKETMAN, WORKER } from '../src/data/units';
import { STRATEGIC_WEAPONS, getStrategicWeaponProfile } from '../src/data/strategicWeapons';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem';
import { InfrastructureSabotageSystem } from '../src/systems/InfrastructureSabotageSystem';
import { InfrastructureRepairSystem } from '../src/systems/InfrastructureRepairSystem';
import { WonderSystem } from '../src/systems/WonderSystem';
import { StrategicWeaponsSystem, type StrategicDetonation } from '../src/systems/StrategicWeaponsSystem';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType, type MapData } from '../src/types/map';
import type { UnitType } from '../src/entities/UnitType';

function fixture() {
  const map: MapData = { width: 64, height: 32, tileSize: 16, tiles: Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const units = new UnitManager(map.width, map.height);
  const cities = new CityManager();
  const nations = new NationManager();
  for (const id of ['a', 'b', 'neutral']) nations.addNation(new Nation({ id, name: id, color: 1 }));
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar('a', 'b');
  const grid = new HexGridSystem();
  const weapons = new StrategicWeaponsSystem(units, cities, map, grid, diplomacy, () => 9, nations);
  const events: StrategicDetonation[] = [];
  weapons.onDetonation(event => events.push(event));
  let nextId = 0;
  const unit = (type: UnitType, ownerId = 'a', x = 2, y = 10, id = `unit${nextId++}`): Unit => {
    const result = new Unit({ id, name: type.name, ownerId, tileX: x, tileY: y, unitType: type });
    units.addUnit(result);
    return result;
  };
  const city = (ownerId = 'b', x = 40, y = 20): City => {
    const result = new City({ id: `city${cities.getAllCities().length}`, name: ownerId, ownerId, tileX: x, tileY: y });
    result.health = 400;
    result.population = 20;
    result.ownedTileCoords = [{ x, y }];
    cities.addCity(result);
    map.tiles[y][x].ownerId = ownerId;
    return result;
  };
  const pad = (ownerId = 'a', x = 2, y = 10) => {
    const ownerCity = city(ownerId, x, y + 3);
    ownerCity.ownedTileCoords.push({ x, y });
    const tile = map.tiles[y][x];
    tile.ownerId = ownerId;
    tile.buildingId = MISSILE_LAUNCH_PAD.id;
    return tile;
  };
  const battery = (x = 39, y = 20, ownerId = 'b') => {
    const tile = map.tiles[y][x];
    tile.ownerId = ownerId;
    tile.buildingId = PATRIOT_MISSILE_BATTERY.id;
    return tile;
  };
  return { map, units, cities, nations, diplomacy, grid, weapons, events, unit, city, pad, battery };
}

test('Launch Pads and Patriots use ordinary empty-land placement away from the city center', () => {
  for (const building of [MISSILE_LAUNCH_PAD, PATRIOT_MISSILE_BATTERY]) {
    const h = fixture();
    const city = h.city('a', 2, 10);
    city.ownedTileCoords.push({ x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 });
    for (const { x, y } of city.ownedTileCoords) h.map.tiles[y][x].ownerId = 'a';
    h.map.tiles[13][3].type = TileType.Ocean;
    h.map.tiles[13][4].improvementId = 'farm';
    const placement = new BuildingPlacementSystem();
    assert.equal(placement.startPlacement(city, building.id, h.map), true);
    assert.deepEqual(placement.getState()!.validCoords, [{ x: 2, y: 13 }]);
    assert.equal(placement.selectTile(city, { x: 2, y: 10 }, h.map).status, 'invalid');
    assert.equal(placement.selectTile(city, { x: 2, y: 13 }, h.map).status, 'reserved');
    assert.equal(placement.completePhysicalBuilding(city, building, h.map), h.map.tiles[13][2]);
    assert.equal(h.map.tiles[13][2].buildingId, building.id);
    if (building.id === MISSILE_LAUNCH_PAD.id) assert.equal(h.weapons.storage.getPads('a').length, 1);
  }
});

test('mixed missile storage has four slots and arming consumes one warhead without another slot', () => {
  const h = fixture();
  const pad = h.pad();
  const missiles = [ICBM, NUCLEAR_MISSILE, ICBM, NUCLEAR_MISSILE].map((type, index) => h.unit(type, 'a', 4 + index, 10));
  for (const missile of missiles) assert.equal(h.weapons.storage.storeMissile(missile, pad), true);
  assert.equal(h.weapons.storage.getStoredMissiles(pad.x, pad.y).length, 4);
  assert.equal(h.weapons.storage.findAvailablePad('a'), undefined);
  assert.equal(h.weapons.storage.storeMissile(h.unit(ICBM, 'a', 9, 10), pad), false);
  h.nations.getNation('a')!.nuclearWarheads = 1;
  assert.equal(h.weapons.storage.armMissile(missiles[0]), true);
  assert.equal(h.weapons.storage.armMissile(missiles[0]), false);
  assert.equal(h.weapons.storage.armMissile(missiles[2]), false);
  assert.equal(h.nations.getNation('a')!.nuclearWarheads, 0);
  assert.equal(h.weapons.storage.getStoredMissiles(pad.x, pad.y).length, 4);
  assert.equal(missiles[0].nuclearArmed, true);
  assert.equal(h.units.moveUnit(missiles[0].id, 3, 10), false);
  const guard = h.unit(WARRIOR, 'b', pad.x, pad.y);
  assert.equal(h.units.getUnitAt(pad.x, pad.y), guard, 'Stored missiles do not block ordinary units');
});

test('ordinary military sabotage preserves stored missiles; Worker repair restores launch capability', () => {
  const h = fixture();
  const pad = h.pad();
  const missile = h.unit(ICBM);
  assert.equal(h.weapons.storage.storeMissile(missile, pad), true);
  h.city();
  const wonders = new WonderSystem();
  const sabotage = new InfrastructureSabotageSystem(h.map, h.cities, wonders, h.nations, () => {});
  const attacker = h.unit(MUSKETMAN, 'b', pad.x, pad.y);
  assert.equal(sabotage.destroyBuilding(attacker), true);
  assert.equal(pad.buildingBroken, true);
  assert.match(h.weapons.getLaunchFailure(missile, 40, 20)!, /working Missile Launch Pad/);
  assert.equal(h.weapons.launch(missile, 40, 20), false);
  assert.equal(h.weapons.storage.storeMissile(h.unit(NUCLEAR_MISSILE, 'a', 4, 10), pad), false);
  assert.deepEqual(missile.missileLaunchPad, { x: pad.x, y: pad.y });
  assert.equal(h.units.getUnit(missile.id), missile);
  assert.equal(h.weapons.storage.getStoredMissiles(pad.x, pad.y).length, 1);
  h.units.removeUnit(attacker.id);
  const worker = h.unit(WORKER, 'a', pad.x, pad.y);
  h.nations.getResources('a').gold = 1000;
  const repairs = new InfrastructureRepairSystem(h.map, h.cities, wonders, h.nations, () => {});
  assert.equal(repairs.repair(worker), true);
  assert.equal(pad.buildingBroken, undefined);
  assert.equal(h.weapons.launch(missile, 40, 20), true);
  assert.equal(h.units.getUnit(missile.id), undefined);
});

test('old city-only Nuclear Silos and over-capacity inventories retain their original launch site', () => {
  const h = fixture();
  const oldCity = h.city('a', 2, 10);
  h.city('b', 10, 10);
  h.cities.getBuildings(oldCity.id).add(NUCLEAR_SILO);
  h.cities.getBuildings(oldCity.id).setBroken(NUCLEAR_SILO.id, true);
  const missiles = Array.from({ length: 5 }, () => h.unit(NUCLEAR_MISSILE));
  h.weapons.storage.reconcile();
  assert.equal(h.map.tiles[10][2].buildingId, MISSILE_LAUNCH_PAD.id);
  assert.equal(h.map.tiles[10][2].buildingBroken, true);
  assert.equal(h.weapons.storage.getStoredMissiles(2, 10).length, 5);
  for (const missile of missiles) assert.deepEqual(missile.missileLaunchPad, { x: 2, y: 10 });
  assert.equal(h.weapons.storage.findAvailablePad('a'), undefined);
  assert.equal(h.weapons.launch(missiles[0], 10, 10), false);
  h.nations.getResources('a').gold = 1000;
  const repairs = new InfrastructureRepairSystem(h.map, h.cities, new WonderSystem(), h.nations, () => {});
  assert.equal(repairs.repair(h.unit(WORKER)), true);
  assert.equal(h.weapons.launch(missiles[0], 10, 10), true);
  assert.equal(h.weapons.storage.getStoredMissiles(2, 10).length, 4);
});

test('a migrated old silo retains its stored arsenal after a second physical Launch Pad is built in the same city', () => {
  const h = fixture();
  const city = h.city('a', 2, 10);
  h.city('b', 10, 10);
  h.cities.getBuildings(city.id).add(NUCLEAR_SILO);
  const missile = h.unit(NUCLEAR_MISSILE);
  h.weapons.storage.reconcile();
  city.ownedTileCoords.push({ x: 2, y: 13 });
  const newSite = h.map.tiles[13][2];
  newSite.ownerId = 'a';
  const placement = new BuildingPlacementSystem();
  assert.equal(placement.startPlacement(city, MISSILE_LAUNCH_PAD.id, h.map), true);
  assert.equal(placement.selectTile(city, newSite, h.map).status, 'reserved');
  assert.equal(placement.completePhysicalBuilding(city, MISSILE_LAUNCH_PAD, h.map), newSite);
  assert.deepEqual(h.weapons.storage.getPads('a').map(({ x, y }) => ({ x, y })), [{ x: 2, y: 10 }, { x: 2, y: 13 }]);
  assert.deepEqual(missile.missileLaunchPad, { x: 2, y: 10 });
  assert.equal(h.weapons.launch(missile, 10, 10), true);
  assert.equal(h.units.getUnit(missile.id), undefined);
});

for (const [type, armed] of [[GUIDED_MISSILE, false], [NUCLEAR_MISSILE, false], [ICBM, false], [ICBM, true]] as const) {
  test(`${type.name}${armed ? ' nuclear armed' : ''} destroys all stored enemy missiles within its radius without secondary detonations`, () => {
    const h = fixture();
    const sourcePad = h.pad();
    const enemyPad = h.pad('b', 10, 10);
    const stored = [h.unit(NUCLEAR_MISSILE, 'b', 10, 10), h.unit(ICBM, 'b', 10, 10), h.unit(ICBM, 'b', 10, 10)];
    for (const missile of stored) {
      missile.health = 1000;
      assert.equal(h.weapons.storage.storeMissile(missile, enemyPad), true);
    }
    stored[2].nuclearArmed = true;
    const attack = h.unit(type);
    attack.nuclearArmed = armed;
    if (type !== GUIDED_MISSILE) assert.equal(h.weapons.storage.storeMissile(attack, sourcePad), true);
    assert.equal(h.weapons.launch(attack, 10, 10), true);
    for (const missile of stored) assert.equal(h.units.getUnit(missile.id), undefined);
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].unitsDestroyed, 3);
    assert.equal(h.weapons.storage.getStoredMissiles(10, 10).length, 0);
    assert.equal(enemyPad.buildingBroken, true);
    if (!armed && type !== NUCLEAR_MISSILE) {
      assert.equal(h.events[0].nuclear, false);
      assert.equal(h.map.tiles.flat().some(tile => tile.type === TileType.NuclearWaste), false);
    }
  });
}

test('conventional ICBMs target globally and apply Atomic Bomb direct damage in a radius of two without waste', () => {
  const h = fixture();
  const pad = h.pad();
  const city = h.city();
  h.cities.getBuildings(city.id).add(BOMB_SHELTER);
  const defender = h.unit(WARRIOR, 'b', 40, 20);
  defender.health = 400;
  const beyond = h.unit(WARRIOR, 'b', 43, 20);
  const missile = h.unit(ICBM);
  h.weapons.storage.storeMissile(missile, pad);
  assert.ok(h.grid.getDistance(pad, { x: city.tileX, y: city.tileY }) > NUCLEAR_MISSILE.range!);
  assert.equal(h.weapons.launch(missile, 40, 20), true);
  assert.equal(city.health, 400 - STRATEGIC_WEAPONS.atomic_bomb.cityDamage);
  assert.equal(defender.health, 400 - STRATEGIC_WEAPONS.atomic_bomb.unitDamage);
  assert.equal(h.units.getUnit(beyond.id), beyond);
  assert.equal(beyond.health, WARRIOR.baseHealth);
  assert.equal(h.events[0].radius, 2);
  assert.equal(h.events[0].tiles, 19);
  assert.equal(h.events[0].nuclear, false);
  assert.equal(h.events[0].contaminatedTiles, 0);
  assert.equal(h.map.tiles.flat().some(tile => tile.type === TileType.NuclearWaste), false);
});

test('nuclear ICBMs use the exact canonical Nuclear Missile profile at global range, including Bomb Shelter protection', () => {
  const h = fixture();
  const pad = h.pad();
  const city = h.city();
  h.cities.getBuildings(city.id).add(BOMB_SHELTER);
  const defender = h.unit(WARRIOR, 'b', 40, 20);
  defender.health = 400;
  const missile = h.unit(ICBM);
  h.weapons.storage.storeMissile(missile, pad);
  h.nations.getNation('a')!.nuclearWarheads = 1;
  h.weapons.storage.armMissile(missile);
  assert.equal(getStrategicWeaponProfile(missile), STRATEGIC_WEAPONS.nuclear_missile);
  assert.equal(h.weapons.launch(missile, 40, 20), true);
  assert.equal(city.health, 400 - STRATEGIC_WEAPONS.nuclear_missile.cityDamage * 0.5);
  assert.equal(defender.health, 400 - STRATEGIC_WEAPONS.nuclear_missile.unitDamage * 0.5);
  assert.equal(city.population, 20 - Math.floor(20 * STRATEGIC_WEAPONS.nuclear_missile.populationLoss * 0.5));
  assert.equal(h.events[0].radius, STRATEGIC_WEAPONS.nuclear_missile.radius);
  assert.equal(h.events[0].nuclear, true);
  assert.equal(h.events[0].contaminatedTiles, 61);
  assert.equal(h.map.tiles[20][40].type, TileType.NuclearWaste);
});

test('ordinary Nuclear Missiles retain limited range and neutral collateral still prevents global launches', () => {
  const h = fixture();
  const pad = h.pad();
  h.city();
  const limited = h.unit(NUCLEAR_MISSILE);
  h.weapons.storage.storeMissile(limited, pad);
  assert.match(h.weapons.getLaunchFailure(limited, 40, 20)!, /range/);
  const global = h.unit(ICBM);
  h.weapons.storage.storeMissile(global, pad);
  h.map.tiles[20][41].ownerId = 'neutral';
  assert.match(h.weapons.getLaunchFailure(global, 40, 20)!, /not at war/);
  assert.equal(h.weapons.launch(global, 40, 20), false);
  assert.equal(h.units.getUnit(global.id), global);
});

function defendedStrike(gold: number, id = 'strike12', armed = false, brokenFirst = false) {
  const h = fixture();
  const pad = h.pad();
  const city = h.city();
  h.battery(39, 20).buildingBroken = brokenFirst;
  h.battery(38, 20);
  h.nations.getResources('b').gold = gold;
  const missile = h.unit(ICBM, 'a', 2, 10, id);
  missile.nuclearArmed = armed;
  h.weapons.storage.storeMissile(missile, pad);
  assert.equal(h.weapons.launch(missile, 40, 20), true);
  return { ...h, city, missile, event: h.events[0], gold: h.nations.getResources('b').gold };
}

test('overlapping Patriots charge each actual attempt, continue after failure and stop on success deterministically', () => {
  const first = defendedStrike(30_000);
  const replay = defendedStrike(30_000);
  assert.deepEqual(first.event.interceptions, [
    { battery: { x: 39, y: 20 }, nationId: 'b', success: false },
    { battery: { x: 38, y: 20 }, nationId: 'b', success: true },
  ]);
  assert.deepEqual(first.event, replay.event);
  assert.equal(first.gold, 10_000);
  assert.equal(replay.gold, first.gold);
  assert.equal(first.event.intercepted, true);
  assert.equal(first.city.health, 400);
  assert.equal(first.units.getUnit(first.missile.id), undefined);
});

test('a successful first Patriot leaves subsequent batteries uncharged and nuclear interception creates no impact', () => {
  const h = defendedStrike(30_000, 'strike0', true);
  assert.equal(h.gold, 20_000);
  assert.equal(h.event.interceptions!.length, 1);
  assert.equal(h.event.intercepted, true);
  assert.equal(h.event.unitsDestroyed, 0);
  assert.equal(h.event.contaminatedTiles, 0);
  assert.equal(h.event.tiles, 0);
  assert.deepEqual(h.event.victimNationIds, []);
  assert.equal(h.city.health, 400);
  assert.equal(h.city.population, 20);
  assert.equal(h.map.tiles.flat().some(tile => tile.type === TileType.NuclearWaste), false);
});

test('Patriot attempts stop when funds run out; broke and broken batteries cannot fire', () => {
  const oneAttempt = defendedStrike(10_000);
  assert.equal(oneAttempt.gold, 0);
  assert.equal(oneAttempt.event.interceptions!.length, 1);
  assert.equal(oneAttempt.event.interceptions![0].success, false);
  assert.equal(oneAttempt.event.intercepted, undefined);
  assert.ok(oneAttempt.city.health < 400);
  const unaffordable = defendedStrike(9_999);
  assert.equal(unaffordable.gold, 9_999);
  assert.deepEqual(unaffordable.event.interceptions, []);
  assert.ok(unaffordable.city.health < 400);
  const broken = defendedStrike(10_000, 'strike12', false, true);
  assert.deepEqual(broken.event.interceptions, [{ battery: { x: 38, y: 20 }, nationId: 'b', success: true }]);
  assert.equal(broken.gold, 0);
});

test('Patriot coverage is exactly five tiles and does not apply to ordinary land attacks', () => {
  assert.equal(STRATEGIC_WEAPONS.warrior, undefined);
  const h = fixture();
  const pad = h.pad();
  h.city();
  h.battery(46, 20);
  h.nations.getResources('b').gold = 50_000;
  assert.equal(h.weapons.launch(h.unit(WARRIOR), 40, 20), false);
  assert.equal(h.nations.getResources('b').gold, 50_000);
  const missile = h.unit(ICBM);
  h.weapons.storage.storeMissile(missile, pad);
  assert.equal(h.weapons.launch(missile, 40, 20), true);
  assert.deepEqual(h.events[0].interceptions, []);
  assert.equal(h.nations.getResources('b').gold, 50_000);
  const atBoundary = fixture();
  const boundaryPad = atBoundary.pad();
  atBoundary.city();
  atBoundary.battery(45, 20);
  atBoundary.nations.getResources('b').gold = 50_000;
  const boundaryMissile = atBoundary.unit(ICBM);
  atBoundary.weapons.storage.storeMissile(boundaryMissile, boundaryPad);
  assert.equal(atBoundary.weapons.launch(boundaryMissile, 40, 20), true);
  assert.equal(atBoundary.events[0].interceptions!.length, 1);
  assert.equal(atBoundary.nations.getResources('b').gold, 40_000);
});
