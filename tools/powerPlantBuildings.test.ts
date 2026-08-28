import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';
import {
  ALL_BUILDINGS,
  COAL_POWER_PLANT,
  GAS_POWER_PLANT,
  NUCLEAR_POWER_PLANT,
  OIL_POWER_PLANT,
  getBuildingById,
} from '../src/data/buildings.ts';
import { ALL_TECHNOLOGIES } from '../src/data/technologies.ts';

const PROJECT_ROOT = new URL('../', import.meta.url);
const PLANTS = [COAL_POWER_PLANT, OIL_POWER_PLANT, GAS_POWER_PLANT, NUCLEAR_POWER_PLANT] as const;

test('the four canonical power plants exist exactly once with initial costs', () => {
  assert.deepEqual(
    PLANTS.map(({ id, name, productionCost }) => ({ id, name, productionCost })),
    [
      { id: 'coal_power_plant', name: 'Coal Power Plant', productionCost: 300 },
      { id: 'oil_power_plant', name: 'Oil Power Plant', productionCost: 340 },
      { id: 'gas_power_plant', name: 'Gas Power Plant', productionCost: 360 },
      { id: 'nuclear_plant', name: 'Nuclear Power Plant', productionCost: 360 },
    ],
  );

  for (const plant of PLANTS) {
    assert.equal(ALL_BUILDINGS.filter((building) => building.id === plant.id).length, 1, plant.id);
    assert.equal(ALL_BUILDINGS.filter((building) => building.name === plant.name).length, 1, plant.name);
    assert.equal(getBuildingById(plant.id), plant);
    assert.equal('requiredResource' in plant, false, `${plant.name} requirements belong in centralized power-plant metadata`);
  }
});

test('each power plant has exactly one chronological technology unlock', () => {
  const expected = new Map([
    ['coal_power_plant', 'industrialization'],
    ['oil_power_plant', 'biology'],
    ['gas_power_plant', 'combustion'],
    ['nuclear_plant', 'nuclear_fission'],
  ]);

  for (const [buildingId, technologyId] of expected) {
    const unlocks = ALL_TECHNOLOGIES.filter((technology) => technology.unlocks.some(
      (unlock) => unlock.kind === 'building' && unlock.id === buildingId,
    ));
    assert.deepEqual(unlocks.map((technology) => technology.id), [technologyId], buildingId);
  }
});

test('the generated editor manifest exposes all four power plants', () => {
  const manifest = JSON.parse(readFileSync(new URL('public/assets/data/buildings-manifest.json', PROJECT_ROOT), 'utf8')) as {
    buildings: Array<{ id: string; name: string; era: string; placement: string; iconPath: string }>;
  };

  for (const plant of PLANTS) {
    const entry = manifest.buildings.find((building) => building.id === plant.id);
    assert.deepEqual(entry, {
      id: plant.id,
      name: plant.name,
      era: plant.era,
      placement: plant.placement,
      iconPath: `assets/sprites/buildings/${plant.id}.png`,
    });
  }
});

test('all four power plant icons are non-empty 256px transparent PNGs', async () => {
  for (const plant of PLANTS) {
    const path = fileURLToPath(new URL(`../public/assets/sprites/buildings/${plant.id}.png`, import.meta.url));
    const image = await loadImage(path);
    assert.equal(image.width, 256, plant.id);
    assert.equal(image.height, 256, plant.id);

    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let transparentPixels = 0;
    let visiblePixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] === 0) transparentPixels += 1;
      if (pixels[index] > 0) visiblePixels += 1;
    }
    assert.ok(transparentPixels > 0, plant.id);
    assert.ok(visiblePixels > 0, plant.id);
  }
});
