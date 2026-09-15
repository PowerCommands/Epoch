import assert from 'node:assert/strict';
import test from 'node:test';
import { ballisticAltitude, ballisticSurfacePoint } from '../src/renderers/ICBMFlight';
import { globeOrientation, hexPlanetarySurface, planetaryZoomRange, projectPlanetary, unprojectPlanetary, type PlanetaryView } from '../src/systems/rendering/PlanetaryProjection';

const base: PlanetaryView = { width: 1200, height: 900, mapWidth: 12000, mapHeight: 6000, zoom: 0.05, strength: 1 };

test('ballistic route is finite and reaches its target across seams, poles and antipodes', () => {
  for (const [from, to] of [[{ x: 11990, y: 3000 }, { x: 10, y: 3000 }],
    [{ x: 3000, y: 3000 }, { x: 9000, y: 3000 }],
    [{ x: 20, y: 1 }, { x: 9000, y: 5999 }],
    [{ x: 6000, y: 3000 }, { x: 6000, y: 3000 }]]) {
    assert.deepEqual(ballisticSurfacePoint(from, to, 0, base), from);
    assert.deepEqual(ballisticSurfacePoint(from, to, 1, base), to);
    for (let step = 0; step <= 100; step++) {
      const point = ballisticSurfacePoint(from, to, step / 100, base);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= 0 && point.x <= base.mapWidth);
      assert.ok(point.y >= 0 && point.y <= base.mapHeight);
    }
  }
  const midpoint = ballisticSurfacePoint({ x: 11990, y: 3000 }, { x: 10, y: 3000 }, 0.5, base);
  assert.ok(midpoint.x < 11 || midpoint.x > 11989, 'seam crossing takes the short visual orbit');
  assert.equal(ballisticAltitude(0), 0);
  assert.ok(ballisticAltitude(1) < 1e-10);
  assert.ok(ballisticAltitude(0.5) > 0.5, 'apogee visibly clears the atmosphere');
});

test('forward effect anchors agree with inverse globe picking throughout transition', () => {
  for (const strength of [0, 0.01, 0.2, 0.6, 1]) for (const longitude of [-3.1, 0.7, 3.1]) {
    const view: PlanetaryView = { ...base, strength, surface: hexPlanetarySurface(200, 100, 48),
      zoom: planetaryZoomRange(1200, 900, 12000, 6000).min,
      navigation: { longitude, latitude: -0.3, centerX: 6000, centerY: 3000 } };
    for (const x of [430, 600, 770]) for (const y of [300, 450, 600]) {
      const source = unprojectPlanetary(x, y, view)!;
      const screen = projectPlanetary(source.x, source.y, view)!;
      assert.ok(screen, 'front-facing world point remains visible');
      assert.ok(Math.hypot(screen.x - x, screen.y - y) < 1e-6, 'flight marker stays attached to the live map');
    }
  }
});

test('ballistic route preserves axial hex surface shear', () => {
  const view = { ...base, surface: hexPlanetarySurface(200, 100, 48) };
  const from = { x: 3000, y: 1000 }, to = { x: 5000, y: 2800 };
  const point = ballisticSurfacePoint(from, to, 0.5, view);
  const orientation = globeOrientation(point.x, point.y, view);
  assert.ok(Number.isFinite(orientation.longitude) && Number.isFinite(orientation.latitude));
});

test('the solid globe occludes surface objects on the far hemisphere', () => {
  const view: PlanetaryView = { ...base, zoom: planetaryZoomRange(1200, 900, 12000, 6000).min,
    navigation: { longitude: 0, latitude: 0, centerX: 6000, centerY: 3000 } };
  const point = { x: 600 + (10000 - 6000) * view.zoom, y: 450 };
  assert.equal(projectPlanetary(point.x, point.y, view), null);
  assert.ok(projectPlanetary(point.x, point.y, view, 0.58), 'high flight can be seen above the limb');
});
