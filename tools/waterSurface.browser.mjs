import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-water';
const save = JSON.parse(await fs.readFile(process.env.EPOCH_SAVE ?? 'autorun-output/latest-save.json', 'utf8'));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.waterGame = game;` });
  });
  await page.route('**/src/systems/rendering/WaterSurface.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('this.refresh();', 'window.waterSurface = this; this.refresh();') });
  });
  await page.goto(`${base}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  const started = process.env.EPOCH_SCENARIO
    ? await page.evaluate(scenario => window.__epochDiagnostics.startNewGame({ scenario }), process.env.EPOCH_SCENARIO)
    : await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save);
  assert.equal(started.ok, true, JSON.stringify(started));
  await page.waitForFunction(() => window.waterSurface?.shader, undefined, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const resourceCounts = () => page.evaluate(() => {
    const r = window.waterGame.renderer;
    return { buffers: r.glBufferWrappers.length, vaos: r.glVAOWrappers.length,
      waterTextures: window.waterGame.textures.getTextureKeys().filter(k => k.startsWith('water-surface-')).length,
      terrainListeners: window.waterSurface.scene.events.listenerCount('terrain-rebuilt') };
  });
  const resourcesBefore = await resourceCounts();
  const before = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  const info = await page.evaluate(() => {
    const w = window.waterSurface;
    const candidates = w.data.tiles.flat().filter(t => t.type === 'coast' && w.canSee(t.x, t.y));
    const tile = candidates[Math.floor(candidates.length / 2)];
    if (!tile) throw new Error('Save must contain visible coast');
    const p = w.tileMap.tileToWorld(tile.x, tile.y);
    w.scene.cameras.main.setZoom(1.5).centerOn(p.x, p.y);
    return { map: [w.data.width, w.data.height], maskBytes: w.data.width * w.data.height * 4, tile, p };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/water-in-game.png` });
  // Isolate terrain and water for deterministic pixel comparisons; the game
  // state and visibility mask are unchanged. Freeze animation at chosen times.
  await page.evaluate(() => {
    const w = window.waterSurface;
    w.scene.events.off('update', w.update, w);
    for (const child of w.scene.children.list) {
      if (child !== w.shader && child.depth !== 0) child.setVisible(false);
    }
  });
  const pixelsAt = async (time, visible = true) => {
    await page.evaluate(({ time, visible }) => { window.waterSurface.elapsed = time; window.waterSurface.shader.setVisible(visible); }, { time, visible });
    await page.waitForTimeout(150);
    const encoded = await page.evaluate(() => {
      const game = window.waterGame;
      return new Promise(resolve => game.renderer.snapshot(image => {
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        resolve(btoa(binary));
      }));
    });
    return Buffer.from(encoded, 'base64');
  };
  const baseline = await pixelsAt(0, false);
  const first = await pixelsAt(0);
  await page.screenshot({ path: `${output}/water-t0.png` });
  const second = await pixelsAt(4);
  await page.screenshot({ path: `${output}/water-t4.png` });
  let animated = 0, changed = 0, maxDelta = 0;
  for (let i = 0; i < first.length; i += 4) {
    const d = Math.max(...[0,1,2].map(c => Math.abs(first[i+c] - second[i+c])));
    if (d > 0) animated++;
    if ([0,1,2].some(c => baseline[i+c] !== first[i+c])) changed++;
    maxDelta = Math.max(maxDelta, d);
  }
  assert.ok(animated > 100, `Water animates: ${animated} pixels`);
  assert.ok(changed > 100, 'Shader contributes visible pixels');
  assert.ok(maxDelta < 50, `Subtle motion, max channel delta ${maxDelta}`);
  // Sample centers in screen space to ensure axial lookup does not animate land
  // or currently unseen water (including after a visibility upload).
  const samples = await page.evaluate(() => {
    const w = window.waterSurface, c = w.scene.cameras.main;
    return w.data.tiles.flat().map(t => {
      const p = w.tileMap.tileToWorld(t.x, t.y);
      return { water: ['ocean','coast'].includes(t.type), visible: w.canSee(t.x,t.y), x: Math.round((p.x-c.scrollX)*c.zoom + c.width/2*(1-c.zoom)), y: Math.round((p.y-c.scrollY)*c.zoom+c.height/2*(1-c.zoom)) };
    }).filter(p => p.x > 2 && p.x < 1438 && p.y > 2 && p.y < 898);
  });
  let landChecked = 0;
  for (const p of samples.filter(p => !p.water || !p.visible)) {
    const i = (p.y * 1440 + p.x) * 4;
    assert.deepEqual(first.slice(i,i+4), baseline.slice(i,i+4), 'Land/unseen center unchanged');
    landChecked++;
  }
  assert.ok(landChecked > 0);
  await page.evaluate(() => {
    const w = window.waterSurface;
    w.originalCanSee = w.canSee;
    w.canSee = () => false;
    w.refresh();
  });
  assert.deepEqual(await pixelsAt(4), baseline, 'Visibility upload suppresses all unseen water');
  await page.evaluate(() => {
    const w = window.waterSurface;
    w.canSee = w.originalCanSee;
    w.refresh();
  });
  await page.evaluate(() => window.waterSurface.tileMap.rebuildTerrain());
  assert.deepEqual(await pixelsAt(4), second, 'Terrain rebake preserves the water surface');
  // Context restoration must re-upload the compact data texture and shader.
  await page.evaluate(() => { window.waterContextExtension = window.waterGame.renderer.gl.getExtension('WEBGL_lose_context'); window.waterContextExtension.loseContext(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.waterContextExtension.restoreContext());
  await page.waitForTimeout(1200);
  console.log('Context restored');
  const restored = await pixelsAt(4);
  assert.deepEqual(restored, second, 'Water and terrain survive context restoration');
  const after = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  for (const key of ['units','cities','turn','humanNationId']) assert.deepEqual(after[key], before[key]);
  // Reload the actual scene and check per-instance GPU resources are released.
  await page.evaluate(savedState => {
    window.waterSurface = null;
    window.waterGame.scene.getScene('GameScene').scene.start('GameScene', {
      mapKey: savedState.mapKey, humanNationId: savedState.humanNationId,
      activeNationIds: savedState.activeNationIds, resourceAbundance: 'normal',
      gameSpeedId: savedState.gameSpeedId, savedState,
    });
  }, after);
  await page.waitForFunction(() => window.waterSurface?.shader, undefined, { timeout: 90000 });
  await page.waitForTimeout(1500);
  assert.deepEqual(await resourceCounts(), resourcesBefore, 'Reload releases water texture, buffer, VAO and listener');
  console.log('Reload resources verified');
  const timings = [];
  for (const enabled of [false, true, true, false]) {
    timings.push(await page.evaluate(enabled => new Promise(resolve => {
      const game = window.waterGame;
      window.waterSurface.shader.setVisible(enabled);
      const samples = []; let start = 0;
      const timeout = setTimeout(() => { game.events.off('prerender', pre); game.events.off('postrender', post); resolve({ enabled, error: 'No render samples within 30s', count: samples.length }); }, 30000);
      const pre = () => { start = performance.now(); };
      const post = () => {
        samples.push(performance.now() - start);
        if (samples.length < 70) return;
        game.events.off('prerender', pre); game.events.off('postrender', post);
        clearTimeout(timeout);
        samples.splice(0, 10); samples.sort((a,b) => a-b);
        const gl = game.renderer.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
        resolve({ enabled, median: samples[30], p95: samples[57], gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' });
      };
      game.events.on('prerender', pre); game.events.on('postrender', post);
    }), enabled));
  }
  assert.ok(timings.every(t => !t.error), JSON.stringify(timings));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ timings, resourcesBefore }));
  console.log(JSON.stringify({ ...info, animated, changed, maxDelta, landChecked }));
} finally { await browser.close(); }
