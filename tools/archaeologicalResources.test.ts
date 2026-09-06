import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { HUMANISM_CULTURE_NODE_ID } from '../src/data/cultureTree.ts';
import {
  getNaturalResourceById,
  isNaturalResourceRevealed,
} from '../src/data/naturalResources.ts';
import { TileType } from '../src/types/map.ts';
import { isResourceExportEligible } from '../src/systems/ResourceAccessSystem.ts';

const EXPECTED = [
  ['ancient_pottery', 3, 0.8],
  ['ancient_coins', 5, 0.6],
  ['ancient_weapons', 7, 0.4],
  ['royal_relics', 10, 0.2],
  ['ancient_treasure', 15, 0.1],
  ['shipwreck', 25, 0.05],
] as const;

test('archaeological resources carry data-driven excavation metadata', () => {
  for (const [id, cultureValue, weight] of EXPECTED) {
    const resource = getNaturalResourceById(id);
    assert.ok(resource, id);
    assert.equal(resource.archaeological, true);
    assert.equal(resource.archaeologicalCultureValue, cultureValue);
    assert.equal(resource.revealCultureNodeId, HUMANISM_CULTURE_NODE_ID);
    assert.equal(resource.weight, weight);
    assert.equal(
      resource.improvementId,
      id === 'shipwreck' ? 'underwater_archaeological_site' : 'archaeological_dig',
    );
    assert.equal(resource.improvementIdByTileType, undefined);
    assert.deepEqual(resource.yieldBonus, {
      food: 0,
      production: 0,
      gold: 0,
      science: 0,
      culture: 0,
      happiness: 0,
    });
    assert.equal(isResourceExportEligible(id), false);
    assert.equal(
      existsSync(`public/assets/sprites/resources/${id}.png`),
      true,
      `${id} sprite`,
    );
  }
});

test('archaeological terrain rules keep shipwrecks at sea and sites on land', () => {
  const landIds = EXPECTED.slice(0, 5).map(([id]) => id);
  for (const id of landIds) {
    const resource = getNaturalResourceById(id)!;
    assert.equal(resource.allowedTileTypes.includes(TileType.Coast), false, id);
    assert.equal(resource.allowedTileTypes.includes(TileType.Ocean), false, id);
  }

  assert.deepEqual(
    getNaturalResourceById('shipwreck')!.allowedTileTypes,
    [TileType.Coast, TileType.Ocean],
  );
});

test('Humanism reveals archaeology independently of technology research', () => {
  const beforeHumanism = isNaturalResourceRevealed('ancient_pottery', {
    isTechnologyResearched: () => true,
    isCultureNodeUnlocked: () => false,
  });
  const afterHumanism = isNaturalResourceRevealed('ancient_pottery', {
    isTechnologyResearched: () => false,
    isCultureNodeUnlocked: (id) => id === HUMANISM_CULTURE_NODE_ID,
  });

  assert.equal(beforeHumanism, false);
  assert.equal(afterHumanism, true);
});
