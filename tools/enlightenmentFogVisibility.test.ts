import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ENLIGHTENMENT_CULTURE_NODE_ID, getCultureNodeById } from '../src/data/cultureTree.ts';
import { VisibilityState, VisibilitySystem } from '../src/systems/VisibilitySystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const mapData: MapData = {
  width: 2,
  height: 1,
  tileSize: 1,
  tiles: [[
    { x: 0, y: 0, type: TileType.Plains },
    { x: 1, y: 0, type: TileType.Plains },
  ]],
};

const gridSystem = { getTilesInRange: () => [] } as unknown as IGridSystem;

test('The Enlightenment and Fog Off share full-map visibility while the cheat stays independent', () => {
  const unlockedCultureNodeIds: string[] = [];
  const visibility = new VisibilitySystem(
    mapData,
    gridSystem,
    () => unlockedCultureNodeIds.includes(ENLIGHTENMENT_CULTURE_NODE_ID),
  );

  assert.equal(visibility.getState(1, 0), VisibilityState.Unseen, 'fog behaves normally first');

  visibility.setEnabled(false);
  assert.equal(visibility.getState(1, 0), VisibilityState.Visible, 'Fog Off reveals the map');
  visibility.setEnabled(true);
  assert.equal(visibility.getState(1, 0), VisibilityState.Unseen, 'Fog On restores normal fog');

  unlockedCultureNodeIds.push(ENLIGHTENMENT_CULTURE_NODE_ID);
  assert.equal(visibility.getState(1, 0), VisibilityState.Visible, 'completion immediately reveals the map');
  assert.equal(visibility.isEnabled(), false, 'the effective fog state remains off');

  visibility.setEnabled(false);
  visibility.setEnabled(true);
  assert.equal(visibility.getState(1, 0), VisibilityState.Visible, 'Fog On cannot undo the permanent reveal');
  assert.deepEqual(visibility.getExploredTileCoords(), [], 'the reveal does not overwrite exploration data');

  const restoredVisibility = new VisibilitySystem(
    mapData,
    gridSystem,
    () => unlockedCultureNodeIds.includes(ENLIGHTENMENT_CULTURE_NODE_ID),
  );
  assert.equal(
    restoredVisibility.getState(1, 0),
    VisibilityState.Visible,
    'restored Culture progress automatically reapplies the reveal',
  );
});

test('The Enlightenment Culture Tree text communicates the permanent map reveal', () => {
  assert.match(
    getCultureNodeById(ENLIGHTENMENT_CULTURE_NODE_ID)?.description ?? '',
    /Permanently reveals the entire world map\./,
  );
});
