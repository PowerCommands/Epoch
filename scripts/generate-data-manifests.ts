import fs from 'node:fs';
import path from 'node:path';
import { ALL_TECHNOLOGIES } from '../src/data/technologies';
import { CULTURE_TREE } from '../src/data/cultureTree';

/**
 * Writes compact browser-friendly technology and culture manifests for the
 * standalone map editor. Canonical gameplay data remains in src/data.
 */

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const technologiesOutputPath = path.join(dataDir, 'technologies-manifest.json');
const cultureOutputPath = path.join(dataDir, 'culture-tree-manifest.json');

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

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(technologiesOutputPath, JSON.stringify({ technologies }, null, 2) + '\n');
fs.writeFileSync(cultureOutputPath, JSON.stringify({ cultureNodes }, null, 2) + '\n');

console.log(`Wrote ${technologiesOutputPath} with ${technologies.length} technology(s).`);
console.log(`Wrote ${cultureOutputPath} with ${cultureNodes.length} culture node(s).`);
