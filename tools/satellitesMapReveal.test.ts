import assert from 'node:assert/strict';
import { test } from 'node:test';

import { VisibilityState, VisibilitySystem } from '../src/systems/VisibilitySystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import {
  ALL_TECHNOLOGIES,
  WORLD_MAP_REVEAL_TECHNOLOGY_ID,
  getTechnologyById,
} from '../src/data/technologies.ts';
import { CULTURE_TREE, getCultureNodeById } from '../src/data/cultureTree.ts';
import { getBuildingById } from '../src/data/buildings.ts';
import { getUnitTypeById } from '../src/data/units.ts';
import { getWonderById } from '../src/data/wonders.ts';
import { getImprovementById } from '../src/data/improvements.ts';

const mapData: MapData = {
  width: 3,
  height: 1,
  tileSize: 1,
  tiles: [[
    { x: 0, y: 0, type: TileType.Plains },
    { x: 1, y: 0, type: TileType.Plains },
    { x: 2, y: 0, type: TileType.Plains },
  ]],
};

// Grid stub: a source only sees its own tile, so update() grants live vision to
// exactly one tile and we can assert the rest stay Explored (not Visible).
const gridSystem = {
  getTilesInRange: (center: { x: number; y: number }) => [{ x: center.x, y: center.y }],
} as unknown as IGridSystem;

test('Satellites reveal marks all terrain Explored (geographic discovery), not Visible', () => {
  const visibility = new VisibilitySystem(mapData, gridSystem);

  const revealed = visibility.revealEntireMapAsExplored();
  assert.equal(revealed, 3, 'every Unseen tile is newly revealed');

  for (let x = 0; x < 3; x++) {
    assert.equal(visibility.getState(x, 0), VisibilityState.Explored, `tile ${x} is Explored`);
    assert.equal(visibility.isTileExploredByHuman(x, 0), true, `tile ${x} counts as discovered`);
    assert.equal(visibility.isTileVisibleToHuman(x, 0), false, `tile ${x} has no live vision`);
    assert.equal(visibility.canRenderObjectAt(x, 0), false, `no enemy objects render on tile ${x}`);
  }

  // Calling again is idempotent and reveals nothing further.
  assert.equal(visibility.revealEntireMapAsExplored(), 0, 'reveal is idempotent');
});

test('Satellites reveal does NOT grant permanent global live vision', () => {
  const visibility = new VisibilitySystem(mapData, gridSystem);
  visibility.revealEntireMapAsExplored();

  // A human unit at tile 0 gains vision of tile 0 only; distant tiles remain
  // Explored, so enemy units elsewhere stay hidden by ordinary fog.
  visibility.update([], [{ tileX: 0, tileY: 0 }]);

  assert.equal(visibility.isTileVisibleToHuman(0, 0), true, 'observed tile is live-visible');
  assert.equal(visibility.isTileVisibleToHuman(2, 0), false, 'distant tile is not live-visible');
  assert.equal(visibility.isTileExploredByHuman(2, 0), true, 'distant tile stays geographically known');
});

test('Satellites reveal persists across save/load and stays geographic-only', () => {
  const visibility = new VisibilitySystem(mapData, gridSystem);
  visibility.revealEntireMapAsExplored();

  const saved = visibility.getExploredTileCoords();
  assert.equal(saved.length, 3, 'all tiles are persisted as explored');

  const restored = new VisibilitySystem(mapData, gridSystem);
  restored.restoreExplored(saved);
  for (let x = 0; x < 3; x++) {
    assert.equal(restored.isTileExploredByHuman(x, 0), true, `restored tile ${x} stays discovered`);
    assert.equal(restored.isTileVisibleToHuman(x, 0), false, `restored tile ${x} has no live vision`);
  }
});

test('Satellites is the canonical world-map-reveal technology and advertises it', () => {
  assert.equal(WORLD_MAP_REVEAL_TECHNOLOGY_ID, 'satellites');
  const satellites = getTechnologyById(WORLD_MAP_REVEAL_TECHNOLOGY_ID);
  assert.ok(satellites, 'Satellites technology exists');
  assert.match(satellites!.description, /reveals the entire world map/i, 'Satellites advertises the reveal');
});

test('Technology unlocks reference only real units/buildings/wonders/improvements', () => {
  for (const tech of ALL_TECHNOLOGIES) {
    for (const unlock of tech.unlocks) {
      const exists =
        unlock.kind === 'unit' ? getUnitTypeById(unlock.id) !== undefined
          : unlock.kind === 'building' ? getBuildingById(unlock.id) !== undefined
            : unlock.kind === 'wonder' ? getWonderById(unlock.id) !== undefined
              : getImprovementById(unlock.id) !== undefined;
      assert.ok(exists, `Technology ${tech.id} references missing ${unlock.kind}: ${unlock.id}`);
    }
  }
});

test('Culture unit/building unlocks reference only real definitions', () => {
  for (const node of CULTURE_TREE) {
    for (const unlock of node.unlocks) {
      if (unlock.type === 'unit') {
        assert.ok(getUnitTypeById(unlock.value) !== undefined, `Culture ${node.id} references missing unit: ${unlock.value}`);
      } else if (unlock.type === 'building') {
        assert.ok(getBuildingById(unlock.value) !== undefined, `Culture ${node.id} references missing building: ${unlock.value}`);
      }
    }
  }
});

test('Known-incorrect diplomacy unlocks are removed from the Culture tree', () => {
  const diplomacyValues = (nodeId: string): string[] =>
    (getCultureNodeById(nodeId)?.unlocks ?? [])
      .filter((unlock) => unlock.type === 'diplomacy')
      .map((unlock) => (unlock.type === 'diplomacy' ? unlock.value : ''));

  // Alliances require an Embassy + Open Borders + Trade Relations, not Civil Service.
  assert.ok(!diplomacyValues('civil_service_civics').includes('alliances'), 'Civil Service must not advertise Alliances');
  // Establish Embassy is enabled by the Writing technology, not Diplomatic Service.
  assert.ok(!diplomacyValues('diplomatic_service').includes('embassies'), 'Diplomatic Service must not advertise Embassies');
  // No system implements research agreements or cultural influence.
  assert.ok(!diplomacyValues('cold_war').includes('research_agreements'), 'Cold War must not advertise unimplemented Research Agreements');
  assert.ok(!diplomacyValues('social_media').includes('cultural_influence'), 'Social Media must not advertise unimplemented Cultural Influence');
});

test('Amphitheater is not advertised as a buildable building (it does not exist)', () => {
  assert.equal(getBuildingById('amphitheater'), undefined, 'Amphitheater is not a real building');
  const dramaBuildingUnlocks = (getCultureNodeById('drama_civics')?.unlocks ?? [])
    .filter((unlock) => unlock.type === 'building');
  assert.equal(dramaBuildingUnlocks.length, 0, 'Drama and Poetry no longer unlocks an Amphitheater');
});
