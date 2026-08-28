import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';
import { getNaturalResourceById, isResourceAllowedOnTile } from '../src/data/naturalResources.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { ScenarioLoader } from '../src/systems/ScenarioLoader.ts';
import { TileType } from '../src/types/map.ts';
import type { ScenarioData } from '../src/types/scenario.ts';

const PROJECT_ROOT = new URL('../', import.meta.url);
const ICON_URL = new URL('../public/assets/sprites/resources/natural_gas.png', import.meta.url);

test('Natural Gas is a strategic, Biology-gated natural resource', () => {
  const resource = getNaturalResourceById('natural_gas');

  assert.ok(resource);
  assert.equal(resource.name, 'Natural Gas');
  assert.equal(resource.category, 'strategic');
  assert.equal(resource.iconKey, 'resource_natural_gas');
  assert.equal(resource.revealTechId, 'biology');
  assert.equal(resource.requiredTechId, 'biology');
  assert.equal(resource.improvementId, 'oil_well');
  assert.equal(isResourceAllowedOnTile(resource.id, TileType.Plains), true);
});

test('the editor manifest exposes Natural Gas with its canonical icon', () => {
  const manifest = JSON.parse(readFileSync(new URL('public/assets/data/natural-resources-manifest.json', PROJECT_ROOT), 'utf8')) as {
    resources: Array<{ id: string; name: string; category: string; allowedTileTypes: string[]; iconPath: string }>;
  };
  const resource = manifest.resources.find((entry) => entry.id === 'natural_gas');

  assert.deepEqual(resource, {
    id: 'natural_gas',
    name: 'Natural Gas',
    category: 'strategic',
    allowedTileTypes: ['desert', 'plains', 'beach', 'meadow', 'ice'],
    iconPath: '/assets/sprites/resources/natural_gas.png',
  });
});

test('a scenario-authored Natural Gas tile survives runtime loading', () => {
  const scenario = {
    meta: { name: 'Natural Gas test', version: 1 },
    map: {
      width: 1,
      height: 1,
      tileSize: 48,
      tiles: [{ q: 0, r: 0, type: 'plains', resourceId: 'natural_gas' }],
    },
    nations: [],
    cities: [],
    units: [],
  } as ScenarioData;

  const parsed = ScenarioLoader.parse(scenario);
  assert.equal(parsed.mapData.tiles[0][0].resourceId, 'natural_gas');
  assert.equal(getNaturalResourceById(parsed.mapData.tiles[0][0].resourceId ?? '')?.name, 'Natural Gas');

  parsed.mapData.tiles[0][0].ownerId = 'test_nation';
  const resourceAccess = new ResourceAccessSystem(parsed.mapData, { getAllDeals: () => [] });
  assert.equal(resourceAccess.hasOwnResource('test_nation', 'natural_gas'), true);
});

test('Natural Gas icon is a non-empty 256px transparent PNG', async () => {
  const image = await loadImage(fileURLToPath(ICON_URL));
  assert.equal(image.width, 256);
  assert.equal(image.height, 256);

  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let transparentPixels = 0;
  let opaquePixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] === 0) transparentPixels += 1;
    if (pixels[index] > 0) opaquePixels += 1;
  }

  assert.ok(transparentPixels > 0);
  assert.ok(opaquePixels > 0);
});
