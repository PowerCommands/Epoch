import fs from 'node:fs';
import path from 'node:path';
import { ALL_TECHNOLOGIES } from '../src/data/technologies';
import { CULTURE_TREE } from '../src/data/cultureTree';
import cityNamePools from '../src/data/cityNames.json';

/**
 * Writes compact browser-friendly technology, culture and city-name manifests
 * for the standalone map editor. Canonical gameplay data remains in src/data;
 * the editor consumes these copies so it never drifts from the game.
 */

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const technologiesOutputPath = path.join(dataDir, 'technologies-manifest.json');
const cultureOutputPath = path.join(dataDir, 'culture-tree-manifest.json');
const cityNamesOutputPath = path.join(dataDir, 'city-names-manifest.json');

interface DataManifestEntry {
  id: string;
  name: string;
  era: string;
}

const technologies: DataManifestEntry[] = ALL_TECHNOLOGIES.map((technology) => ({
  id: technology.id,
  name: technology.name,
  era: technology.era,
}));

const cultureNodes: DataManifestEntry[] = CULTURE_TREE.map((cultureNode) => ({
  id: cultureNode.id,
  name: cultureNode.name,
  era: cultureNode.era,
}));

// Per-nation city name pools (nationId -> names), consumed by the editor so new
// cities are named from the same pools the game uses when founding cities.
const cityNames: Record<string, string[]> = cityNamePools;

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(technologiesOutputPath, JSON.stringify({ technologies }, null, 2) + '\n');
fs.writeFileSync(cultureOutputPath, JSON.stringify({ cultureNodes }, null, 2) + '\n');
fs.writeFileSync(cityNamesOutputPath, JSON.stringify({ cityNames }, null, 2) + '\n');

console.log(`Wrote ${technologiesOutputPath} with ${technologies.length} technology(s).`);
console.log(`Wrote ${cultureOutputPath} with ${cultureNodes.length} culture node(s).`);
console.log(`Wrote ${cityNamesOutputPath} with ${Object.keys(cityNames).length} nation pool(s).`);
