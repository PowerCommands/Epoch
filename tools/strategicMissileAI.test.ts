import assert from 'node:assert/strict';
import test from 'node:test';
import { ICBM, NUCLEAR_MISSILE } from '../src/data/units';
import { MISSILE_LAUNCH_PAD } from '../src/data/buildings';
import { getStrategicWeaponProfile, STRATEGIC_WEAPONS } from '../src/data/strategicWeapons';
import { getTechnologyById } from '../src/data/technologies';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { TileType, type MapData } from '../src/types/map';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { StrategicWeaponsSystem, type StrategicDetonation } from '../src/systems/StrategicWeaponsSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { getNuclearCapability, runStrategicWeaponsAI, type StrategicAIContext } from '../src/systems/ai/AIStrategicWeapons';

function harness() {
  const map: MapData = { width: 64, height: 24, tileSize: 1, tiles: Array.from({ length: 24 }, (_, y) => Array.from({ length: 64 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const grid = new HexGridSystem(), units = new UnitManager(64, 24), cities = new CityManager(), nations = new NationManager();
  for (const id of ['a', 'b']) nations.addNation(new Nation({ id, name: id, color: 1 }));
  const diplomacy = new DiplomacyManager(); diplomacy.declareWar('a', 'b');
  const weapons = new StrategicWeaponsSystem(units, cities, map, grid, diplomacy);
  weapons.storage.setNationManager(nations);
  const city = (ownerId: string, x: number, y = 10) => {
    const c = new City({ id: `city_${ownerId}`, name: ownerId, ownerId, tileX: x, tileY: y });
    c.health = 400; c.population = 20; c.ownedTileCoords = [{ x, y }]; cities.addCity(c); map.tiles[y][x].ownerId = ownerId; return c;
  };
  const home = city('a', 2), enemy = city('b', 55);
  const pad = (owner: City, x: number, y = 10) => {
    owner.ownedTileCoords.push({ x, y });
    Object.assign(map.tiles[y][x], { ownerId: owner.ownerId, buildingId: MISSILE_LAUNCH_PAD.id });
    cities.getBuildings(owner.id).add(MISSILE_LAUNCH_PAD);
    return map.tiles[y][x];
  };
  const launchPad = pad(home, 3);
  const missile = (type = ICBM) => {
    const unit = new Unit({ id: `missile_${units.getAllUnits().length}`, name: type.name, ownerId: 'a', tileX: 3, tileY: 10, unitType: type });
    units.addUnit(unit); assert.ok(weapons.storage.storeMissile(unit, launchPad)); return unit;
  };
  const events: StrategicDetonation[] = []; weapons.onDetonation(event => events.push(event));
  const context: StrategicAIContext = { nationId: 'a', units, cities, map, grid, weapons, atWar: id => id === 'b', known: () => true,
    aggression: 0.5, warTolerance: 0.5, relation: () => ({ hostility: 50, trust: 0, fear: 0 }), move: () => {}, log: () => {}, round: 1 };
  return { map, units, cities, nations, weapons, missile, launchPad, home, enemy, pad, events, context };
}

test('specified technologies unlock the launch facility, global delivery and separate nuclear component', () => {
  for (const [tech, kind, id] of [['rocketry', 'building', 'nuclear_silo'], ['satellites', 'unit', 'icbm'], ['nuclear_fission', 'strategicComponent', 'nuclear_warhead']]) {
    assert.ok(getTechnologyById(tech)?.unlocks.some(unlock => unlock.kind === kind && unlock.id === id));
  }
});

test('conventional AI ICBM strikes an enemy city far outside limited missile range', () => {
  const h = harness(), missile = h.missile();
  runStrategicWeaponsAI(h.context);
  assert.equal(h.units.getUnit(missile.id), undefined);
  assert.equal(h.events.length, 1); assert.equal(h.events[0].nuclear, false);
  assert.equal(h.enemy.health, 400 - STRATEGIC_WEAPONS.atomic_bomb.cityDamage);
  assert.equal(h.map.tiles[10][55].type, TileType.Plains);
});

test('AI values a visible enemy launch facility without inspecting its stored arsenal', () => {
  const h = harness(); h.pad(h.enemy, 35); h.missile();
  runStrategicWeaponsAI(h.context);
  assert.equal(h.events.length, 1);
  assert.ok(h.context.grid.getDistance(h.events[0].target, { x: 35, y: 10 }) <= 2);
  assert.equal(h.enemy.health, 400);
});

test('hidden magazine contents do not change the AI choice between visible launch pads', () => {
  const h = harness(); h.pad(h.enemy, 35); h.pad(h.enemy, 44); h.missile();
  for (let index = 0; index < 4; index++) {
    const hidden = new Unit({ id: `hidden_${index}`, name: ICBM.name, ownerId: 'b', tileX: 44, tileY: 10, unitType: ICBM });
    h.units.addUnit(hidden); assert.ok(h.weapons.storage.storeMissile(hidden, { x: 44, y: 10 }));
  }
  runStrategicWeaponsAI(h.context);
  assert.equal(h.events.length, 1);
  assert.ok(h.context.grid.getDistance(h.events[0].target, { x: 35, y: 10 }) <= 2,
    'equally valuable visible installations retain stable coordinate ordering regardless of hidden stockpiles');
});

test('unknown enemy targets and broken launch facilities do not fire', () => {
  const h = harness(), missile = h.missile();
  runStrategicWeaponsAI({ ...h.context, known: x => x < 10 });
  assert.ok(h.units.getUnit(missile.id)); assert.equal(h.events.length, 0);
  h.launchPad.buildingBroken = true;
  runStrategicWeaponsAI(h.context);
  assert.ok(h.units.getUnit(missile.id)); assert.equal(h.events.length, 0);
});

test('AI mounts a produced warhead and retains a conservative nuclear deterrent', () => {
  const h = harness(), missile = h.missile(); h.nations.getNation('a')!.nuclearWarheads = 1;
  runStrategicWeaponsAI(h.context);
  assert.equal(missile.nuclearArmed, true); assert.equal(h.nations.getNation('a')!.nuclearWarheads, 0);
  assert.equal(getStrategicWeaponProfile(missile), STRATEGIC_WEAPONS.nuclear_missile);
  assert.equal(h.events.length, 0);
  assert.equal(getNuclearCapability('a', h.units, h.cities, h.weapons.storage).ready, 1);
  h.launchPad.buildingBroken = true;
  const arsenal = getNuclearCapability('a', h.units, h.cities, h.weapons.storage);
  assert.equal(arsenal.stockpile, 1); assert.equal(arsenal.ready, 0);
});

test('ordinary Nuclear Missile keeps limited range in the same launch facility', () => {
  const h = harness(), missile = h.missile(NUCLEAR_MISSILE);
  assert.match(h.weapons.getLaunchFailure(missile, 55, 10) ?? '', /range/);
  assert.ok(h.units.getUnit(missile.id));
});
