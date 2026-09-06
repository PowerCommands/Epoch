import assert from 'node:assert/strict';
import test from 'node:test';

import {
  desiredArchaeologistCount,
  getArchaeologicalCultureValue,
  isUnexcavatedArchaeologicalTile,
  scoreLandArchaeologyTarget,
  scoreShipwreckTarget,
  MAX_ARCHAEOLOGISTS_PER_NATION,
} from '../src/systems/ai/archaeologyTargeting.ts';
import { TileType, type Tile } from '../src/types/map.ts';

function landTile(resourceId?: string, improvementId?: string): Tile {
  return { x: 0, y: 0, type: TileType.Plains, resourceId, improvementId };
}

test('culture value comes from resource metadata, not hardcoded AI numbers', () => {
  assert.equal(getArchaeologicalCultureValue('ancient_pottery'), 3);
  assert.equal(getArchaeologicalCultureValue('ancient_coins'), 5);
  assert.equal(getArchaeologicalCultureValue('ancient_weapons'), 7);
  assert.equal(getArchaeologicalCultureValue('royal_relics'), 10);
  assert.equal(getArchaeologicalCultureValue('ancient_treasure'), 15);
  assert.equal(getArchaeologicalCultureValue('shipwreck'), 25);
  assert.equal(getArchaeologicalCultureValue('wheat'), 0);
  assert.equal(getArchaeologicalCultureValue(undefined), 0);
});

test('higher-value sites are preferred when travel cost is comparable', () => {
  const treasure = scoreLandArchaeologyTarget({ cultureValue: 15, distance: 5, owned: true });
  const pottery = scoreLandArchaeologyTarget({ cultureValue: 3, distance: 5, owned: true });
  assert.ok(treasure > pottery);
});

test('distance meaningfully affects target selection among equal-value sites', () => {
  const near = scoreLandArchaeologyTarget({ cultureValue: 5, distance: 1, owned: true });
  const far = scoreLandArchaeologyTarget({ cultureValue: 5, distance: 12, owned: true });
  assert.ok(near > far);
});

test('own territory is preferred over a foreign exploitation site of equal value/distance', () => {
  const owned = scoreLandArchaeologyTarget({ cultureValue: 7, distance: 3, owned: true });
  const foreign = scoreLandArchaeologyTarget({ cultureValue: 7, distance: 3, owned: false });
  assert.ok(owned > foreign);
});

test('shipwrecks carry a stronger distance penalty than land digs', () => {
  const landDrop = scoreLandArchaeologyTarget({ cultureValue: 10, distance: 0, owned: true })
    - scoreLandArchaeologyTarget({ cultureValue: 10, distance: 10, owned: true });
  const wreckDrop = scoreShipwreckTarget(10, 0) - scoreShipwreckTarget(10, 10);
  assert.ok(wreckDrop > landDrop);
});

test('Archaeologist demand scales ~one per three targets and is capped', () => {
  assert.equal(desiredArchaeologistCount(0), 0);
  assert.equal(desiredArchaeologistCount(1), 1);
  assert.equal(desiredArchaeologistCount(3), 1);
  assert.equal(desiredArchaeologistCount(4), 2);
  assert.equal(desiredArchaeologistCount(6), 2);
  assert.equal(desiredArchaeologistCount(7), 3);
  assert.equal(desiredArchaeologistCount(100), MAX_ARCHAEOLOGISTS_PER_NATION);
});

test('an already-excavated tile is not a candidate target', () => {
  assert.equal(isUnexcavatedArchaeologicalTile(landTile('ancient_coins')), true);
  assert.equal(isUnexcavatedArchaeologicalTile(landTile('ancient_coins', 'archaeological_dig')), false);
  assert.equal(isUnexcavatedArchaeologicalTile(landTile('wheat')), false);
  assert.equal(isUnexcavatedArchaeologicalTile(landTile()), false);
});
