import assert from 'node:assert/strict';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { WorldMarkerSystem } from '../src/systems/WorldMarkerSystem';
import type { ScenarioData } from '../src/types/scenario';
import type { WorldMarker } from '../src/types/WorldMarker';
import {
  GEOGRAPHIC_MARKER_TYPE,
  GEOGRAPHIC_MARKER_CATEGORY_IDS,
  DEFAULT_GEOGRAPHIC_CATEGORY,
  isGeographicMarker,
  normalizeGeographicCategory,
} from '../src/types/geographicMarker';
import { getGeographicMarkerStyle, GEOGRAPHIC_MARKER_STYLES } from '../src/data/geographicMarkers';

function baseScenario(worldMarkers?: WorldMarker[]): ScenarioData {
  const scenario = {
    map: { width: 2, height: 2, tileSize: 32, tiles: [] },
    nations: [],
    cities: [],
    units: [],
  } as unknown as ScenarioData;
  if (worldMarkers) (scenario as { worldMarkers?: WorldMarker[] }).worldMarkers = worldMarkers;
  return scenario;
}

const geographicMarker = (over: Partial<WorldMarker> = {}): WorldMarker => ({
  id: 'geo_atlantic',
  type: GEOGRAPHIC_MARKER_TYPE,
  x: 1,
  y: 1,
  name: 'Atlantic Ocean',
  category: 'ocean',
  ...over,
});

// ── Type / category helpers ──────────────────────────────────────────────────

test('isGeographicMarker distinguishes geographic markers from others', () => {
  assert.equal(isGeographicMarker(geographicMarker()), true);
  assert.equal(isGeographicMarker({ type: 'islandDiscovery' }), false);
});

test('normalizeGeographicCategory keeps valid ids and falls back to other', () => {
  for (const id of GEOGRAPHIC_MARKER_CATEGORY_IDS) {
    assert.equal(normalizeGeographicCategory(id), id);
  }
  assert.equal(normalizeGeographicCategory('atlantis'), DEFAULT_GEOGRAPHIC_CATEGORY);
  assert.equal(normalizeGeographicCategory(undefined), DEFAULT_GEOGRAPHIC_CATEGORY);
  assert.equal(DEFAULT_GEOGRAPHIC_CATEGORY, 'other');
});

test('getGeographicMarkerStyle returns a style for every category and falls back', () => {
  for (const id of GEOGRAPHIC_MARKER_CATEGORY_IDS) {
    assert.equal(getGeographicMarkerStyle(id), GEOGRAPHIC_MARKER_STYLES[id]);
  }
  // Unknown / missing → the `other` style, never undefined.
  assert.equal(getGeographicMarkerStyle(undefined), GEOGRAPHIC_MARKER_STYLES.other);
});

// ── Scenario compatibility & persistence ─────────────────────────────────────

test('old scenario without worldMarkers still loads', () => {
  const parsed = ScenarioLoader.parse(baseScenario());
  assert.deepEqual(parsed.worldMarkers, []);
});

test('geographic marker text/category/position survive scenario parse', () => {
  const parsed = ScenarioLoader.parse(baseScenario([geographicMarker()]));
  assert.equal(parsed.worldMarkers.length, 1);
  const [marker] = parsed.worldMarkers;
  assert.equal(marker.type, GEOGRAPHIC_MARKER_TYPE);
  assert.equal(marker.name, 'Atlantic Ocean');
  assert.equal(marker.category, 'ocean');
  assert.equal(marker.x, 1);
  assert.equal(marker.y, 1);
});

test('WorldMarkerSystem save serialization preserves category (round-trip)', () => {
  const system = new WorldMarkerSystem([geographicMarker()]);
  const saved = system.getAllMarkersForSave();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].category, 'ocean');

  // Reload from the serialized form → still intact.
  const reloaded = new WorldMarkerSystem(saved);
  assert.equal(reloaded.getAllMarkers()[0].category, 'ocean');
});

test('multiple geographic categories coexist in one scenario', () => {
  const markers = [
    geographicMarker({ id: 'g_ocean', category: 'ocean', name: 'Atlantic Ocean' }),
    geographicMarker({ id: 'g_sea', category: 'sea', name: 'Baltic Sea' }),
    geographicMarker({ id: 'g_desert', category: 'desert', name: 'Sahara' }),
    geographicMarker({ id: 'g_mtn', category: 'mountain_range', name: 'Alps' }),
    geographicMarker({ id: 'g_region', category: 'region', name: 'Scandinavia' }),
  ];
  const parsed = ScenarioLoader.parse(baseScenario(markers));
  assert.equal(parsed.worldMarkers.length, 5);
  const categories = parsed.worldMarkers.map((m) => m.category);
  assert.deepEqual(categories, ['ocean', 'sea', 'desert', 'mountain_range', 'region']);
});

// ── No gameplay effect ───────────────────────────────────────────────────────

test('geographic markers are never auto-claimed or auto-discovered', () => {
  const system = new WorldMarkerSystem([geographicMarker()]);
  // They appear in the (unclaimed) marker list used for rendering.
  assert.equal(system.getAllMarkers().length, 1);
  // Nothing claims or discovers them on its own.
  assert.equal(system.isMarkerClaimed('geo_atlantic'), false);
  assert.equal(system.getDiscoveredMarkersForNation('nation_test').length, 0);
});
