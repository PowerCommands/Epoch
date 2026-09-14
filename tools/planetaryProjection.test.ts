import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HexGridLayout } from '../src/systems/gridLayout/HexGridLayout';
import { hexPlanetarySurface, globeOrientation, GLOBE_LONGITUDE_SPAN, GLOBE_LATITUDE_LIMIT, wrapLongitude, globeDestination, planetaryZoomRange, planetaryStrength, planetaryParameters, unprojectPlanetary, type PlanetaryView } from '../src/systems/rendering/PlanetaryProjection';

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

for (const [mapWidth, mapHeight] of [[12000, 6000], [6000, 12000], [24000, 1000]]) {
  test(`rotated sphere recovers finite map coordinates ${mapWidth}x${mapHeight}`, () => {
    const width = 1440, height = 900;
    const zoom = planetaryZoomRange(width, height, mapWidth, mapHeight).min;
    for (const yaw of [-3, -1.5, 0.6, 2.8]) for (const pitch of [-GLOBE_LATITUDE_LIMIT, 0.4, GLOBE_LATITUDE_LIMIT]) {
      const view: PlanetaryView = { width, height, mapWidth, mapHeight, zoom, strength: 1,
        navigation: { longitude: yaw, latitude: pitch, centerX: mapWidth / 2, centerY: mapHeight / 2 } };
      for (const dx of [-0.2, 0, 0.2]) for (const dy of [-0.08, 0, 0.08]) {
        const longitude = wrapLongitude(yaw + dx), latitude = pitch + dy;
        // Independent forward spherical rotation, followed by the input inverse.
        const x = Math.sin(dx) * Math.cos(latitude);
        const y = Math.sin(latitude) * Math.cos(pitch) - Math.cos(dx) * Math.cos(latitude) * Math.sin(pitch);
        const radius = planetaryParameters(view).radius;
        const pick = unprojectPlanetary(width / 2 + x * radius, height / 2 + y * radius, view)!;
        assert.ok(Math.abs((pick.x - width / 2) / zoom + mapWidth / 2 - mapWidth * (0.5 + longitude / GLOBE_LONGITUDE_SPAN)) < 1e-6);
        assert.ok(Math.abs((pick.y - height / 2) / zoom + mapHeight / 2 - mapHeight * (0.5 + latitude / Math.PI)) < 1e-6);
      }
      assert.ok(Math.abs(wrapLongitude(yaw + Math.PI * 20) - yaw) < 1e-12);
    }
    const seam: PlanetaryView = { width, height, mapWidth, mapHeight, zoom, strength: 1,
      navigation: { longitude: Math.PI - 0.01, latitude: 0, centerX: mapWidth / 2, centerY: mapHeight / 2 } };
    assert.ok(globeDestination(seam).x > mapWidth * .99);
    const radius = planetaryParameters(seam).radius;
    const west = unprojectPlanetary(width / 2 + Math.sin(.02) * radius, height / 2, seam)!;
    const westWorldX = (west.x - width / 2) / zoom + mapWidth / 2;
    assert.ok(westWorldX > 0 && westWorldX < mapWidth * .01, 'west edge appears immediately beyond the east edge');
    seam.navigation!.longitude = -Math.PI + .01;
    const east = unprojectPlanetary(width / 2 - Math.sin(.02) * radius, height / 2, seam)!;
    const eastWorldX = (east.x - width / 2) / zoom + mapWidth / 2;
    assert.ok(eastWorldX > mapWidth * .99 && eastWorldX < mapWidth, 'east edge appears immediately beyond the west edge');
  });
}

test('zoom transition holds the viewed region at the screen centre', () => {
  const width = 1440, height = 900, mapWidth = 12000, mapHeight = 6000;
  const range = planetaryZoomRange(width, height, mapWidth, mapHeight);
  for (let i = 1; i <= 100; i++) {
    const zoom = range.start * (range.min / range.start) ** (i / 100);
    const strength = planetaryStrength(zoom, range.start, range.min);
    const view: PlanetaryView = { width, height, mapWidth, mapHeight, zoom, strength,
      navigation: { longitude: 1.2, latitude: -0.7, centerX: 5500, centerY: 3100 } };
    const point = unprojectPlanetary(width / 2, height / 2, view)!;
    const destination = globeDestination(view);
    assert.ok(Math.abs((point.x - width / 2) / zoom + 5500 - destination.x) < 1e-6);
    assert.ok(Math.abs((point.y - height / 2) / zoom + 3100 - destination.y) < 1e-6);
  }
});

for (const [columns, rows] of [[200, 75], [25, 180], [1, 1], [1, 50], [50, 1]]) {
  test(`painted hex surface covers every globe sample (${columns}x${rows})`, () => {
    const layout = new HexGridLayout();
    const data = { width: columns, height: rows, tileSize: 48, tiles: [] };
    const bounds = layout.getWorldBounds(data);
    const view: PlanetaryView = { width: 1440, height: 900, mapWidth: bounds.width, mapHeight: bounds.height,
      zoom: planetaryZoomRange(1440, 900, bounds.width, bounds.height).min, strength: 1,
      surface: hexPlanetarySurface(columns, rows, data.tileSize) };
    for (const longitude of [-Math.PI + .001, -1.8, 0, 1.8, Math.PI - .001]) {
      for (const latitude of [-GLOBE_LATITUDE_LIMIT, 0, GLOBE_LATITUDE_LIMIT]) {
        view.navigation = { longitude, latitude, centerX: bounds.width / 2, centerY: bounds.height / 2 };
        for (let x = 350; x < 1100; x += 19) for (let y = 70; y < 835; y += 19) {
          const point = unprojectPlanetary(x, y, view);
          if (!point) continue;
          const world = { x: (point.x - 720) / view.zoom + bounds.width / 2,
            y: (point.y - 450) / view.zoom + bounds.height / 2 };
          assert.ok(layout.worldToTileCoord(world, data), 'each visible point samples a real finite tile');
        }
        const destination = globeDestination(view);
        const orientation = globeOrientation(destination.x, destination.y, view);
        assert.ok(Math.abs(orientation.longitude - longitude) < 1e-6);
        assert.ok(Math.abs(orientation.latitude - latitude) < 1e-6);
        // Registration at the centre must survive the shear fading to flat.
        for (const strength of [.01, .4, .8]) {
          const transition = { ...view, strength };
          const center = unprojectPlanetary(720, 450, transition)!;
          assert.ok(Math.abs((center.x - 720) / view.zoom + bounds.width / 2 - destination.x) < 1e-6);
          assert.ok(Math.abs((center.y - 450) / view.zoom + bounds.height / 2 - destination.y) < 1e-6);
        }
      }
    }
  });
}
