/**
 * Focused tests: unit upgrades must satisfy the TARGET unit's strategic-resource
 * requirement using the same canonical capacity/access logic as production, so a
 * resource-gated unit (e.g. Horseman) cannot be created through an upgrade the
 * nation could not have built. Covers both the preview (AI reads it) and the
 * upgradeUnit mutation (AI + human both call it).
 *
 * Run with: npx tsx --test tools/unitUpgradeStrategicResource.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ARCHER, CHARIOT_ARCHER, HORSEMAN } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { StrategicResourceCapacitySystem } from '../src/systems/StrategicResourceCapacitySystem.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { UnitUpgradeSystem } from '../src/systems/UnitUpgradeSystem.ts';

const NATION = 'usa';

function harness() {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'USA', color: 0x224488 }));
  nations.getResources(NATION).gold = 100000; // never gold-blocked in these tests

  const units = new UnitManager(20, 20);

  // Canonical resource source counter (domestic tiles + imports + Foreign
  // Resource Exploitation Rights + manufactured all resolve through this single
  // method in ResourceAccessSystem; here it is a controllable stand-in).
  const sources = new Map<string, number>();
  const capacity = new StrategicResourceCapacitySystem(
    { getResourceSourceCount: (_nationId, resourceId) => sources.get(resourceId) ?? 0 },
    units,
  );

  // researchSystem omitted → targets count as unlocked, isolating the resource check.
  const upgrades = new UnitUpgradeSystem(nations, units, undefined, {}, capacity);

  let nextTile = 0;
  const addUnit = (id: string, unitType: typeof CHARIOT_ARCHER): Unit => {
    const unit = new Unit({ id, name: id, ownerId: NATION, unitType, tileX: nextTile++, tileY: 0 });
    units.addUnit(unit);
    return unit;
  };

  return { nations, units, capacity, upgrades, sources, addUnit };
}

// Reproduction + case 1: no required resource → upgrade rejected.
test('Chariot Archer → Horseman without Horses is rejected (both preview and mutation)', () => {
  const h = harness();
  h.sources.set('horses', 0);
  const unit = h.addUnit('u1', CHARIOT_ARCHER);

  const preview = h.upgrades.getUpgradePreview(unit, NATION); // AI path reads this
  assert.equal(preview.canUpgrade, false);
  assert.match(preview.reason ?? '', /Horses/);

  assert.equal(h.upgrades.upgradeUnit(unit, NATION), false); // AI + human mutation path
  assert.equal(unit.unitType.id, 'chariot_archer', 'unit was not upgraded');
});

// Case 2: sufficient domestic access → allowed.
test('Chariot Archer → Horseman with domestic Horse access is allowed', () => {
  const h = harness();
  h.sources.set('horses', 1); // 1 source → capacity 4
  const unit = h.addUnit('u1', CHARIOT_ARCHER);

  assert.equal(h.upgrades.getUpgradePreview(unit, NATION).canUpgrade, true);
  assert.equal(h.upgrades.upgradeUnit(unit, NATION), true);
  assert.equal(unit.unitType.id, 'horseman');
});

// Case 3 & 4: imported / Foreign Resource Exploitation access. Both are counted
// by the same canonical getResourceSourceCount, so a positive source count from
// either enables the upgrade exactly like a domestic source.
test('Chariot Archer → Horseman with imported or exploitation Horse access is allowed', () => {
  for (const label of ['imported', 'exploitation']) {
    const h = harness();
    h.sources.set('horses', 1); // represents an import or exploitation-rights source
    const unit = h.addUnit('u1', CHARIOT_ARCHER);
    assert.equal(h.upgrades.upgradeUnit(unit, NATION), true, `${label} source should allow upgrade`);
    assert.equal(unit.unitType.id, 'horseman');
  }
});

// Case 5: upgrade that would exceed strategic-resource capacity → rejected.
test('Chariot Archer → Horseman is rejected when Horse capacity is already full', () => {
  const h = harness();
  h.sources.set('horses', 1); // capacity = 4
  for (let i = 0; i < 4; i += 1) h.addUnit(`h${i}`, HORSEMAN); // 4 Horsemen already use all 4
  const unit = h.addUnit('u1', CHARIOT_ARCHER);

  const preview = h.upgrades.getUpgradePreview(unit, NATION);
  assert.equal(preview.canUpgrade, false);
  assert.match(preview.reason ?? '', /capacity/);
  assert.equal(h.upgrades.upgradeUnit(unit, NATION), false);
});

// Same-resource upgrade is capacity-neutral: replacing a Horseman with a Knight
// (both need Horses) must be allowed even at full capacity, because the source
// unit's reservation is freed.
test('Horseman → Knight is allowed at full capacity (same-resource, net-zero)', () => {
  const h = harness();
  h.sources.set('horses', 1); // capacity = 4
  const horsemen = Array.from({ length: 4 }, (_, i) => h.addUnit(`h${i}`, HORSEMAN)); // used = 4
  const upgraded = h.upgrades.upgradeUnit(horsemen[0], NATION);
  assert.equal(upgraded, true, 'a Horseman may upgrade to Knight without new Horse capacity');
  assert.equal(horsemen[0].unitType.id, 'knight');
});

// Case 6: target with no strategic-resource requirement → unaffected.
test('an upgrade to a unit without a resource requirement still works with no sources', () => {
  const h = harness();
  // No sources at all.
  const unit = h.addUnit('u1', ARCHER); // Archer → Composite Bowman (no requiredResource)
  assert.equal(h.upgrades.getUpgradePreview(unit, NATION).canUpgrade, true);
  assert.equal(h.upgrades.upgradeUnit(unit, NATION), true);
  assert.equal(unit.unitType.id, 'composite_bowman');
});
