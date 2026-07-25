/** Focused tests for UnitManager's primary and off-grid tile indexes. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SPY, AGENT, TRANSPORT_SHIP, WARRIOR, WORKER } from '../src/data/units.ts';
import { Unit } from '../src/entities/Unit.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';

const OWNER_ID = 'nation_test';
const COLLISION_IGNORING_WARRIOR: UnitType = {
  ...WARRIOR,
  id: 'collision_ignoring_warrior',
  name: 'Collision-Ignoring Warrior',
  ignoresUnitCollision: true,
};

function makeUnit(
  id: string,
  unitType: UnitType,
  tileX: number,
  tileY: number,
  options: { carriedByUnitId?: string; cargoUnitIds?: string[] } = {},
): Unit {
  return new Unit({
    id,
    name: unitType.name,
    ownerId: OWNER_ID,
    tileX,
    tileY,
    unitType,
    carriedByUnitId: options.carriedByUnitId,
    cargoUnitIds: options.cargoUnitIds,
  });
}

function restore(manager: UnitManager, unit: Unit): Unit {
  return manager.restoreUnit({
    id: unit.id,
    name: unit.name,
    ownerId: unit.ownerId,
    tileX: unit.tileX,
    tileY: unit.tileY,
    unitType: unit.unitType,
    health: unit.health,
    movementPoints: unit.movementPoints,
    carriedByUnitId: unit.carriedByUnitId,
    cargoUnitIds: unit.cargoUnitIds,
    isSleeping: unit.isSleeping,
  });
}

test('moving a unit updates both its old and new tile lookups', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 1, 1);
  manager.addUnit(warrior);

  assert.equal(manager.getUnitAt(1, 1), warrior);
  assert.deepEqual(manager.getUnitsAt(1, 1), [warrior]);
  assert.equal(manager.moveUnit(warrior.id, 3, 2), true);
  assert.equal(manager.getUnitAt(1, 1), null);
  assert.deepEqual(manager.getUnitsAt(1, 1), []);
  assert.equal(manager.getUnitAt(3, 2), warrior);
  assert.deepEqual(manager.getUnitsAt(3, 2), [warrior]);
});

test('covert operatives stack on an occupied tile without becoming getUnitAt occupants', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 2, 2);
  const spy = makeUnit('spy', SPY, 2, 2);
  const agent = makeUnit('agent', AGENT, 2, 2);
  manager.addUnit(warrior);
  manager.addUnit(spy);
  manager.addUnit(agent);

  assert.equal(manager.getUnitAt(2, 2), warrior);
  assert.deepEqual(manager.getUnitsAt(2, 2), [warrior, spy, agent]);
  assert.deepEqual(manager.getCovertOperativesAt(2, 2), [spy, agent]);

  assert.equal(manager.moveUnit(spy.id, 4, 3), true);
  assert.equal(manager.getUnitAt(4, 3), null);
  assert.deepEqual(manager.getUnitsAt(4, 3), [spy]);
  assert.deepEqual(manager.getCovertOperativesAt(4, 3), [spy]);
});

test('a collision-ignoring stacked unit remains discoverable when the primary unit leaves', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 2, 2);
  const offGrid = makeUnit('off_grid', COLLISION_IGNORING_WARRIOR, 2, 2);
  manager.addUnit(warrior);
  manager.addUnit(offGrid);

  assert.equal(manager.getUnitAt(2, 2), warrior);
  assert.deepEqual(manager.getUnitsAt(2, 2), [warrior, offGrid]);
  manager.removeUnit(warrior.id);
  assert.equal(manager.getUnitAt(2, 2), offGrid);
  assert.deepEqual(manager.getUnitsAt(2, 2), [offGrid]);
});

test('boarding removes cargo from tile indexes and unboarding restores it', () => {
  const manager = new UnitManager(8, 8);
  const transport = makeUnit('transport', TRANSPORT_SHIP, 3, 3);
  const worker = makeUnit('worker', WORKER, 2, 3);
  manager.addUnit(transport);
  manager.addUnit(worker);

  assert.equal(manager.boardUnit(worker.id, transport.id), true);
  assert.equal(worker.carriedByUnitId, transport.id);
  assert.equal(manager.getUnitAt(2, 3), null);
  assert.deepEqual(manager.getUnitsAt(2, 3), []);
  assert.equal(manager.getUnitAt(3, 3), transport);
  assert.deepEqual(manager.getUnitsAt(3, 3), [transport]);

  assert.equal(manager.moveUnit(transport.id, 4, 4), true);
  assert.equal(worker.tileX, 4);
  assert.equal(worker.tileY, 4);
  assert.equal(manager.getUnitAt(4, 4), transport);
  assert.deepEqual(manager.getUnitsAt(4, 4), [transport]);

  assert.equal(manager.unboardUnit(worker.id, 5, 4), true);
  assert.equal(worker.carriedByUnitId, undefined);
  assert.equal(manager.getUnitAt(5, 4), worker);
  assert.deepEqual(manager.getUnitsAt(5, 4), [worker]);
});

test('clear-and-restore rebuilds primary, off-grid, covert, and carried-unit state', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 1, 1);
  const offGrid = makeUnit('off_grid', COLLISION_IGNORING_WARRIOR, 1, 1);
  const spy = makeUnit('spy', SPY, 1, 1);
  const transport = makeUnit('transport', TRANSPORT_SHIP, 5, 5, { cargoUnitIds: ['worker'] });
  const worker = makeUnit('worker', WORKER, 5, 5, { carriedByUnitId: transport.id });
  for (const unit of [warrior, offGrid, spy, transport, worker]) manager.addUnit(unit);

  manager.clearAllSilently();
  assert.equal(manager.getUnitAt(1, 1), null);
  assert.deepEqual(manager.getUnitsAt(1, 1), []);

  const restored = [warrior, offGrid, spy, transport, worker].map((unit) => restore(manager, unit));
  manager.normalizeCargoLinks();
  const [restoredWarrior, restoredOffGrid, restoredSpy, restoredTransport, restoredWorker] = restored;

  assert.equal(manager.getUnitAt(1, 1), restoredWarrior);
  assert.deepEqual(manager.getUnitsAt(1, 1), [restoredWarrior, restoredOffGrid, restoredSpy]);
  assert.deepEqual(manager.getCovertOperativesAt(1, 1), [restoredSpy]);
  assert.equal(manager.getUnitAt(5, 5), restoredTransport);
  assert.deepEqual(manager.getUnitsAt(5, 5), [restoredTransport]);
  assert.equal(restoredWorker.carriedByUnitId, restoredTransport.id);
});

test('unit removal clears primary and off-grid index entries', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 6, 6);
  const spy = makeUnit('spy', SPY, 6, 6);
  manager.addUnit(warrior);
  manager.addUnit(spy);

  manager.removeUnit(spy.id);
  assert.deepEqual(manager.getCovertOperativesAt(6, 6), []);
  assert.deepEqual(manager.getUnitsAt(6, 6), [warrior]);

  manager.removeUnit(warrior.id);
  assert.equal(manager.getUnitAt(6, 6), null);
  assert.deepEqual(manager.getUnitsAt(6, 6), []);
});

test('owner index follows create, removal, ownership transfer, cargo transfer, and restore', () => {
  const manager = new UnitManager(8, 8);
  const transport = makeUnit('transport', TRANSPORT_SHIP, 3, 3);
  const worker = makeUnit('worker', WORKER, 2, 3);
  const warrior = makeUnit('warrior', WARRIOR, 1, 1);
  for (const unit of [transport, worker, warrior]) manager.addUnit(unit);
  const produced = manager.createUnit({
    type: WARRIOR,
    ownerId: OWNER_ID,
    tileX: 7,
    tileY: 7,
  });

  assert.deepEqual(manager.getUnitsByOwner(OWNER_ID), [transport, worker, warrior, produced]);
  assert.equal(manager.boardUnit(worker.id, transport.id), true);
  assert.deepEqual(manager.getCargoUnitsForTransport(transport), [worker]);
  assert.equal(manager.transferOwnership(transport.id, 'nation_new'), true);
  assert.deepEqual(manager.getUnitsByOwner('nation_new'), [transport, worker]);
  assert.deepEqual(manager.getUnitsByOwner(OWNER_ID), [warrior, produced]);

  manager.removeUnit(warrior.id);
  manager.removeUnit(produced.id);
  assert.deepEqual(manager.getUnitsByOwner(OWNER_ID), []);
  manager.clearAllSilently();
  assert.deepEqual(manager.getUnitsByOwner('nation_new'), []);

  const restoredTransport = restore(manager, transport);
  const restoredWorker = restore(manager, worker);
  manager.normalizeCargoLinks();
  assert.deepEqual(manager.getUnitsByOwner('nation_new'), [restoredTransport, restoredWorker]);
  assert.deepEqual(manager.getCargoUnitsForTransport(restoredTransport), [restoredWorker]);
});

test('moving a non-transport with no cargo keeps cargo lookup empty', () => {
  const manager = new UnitManager(8, 8);
  const warrior = makeUnit('warrior', WARRIOR, 1, 1);
  manager.addUnit(warrior);

  assert.deepEqual(manager.getCargoUnitsForTransport(warrior), []);
  assert.equal(manager.moveUnit(warrior.id, 2, 2), true);
  assert.deepEqual(manager.getCargoUnitsForTransport(warrior), []);
  assert.equal(manager.getUnitAt(2, 2), warrior);
});
