import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectResourceLensRevealTiles, resourceLensCoordKey } from '../src/systems/ResourceMapLens.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

function makeMap(width = 5, height = 5): MapData {
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x) => ({ x, y, type: TileType.Ocean }))
  ));
  return { width, height, tileSize: 64, tiles };
}

test('resource lens reveals an eligible explored resource and only its explored neighbours', () => {
  const mapData = makeMap();
  mapData.tiles[2]![2]!.resourceId = 'fish';
  const explored = new Set([
    resourceLensCoordKey(2, 2),
    resourceLensCoordKey(3, 2),
    resourceLensCoordKey(2, 3),
    resourceLensCoordKey(0, 4),
  ]);

  const revealed = collectResourceLensRevealTiles(
    mapData,
    new HexGridSystem(),
    (x, y) => explored.has(resourceLensCoordKey(x, y)),
    () => true,
  );

  assert.equal(revealed.has(resourceLensCoordKey(2, 2)), true);
  assert.equal(revealed.has(resourceLensCoordKey(3, 2)), true);
  assert.equal(revealed.has(resourceLensCoordKey(2, 3)), true);
  assert.equal(revealed.has(resourceLensCoordKey(1, 2)), false, 'unexplored neighbour must stay hidden');
  assert.equal(revealed.has(resourceLensCoordKey(0, 4)), false, 'unrelated explored terrain stays fogged');
});

test('resource lens does not leak unexplored or technology-hidden resources', () => {
  const mapData = makeMap();
  mapData.tiles[1]![1]!.resourceId = 'oil';
  mapData.tiles[3]![3]!.resourceId = 'fish';

  const revealed = collectResourceLensRevealTiles(
    mapData,
    new HexGridSystem(),
    (x, y) => x !== 3 || y !== 3,
    (resourceId) => resourceId !== 'oil',
  );

  assert.equal(revealed.size, 0);
});

test('resource lens omits resources on tiles that already have an improvement', () => {
  const mapData = makeMap();
  mapData.tiles[1]![1]!.resourceId = 'fish';
  mapData.tiles[1]![1]!.improvementId = 'fishing_boats';
  mapData.tiles[3]![3]!.resourceId = 'pearls';

  const revealed = collectResourceLensRevealTiles(
    mapData,
    new HexGridSystem(),
    () => true,
    () => true,
  );

  assert.equal(
    revealed.has(resourceLensCoordKey(1, 1)),
    false,
    'an exploited resource must not be a reveal target',
  );
  assert.equal(
    revealed.has(resourceLensCoordKey(3, 3)),
    true,
    'an unimproved resource remains a reveal target',
  );
});

test('HUD exposes a separate resource-lens button to the right of culture', () => {
  const source = readFileSync(new URL('../src/ui/hud/MapLensToggleHud.ts', import.meta.url), 'utf8');
  assert.match(source, /RESOURCE_LABEL = '\\u\{1F48E\}'/);
  assert.match(source, /const resourceX = x \+ BUTTON_RADIUS \* 2 \+ BUTTON_GAP/);
  assert.match(source, /setOnResourceToggle/);
});
