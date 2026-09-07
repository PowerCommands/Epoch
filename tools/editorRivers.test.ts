import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as EpochRivers from '../src/systems/geography/Rivers';

const html = readFileSync('public/editor.html', 'utf8');
const editing = html.slice(html.indexOf('function editorRiverGrid()'), html.indexOf("document.getElementById('river-new-btn').addEventListener"));
const history = html.slice(html.indexOf('function applyTileChanges('), html.indexOf('/** Remove a unit from the scenario'));
function editor() {
  const state = {
    mapW: 12, mapH: 5,
    tiles: Array.from({ length: 5 }, () => Array<string>(12).fill('plains')),
    tileRivers: Array.from({ length: 5 }, () => Array<number | undefined>(12).fill(undefined)),
    tileResources: Array.from({ length: 5 }, () => Array(12).fill(undefined)),
    paintedTiles: Array.from({ length: 5 }, () => Array(12).fill(false)),
    riverAnchor: null, riverEraseAnchor: null, riverReachedWater: false, isPainting: true,
    EpochRivers, recordTileBefore() {}, render() {}, setStatusInfo() {},
    isLandTerrain: (type: string) => type !== 'coast' && type !== 'ocean',
    document: { getElementById: () => ({ checked: state.erase }) }, erase: false,
  };
  const api = runInNewContext(`${editing}\n${history}\n({paintRiverAt, applyTileChanges})`, state);
  return { state, api };
}

test('real editor interpolates a fast drag and stops at the first water tile', () => {
  const { state, api } = editor();
  state.tiles[2][6] = 'coast';
  api.paintRiverAt(1, 2);
  api.paintRiverAt(10, 2);
  assert.equal(state.tileRivers[2][1], 1);
  for (let q = 2; q < 6; q++) assert.equal(state.tileRivers[2][q], 9);
  assert.equal(state.tileRivers[2][6], 8);
  api.paintRiverAt(11, 2);
  assert.ok(state.tileRivers[2].slice(7).every(mask => mask === undefined));
  assert.equal(state.riverAnchor, null);
});

test('real editor erase drag removes reciprocal neighbors without damaging another reach', () => {
  const { state, api } = editor();
  api.paintRiverAt(1, 2); api.paintRiverAt(10, 2);
  state.erase = true;
  api.paintRiverAt(4, 2); api.paintRiverAt(7, 2);
  assert.ok(state.tileRivers[2].slice(4, 8).every(mask => mask === undefined));
  assert.equal(state.tileRivers[2][3], 8);
  assert.equal(state.tileRivers[2][8], 1);
  assert.equal(state.tileRivers[2][2], 9);
  assert.equal(state.tileRivers[2][9], 9);
});

test('resource-only undo preserves rivers; river undo and redo restore masks', () => {
  const { state, api } = editor();
  state.tileRivers[2][3] = 9;
  const change = { q: 3, r: 2, prevType: 'plains', nextType: 'plains', prevResource: undefined, nextResource: 'wheat', prevPainted: false, nextPainted: true };
  api.applyTileChanges([change], true);
  api.applyTileChanges([change], false);
  assert.equal(state.tileRivers[2][3], 9);
  const riverChange = { ...change, prevRiver: 9, nextRiver: undefined };
  api.applyTileChanges([riverChange], true);
  assert.equal(state.tileRivers[2][3], undefined);
  api.applyTileChanges([riverChange], false);
  assert.equal(state.tileRivers[2][3], 9);
});
