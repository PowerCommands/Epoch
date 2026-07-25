import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Unit } from '../src/entities/Unit.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';

test('military strength is cached until a relevant unit event invalidates its owner', () => {
  const units = new UnitManager(8, 8);
  const cities = new CityManager();
  const warrior = makeWarrior('warrior-a', 'a', 1, 1);
  units.addUnit(warrior);
  const evaluation = new AIMilitaryEvaluationSystem(units, cities);

  const first = evaluation.getMilitaryStrength('a');
  const cached = evaluation.getMilitaryStrength('a');
  assert.strictEqual(cached, first);

  units.removeUnit(warrior.id);
  const afterKill = evaluation.getMilitaryStrength('a');
  assert.notStrictEqual(afterKill, first);
  assert.ok(afterKill.totalStrength < first.totalStrength);
});

test('damage and explicit round invalidation refresh cached military strength', () => {
  const units = new UnitManager(8, 8);
  const cities = new CityManager();
  const warrior = makeWarrior('warrior-a', 'a', 1, 1);
  units.addUnit(warrior);
  const evaluation = new AIMilitaryEvaluationSystem(units, cities);

  const healthy = evaluation.getMilitaryStrength('a');
  warrior.health /= 2;
  assert.strictEqual(evaluation.getMilitaryStrength('a'), healthy, 'unannounced mutation remains cached');
  units.notifyDamaged(warrior);
  const damaged = evaluation.getMilitaryStrength('a');
  assert.equal(damaged.totalStrength, healthy.totalStrength / 2);

  evaluation.invalidate();
  assert.notStrictEqual(evaluation.getMilitaryStrength('a'), damaged);
});

test('unit ownership transfer invalidates both nations without clearing unrelated entries', () => {
  const units = new UnitManager(8, 8);
  const cities = new CityManager();
  const warrior = makeWarrior('warrior-a', 'a', 1, 1);
  units.addUnit(warrior);
  const evaluation = new AIMilitaryEvaluationSystem(units, cities);

  const beforeA = evaluation.getMilitaryStrength('a');
  const beforeB = evaluation.getMilitaryStrength('b');
  const beforeC = evaluation.getMilitaryStrength('c');
  assert.equal(units.transferOwnership(warrior.id, 'b'), true);

  const afterA = evaluation.getMilitaryStrength('a');
  const afterB = evaluation.getMilitaryStrength('b');
  assert.notStrictEqual(afterA, beforeA);
  assert.notStrictEqual(afterB, beforeB);
  assert.strictEqual(evaluation.getMilitaryStrength('c'), beforeC);
  assert.equal(afterA.unitStrength, 0);
  assert.equal(afterB.unitStrength, beforeA.unitStrength);
});

test('city ownership transfer invalidates both the former and new owner', () => {
  const units = new UnitManager(8, 8);
  const cities = new CityManager();
  cities.addCity(makeCity('city-a', 'a', 1, 1));
  cities.addCity(makeCity('city-b', 'b', 5, 5));
  const evaluation = new AIMilitaryEvaluationSystem(units, cities);

  const beforeA = evaluation.getMilitaryStrength('a');
  const beforeB = evaluation.getMilitaryStrength('b');
  cities.transferOwnership('city-a', 'b');
  const afterA = evaluation.getMilitaryStrength('a');
  const afterB = evaluation.getMilitaryStrength('b');

  assert.notStrictEqual(afterA, beforeA);
  assert.notStrictEqual(afterB, beforeB);
  assert.equal(afterA.cityStrength, 0);
  assert.equal(afterB.cityStrength, beforeB.cityStrength * 2);
});

function makeWarrior(id: string, ownerId: string, tileX: number, tileY: number): Unit {
  return new Unit({
    id,
    name: WARRIOR.name,
    ownerId,
    tileX,
    tileY,
    unitType: WARRIOR,
  });
}

function makeCity(id: string, ownerId: string, tileX: number, tileY: number): City {
  return new City({
    id,
    name: id,
    ownerId,
    tileX,
    tileY,
    originNationId: ownerId,
  });
}
