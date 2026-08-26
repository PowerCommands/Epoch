/**
 * Validates the dropped-in World War II - Europe scenario and confirms it is
 * registered in the map manifest. Run after saving the scenario JSON to
 * public/assets/maps/world-war-ii-europe.json:
 *
 *   npx tsx scripts/validateWw2Scenario.ts
 *
 * Checks: valid JSON, declared width/height, a complete row-major tile grid
 * with no missing/duplicate/out-of-range coordinates, only known terrain types,
 * and that the manifest entry points at the file. Prints a terrain histogram
 * and an entity summary so the map can be sanity-checked at a glance.
 */
import fs from 'node:fs';
import path from 'node:path';

const KNOWN_TYPES = new Set([
  'ocean', 'plains', 'forest', 'mountain', 'coast', 'ice', 'jungle', 'desert', 'beach', 'meadow',
]);
const FILE_NAME = 'world-war-ii-europe.json';
const MAP_KEY = 'map_world_war_ii_europe';

const mapsDir = path.resolve(process.cwd(), 'public', 'assets', 'maps');
const scenarioPath = path.join(mapsDir, FILE_NAME);
const manifestPath = path.join(mapsDir, 'manifest.json');

if (!fs.existsSync(scenarioPath)) {
  console.error(`MISSING: ${scenarioPath}\nSave the scenario JSON there, then re-run.`);
  process.exit(1);
}

const errors: string[] = [];
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

const width = scenario?.map?.width;
const height = scenario?.map?.height;
const tiles: Array<{ q: number; r: number; type: string; resourceId?: string; buildingId?: string }> =
  scenario?.map?.tiles ?? [];

if (typeof width !== 'number' || typeof height !== 'number') {
  errors.push('map.width / map.height must be numbers.');
}

const terrainHistogram = new Map<string, number>();
const resourceHistogram = new Map<string, number>();
const buildingCount = tiles.filter((t) => t.buildingId).length;

if (typeof width === 'number' && typeof height === 'number') {
  const expected = width * height;
  if (tiles.length !== expected) {
    errors.push(`Expected ${expected} tiles (${width}x${height}) but found ${tiles.length}.`);
  }
  // Verify a complete grid in row-major (r outer, q inner) order.
  let index = 0;
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const tile = tiles[index];
      if (!tile) { errors.push(`Missing tile at index ${index} (expected q=${q}, r=${r}).`); index += 1; continue; }
      if (tile.q !== q || tile.r !== r) {
        errors.push(`Tile ${index} out of order: expected (q=${q}, r=${r}) got (q=${tile.q}, r=${tile.r}).`);
      }
      if (!KNOWN_TYPES.has(tile.type)) errors.push(`Tile (${tile.q},${tile.r}) has unknown type "${tile.type}".`);
      terrainHistogram.set(tile.type, (terrainHistogram.get(tile.type) ?? 0) + 1);
      if (tile.resourceId) resourceHistogram.set(tile.resourceId, (resourceHistogram.get(tile.resourceId) ?? 0) + 1);
      index += 1;
      if (errors.length > 20) break;
    }
    if (errors.length > 20) break;
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entry = manifest.maps?.find((m: { key: string }) => m.key === MAP_KEY);
if (!entry) errors.push(`Manifest is missing the "${MAP_KEY}" entry.`);
else if (entry.file !== `assets/maps/${FILE_NAME}`) errors.push(`Manifest entry points at "${entry.file}", expected "assets/maps/${FILE_NAME}".`);

console.log(`Scenario: ${scenario?.meta?.name} (${width}x${height}, ${tiles.length} tiles)`);
console.log(`Manifest label: ${entry?.label ?? '(not registered)'}`);
console.log(`Nations: ${(scenario.nations ?? []).map((n: { name: string }) => n.name).join(', ')}`);
console.log(`Cities:  ${(scenario.cities ?? []).map((c: { name: string }) => c.name).join(', ')}`);
console.log(`Units:   ${(scenario.units ?? []).length}   Buildings on map: ${buildingCount}`);
console.log('Terrain:', [...terrainHistogram.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}=${n}`).join(' '));
console.log('Resources:', [...resourceHistogram.entries()].map(([t, n]) => `${t}=${n}`).join(' ') || '(none)');

if (errors.length > 0) {
  console.error(`\nFAILED with ${errors.length} problem(s):`);
  for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nOK: complete grid, known terrain, registered in manifest.');
