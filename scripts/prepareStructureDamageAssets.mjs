// Mechanical export only: resize generated sprites to the source canvas aspect
// ratio and at most 512px. Artwork itself comes from the built-in image tool.
import fs from 'node:fs/promises';
import { createCanvas, loadImage } from 'canvas';
import path from 'node:path';
const root = 'public/assets/sprites';
for (const category of ['buildings', 'wonders', 'cities']) {
  for (const name of await fs.readdir(`${root}/${category}`)) {
    if (!name.endsWith('-broken.png')) continue;
    const target = `${root}/${category}/${name}`;
    const source = await loadImage(target.replace('-broken.png', '.png'));
    const generated = await loadImage(target);
    const scale = Math.min(1, 512 / Math.max(source.width, source.height));
    const width = Math.round(source.width * scale), height = Math.round(source.height * scale);
    if (generated.width === width && generated.height === height) continue;
    const canvas = createCanvas(width, height);
    canvas.getContext('2d').drawImage(generated, 0, 0, width, height);
    await fs.writeFile(target, canvas.toBuffer('image/png'));
    console.log(`${path.basename(target)}: ${width}x${height}`);
  }
}
