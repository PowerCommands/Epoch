import fs from 'node:fs';
import path from 'node:path';

/**
 * Scans public/assets/maps/ for scenario JSON files and writes a manifest
 * consumed by BootScene, MainMenuScene, and the standalone editor.
 */

const projectRoot = path.resolve(process.cwd());
const mapsDir = path.join(projectRoot, 'public', 'assets', 'maps');
const outputPath = path.join(mapsDir, 'manifest.json');

interface ScenarioMeta {
  meta?: {
    name?: unknown;
  };
}

interface MapManifestEntry {
  key: string;
  label: string;
  file: string;
}

interface MapManifest {
  maps: MapManifestEntry[];
}

const manifest: MapManifest = { maps: [] };

if (!fs.existsSync(mapsDir)) {
  fs.mkdirSync(mapsDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`No maps directory at ${mapsDir}; wrote empty manifest.`);
  process.exit(0);
}

const files = fs
  .readdirSync(mapsDir)
  .filter(file => file.toLowerCase().endsWith('.json'))
  .filter(file => file !== 'manifest.json')
  .sort(compareMapFilenames);

for (const file of files) {
  const scenarioPath = path.join(mapsDir, file);
  const stem = path.basename(file, '.json');
  const scenario = readScenarioMeta(scenarioPath);

  manifest.maps.push({
    key: mapKeyFromFilename(stem),
    label: scenario?.meta?.name && typeof scenario.meta.name === 'string'
      ? scenario.meta.name
      : labelFromFilename(stem),
    file: `assets/maps/${file}`,
  });
}

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.maps.length} map(s).`);

function readScenarioMeta(filePath: string): ScenarioMeta | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ScenarioMeta;
  } catch (err) {
    console.warn(`Skipping scenario metadata for ${filePath}:`, err);
    return null;
  }
}

function compareMapFilenames(a: string, b: string): number {
  return sortKey(a).localeCompare(sortKey(b));
}

function sortKey(file: string): string {
  return file.replace(/-old(?=\.json$)/i, '~old');
}

function mapKeyFromFilename(stem: string): string {
  const normalized = stem.replace(/Scenario$/i, '');
  return `map_${toSnakeCase(normalized)}`;
}

function labelFromFilename(stem: string): string {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toSnakeCase(value: string): string {
  const tokens = value.match(/[A-Z]?[a-z]+|\d+[a-z]\d+|\d+|[A-Z]+(?![a-z])/g);
  if (tokens && tokens.length > 0) return tokens.join('_').toLowerCase();

  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
