import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCanvas, loadImage } from 'canvas';
import { chromium } from 'playwright';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-planetary';
const save = JSON.parse(await fs.readFile(process.env.EPOCH_SAVE ?? 'autorun-output/latest-save.json', 'utf8'));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
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
  await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save);
  await page.waitForFunction(() => window.planetaryGame.scene.getScene('GameScene').cameraController, undefined, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.planetaryHud.culturePanel.setCollapsed(true); window.planetaryHud.researchPanel.setCollapsed(true); });
  const before = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  for (const stage of ['normal', 'altitude', 'atmosphere', 'planet']) {
    const info = await page.evaluate(stage => {
      const scene = window.planetaryGame.scene.getScene('GameScene');
      const control = scene.cameraController;
      const { start, min } = control.planetary.range;
      const t = { normal: 0, altitude: .35, atmosphere: .7, planet: 1 }[stage];
      const view = control.planetary.view;
      control.focusOn(view.mapWidth / 2, view.mapHeight / 2, start * (min / start) ** t);
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

    // Find a rendered world sprite in screenshot pixels, then hover it. This
    // verifies GPU projection against Phaser hit testing, not just copied math.
    const markerWorld = await page.evaluate(() => {
      const scene = window.planetaryGame.scene.getScene('GameScene');
      const v = scene.cameraController.planetary.view;
      const x = scene.cameras.main.midPoint.x + v.mapWidth * .04;
      const y = scene.cameras.main.midPoint.y + v.mapHeight * .08;
      window.planetaryMarker = scene.add.image(x, y, '__WHITE').setTint(0xff00ff)
        .setDisplaySize(20 / v.zoom, 20 / v.zoom).setDepth(10000).setInteractive();
      for (const camera of scene.cameras.cameras) if (camera !== scene.cameras.main) camera.ignore(window.planetaryMarker);
      window.planetaryMarkerHit = false;
      window.planetaryMarker.on('pointerover', () => { window.planetaryMarkerHit = true; });
      return { x, y };
    });
    await page.waitForTimeout(100);
    ctx.drawImage(await loadImage(await page.screenshot()), 0, 0);
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
