import fs from 'node:fs';
import path from 'node:path';
import { NATURAL_RESOURCES } from '../src/data/naturalResources';
import { TileType } from '../src/types/map';

/**
 * Writes a browser-friendly natural resource registry for the standalone editor.
 * The canonical resource definitions remain in src/data/naturalResources.ts.
 */

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const outputPath = path.join(dataDir, 'natural-resources-manifest.json');

interface NaturalResourceManifestEntry {
  id: string;
  name: string;
  category: string;
  allowedTileTypes: TileType[];
  iconPath: string;
}

interface NaturalResourceManifest {
  resources: NaturalResourceManifestEntry[];
}

const manifest: NaturalResourceManifest = {
  resources: NATURAL_RESOURCES.map((resource) => ({
    id: resource.id,
    name: resource.name,
    category: resource.category,
    allowedTileTypes: [...resource.allowedTileTypes],
    iconPath: `/assets/sprites/resources/${resource.id}.png`,
  })),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.resources.length} resource(s).`);
