import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCanvas, loadImage } from 'canvas';
import { ALL_BUILDINGS, GRAND_STADIUM } from '../src/data/buildings.ts';
import { ALL_WONDERS } from '../src/data/wonders.ts';
import { getBuildingSpritePath, getWonderSpritePath } from '../src/utils/assetPaths.ts';

const pairs = [
  ...[...ALL_BUILDINGS, GRAND_STADIUM].filter(b => b.placement !== 'city').map(b => [getBuildingSpritePath(b.id), getBuildingSpritePath(b.id, true)]),
  ...['barbarian-camp', 'solar_plant'].map(id => [getBuildingSpritePath(id), getBuildingSpritePath(id, true)]),
  ...ALL_WONDERS.map(w => [getWonderSpritePath(w.id), getWonderSpritePath(w.id, true)]),
  ...fs.readdirSync('public/assets/sprites/cities').filter(f => f.endsWith('.png') && !f.endsWith('-broken.png'))
    .map(f => [`assets/sprites/cities/${f}`, `assets/sprites/cities/${f.replace('.png', '-broken.png')}`]),
];
for (const [normal, broken] of pairs) {
  test(`Dedicated transparent damage sprite: ${broken}`, async () => {
    const original = fs.readFileSync(`public/${normal}`);
    const damaged = fs.readFileSync(`public/${broken}`);
    assert.notDeepEqual(damaged, original, 'Damaged artwork must not be a copy of the normal sprite');
    const a = await loadImage(original), b = await loadImage(damaged);
    assert.ok(Math.abs(a.width / a.height - b.width / b.height) < 0.01, 'Source canvas aspect ratio is preserved');
    assert.ok(Math.max(b.width, b.height) <= 512, 'Map textures have bounded resolution');
    const canvas = createCanvas(b.width, b.height), context = canvas.getContext('2d');
    context.drawImage(b, 0, 0);
    const rgba = context.getImageData(0, 0, b.width, b.height).data;
    let transparent = 0, visible = 0;
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] < 16) transparent++;
      if (rgba[i] > 128) visible++;
    }
    assert.ok(transparent / (b.width * b.height) > 0.1, 'True alpha transparency, not a baked checkerboard or matte');
    assert.ok(visible / (b.width * b.height) > 0.02, 'Artwork contains a visible structure');
  });
}
test('Shared Under Construction sign is a transparent PNG', async () => {
  const image = await loadImage('public/assets/sprites/overlays/under-construction.png');
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  assert.ok(context.getImageData(0, 0, 1, 1).data[3] < 16);
});
