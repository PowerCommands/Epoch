import fs from 'node:fs';
import path from 'node:path';
import { ALL_LEADERS } from '../src/data/leaders';
import { NATION_DEFINITIONS } from '../src/data/nations';

/**
 * Writes a browser-friendly nation registry for the standalone editor.
 * The canonical leader -> nation mapping remains in src/data/leaders.ts.
 */

const projectRoot = path.resolve(process.cwd());
const dataDir = path.join(projectRoot, 'public', 'assets', 'data');
const outputPath = path.join(dataDir, 'nations-manifest.json');

interface NationManifestEntry {
  nationId: string;
  nationName: string;
  color: string;
  secondaryColor: string;
  leaderId: string;
  leaderName: string;
  leaderTitle: string;
  leaderImage: string;
}

interface NationManifest {
  nations: NationManifestEntry[];
}

const manifest: NationManifest = {
  nations: NATION_DEFINITIONS
    .map((nation): NationManifestEntry => {
      const leader = ALL_LEADERS.find((candidate) => candidate.nationId === nation.id);
      return {
        nationId: nation.id,
        nationName: nation.name,
        color: nation.color,
        secondaryColor: nation.secondaryColor,
        leaderId: leader?.id ?? '',
        leaderName: leader?.name ?? '',
        leaderTitle: leader?.title ?? '',
        leaderImage: leader?.image ?? '',
      };
    })
    .sort((a, b) => a.nationId.localeCompare(b.nationId)),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.nations.length} nation(s).`);
