import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planetaryZoomRange, planetaryStrength, planetaryParameters, unprojectPlanetary, type PlanetaryView } from '../src/systems/rendering/PlanetaryProjection';

for (const [width, height, mapWidth, mapHeight] of [[1440,900,12000,6000], [800,1100,6000,12000], [1024,768,2000,2000], [1440,900,24000,1000]]) {
  test(`projection preserves registration for ${width}x${height}, map ${mapWidth}x${mapHeight}`, () => {
    const range = planetaryZoomRange(width, height, mapWidth, mapHeight);
    assert.ok(range.min < range.start);
    assert.equal(planetaryStrength(range.start, range.start, range.min), 0);
    assert.equal(planetaryStrength(range.min, range.start, range.min), 1);
    let last = -1;
    for (let step = 0; step <= 100; step++) {
      const zoom = range.start * (range.min / range.start) ** (step / 100);
      const strength = planetaryStrength(zoom, range.start, range.min);
      assert.ok(strength >= last); last = strength;
      const view: PlanetaryView = { width, height, mapWidth, mapHeight, zoom, strength };
      assert.deepEqual(unprojectPlanetary(width / 2, height / 2, view), { x: width / 2, y: height / 2 });
      for (let x = 0; x <= width; x += width / 8) {
        for (let y = 0; y <= height; y += height / 8) {
          const sample = unprojectPlanetary(x, y, view);
          if (sample) {
            assert.ok(sample.x >= -1e-6 && sample.x <= width + 1e-6, 'visible surface samples the captured viewport');
            assert.ok(sample.y >= -1e-6 && sample.y <= height + 1e-6, 'visible surface samples the captured viewport');
          }
        }
      }
      if (!strength) { assert.deepEqual(unprojectPlanetary(13, 27, view), { x: 13, y: 27 }); continue; }
      // Independently forward-project known longitude/latitude points, then
      // verify picking recovers their exact location in the flat camera image.
      const { radius, scaleX, scaleY } = planetaryParameters(view);
      const bend = Math.sqrt(strength);
      for (const longitude of [-1.3, -.4, 0, .7, 1.3]) {
        for (const latitude of [-1, -.3, 0, .8]) {
          const x = width / 2 + radius / bend * Math.sin(longitude) * Math.cos(latitude);
          const y = height / 2 + radius / bend * Math.sin(latitude);
          const point = unprojectPlanetary(x, y, view)!;
          assert.ok(Math.abs(point.x - (width / 2 + longitude * scaleX / bend)) < 1e-6);
          assert.ok(Math.abs(point.y - (height / 2 + latitude * scaleY / bend)) < 1e-6);
        }
      }
    }
    const planet = { width, height, mapWidth, mapHeight, zoom: range.min, strength: 1 };
    assert.equal(unprojectPlanetary(0, 0, planet), null);
  });
}
