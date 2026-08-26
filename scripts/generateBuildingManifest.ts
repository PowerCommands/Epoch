import fs from 'node:fs';
import path from 'node:path';
import { ALL_BUILDINGS, GRAND_STADIUM } from '../src/data/buildings';
import { getBuildingSpritePath } from '../src/utils/assetPaths';

/** Browser-friendly canonical city-building list for the standalone editor. */
const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const outputPath = path.join(dataDir, 'buildings-manifest.json');

const manifest = {
  buildings: [...ALL_BUILDINGS, GRAND_STADIUM].map((building) => ({
    id: building.id,
    name: building.name,
    era: building.era,
    placement: building.placement,
    iconPath: getBuildingSpritePath(building.id),
  })),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath} with ${manifest.buildings.length} building(s).`);
