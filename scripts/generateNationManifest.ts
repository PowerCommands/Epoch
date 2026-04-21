import fs from 'node:fs';
import path from 'node:path';
import { ALL_LEADERS } from '../src/data/leaders';
import { getNationDefinitionById } from '../src/data/nations';

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
  leaderId: string;
  leaderName: string;
  leaderTitle: string;
  leaderImage: string;
}

interface NationManifest {
  nations: NationManifestEntry[];
}

const manifest: NationManifest = {
  nations: ALL_LEADERS
    .map((leader): NationManifestEntry => {
      const nation = getNationDefinitionById(leader.nationId);
      return {
        nationId: leader.nationId,
        nationName: nation?.name ?? labelFromNationId(leader.nationId),
        color: nation?.color ?? '#888888',
        leaderId: leader.id,
        leaderName: leader.name,
        leaderTitle: leader.title ?? '',
        leaderImage: leader.image,
      };
    })
    .sort((a, b) => a.nationId.localeCompare(b.nationId)),
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.nations.length} nation(s).`);

function labelFromNationId(nationId: string): string {
  return nationId
    .replace(/^nation_/, '')
    .split('_')
    .filter(Boolean)
    .map(word => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
