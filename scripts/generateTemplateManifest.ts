import fs from 'node:fs';
import path from 'node:path';

/**
 * Scans public/assets/maps/templates/ for *.png background templates and writes
 * a manifest consumed by the standalone editor's "Create New" dialog. Dropping a
 * new PNG into the folder makes it appear in the editor with no code changes —
 * the manifest is regenerated automatically on predev/prebuild.
 */

const projectRoot = path.resolve(process.cwd());
const templatesDir = path.join(projectRoot, 'public', 'assets', 'maps', 'templates');
const outputPath = path.join(templatesDir, 'manifest.json');

interface TemplateManifestEntry {
  /** Display name + stored value (filename without the .png extension). */
  name: string;
  /** Public path used to load the image at runtime. */
  file: string;
}

interface TemplateManifest {
  templates: TemplateManifestEntry[];
}

const manifest: TemplateManifest = { templates: [] };

if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`No templates directory at ${templatesDir}; wrote empty manifest.`);
  process.exit(0);
}

const files = fs
  .readdirSync(templatesDir)
  .filter(file => file.toLowerCase().endsWith('.png'))
  .sort((a, b) => a.localeCompare(b));

for (const file of files) {
  manifest.templates.push({
    name: path.basename(file, path.extname(file)),
    file: `assets/maps/templates/${file}`,
  });
}

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputPath} with ${manifest.templates.length} template(s).`);
