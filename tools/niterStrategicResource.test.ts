import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ARTILLERY,
  CANNON,
  CAVALRY,
  GATLING_GUN,
  GREAT_WAR_INFANTRY,
  MACHINE_GUN,
  MUSKETMAN,
  RIFLEMAN,
  ROCKET_ARTILLERY,
  SWORDSMAN,
} from '../src/data/units.ts';
import { Unit } from '../src/entities/Unit.ts';
import {
  STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE,
  StrategicResourceCapacitySystem,
} from '../src/systems/StrategicResourceCapacitySystem.ts';

const NATION_ID = 'nation_test';

function makeUnit(id: string, unitType: typeof MUSKETMAN): Unit {
  return new Unit({ id, name: unitType.name, ownerId: NATION_ID, tileX: 0, tileY: 0, unitType });
}

test('the four core Renaissance/Industrial gunpowder units require one Niter', () => {
  for (const unitType of [MUSKETMAN, CANNON, RIFLEMAN, ARTILLERY]) {
    assert.deepEqual(unitType.requiredResource, { resourceId: 'niter', amount: 1 }, unitType.name);
  }
  assert.notEqual(RIFLEMAN.requiredResource?.resourceId, 'iron');
});

test('one Niter source provides the normal shared capacity of four units', () => {
  const units: Unit[] = [];
  let niterSources = 1;
  const system = new StrategicResourceCapacitySystem(
    { getResourceSourceCount: (_nationId, resourceId) => resourceId === 'niter' ? niterSources : 0 },
    { getUnitsByOwner: () => units },
  );

  assert.equal(STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE, 4);
  for (const unit of [
    makeUnit('rifle-1', RIFLEMAN),
    makeUnit('rifle-2', RIFLEMAN),
    makeUnit('cannon-1', CANNON),
    makeUnit('artillery-1', ARTILLERY),
  ]) {
    assert.equal(system.canProduceUnit(NATION_ID, unit.unitType), true);
    units.push(unit);
    // Producing a unit occupies capacity; it never consumes the Niter source.
    assert.equal(system.getCapacity(NATION_ID, 'niter').sources, 1);
    assert.equal(system.getCapacity(NATION_ID, 'niter').capacity, 4);
  }
  assert.deepEqual(system.getCapacity(NATION_ID, 'niter'), {
    resourceId: 'niter', sources: 1, capacity: 4, used: 4, available: 0, deficit: 0,
  });
  assert.equal(system.canProduceUnit(NATION_ID, MUSKETMAN), false);
  assert.equal(system.getMissingRequirementReason(NATION_ID, MUSKETMAN), 'Requires Niter capacity');

  // Capacity is source-based and is not consumed or stockpiled by production.
  niterSources = 2;
  assert.equal(system.getCapacity(NATION_ID, 'niter').capacity, 8);
  assert.equal(system.getCapacity(NATION_ID, 'niter').available, 4);
  assert.equal(system.canProduceUnit(NATION_ID, MUSKETMAN), true);
});

test('explicitly out-of-scope gunpowder units and existing Iron/Horses behavior stay unchanged', () => {
  assert.deepEqual(CAVALRY.requiredResource, { resourceId: 'horses', amount: 1 });
  for (const unitType of [GATLING_GUN, GREAT_WAR_INFANTRY, MACHINE_GUN, ROCKET_ARTILLERY]) {
    assert.equal(unitType.requiredResource, undefined, unitType.name);
  }
  assert.deepEqual(SWORDSMAN.requiredResource, { resourceId: 'iron', amount: 1 });

  const horseUnits = Array.from({ length: 4 }, (_, index) => makeUnit(`cavalry-${index}`, CAVALRY));
  const system = new StrategicResourceCapacitySystem(
    { getResourceSourceCount: (_nationId, resourceId) => resourceId === 'horses' ? 1 : 0 },
    { getUnitsByOwner: () => horseUnits },
  );
  assert.equal(system.getCapacity(NATION_ID, 'horses').capacity, 4);
  assert.equal(system.canProduceUnit(NATION_ID, CAVALRY), false);
});
