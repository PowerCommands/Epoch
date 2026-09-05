import fs from 'node:fs';
import path from 'node:path';

/**
 * Generates the metadata-only manifest used by the standalone editor's asset
 * viewer. Each directory is its own category, so nested sprite collections do
 * not get folded into their parent directory.
 */

const projectRoot = path.resolve(process.cwd());
const spritesDir = path.join(projectRoot, 'public', 'assets', 'sprites');
const outputPath = path.join(spritesDir, 'manifest.json');
const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface SpriteAsset {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface SpriteCategory {
  path: string;
  label: string;
  assets: SpriteAsset[];
}

interface SpriteAssetManifest {
  categories: SpriteCategory[];
}

const manifest: SpriteAssetManifest = { categories: [] };

if (!fs.existsSync(spritesDir)) {
  fs.mkdirSync(spritesDir, { recursive: true });
} else {
  scanDirectory(spritesDir, '');
}

manifest.categories.sort((a, b) => a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }));
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

const assetCount = manifest.categories.reduce((total, category) => total + category.assets.length, 0);
console.log(
  `Wrote ${path.relative(projectRoot, outputPath)} with ${manifest.categories.length} categories and ${assetCount} images.`,
);

function scanDirectory(absoluteDirectory: string, relativeDirectory: string): void {
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
  const assets = entries
    .filter(entry => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map(entry => {
      const extension = path.extname(entry.name).slice(1).toUpperCase();
      const relativeFile = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      return {
        name: entry.name,
        path: `/assets/sprites/${encodePublicPath(relativeFile)}`,
        type: extension === 'JPG' ? 'JPEG' : extension,
        size: fs.statSync(path.join(absoluteDirectory, entry.name)).size,
      };
    });

  // Root-level sprites remain visible under a clear synthetic category. Every
  // actual subdirectory is represented even when it currently contains no images.
  if (relativeDirectory || assets.length > 0) {
    manifest.categories.push({
      path: relativeDirectory || '.',
      label: relativeDirectory ? displayLabel(relativeDirectory) : 'Root',
      assets,
    });
  }

  for (const entry of entries
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))) {
    const childRelative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    scanDirectory(path.join(absoluteDirectory, entry.name), childRelative);
  }
}

function displayLabel(relativeDirectory: string): string {
  return relativeDirectory
    .split('/')
    .map(segment => segment
      .split(/[-_]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '))
    .join(' / ');
}

function encodePublicPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}
