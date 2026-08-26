import fs from 'node:fs';
import path from 'node:path';
import { NATION_DEFINITIONS } from '../src/data/nations';

/**
 * Scans public/assets/sounds/ for subfolders of mp3 tracks and writes a
 * manifest consumed at runtime by SetupMusicManager. Each subfolder name
 * becomes a playlist key (e.g. "start", "nation_england"). URLs use the
 * public path served by Vite.
 */

const projectRoot = path.resolve(process.cwd());
const soundsDir = path.join(projectRoot, 'public', 'assets', 'sounds');
const outputPath = path.join(soundsDir, 'manifest.json');

interface Manifest {
  playlists: Record<string, string[]>;
}

const manifest: Manifest = { playlists: {} };

if (!fs.existsSync(soundsDir)) {
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`No sounds directory at ${soundsDir}; wrote empty manifest.`);
  process.exit(0);
}

const entries = fs.readdirSync(soundsDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;

  const folder = entry.name;
  const folderPath = path.join(soundsDir, folder);
  const files = fs
    .readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.mp3'))
    .sort();

  if (files.length === 0) continue;

  manifest.playlists[folder] = files.map(f => `/assets/sounds/${folder}/${f}`);
}

// Nations may reuse an existing nation's playlist without duplicating large
// media files. Runtime remains unaware of the alias: every nation still has a
// normal playlist key in the generated manifest.
for (const nation of NATION_DEFINITIONS) {
  if (!nation.audioPlaylistNationId) continue;
  const source = manifest.playlists[nation.audioPlaylistNationId];
  if (source?.length) manifest.playlists[nation.id] = [...source];
}

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Wrote ${outputPath} with ${Object.keys(manifest.playlists).length} playlist(s).`,
);
