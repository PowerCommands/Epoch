import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCanvas, loadImage } from 'canvas';
import { chromium } from 'playwright';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-planetary';
const save = process.env.EPOCH_SAVE ? JSON.parse(await fs.readFile(process.env.EPOCH_SAVE, 'utf8')) : null;
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('epoch.tutorialDontShowAgain', 'true'));
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('console', msg => { if (msg.type() === 'error' && /shader|WebGL|GL_INVALID/i.test(msg.text())) errors.push(msg.text()); });
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.planetaryGame = game;` });
  });
  await page.route('**/src/ui/hud/HudLayer.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('this.researchPanel =', 'window.planetaryHud = this; this.researchPanel =') });
  });
  await page.route('**/src/ui/CheatConsole.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('this.cheatSystem = cheatSystem;', 'this.cheatSystem = cheatSystem; window.planetaryCheats = cheatSystem;') });
  });
  await page.goto(`${base}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  assert.equal((await page.evaluate(s => s ? window.__epochDiagnostics.startSavedGame(s) : window.__epochDiagnostics.startNewGame(), save)).ok, true);
  await page.waitForFunction(() => window.planetaryGame.scene.getScene('GameScene').cameraController, undefined, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.planetaryHud.culturePanel.setCollapsed(true); window.planetaryHud.researchPanel.setCollapsed(true); });
  await page.evaluate(() => window.planetaryCheats.execute('fog off'));
  const before = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  for (const stage of ['normal', 'altitude', 'atmosphere', 'planet', 'navigation', 'navigation-transition', 'navigation-seam', 'navigation-pole']) {
    const info = await page.evaluate(stage => {
      const scene = window.planetaryGame.scene.getScene('GameScene');
      const control = scene.cameraController;
      const { start, min } = control.planetary.range;
      const t = { normal: 0, altitude: .35, atmosphere: .7, planet: 1, navigation: 1, 'navigation-transition': .7, 'navigation-seam': 1, 'navigation-pole': 1 }[stage];
      const view = control.planetary.view;
      control.focusOn(view.mapWidth / 2, view.mapHeight / 2, start * (min / start) ** t);
      if (stage.startsWith('navigation')) {
        control.enterGlobeNavigation();
        control.rotateGlobe(stage === 'navigation-seam' ? Math.PI - .01 : 0.7, stage === 'navigation-pole' ? -Math.PI * .44 : -0.5);
        control.planetary.update();
      }
      return { zoom: control.zoom, ...control.planetary.view, filters: scene.cameras.main.filters.internal.list.length };
    }, stage);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${output}/${stage}.png` });
    if (stage === 'normal') assert.equal(info.filters, 0);
    else assert.equal(info.filters, 1);
    // Catch the offscreen stencil regression: a blue limb alone is not a world.
    const screenshot = await loadImage(`${output}/${stage}.png`);
    const canvas = createCanvas(1440, 900);
    const ctx = canvas.getContext('2d'); ctx.drawImage(screenshot, 0, 0);
    const pixels = ctx.getImageData(340, 160, 760, 570).data;
    let land = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 1] > pixels[i] * 1.12 && pixels[i + 1] > pixels[i + 2] * 1.15 && pixels[i + 1] > 45) land++;
    }
    assert.ok(land > 1000, `${stage}: actual terrain survives camera compositing (${land} land pixels)`);

    if (stage === 'navigation' || stage === 'navigation-seam' || stage === 'navigation-pole') {
      let samples = 0, empty = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const x = 340 + (i / 4) % 760, y = 160 + Math.floor((i / 4) / 760);
        if (Math.hypot(x - 720, y - 450) > 350) continue;
        samples++;
        if (pixels[i] < 18 && pixels[i + 1] < 42 && pixels[i + 2] < 58) empty++;
      }
      assert.ok(empty / samples < .02, `${stage}: globe has no empty bounding-box wedges (${empty}/${samples})`);
    }

    // Find a rendered world sprite in screenshot pixels, then hover it. This
    // verifies GPU projection against Phaser hit testing, not just copied math.
    const markerWorld = await page.evaluate(stage => {
      const scene = window.planetaryGame.scene.getScene('GameScene');
      const v = scene.cameraController.planetary.view;
      const center = v.navigation ? scene.cameras.main.getWorldPoint(v.width / 2, v.height / 2) : scene.cameras.main.midPoint;
      const y = center.y + v.mapHeight * .08;
      const x = stage === 'navigation-seam'
        ? v.surface.originX + v.surface.width * .02 + v.surface.shearX * (y - v.surface.originY) / v.surface.height
        : center.x + v.mapWidth * .04;
      window.planetaryMarker = scene.add.image(x, y, '__WHITE').setTint(0xff00ff)
        .setDisplaySize(20 / v.zoom, 20 / v.zoom).setDepth(10000).setInteractive();
      for (const camera of scene.cameras.cameras) if (camera !== scene.cameras.main) camera.ignore(window.planetaryMarker);
      window.planetaryMarkerHit = false;
      window.planetaryMarker.on('pointerover', () => { window.planetaryMarkerHit = true; });
      return { x, y };
    }, stage);
    await page.waitForTimeout(100);
    ctx.drawImage(await loadImage(await page.screenshot({ path: `${output}/${stage}-marker.png` })), 0, 0);
    const marked = ctx.getImageData(340, 160, 760, 570).data;
    let sx = 0, sy = 0, count = 0;
    for (let i = 0; i < marked.length; i += 4) {
      if (marked[i] > 150 && marked[i + 2] > 150 && marked[i + 1] < 60) {
        const pixel = i / 4; sx += 340 + pixel % 760; sy += 160 + Math.floor(pixel / 760); count++;
      }
    }
    assert.ok(count > 20, `${stage}: projected marker is visible`);
    await page.mouse.move(sx / count, sy / count);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.planetaryMarkerHit), true, `${stage}: sprite hit test follows projection`);
    const world = await page.evaluate(({ x, y }) => window.planetaryGame.scene.getScene('GameScene').cameras.main.getWorldPoint(x, y), { x: sx / count, y: sy / count });
    assert.ok(Math.hypot(world.x - markerWorld.x, world.y - markerWorld.y) < 8, `${stage}: hex picking follows projection`);
    await page.evaluate(() => window.planetaryMarker.destroy());
    console.log(stage, JSON.stringify({ ...info, landPixels: land }));
  }
  await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameraController;
    const v = c.planetary.view;
    c.focusOn(v.mapWidth / 2, v.mapHeight / 2, c.planetary.range.min);
  });
  await page.waitForTimeout(150);
  const metrics = await page.evaluate(async () => {
    const game = window.planetaryGame;
    const filter = game.scene.getScene('GameScene').cameraController.planetary.filter;
    const result = {};
    for (const active of [false, true]) {
      filter.active = active;
      const samples = []; let start = 0;
      const before = () => { start = performance.now(); };
      const after = () => samples.push(performance.now() - start);
      game.events.on('prerender', before); game.events.on('postrender', after);
      await new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 60 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); });
      game.events.off('prerender', before); game.events.off('postrender', after);
      const sorted = samples.slice(10).sort((a, b) => a - b);
      result[active ? 'planet' : 'flatAtSameZoom'] = { medianMs: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)] };
    }
    return result;
  });
  console.log('CPU render timings (browser/GPU dependent):', JSON.stringify(metrics));
  // No hit on the empty space outside the globe, and the centre stays registered.
  const picks = await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameras.main;
    return { outside: c.getWorldPoint(5, 5), center: c.getWorldPoint(c.width / 2, c.height / 2), midpoint: c.midPoint };
  });
  assert.ok(picks.outside.x < 0);
  assert.ok(Math.abs(picks.center.x - picks.midpoint.x) < .01);
  assert.ok(Math.abs(picks.center.y - picks.midpoint.y) < .01);
  // Exercise real input and resize instead of only setting camera properties.
  const zoomBeforeWheel = await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.zoom);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.zoom) > zoomBeforeWheel, 'wheel leaves planetary zoom');
  const scrollBeforeDrag = await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.scrollX);
  await page.mouse.down(); await page.mouse.move(770, 460, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.scrollX) < scrollBeforeDrag, 'drag pans the hemisphere');
  for (const viewport of [{ width: 1024, height: 768 }, { width: 800, height: 1100 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const control = window.planetaryGame.scene.getScene('GameScene').cameraController;
      control.setZoom(control.planetary.range.min);
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${output}/planet-${viewport.width}.png` });
  }
  await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.setZoom(1));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.filters.internal.list.length), 0);
  // Normal zoom: an off-centre wheel anchor stays on the same world point.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameraController;
    const v = c.planetary.view; c.focusOn(v.mapWidth / 2, v.mapHeight / 2, 1);
  });
  await page.waitForTimeout(200);
  await page.mouse.move(800, 400);
  const anchor = await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.getWorldPoint(800, 400));
  await page.mouse.wheel(0, -100); await page.waitForTimeout(900);
  const anchored = await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.getWorldPoint(800, 400));
  assert.ok(Math.hypot(anchor.x - anchored.x, anchor.y - anchored.y) < .1, 'normal wheel preserves pointer anchor');
  // G is scoped to world input, including DOM focus and Phaser modal gates.
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'globe-test-input'; document.body.append(input); input.focus(); });
  await page.keyboard.press('g');
  assert.equal(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.isGlobeNavigationActive), false);
  await page.evaluate(() => document.getElementById('globe-test-input').remove());
  await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.worldInputGate.blockWorld('globe-test'));
  await page.keyboard.press('g');
  assert.equal(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.isGlobeNavigationActive), false);
  await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.worldInputGate.unblockWorld('globe-test'));
  const local = await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameras.main;
    return { zoom: c.zoom, x: c.midPoint.x, y: c.midPoint.y };
  });
  await page.keyboard.press('g');
  assert.ok(await page.evaluate(() => { const c = window.planetaryGame.scene.getScene('GameScene').cameraController; return c.isGlobeNavigationActive && c.zoom > c.planetary.range.min; }), 'G animates to the globe');
  await page.waitForTimeout(1400);
  await page.keyboard.press('g');
  await page.waitForTimeout(1400);
  const restored = await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameras.main;
    return { zoom: c.zoom, x: c.midPoint.x, y: c.midPoint.y };
  });
  assert.ok(Math.abs(local.zoom - restored.zoom) < .001 && Math.hypot(local.x - restored.x, local.y - restored.y) < 1, 'G round trip restores local position');
  await page.keyboard.press('g'); await page.waitForTimeout(1400);
  const initialOrientation = await page.evaluate(() => ({ ...window.planetaryGame.scene.getScene('GameScene').cameraController.planetary.navigation }));
  await page.keyboard.down('d'); await page.keyboard.down('w'); await page.waitForTimeout(250);
  await page.keyboard.up('d'); await page.keyboard.up('w');
  const rotated = await page.evaluate(() => ({ ...window.planetaryGame.scene.getScene('GameScene').cameraController.planetary.navigation }));
  assert.ok(rotated.longitude > initialOrientation.longitude && rotated.latitude < initialOrientation.latitude, 'keyboard rotates and tilts');
  await page.mouse.move(720, 450); await page.mouse.down(); await page.mouse.move(820, 510, { steps: 8 }); await page.mouse.up();
  const dragged = await page.evaluate(() => ({ ...window.planetaryGame.scene.getScene('GameScene').cameraController.planetary.navigation }));
  assert.ok(dragged.longitude < rotated.longitude && dragged.latitude < rotated.latitude, 'drag grabs the sphere');
  await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameraController;
    c.rotateGlobe(Math.PI * 12, -100);
  });
  const bounded = await page.evaluate(() => ({ ...window.planetaryGame.scene.getScene('GameScene').cameraController.planetary.navigation }));
  assert.ok(Math.abs(bounded.longitude - dragged.longitude) < 1e-6 && Math.abs(bounded.latitude) < Math.PI / 2, 'continuous rotation and bounded tilt');
  await page.setViewportSize({ width: 800, height: 1100 }); await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameraController.isGlobeNavigationActive), true, 'resize preserves globe navigation');
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(250);
  await page.keyboard.down('a'); await page.keyboard.down('s'); await page.waitForTimeout(150);
  await page.keyboard.up('a'); await page.keyboard.up('s');
  await page.evaluate(() => {
    const c = window.planetaryGame.scene.getScene('GameScene').cameraController;
    c.planetary.navigation = { longitude: 0.7, latitude: -0.5 }; c.syncGlobeCamera();
  });
  await page.waitForTimeout(100);
  const destination = await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.getWorldPoint(720, 450));
  await page.mouse.move(720, 450);
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(35); }
  await page.waitForTimeout(1400);
  const arrived = await page.evaluate(() => {
    const s = window.planetaryGame.scene.getScene('GameScene');
    return { active: s.cameraController.isGlobeNavigationActive, point: s.cameras.main.getWorldPoint(720, 450) };
  });
  assert.equal(arrived.active, false, 'inward wheel leaves globe mode');
  assert.ok(Math.hypot(arrived.point.x - destination.x, arrived.point.y - destination.y) < 1, `zoom arrives at the viewed region: ${JSON.stringify({ destination, arrived })}`);
  console.log('Globe navigation input and destination checks passed');
  const after = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  for (const key of ['units', 'cities', 'turn', 'humanNationId']) assert.deepEqual(after[key], before[key], key);
  for (const name of (process.env.EPOCH_PLANETARY_MAPS ?? '').split(',').filter(Boolean)) {
    const scenario = JSON.parse(await fs.readFile(`public/assets/maps/${name}.json`, 'utf8'));
    await page.evaluate(({ name, nations }) => {
      window.planetaryHud = null; window.planetaryCheats = null;
      window.planetaryGame.scene.getScene('GameScene').scene.restart({
        mapKey: `map_${name}`, humanNationId: nations[0], activeNationIds: nations, resourceAbundance: 'scenario',
      });
    }, { name, nations: scenario.nations.map(n => n.id) });
    await page.waitForFunction(() => window.planetaryHud && window.planetaryCheats, undefined, { timeout: 120000 });
    const view = await page.evaluate(() => {
      window.planetaryHud.culturePanel.setCollapsed(true); window.planetaryHud.researchPanel.setCollapsed(true);
      window.planetaryCheats.execute('fog off');
      const c = window.planetaryGame.scene.getScene('GameScene').cameraController;
      const v = c.planetary.view; c.focusOn(v.mapWidth / 2, v.mapHeight / 2, c.planetary.range.min);
      return c.planetary.view;
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${output}/planet-${name}.png` });
    assert.equal(view.strength, 1);
    assert.ok(await page.evaluate(() => window.planetaryGame.scene.getScene('GameScene').cameras.main.renderList.length) > 100);
    console.log('Additional map', name, JSON.stringify(view));
  }
  assert.deepEqual(errors, []);
  console.log('Planetary browser checks passed. Screenshots:', output);
} finally { await browser.close(); }
