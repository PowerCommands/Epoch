/** Focused deterministic tests for AI emergency city defense. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SWORDSMAN, WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Unit } from '../src/entities/Unit.ts';
import { ProductionPurchaseSystem } from '../src/systems/ProductionPurchaseSystem.ts';
import { getCityUnitProductionBlockReason } from '../src/systems/ProductionRules.ts';
import {
  allocateEmergencyCityDefenders,
  detectEmergencyCityThreats,
  executeEmergencyDefenseAssignment,
  getEmergencyProductionThreats,
  getEmergencyPurchaseThreats,
  type EmergencyCityThreat,
} from '../src/systems/ai/EmergencyCityDefense.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const grid = new HexGridSystem();

function city(id = 'city_defender'): City {
  return new City({
    id,
    name: id,
    ownerId: 'defender',
    tileX: 5,
    tileY: 5,
    isCapital: true,
  });
}

function unit(id: string, ownerId: string, tileX: number, tileY: number): Unit {
  return new Unit({
    id,
    name: id,
    ownerId,
    tileX,
    tileY,
    unitType: WARRIOR,
  });
}

function detect(isAtWar: boolean): EmergencyCityThreat[] {
  return detectEmergencyCityThreats({
    nationId: 'defender',
    cities: [city()],
    units: [unit('enemy', 'attacker', 6, 5)],
    currentRound: 10,
    getDistance: (a, b) => grid.getDistance(a, b),
    isAtWar: () => isAtWar,
  });
}

test('peace plus a nearby foreign military unit does not trigger emergency defense', () => {
  assert.deepEqual(detect(false), []);
});

test('war plus credible nearby enemy force creates a critical city threat', () => {
  const threats = detect(true);
  assert.equal(threats.length, 1);
  assert.equal(threats[0].severity, 'critical');
  assert.match(threats[0].reason, /adjacent/);
});

test('a nearby friendly combat unit is uniquely reassigned to an unguarded threatened city', () => {
  const threat = detect(true)[0];
  const defender = unit('friendly', 'defender', 3, 5);
  const assignments = allocateEmergencyCityDefenders({
    nationId: 'defender',
    threats: [threat, { ...threat, city: city('second_city') }],
    friendlyUnits: [defender],
    getDistance: (a, b) => grid.getDistance(a, b),
    canReachCity: () => true,
    hasFriendlyMilitaryOnCity: () => false,
  });
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].unit.id, defender.id);
  assert.equal(assignments[0].threat.city.id, threat.city.id);
  const didMove = executeEmergencyDefenseAssignment({
    assignment: assignments[0],
    findPath: () => [{ x: 5, y: 5, type: TileType.Grassland }],
    moveAlongPath: (movingUnit, path) => {
      movingUnit.tileX = path[0].x;
      movingUnit.tileY = path[0].y;
    },
  });
  assert.equal(didMove, true);
  assert.deepEqual({ x: defender.tileX, y: defender.tileY }, { x: 5, y: 5 });
});

test('an inadequately defended emergency remains eligible for military-production override', () => {
  const threats = detect(true);
  assert.equal(getEmergencyProductionThreats(threats, () => false).length, 1);
  assert.equal(getEmergencyProductionThreats(threats, () => true).length, 0);
});

interface PurchaseHarness {
  system: ProductionPurchaseSystem;
  gold: { value: number };
  queueByCity: Map<string, Array<{ item: { kind: 'unit'; unitType: typeof WARRIOR } }>>;
  round: { value: number };
}

function makePurchaseHarness(startingGold: number, failCompletion = false): PurchaseHarness {
  const ownerByCity = new Map([
    ['city_a', { id: 'city_a', ownerId: 'defender' }],
    ['city_b', { id: 'city_b', ownerId: 'defender' }],
  ]);
  const queueByCity = new Map([
    ['city_a', [{ item: { kind: 'unit' as const, unitType: WARRIOR } }]],
    ['city_b', [{ item: { kind: 'unit' as const, unitType: WARRIOR } }]],
  ]);
  const gold = { value: startingGold };
  const resources = {
    get gold() { return gold.value; },
    set gold(value: number) { gold.value = value; },
  };
  const round = { value: 10 };
  const productionSystem = {
    getQueue: (cityId: string) => queueByCity.get(cityId) ?? [],
    getBuyCost: (cityId: string, index: number) =>
      queueByCity.get(cityId)?.[index] ? 100 : null,
    completeQueueEntry: (cityId: string, index: number) => {
      const queue = queueByCity.get(cityId);
      if (!queue?.[index]) return { ok: false as const, reason: 'Queue entry not found' };
      if (failCompletion) return { ok: false as const, reason: 'No placement tile' };
      queue.splice(index, 1);
      return { ok: true as const, item: { kind: 'unit' as const, unitType: WARRIOR } };
    },
  };
  const system = new ProductionPurchaseSystem(
    { getCity: (id: string) => ownerByCity.get(id) } as never,
    { getResources: () => resources } as never,
    productionSystem as never,
    {
      addGold: (_nationId: string, amount: number) => {
        gold.value += amount;
        return gold.value;
      },
      recalculateForNation: () => {},
    } as never,
    () => round.value,
  );
  return { system, gold, queueByCity, round };
}

test('AI can use the normal production purchase pipeline during an emergency', () => {
  const harness = makePurchaseHarness(500);
  const purchaseThreats = getEmergencyPurchaseThreats(detect(true), () => false);
  assert.equal(purchaseThreats.length, 1);
  const result = harness.system.purchase('city_a', 0);
  assert.deepEqual(result, { ok: true, cost: 100, goldBefore: 500, goldAfter: 400 });
  assert.equal(harness.queueByCity.get('city_a')?.length, 0);
});

test('emergency purchase cannot make gold negative', () => {
  const harness = makePurchaseHarness(99);
  assert.deepEqual(
    harness.system.purchase('city_a', 0),
    { ok: false, reason: 'Insufficient gold', cost: 100 },
  );
  assert.equal(harness.gold.value, 99);
});

test('blocked emergency completion refunds gold and does not consume the turn limit', () => {
  const harness = makePurchaseHarness(500, true);
  assert.deepEqual(
    harness.system.purchase('city_a', 0),
    { ok: false, reason: 'No placement tile', cost: 100 },
  );
  assert.equal(harness.gold.value, 500);
  assert.equal(harness.system.getQuote('city_b', 0).ok, true);
});

test('human and AI share one military-unit purchase per nation per turn', () => {
  const harness = makePurchaseHarness(500);
  assert.equal(harness.system.purchase('city_a', 0).ok, true);
  assert.deepEqual(
    harness.system.purchase('city_b', 0),
    {
      ok: false,
      reason: 'Only one military unit may be purchased per nation per turn',
      cost: 100,
    },
  );
  harness.round.value += 1;
  assert.equal(harness.system.purchase('city_b', 0).ok, true);
});

test('emergency purchasing stops when no city remains threatened', () => {
  assert.equal(getEmergencyPurchaseThreats(detect(true), () => false).length, 1);
  assert.equal(getEmergencyPurchaseThreats([], () => false).length, 0);
});

test('normal strategic-resource production restrictions remain authoritative', () => {
  const testCity = city();
  const mapData: MapData = {
    width: 1,
    height: 1,
    tiles: [[{ x: 0, y: 0, type: TileType.Grassland }]],
  };
  const reason = getCityUnitProductionBlockReason(
    testCity,
    SWORDSMAN,
    mapData,
    grid,
    {
      strategicResourceCapacitySystem: {
        getMissingRequirementReason: () => 'Requires 1 Iron',
      } as never,
    },
  );
  assert.equal(reason, 'Requires 1 Iron');
});
