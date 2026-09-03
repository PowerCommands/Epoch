import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveCityViewPosition } from '../src/ui/CityView.ts';

test('City View sits flush against the rightmost city tile when it fits', () => {
  assert.deepEqual(
    resolveCityViewPosition(
      { screenX: 400, screenY: 500, rightEdgeScreenX: 720 },
      760,
      700,
      1600,
      1000,
    ),
    { left: 720, top: 150 },
  );
});

test('City View moves as far right as possible when it cannot fit beside the tile', () => {
  assert.deepEqual(
    resolveCityViewPosition(
      { screenX: 900, screenY: 500, rightEdgeScreenX: 1200 },
      760,
      1000,
      1600,
      1000,
    ),
    { left: 840, top: 0 },
  );
});
