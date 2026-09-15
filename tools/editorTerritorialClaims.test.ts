import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { isClaimableNeutralLand, getTerritorialClaimTint } from '../src/systems/TerritorialClaimSystem';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { NationManager } from '../src/systems/NationManager';
import { CityManager } from '../src/systems/CityManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import type { ScenarioData } from '../src/types/scenario';

const html = readFileSync('public/editor.html', 'utf8');
function fixture(): ScenarioData {
  return { meta: { name: 'Claims', version: 1 }, map: { width: 30, height: 10, tileSize: 64,
    tiles: Array.from({ length: 300 }, (_, i) => ({ q: i % 30, r: Math.floor(i / 30), type: 'plains' })) },
    nations: ['nation_canada', 'nation_usa'].map((id, i) => ({ id, name: id, color: '#225588', isHuman: i === 0, startTerritoryCenter: { q: 5 + i * 10, r: 5 } })),
    cities: [], units: [] };
}
function editor() {
  const scenario = fixture();
  const state: any = { scenario, scenarioTileIndex: new Map(), claimNationId: scenario.nations[0].id, eraseTerritorialClaims: false,
    tiles: Array.from({length:10},()=>Array(30).fill('plains')),
    tileResources: Array.from({length:10},()=>Array(30)), tileBuildings: Array.from({length:10},()=>Array(30)),
    tileImprovements: Array.from({length:10},()=>Array(30)), tileRivers: Array.from({length:10},()=>Array(30)),
    paintedTiles: Array.from({length:10},()=>Array(30).fill(false)),
    brushSize: 1, riverAnchor: null, render() {}, setStatusInfo() {}, updateUndoRedoButtons() {},
    window: { EpochTerritorialClaims: { isClaimableNeutralLand, getTerritorialClaimTint } },
  };
  const source = [
    html.slice(html.indexOf('function rebuildScenarioTileIndex()'), html.indexOf('function updateTerritorialClaimControls()')),
    html.slice(html.indexOf('function paintTerritorialClaimAt('), html.indexOf('function paintAt(')),
    html.slice(html.indexOf('const undoStack ='), html.indexOf('/** Remove a unit from the scenario')),
    html.slice(html.indexOf('function undo()'), html.indexOf('function resetUndoHistory()')),
  ].join('\n');
  const api = runInNewContext(`${source}\nrebuildScenarioTileIndex(); ({beginBrushStroke, paintTerritorialClaimAt, commitBrushStroke, undo, redo, getAuthoredClaim, isEditorClaimEligible})`, state);
  return { state, api, scenario };
}

test('real editor paints canonical tile fields without a city, unit, unlock or Gold, and switches nations', () => {
  const { state, api, scenario } = editor();
  api.beginBrushStroke(); api.paintTerritorialClaimAt(29, 9); api.commitBrushStroke();
  assert.equal(scenario.map.tiles.at(-1)!.territorialClaimNationId, 'nation_canada');
  assert.equal(scenario.cities.length, 0);
  state.claimNationId = 'nation_usa';
  api.beginBrushStroke(); api.paintTerritorialClaimAt(29, 9); api.paintTerritorialClaimAt(28, 9); api.commitBrushStroke();
  assert.equal(api.getAuthoredClaim(29,9), 'nation_usa');
  api.undo();
  assert.equal(api.getAuthoredClaim(29,9), 'nation_canada');
  assert.equal(api.getAuthoredClaim(28,9), undefined);
  api.redo();
  assert.equal(api.getAuthoredClaim(28,9), 'nation_usa');
});

test('real editor erase brush and undo/redo preserve terrain and resources', () => {
  const { state, api } = editor();
  state.tileResources[4][4] = 'iron'; state.brushSize = 2;
  api.beginBrushStroke(); api.paintTerritorialClaimAt(4,4); api.commitBrushStroke();
  state.eraseTerritorialClaims = true;
  api.beginBrushStroke(); api.paintTerritorialClaimAt(4,4); api.commitBrushStroke();
  assert.equal(api.getAuthoredClaim(4,4), undefined);
  api.undo(); assert.equal(api.getAuthoredClaim(4,4), 'nation_canada');
  api.redo(); assert.equal(api.getAuthoredClaim(4,4), undefined);
  assert.equal(state.tiles[4][4], 'plains'); assert.equal(state.tileResources[4][4], 'iron');
});

test('city-owned tiles, all reserved city cores, water and structures reject painting', () => {
  const { state, api, scenario } = editor();
  scenario.cities.push({id:'city',name:'City',nationId:'nation_canada',q:2,r:2,isCapital:true,ownedTileCoords:[{q:4,r:4}]});
  scenario.cities.push({id:'legacy',name:'Legacy',nationId:'nation_usa',q:10,r:5,isCapital:false});
  state.tiles[8][8]='coast'; state.tileBuildings[7][7]='barbarian-camp';
  for (const [q,r] of [[2,2],[3,2],[4,4],[11,5],[8,8],[7,7]]) {
    api.beginBrushStroke(); api.paintTerritorialClaimAt(q,r); api.commitBrushStroke();
    assert.equal(api.getAuthoredClaim(q,r),undefined);
  }
});

test('scenario claims initialize canonical state, survive nation-area seeding and runtime save/load', () => {
  const scenario = fixture();
  scenario.map.tiles.find(t=>t.q===15&&t.r===5)!.territorialClaimNationId='nation_canada';
  const parsed = ScenarioLoader.parse(JSON.parse(JSON.stringify(scenario)));
  NationManager.loadFromScenario(parsed.nations, parsed.mapData, new HexGridSystem());
  assert.equal(parsed.mapData.tiles[5][15].ownerId,undefined);
  assert.equal(parsed.mapData.tiles[5][15].territorialClaimNationId,'nation_canada');
  const saved = SaveLoadService.serializeTiles(parsed.mapData);
  const loaded = ScenarioLoader.parse(fixture()).mapData;
  SaveLoadService.restoreTiles(saved,loaded);
  assert.equal(loaded.tiles[5][15].territorialClaimNationId,'nation_canada');
  parsed.cities.push({id:'actual',name:'Actual',nationId:'nation_usa',q:15,r:5,isCapital:true,ownedTileCoords:[{q:15,r:5}]});
  CityManager.loadFromScenario(parsed.cities,parsed.mapData);
  assert.equal(parsed.mapData.tiles[5][15].ownerId,'nation_usa');
  assert.equal(parsed.mapData.tiles[5][15].territorialClaimNationId,undefined);
});

test('old scenarios need no claim fields and invalid authored nations are ignored', () => {
  const old = fixture();
  assert.ok(ScenarioLoader.parse(old).mapData.tiles.flat().every(t=>t.territorialClaimNationId===undefined));
  old.map.tiles[0].territorialClaimNationId='unknown';
  old.map.tiles[1].territorialClaimNationId='nation_canada'; old.map.tiles[1].type='ocean';
  assert.ok(ScenarioLoader.parse(old).mapData.tiles.flat().every(t=>t.territorialClaimNationId===undefined));
});
