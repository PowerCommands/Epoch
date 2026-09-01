/**
 * Fix 2B — an attack that pushes a nation's own original capital below the
 * defensive collapse threshold (10% of max city health) forces capitulation to the
 * attacker responsible for the crossing hit, without requiring a capture.
 *
 * These drive real city combat through CombatSystem.tryAttack with a recording
 * stub resolver, so the crossing detection, coalition attribution, and the
 * skip-capture / skip-collapse behaviour are all exercised end to end.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import {
  CombatSystem,
  DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT,
  ORIGINAL_CAPITAL_COLLAPSE_HEALTH,
  resolveOriginalCapitalCollapsePercent,
} from '../src/systems/CombatSystem.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import type { NationCollapseSystem } from '../src/systems/NationCollapseSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const DEFENDER = 'nation_mongolia';
const ATTACKER_A = 'nation_china';
const ATTACKER_B = 'nation_france';

const CITY_X = 2;
const CITY_Y = 2;

function meleeType(strength: number): UnitType {
  return {
    id: 'melee', name: 'Melee', baseHealth: 100, baseStrength: strength,
    movementPoints: 2, range: 1,
  } as unknown as UnitType;
}

function rangedType(strength: number): UnitType {
  return {
    id: 'ranged', name: 'Ranged', baseHealth: 100, baseStrength: 5, rangedStrength: strength,
    movementPoints: 2, range: 2,
  } as unknown as UnitType;
}

function makeMap(width = 6, height = 6): MapData {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push({ x, y, type: TileType.Plains, ownerId: undefined });
    tiles.push(row);
  }
  return { width, height, tileSize: 32, tiles } as unknown as MapData;
}

// Adjacency/range are not what we test here, so a stub keeps the target resolution
// deterministic; getTilesInRange lets a control-case capture run its culture claim.
const gridStub = {
  getDistance: () => 1,
  isAdjacent: () => true,
  getTilesInRange: () => [],
} as unknown as IGridSystem;

function harness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: DEFENDER, name: 'Mongolia', color: 0x1e90ff }));
  nationManager.addNation(new Nation({ id: ATTACKER_A, name: 'China', color: 0xde2910 }));
  nationManager.addNation(new Nation({ id: ATTACKER_B, name: 'France', color: 0x002395 }));

  const mapData = makeMap();
  const cityManager = new CityManager();
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happiness);
  const unitManager = new UnitManager(mapData.width, mapData.height);
  const diplomacy = new DiplomacyManager(turnManager);

  const collapses: string[] = [];
  const collapseStub = {
    collapse: (input: { nationId: string }) => { collapses.push(input.nationId); return null; },
  } as unknown as NationCollapseSystem;

  const combat = new CombatSystem(
    unitManager, turnManager, cityManager, productionSystem, mapData, diplomacy,
    gridStub, () => false, undefined, () => false, undefined, collapseStub, undefined,
  );

  const calls: Array<{ defender: string; attacker: string }> = [];
  let resolverReturn = true;
  combat.setOriginalCapitalCollapseResolver((_city, defenderId, attackerId) => {
    calls.push({ defender: defenderId, attacker: attackerId });
    return resolverReturn;
  });

  const addCity = (health: number, isOriginalCapital = true): City => {
    const city = new City({
      id: 'cap', name: 'Ulaanbaatar', ownerId: DEFENDER, originNationId: DEFENDER,
      tileX: CITY_X, tileY: CITY_Y, isCapital: isOriginalCapital,
    });
    city.health = health;
    cityManager.addCity(city);
    return city;
  };

  const addAttacker = (nationId: string, unitType: UnitType, id: string, tileX: number, tileY: number): Unit => {
    const unit = new Unit({ id, name: id, ownerId: nationId, unitType, tileX, tileY });
    unitManager.addUnit(unit);
    return unit;
  };

  const attack = (unit: Unit): boolean => {
    unit.movementPoints = unit.maxMovementPoints;
    return combat.tryAttack(unit, CITY_X, CITY_Y, { allowOutOfTurn: true });
  };

  return {
    nationManager, cityManager, diplomacy, combat, calls, collapses,
    addCity, addAttacker, attack,
    setResolverReturn: (value: boolean) => { resolverReturn = value; },
  };
}

test('an attack crossing the original capital below 10% capitulates the defender to that attacker', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  const city = h.addCity(25); // above 20 (= 10% of 200)
  const attacker = h.addAttacker(ATTACKER_A, rangedType(10), 'a', CITY_X, CITY_Y - 1);

  assert.ok(city.health >= ORIGINAL_CAPITAL_COLLAPSE_HEALTH);
  h.attack(attacker); // 25 -> 15, crosses below 20

  assert.deepEqual(h.calls, [{ defender: DEFENDER, attacker: ATTACKER_A }]);
});

test('an attack that leaves the original capital above 10% does not capitulate', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.addCity(100);
  const attacker = h.addAttacker(ATTACKER_A, rangedType(10), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // 100 -> 90, still above 20

  assert.equal(h.calls.length, 0);
});

test('a capital already below 10% before the attack does not re-trigger', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.addCity(15); // already below 20
  const attacker = h.addAttacker(ATTACKER_A, rangedType(10), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // 15 -> 5, was already below the line

  assert.equal(h.calls.length, 0);
});

test('in a coalition war, only the attacker whose hit crosses the threshold is credited', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.diplomacy.declareWar(ATTACKER_B, DEFENDER);
  h.addCity(40);
  const first = h.addAttacker(ATTACKER_A, rangedType(10), 'a', CITY_X, CITY_Y - 1);
  const second = h.addAttacker(ATTACKER_B, rangedType(15), 'b', CITY_X - 1, CITY_Y);

  h.attack(first); // 40 -> 30, no crossing
  assert.equal(h.calls.length, 0);

  h.attack(second); // 30 -> 15, crosses below 20

  assert.deepEqual(h.calls, [{ defender: DEFENDER, attacker: ATTACKER_B }]);
});

test('a non-original city dropping below 10% does not trigger capitulation', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.addCity(25, /* isOriginalCapital */ false);
  const attacker = h.addAttacker(ATTACKER_A, rangedType(10), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // 25 -> 15, but it is not the original capital

  assert.equal(h.calls.length, 0);
});

test('a resolved capitulation skips capture and nation collapse for the same attack', () => {
  const h = harness();
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  const city = h.addCity(21); // the defender's only city; a melee hit would capture it
  const attacker = h.addAttacker(ATTACKER_A, meleeType(100), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // would capture (city falls to 0) but capitulation intervenes

  assert.deepEqual(h.calls, [{ defender: DEFENDER, attacker: ATTACKER_A }]);
  assert.equal(city.ownerId, DEFENDER, 'city must not be captured');
  assert.ok(city.health >= 1, 'capital stays standing rather than a 0-HP ghost');
  assert.equal(h.collapses.length, 0, 'nation collapse must not run');
  assert.ok(h.nationManager.getNation(DEFENDER), 'defender still exists');
});

test('without the capitulation the same last-city melee hit captures and collapses the nation', () => {
  const h = harness();
  h.setResolverReturn(false); // e.g. hierarchy/integrity rules blocked the vassal outcome
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  const city = h.addCity(21);
  const attacker = h.addAttacker(ATTACKER_A, meleeType(100), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker);

  assert.equal(h.calls.length, 1, 'the crossing was still detected and offered');
  assert.equal(city.ownerId, ATTACKER_A, 'capture proceeds when capitulation is refused');
  assert.deepEqual(h.collapses, [DEFENDER], 'normal collapse handling runs');
});

// --- Scenario-configurable threshold ---------------------------------------

test('resolveOriginalCapitalCollapsePercent clamps and defaults', () => {
  assert.equal(resolveOriginalCapitalCollapsePercent(undefined), DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT);
  assert.equal(resolveOriginalCapitalCollapsePercent(25), 25);
  assert.equal(resolveOriginalCapitalCollapsePercent(0), 0); // valid: disables the rule
  assert.equal(resolveOriginalCapitalCollapsePercent(100), 100);
  assert.equal(resolveOriginalCapitalCollapsePercent(-5), DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT);
  assert.equal(resolveOriginalCapitalCollapsePercent(150), DEFAULT_ORIGINAL_CAPITAL_COLLAPSE_PERCENT);
  assert.equal(resolveOriginalCapitalCollapsePercent(12.9), 12); // floored
});

test('a higher configured threshold triggers capitulation earlier', () => {
  const h = harness();
  h.combat.setOriginalCapitalCollapsePercent(25); // threshold = 25% of 200 = 50 HP
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.addCity(60); // above 50, but far above the default 20
  const attacker = h.addAttacker(ATTACKER_A, rangedType(15), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // 60 -> 45, crosses the 50 line (would NOT cross the default 20)

  assert.deepEqual(h.calls, [{ defender: DEFENDER, attacker: ATTACKER_A }]);
});

test('a threshold of 0 disables original-capital capitulation entirely', () => {
  const h = harness();
  h.combat.setOriginalCapitalCollapsePercent(0);
  h.diplomacy.declareWar(ATTACKER_A, DEFENDER);
  h.addCity(25);
  const attacker = h.addAttacker(ATTACKER_A, rangedType(20), 'a', CITY_X, CITY_Y - 1);

  h.attack(attacker); // 25 -> 5; with the rule disabled nothing triggers

  assert.equal(h.calls.length, 0);
});
