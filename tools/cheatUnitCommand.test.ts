import assert from 'node:assert/strict';
import test from 'node:test';

import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';

interface CreatedUnit {
  type: { id: string; name: string };
  ownerId: string;
  tileX: number;
  tileY: number;
}

interface TileStub {
  x: number;
  y: number;
  type: number;
  resourceId?: string;
  ownerId?: string;
}

function makeCheats(selection: unknown, options: { researched?: Set<string> } = {}) {
  const created: CreatedUnit[] = [];
  const nations = [
    { id: 'england', name: 'England' },
    { id: 'france', name: 'France' },
  ];
  const researched = options.researched ?? new Set<string>();
  // A small 6x6 grid of empty tiles the resource cheat can mutate.
  const tiles: TileStub[][] = Array.from({ length: 6 }, (_, y) =>
    Array.from({ length: 6 }, (_, x) => ({ x, y, type: 0 })));
  let invalidateCount = 0;
  const refreshedTiles: Array<[number, number]> = [];
  const context = {
    humanNationId: 'england',
    nationManager: {
      getAllNations: () => nations,
      getNation: (id: string) => nations.find((nation) => nation.id === id),
    },
    researchSystem: { isResearched: (_nationId: string, techId: string) => researched.has(techId) },
    resourceAccessSystem: { invalidateResourceIndex: () => { invalidateCount += 1; } },
    mapData: { width: 6, height: 6, tiles },
    refreshTileVisuals: (x: number, y: number) => { refreshedTiles.push([x, y]); },
    selectionManager: { getSelected: () => selection },
    unitManager: {
      createUnit: (config: CreatedUnit) => {
        created.push(config);
        return { name: config.type.name };
      },
    },
  } as unknown as GameContext;
  return {
    cheats: new CheatSystem(context),
    created,
    tiles,
    getInvalidateCount: () => invalidateCount,
    refreshedTiles,
  };
}

const TILE = { kind: 'tile', tile: { x: 3, y: 4 } };

test('unit <type> <nation> creates the unit on the selected tile for that nation', () => {
  const { cheats, created } = makeCheats(TILE);
  const message = cheats.execute('unit settler france');
  assert.match(message, /Created Settler for France at \(3, 4\)/);
  assert.equal(created.length, 1);
  assert.equal(created[0].type.id, 'settler');
  assert.equal(created[0].ownerId, 'france');
  assert.deepEqual([created[0].tileX, created[0].tileY], [3, 4]);
});

test('omitting the nation defaults the unit to the human player', () => {
  const { cheats, created } = makeCheats(TILE);
  cheats.execute('unit warrior');
  assert.equal(created[0].type.id, 'warrior');
  assert.equal(created[0].ownerId, 'england');
});

test('any unit type can be created regardless of tech/culture', () => {
  const { cheats, created } = makeCheats(TILE);
  // Giant Death Robot has deep tech requirements in normal play; the cheat ignores them.
  cheats.execute('unit giant_death_robot');
  assert.equal(created[0].type.id, 'giant_death_robot');
});

test('with no selected tile no unit is created and an error is shown', () => {
  const { cheats, created } = makeCheats(null);
  assert.equal(cheats.execute('unit settler'), 'No tile selected');
  assert.equal(created.length, 0);
});

test('an unknown unit type reports an error and creates nothing', () => {
  const { cheats, created } = makeCheats(TILE);
  assert.match(cheats.execute('unit not_a_unit'), /Unknown unit: not_a_unit/);
  assert.equal(created.length, 0);
});

test('tab completion offers unit types then nations', () => {
  const { cheats } = makeCheats(TILE);
  const unitSuggestions = cheats.getCompletions('unit set').map((s) => s.value);
  assert.ok(unitSuggestions.includes('settler'));

  const nationSuggestions = cheats.getCompletions('unit settler fra').map((s) => s.value);
  assert.deepEqual(nationSuggestions, ['france']);
});

test('resource <id> <nation> places the resource, assigns the tile, and invalidates the index', () => {
  // England has researched the horses-enabling tech, so no missing-tech note.
  const h = makeCheats(TILE, { researched: new Set(['animal_husbandry']) });
  const message = h.cheats.execute('resource horses');
  assert.match(message, /Placed Horses on the selected tile for England/);
  assert.doesNotMatch(message, /needs .* to access/);
  assert.equal(h.tiles[4][3].resourceId, 'horses');
  assert.equal(h.tiles[4][3].ownerId, 'england');
  assert.equal(h.getInvalidateCount(), 1);
  assert.deepEqual(h.refreshedTiles, [[3, 4]]);
});

test('resource assigns the tile to the named nation', () => {
  const h = makeCheats(TILE, { researched: new Set(['animal_husbandry']) });
  h.cheats.execute('resource horses france');
  assert.equal(h.tiles[4][3].ownerId, 'france');
});

test('resource notes when the owner lacks the required technology', () => {
  const h = makeCheats(TILE); // nothing researched
  const message = h.cheats.execute('resource horses');
  assert.match(message, /needs .* to access it; the tile yield applies regardless/);
  // The resource is still placed regardless of tech.
  assert.equal(h.tiles[4][3].resourceId, 'horses');
});

test('resource with no selected tile creates nothing and reports an error', () => {
  const h = makeCheats(null);
  assert.equal(h.cheats.execute('resource horses'), 'No tile selected');
  assert.equal(h.getInvalidateCount(), 0);
});

test('unknown resource reports an error and mutates nothing', () => {
  const h = makeCheats(TILE);
  assert.match(h.cheats.execute('resource not_a_resource'), /Unknown resource: not_a_resource/);
  assert.equal(h.tiles[4][3].resourceId, undefined);
});

test('resource tab completion offers resources then nations', () => {
  const { cheats } = makeCheats(TILE);
  const resourceSuggestions = cheats.getCompletions('resource hor').map((s) => s.value);
  assert.ok(resourceSuggestions.includes('horses'));

  const nationSuggestions = cheats.getCompletions('resource horses fra').map((s) => s.value);
  assert.deepEqual(nationSuggestions, ['france']);
});
