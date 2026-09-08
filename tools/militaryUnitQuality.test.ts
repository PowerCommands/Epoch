import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WARRIOR, ARCHER, SETTLER, WORKER, RIFLEMAN, getUnitTypeById } from '../src/data/units.ts';
import { BARRACKS, ARMORY, MILITARY_ACADEMY, MILITARY_BASE } from '../src/data/buildings.ts';
import {
  resolveMilitaryQualityLevel,
  getMilitaryQualityMultiplier,
  getMilitaryQualityName,
  clampMilitaryQualityLevel,
} from '../src/data/unitQuality.ts';
import { getEffectiveMeleeStrength, getEffectiveRangedStrength } from '../src/utils/unitCombatStrength.ts';
import { City } from '../src/entities/City.ts';
import { Unit } from '../src/entities/Unit.ts';
import { CityBuildings } from '../src/entities/CityBuildings.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { resolveCombat, resolveRangedCombat } from '../src/systems/CombatResolver.ts';
import { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';

function levelFromBuildings(...buildingIds: string[]): number {
  const buildings = new CityBuildings('c');
  for (const id of buildingIds) buildings.addEntry(id, false);
  return resolveMilitaryQualityLevel((buildingId) => buildings.hasActive(buildingId));
}

// 1. No military building → Level 1.
test('no qualifying building yields Level 1 (Regular)', () => {
  assert.equal(levelFromBuildings(), 1);
  assert.equal(getMilitaryQualityName(1), 'Regular');
  assert.equal(getMilitaryQualityMultiplier(1), 1.0);
});

// 2. Barracks → Level 2.
test('Barracks yields Level 2 (Trained, 1.20x)', () => {
  assert.equal(levelFromBuildings(BARRACKS.id), 2);
  assert.equal(getMilitaryQualityMultiplier(2), 1.2);
});

// 3. Armory → Level 3.
test('Armory yields Level 3 (Professional, 1.40x)', () => {
  assert.equal(levelFromBuildings(ARMORY.id), 3);
  assert.equal(getMilitaryQualityMultiplier(3), 1.4);
});

// 4. Military Academy → Level 4.
test('Military Academy yields Level 4 (Elite, 1.60x)', () => {
  assert.equal(levelFromBuildings(MILITARY_ACADEMY.id), 4);
  assert.equal(getMilitaryQualityMultiplier(4), 1.6);
});

// 5. Military Base → Level 5.
test('Military Base yields Level 5 (Special Forces, 2.00x)', () => {
  assert.equal(levelFromBuildings(MILITARY_BASE.id), 5);
  assert.equal(getMilitaryQualityMultiplier(5), 2.0);
});

// 6. Highest qualifying building wins, regardless of the chain being complete.
test('highest qualifying building wins even without the intermediate chain', () => {
  assert.equal(levelFromBuildings(BARRACKS.id, MILITARY_BASE.id), 5);
  assert.equal(levelFromBuildings(MILITARY_ACADEMY.id), 4);
  assert.equal(levelFromBuildings(BARRACKS.id, ARMORY.id), 3);
});

// 7. Level is permanent: it does not change when the originating building is gone.
test('quality is permanent and independent of the current city buildings', () => {
  const buildings = new CityBuildings('c');
  buildings.addEntry(MILITARY_ACADEMY.id, false);
  const level = resolveMilitaryQualityLevel((id) => buildings.hasActive(id));
  const unit = new Unit({
    id: 'u1', name: RIFLEMAN.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: RIFLEMAN, qualityLevel: level,
  });
  assert.equal(unit.qualityLevel, 4);

  // Academy destroyed / sabotaged after production — unit keeps its level.
  buildings.remove(MILITARY_ACADEMY.id);
  assert.equal(resolveMilitaryQualityLevel((id) => buildings.hasActive(id)), 1);
  assert.equal(unit.qualityLevel, 4, 'produced unit retains its Level 4 quality');
});

// A broken (non-functioning) building must not grant quality.
test('a broken military building does not grant its quality tier', () => {
  const buildings = new CityBuildings('c');
  buildings.addEntry(MILITARY_BASE.id, true); // present but broken
  assert.equal(resolveMilitaryQualityLevel((id) => buildings.hasActive(id)), 1);
});

// 8. Upgrade preserves the level.
test('unit upgrade preserves the quality level', () => {
  const units = new UnitManager(8, 8);
  const rifleman = units.createUnit({ type: RIFLEMAN, ownerId: 'a', tileX: 1, tileY: 1, qualityLevel: 4 });
  assert.equal(rifleman.qualityLevel, 4);
  const target = getUnitTypeById('great_war_infantry');
  assert.ok(target, 'great_war_infantry exists');
  assert.equal(units.upgradeUnitType(rifleman.id, target!), true);
  assert.equal(rifleman.unitType.id, 'great_war_infantry');
  assert.equal(rifleman.qualityLevel, 4, 'quality survives equipment upgrade');
});

// 9. Save/load preserves the level (restore path).
test('restoreUnit round-trips the quality level', () => {
  const units = new UnitManager(8, 8);
  const restored = units.restoreUnit({
    id: 'u1', name: RIFLEMAN.name, ownerId: 'a', tileX: 2, tileY: 2, unitType: RIFLEMAN,
    health: RIFLEMAN.baseHealth, movementPoints: 2, isSleeping: false, qualityLevel: 5,
  });
  assert.equal(restored.qualityLevel, 5);
});

// 10. Missing quality data safely defaults to Level 1.
test('missing quality data defaults to Level 1', () => {
  assert.equal(clampMilitaryQualityLevel(undefined), 1);
  assert.equal(clampMilitaryQualityLevel(0), 1);
  assert.equal(clampMilitaryQualityLevel(99), 5);
  assert.equal(clampMilitaryQualityLevel(Number.NaN), 1);
  const unit = new Unit({ id: 'u', name: WARRIOR.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: WARRIOR });
  assert.equal(unit.qualityLevel, 1, 'a unit built without a quality gets Level 1');
});

// 11. Effective melee strength uses the correct multiplier.
test('effective melee strength applies the quality multiplier in combat', () => {
  const l1 = new Unit({ id: 'a', name: RIFLEMAN.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: RIFLEMAN });
  const l5 = new Unit({ id: 'b', name: RIFLEMAN.name, ownerId: 'b', tileX: 0, tileY: 0, unitType: RIFLEMAN, qualityLevel: 5 });
  assert.equal(getEffectiveMeleeStrength(l1), 48);
  assert.equal(getEffectiveMeleeStrength(l5), 96);

  const defenderA = new Unit({ id: 'd1', name: WARRIOR.name, ownerId: 'z', tileX: 0, tileY: 0, unitType: WARRIOR });
  const defenderB = new Unit({ id: 'd2', name: WARRIOR.name, ownerId: 'z', tileX: 0, tileY: 0, unitType: WARRIOR });
  const dmgL1 = resolveCombat(l1, defenderA).defenderDamageTaken;
  const dmgL5 = resolveCombat(l5, defenderB).defenderDamageTaken;
  assert.equal(dmgL5, dmgL1 * 2, 'Level 5 melee deals double the Level 1 damage');
});

// 12. Effective ranged strength uses the correct multiplier.
test('effective ranged strength applies the quality multiplier in combat', () => {
  const l1 = new Unit({ id: 'a', name: ARCHER.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: ARCHER });
  const l3 = new Unit({ id: 'b', name: ARCHER.name, ownerId: 'b', tileX: 0, tileY: 0, unitType: ARCHER, qualityLevel: 3 });
  assert.equal(getEffectiveRangedStrength(l1), 7);
  assert.ok(Math.abs(getEffectiveRangedStrength(l3) - 9.8) < 1e-9);

  const target1 = new Unit({ id: 't1', name: WARRIOR.name, ownerId: 'z', tileX: 0, tileY: 0, unitType: WARRIOR });
  const target2 = new Unit({ id: 't2', name: WARRIOR.name, ownerId: 'z', tileX: 0, tileY: 0, unitType: WARRIOR });
  const dmgL1 = resolveRangedCombat(l1, target1).defenderDamageTaken;
  const dmgL3 = resolveRangedCombat(l3, target2).defenderDamageTaken;
  assert.ok(dmgL3 > dmgL1, 'Level 3 ranged deals more damage than Level 1');
  assert.equal(dmgL1, 7);
  assert.equal(dmgL3, Math.round(7 * 1.4));
});

// 13. Civilian units are unaffected.
test('civilian units are excluded from quality effects', () => {
  const settler = new Unit({ id: 's', name: SETTLER.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: SETTLER });
  const worker = new Unit({ id: 'w', name: WORKER.name, ownerId: 'a', tileX: 0, tileY: 0, unitType: WORKER });
  // No combat strength regardless of any stored level.
  assert.equal(getEffectiveMeleeStrength(settler), 0);
  assert.equal(getEffectiveMeleeStrength(worker), 0);
});

// 14. AI/national military strength distinguishes Level 1 from Level 5 forces.
test('national military strength distinguishes Level 1 from Level 5 armies', () => {
  const cities = new CityManager();
  const regularArmy = new UnitManager(16, 16);
  const eliteArmy = new UnitManager(16, 16);
  for (let i = 0; i < 3; i++) {
    regularArmy.addUnit(new Unit({ id: `r${i}`, name: RIFLEMAN.name, ownerId: 'regular', tileX: i, tileY: 0, unitType: RIFLEMAN }));
    eliteArmy.addUnit(new Unit({ id: `e${i}`, name: RIFLEMAN.name, ownerId: 'elite', tileX: i, tileY: 0, unitType: RIFLEMAN, qualityLevel: 5 }));
  }
  const regularEval = new AIMilitaryEvaluationSystem(regularArmy, cities);
  const eliteEval = new AIMilitaryEvaluationSystem(eliteArmy, cities);

  const regularStrength = regularEval.getMilitaryStrength('regular').unitStrength;
  const eliteStrength = eliteEval.getMilitaryStrength('elite').unitStrength;
  assert.ok(regularStrength > 0);
  assert.equal(eliteStrength, regularStrength * 2, 'a Level 5 army evaluates at double a Level 1 army');
});
