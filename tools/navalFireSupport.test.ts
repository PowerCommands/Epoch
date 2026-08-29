/** Focused deterministic tests for AI naval emergency fire support. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ARCHER_GALLEY,
  BATTLESHIP,
  DESTROYER,
  FRIGATE,
  GALLEASS,
  SCOUT_BOAT,
  SUBMARINE,
  TRIREME,
  WARRIOR,
  WORK_BOAT,
} from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Unit } from '../src/entities/Unit.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import {
  allocateNavalFireSupport,
  isSuitableNavalFireSupportUnitType,
  type EmergencyCityThreat,
} from '../src/systems/ai/EmergencyCityDefense.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';

const grid = new HexGridSystem();

function city(id: string, tileX: number, tileY: number): City {
  return new City({ id, name: id, ownerId: 'defender', tileX, tileY, isCapital: id === 'capital' });
}

function unit(id: string, ownerId: string, tileX: number, tileY: number, unitType: UnitType): Unit {
  return new Unit({ id, name: id, ownerId, tileX, tileY, unitType });
}

function threat(
  threatCity: City,
  hostileUnits: Unit[],
  severity: EmergencyCityThreat['severity'] = 'critical',
): EmergencyCityThreat {
  return {
    city: threatCity,
    severity,
    threateningNationIds: [...new Set(hostileUnits.map((u) => u.ownerId))],
    hostileUnits,
    localHostileStrength: hostileUnits.reduce((sum, u) => sum + u.unitType.baseStrength, 0),
    nearestHostileDistance: 1,
    reason: 'test',
  };
}

const alwaysCoastal = () => true;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => grid.getDistance(a, b);
const neverInRange = () => false;

// ─── eligibility ─────────────────────────────────────────────────────────────

test('ranged warships qualify as naval fire support regardless of doctrine or name', () => {
  for (const rangedWarship of [ARCHER_GALLEY, GALLEASS, SUBMARINE, BATTLESHIP]) {
    assert.equal(isSuitableNavalFireSupportUnitType(rangedWarship), true, rangedWarship.name);
  }
});

test('melee ships, civilian sea units, recon boats and land units are not fire support', () => {
  for (const notFireSupport of [TRIREME, WORK_BOAT, SCOUT_BOAT, WARRIOR]) {
    assert.equal(isSuitableNavalFireSupportUnitType(notFireSupport), false, notFireSupport.name);
  }
});

test('ships without a real ranged attack (range<2 or no ranged strength) are excluded', () => {
  // Frigate has range but no ranged strength; Destroyer has ranged strength but range<2.
  assert.equal(isSuitableNavalFireSupportUnitType(FRIGATE), false);
  assert.equal(isSuitableNavalFireSupportUnitType(DESTROYER), false);
});

// ─── allocation ──────────────────────────────────────────────────────────────

test('case 1: nearby ranged warship is assigned to a land-attacked coastal city', () => {
  const bristol = city('bristol', 5, 5);
  const frenchInfantry = unit('inf', 'france', 6, 5, WARRIOR);
  const battleship = unit('bb', 'defender', 11, 5, BATTLESHIP); // distance 6, out of firing range

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(bristol, [frenchInfantry])],
    friendlyUnits: [battleship],
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 3,
  });

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].unit.id, 'bb');
  assert.equal(assignments[0].threat.city.id, 'bristol');
});

test('case 2: a coastal city threatened by enemy warships also draws fire support', () => {
  const port = city('port', 5, 5);
  const enemyBattleship = unit('e_bb', 'france', 6, 5, BATTLESHIP);
  const defender = unit('bb', 'defender', 9, 5, GALLEASS);

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(port, [enemyBattleship])],
    friendlyUnits: [defender],
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 3,
  });

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].unit.id, 'bb');
});

test('case 3: a ship already able to fire is preferred over a closer ship out of range', () => {
  const bristol = city('bristol', 5, 5);
  const attacker = unit('inf', 'france', 6, 5, WARRIOR);
  const inRangeShip = unit('far', 'defender', 10, 5, BATTLESHIP);  // farther from city
  const closerShip = unit('near', 'defender', 7, 5, BATTLESHIP);   // closer but out of range

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(bristol, [attacker])],
    friendlyUnits: [inRangeShip, closerShip],
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: (u) => u.id === 'far',
    reachRadius: 12,
    maxShipsPerThreat: 1,
  });

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].unit.id, 'far', 'in-range ship should be chosen despite being farther');
});

test('case 4: inland cities never receive naval fire support', () => {
  const inland = city('inland', 5, 5);
  const attacker = unit('inf', 'france', 6, 5, WARRIOR);
  const battleship = unit('bb', 'defender', 8, 5, BATTLESHIP);

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(inland, [attacker])],
    friendlyUnits: [battleship],
    isCoastalCity: () => false,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 3,
  });

  assert.deepEqual(assignments, []);
});

test('case 5: no suitable fleet within reach yields no assignment (no distant fleet dragged in)', () => {
  const bristol = city('bristol', 5, 5);
  const attacker = unit('inf', 'france', 6, 5, WARRIOR);
  const distantShip = unit('bb', 'defender', 40, 40, BATTLESHIP); // far beyond reach radius
  const meleeShipNearby = unit('tri', 'defender', 7, 5, TRIREME); // near but not ranged

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(bristol, [attacker])],
    friendlyUnits: [distantShip, meleeShipNearby],
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 3,
  });

  assert.deepEqual(assignments, []);
});

test('ships assigned per threat are capped and never double-assigned across cities', () => {
  const bristol = city('bristol', 5, 5);
  const london = city('london', 6, 5);
  const attackerA = unit('a', 'france', 4, 5, WARRIOR);
  const attackerB = unit('b', 'france', 7, 5, WARRIOR);
  const ships = [
    unit('s1', 'defender', 5, 6, BATTLESHIP),
    unit('s2', 'defender', 5, 4, BATTLESHIP),
    unit('s3', 'defender', 6, 6, BATTLESHIP),
  ];

  const assignments = allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(bristol, [attackerA, attackerB]), threat(london, [attackerA])],
    friendlyUnits: ships,
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 2,
  });

  // At most 2 to bristol (cap), and each ship serves at most one city.
  const bristolShips = assignments.filter((a) => a.threat.city.id === 'bristol');
  assert.ok(bristolShips.length <= 2);
  const uniqueShipIds = new Set(assignments.map((a) => a.unit.id));
  assert.equal(uniqueShipIds.size, assignments.length);
});

test('case 7: hysteresis keeps a ship on its previous city between equidistant threats', () => {
  // One ship exactly between two equally-critical threatened coastal cities.
  const west = city('west', 3, 5);
  const east = city('east', 7, 5);
  const attackerW = unit('aw', 'france', 3, 6, WARRIOR);
  const attackerE = unit('ae', 'france', 7, 6, WARRIOR);
  const ship = unit('bb', 'defender', 5, 5, BATTLESHIP); // equidistant from both cities

  const run = (previousCity: string) => allocateNavalFireSupport({
    nationId: 'defender',
    threats: [threat(west, [attackerW]), threat(east, [attackerE])],
    friendlyUnits: [ship],
    isCoastalCity: alwaysCoastal,
    getDistance: distance,
    isInFiringRange: neverInRange,
    reachRadius: 12,
    maxShipsPerThreat: 3,
    previousCityByUnit: new Map([[ship.id, previousCity]]),
  });

  assert.equal(run('east')[0].threat.city.id, 'east', 'should stay assigned to east');
  assert.equal(run('west')[0].threat.city.id, 'west', 'should stay assigned to west');
});
