import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from 'canvas';
import { City, type SettlementStage } from '../src/entities/City';
import { CITY_BASE_HEALTH } from '../src/data/cities';
import { HexGridLayout } from '../src/systems/gridLayout/HexGridLayout';
import { URBAN_SLOTS } from '../src/systems/UrbanDevelopment';
import { drawOrganicCity } from '../src/systems/rendering/OrganicCityArtwork';
import { drawMetropolis } from '../src/systems/rendering/MetropolisArtwork';
import type { MapData } from '../src/types/map';

for (const stage of ['Village', 'Town', 'City', 'Metropolis'] as SettlementStage[]) {
  test(`${stage}: damage appearance persists below 51% and clears exactly at 51%`, () => {
    const city = new City({ id: stage, name: stage, ownerId: 'a', tileX: 4, tileY: 4, settlementStage: stage });
    for (const health of [200, 150, 102, 101.99, 101, 100, 1, 80, 101, 102, 200]) {
      city.health = health;
      assert.equal(city.isVisuallyDamaged, health < CITY_BASE_HEALTH * .51, `${health} HP`);
      assert.equal(city.isDamaged, health < CITY_BASE_HEALTH, 'healing eligibility is independent of the visual threshold');
      assert.equal(city.settlementStage, stage);
    }
  });
}

const layout = new HexGridLayout(), map = { width: 9, height: 9, tileSize: 64 } as MapData;
const origin = layout.tileToWorld({ x: 4, y: 4 }, map);
const size = layout.getTileRect({ x: 4, y: 4 }, map).width;
for (const stage of ['Town', 'City', 'Metropolis']) for (const waterMask of [0, 18, 42]) {
  test(`${stage}: dedicated damaged streetscape and building fire anchors, coast mask ${waterMask}`, () => {
    const centers = [{ x: 4, y: 4 }, ...URBAN_SLOTS.filter((_, i) => !(waterMask & (1 << i))).map(s => ({ x: 4 + s.dq, y: 4 + s.dr }))];
    const land = centers.map(p => layout.getTileOutlinePoints(p, map).map(q => ({ x: q.x - origin.x, y: q.y - origin.y })));
    const render = (damaged: boolean) => {
      const canvas = createCanvas(600, 500), ctx = canvas.getContext('2d');
      ctx.translate(300, 290); ctx.scale(2, 2);
      const art = stage === 'Metropolis' ? drawMetropolis(ctx as unknown as CanvasRenderingContext2D, land, size, damaged)
        : drawOrganicCity(ctx as unknown as CanvasRenderingContext2D, land, size, stage === 'City', damaged);
      return { pixels: ctx.getImageData(0, 0, 600, 500).data, fires: art.fires ?? [] };
    };
    const healthy = render(false), damaged = render(true), repeated = render(true);
    assert.equal(healthy.fires.length, 0);
    assert.ok(damaged.fires.length >= 4);
    assert.deepEqual(damaged, repeated, 'save/reload and texture reuse must retain the same ruins and anchors');
    let changed = 0, visible = 0;
    for (let i = 0; i < healthy.pixels.length; i += 4) {
      if (healthy.pixels[i + 3] > 128) visible++;
      if (Math.abs(healthy.pixels[i] - damaged.pixels[i]) + Math.abs(healthy.pixels[i + 1] - damaged.pixels[i + 1]) + Math.abs(healthy.pixels[i + 2] - damaged.pixels[i + 2]) > 40) changed++;
    }
    assert.ok(changed > visible * .1, `${changed}/${visible} changed pixels: ruins must be visible, not just a texture-key change`);
  });
}
