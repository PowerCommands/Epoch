import fs from 'node:fs';
import path from 'node:path';
import { ALL_UNIT_TYPES } from '../src/data/units';

/**
 * Writes a browser-friendly unit type registry for the standalone editor.
 * The canonical unit definitions remain in src/data/units.ts.
 *
 * Exports all normal unit types (ALL_UNIT_TYPES). The special LEADER unit is
 * intentionally excluded: it is runtime-only and cannot be manually placed.
 */

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const outputPath = path.join(dataDir, 'units-manifest.json');

interface UnitManifestEntry {
  id: string;
  name: string;
  era: string;
  category: string;
  isNaval: boolean;
}

interface UnitManifest {
  units: UnitManifestEntry[];
}

const manifest: UnitManifest = {
  units: ALL_UNIT_TYPES.map((u) => ({
    id: u.id,
    name: u.name,
    era: u.era,
    category: u.category,
    isNaval: u.isNaval ?? false,
  })),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.units.length} unit type(s).`);
