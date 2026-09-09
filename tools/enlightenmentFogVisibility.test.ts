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

test('The Enlightenment no longer reveals the map; only the independent Fog Off cheat does', () => {
  const visibility = new VisibilitySystem(mapData, gridSystem);

  assert.equal(visibility.getState(1, 0), VisibilityState.Unseen, 'fog behaves normally first');

  // The Fog Off cheat still reveals every tile as fully Visible.
  visibility.setEnabled(false);
  assert.equal(visibility.getState(1, 0), VisibilityState.Visible, 'Fog Off reveals the map');
  visibility.setEnabled(true);
  assert.equal(visibility.getState(1, 0), VisibilityState.Unseen, 'Fog On restores normal fog');
});

test('The Enlightenment Culture Tree text no longer claims a world-map reveal', () => {
  const description = getCultureNodeById(ENLIGHTENMENT_CULTURE_NODE_ID)?.description ?? '';
  assert.doesNotMatch(
    description,
    /reveals the entire world map/i,
    'The Enlightenment must not advertise a world-map reveal',
  );
  // It must still communicate that it enables the World Council.
  assert.match(description, /World Council/i, 'The Enlightenment still enables the World Council');
});
