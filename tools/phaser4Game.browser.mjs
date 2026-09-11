import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Test-only Vite response instrumentation exposes existing instances without
// adding globals or diagnostics hooks to the shipping application.
const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-phaser-migration';
const expected = process.env.EPOCH_PHASER_VERSION ?? '4.2.1';
const save = JSON.parse(await fs.readFile(process.env.EPOCH_SAVE ?? 'autorun-output/latest-save.json', 'utf8'));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const mode of process.env.EPOCH_RENDERER ? [process.env.EPOCH_RENDERER] : ['webgl', 'canvas']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    if (mode === 'canvas') await page.addInitScript(() => {
      // Simulate ordinary WebGL being present without Phaser 4's mandatory
      // instancing extension. This exercises application startup selection.
      const original = WebGLRenderingContext.prototype.getExtension;
      WebGLRenderingContext.prototype.getExtension = function (name) {
        return name === 'ANGLE_instanced_arrays' ? null : original.call(this, name);
      };
    });
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.migrationGame = game; window.migrationPhaserVersion = Phaser.VERSION;` });
    });
    await page.route('**/src/ui/hud/HudLayer.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('this.researchPanel =', 'window.migrationHud = this; this.researchPanel =') });
    });
    await page.goto(`${base}/?epochDiagnostics=1`);
    await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
    assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save)).ok, true);
    await page.waitForFunction(() => window.migrationHud, undefined, { timeout: 90000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.migrationPhaserVersion), expected);
    // Phaser 3 does not need the instancing extension; only 4 must fall back.
    assert.equal(await page.evaluate(() => window.migrationGame.renderer.type), mode === 'canvas' && expected.startsWith('4.') ? 1 : 2);
    const snapshot = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
    await page.screenshot({ path: `${output}/game-${expected}-${mode}.png` });

    for (const view of ['policies', 'technology', 'culture', 'discovery']) {
      assert.equal(await page.evaluate(view => {
        const hud = window.migrationHud;
        if (view === 'policies') { hud.policyDialog.open(); return hud.policyDialog.isShowing(); }
        if (view === 'technology') { hud.researchPanel.onOpenTree(); return hud.dependencyTreeDialog.isShowing(); }
        if (view === 'culture') { hud.culturePanel.onOpenTree(); return hud.dependencyTreeDialog.isShowing(); }
        hud.discoveryPopup.show({ title: 'Migration rendering check', imageKey: '__WHITE', description: 'Scrollable discovery content. '.repeat(50), unlockRows: Array.from({length: 20}, (_, i) => ({label: `Unlock ${i}`, imageKey: '__WHITE'})), leadsToRows: [] });
        return hud.discoveryPopup.isShowing();
      }, view), true);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${output}/${view}-initial-${expected}-${mode}.png` });
      const zoomBefore = await page.evaluate(() => window.migrationGame.scene.getScene('GameScene').cameras.main.zoom);
      await page.mouse.move(700, 450);
      // The old tree/popup handlers incorrectly dereference a sixth argument
      // Phaser never emits. Baseline captures remain at the initial position.
      if (expected.startsWith('4.')) await page.mouse.wheel(0, 500);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.migrationGame.scene.getScene('GameScene').cameras.main.zoom), zoomBefore, `${view}: modal wheel does not zoom world`);
      if (view === 'discovery' && expected.startsWith('4.')) {
        assert.ok(await page.evaluate(() => window.migrationHud.discoveryPopup.scrollOffset > 0), 'discovery wheel scrolls content');
      }
      await page.screenshot({ path: `${output}/${view}-${expected}-${mode}.png` });
      await page.evaluate(() => {
        const hud = window.migrationHud;
        hud.policyDialog.close(); hud.dependencyTreeDialog.close(); hud.discoveryPopup.hide();
      });
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => { window.migrationHud.policyDialog.open(); });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${output}/policies-small-${expected}-${mode}.png` });
    await page.evaluate(() => window.migrationHud.policyDialog.close());
    await page.setViewportSize({ width: 1440, height: 900 });
    const metrics = await page.evaluate(async () => {
      const game = window.migrationGame;
      const scene = game.scene.getScene('GameScene');
      const samples = [];
      let start = 0;
      const before = () => { start = performance.now(); };
      const after = () => { samples.push(performance.now() - start); };
      game.events.on('prerender', before); game.events.on('postrender', after);
      await new Promise(resolve => { let frames = 0; const tick = () => ++frames >= 150 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); });
      game.events.off('prerender', before); game.events.off('postrender', after);
      const sorted = samples.slice(30).sort((a, b) => a - b);
      return { objects: scene.children.length, cameras: scene.cameras.cameras.length, restoreListeners: game.renderer.listenerCount('restorewebgl'), medianRenderMs: sorted[Math.floor(sorted.length * .5)], p95RenderMs: sorted[Math.floor(sorted.length * .95)] };
    });
    // UI interaction and renderer changes must not mutate saved gameplay state.
    const afterUi = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
    for (const key of ['units', 'cities', 'turn', 'humanNationId']) {
      assert.ok(Object.hasOwn(snapshot, key), `save fixture has ${key}`);
      assert.deepEqual(afterUi[key], snapshot[key], `UI preserves ${key}`);
    }
    await page.evaluate(savedState => {
      window.migrationHud = null;
      window.migrationGame.scene.getScene('GameScene').scene.start('GameScene', {
        mapKey: savedState.mapKey, humanNationId: savedState.humanNationId,
        activeNationIds: savedState.activeNationIds, resourceAbundance: 'normal',
        gameSpeedId: savedState.gameSpeedId, savedState,
      });
    }, afterUi);
    await page.waitForFunction(() => window.migrationHud, undefined, { timeout: 90000 });
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => window.migrationGame.scene.getScene('GameScene').cameras.cameras.length), metrics.cameras, 'scene restart does not leak cameras');
    assert.equal(await page.evaluate(() => window.migrationGame.renderer.listenerCount('restorewebgl')), metrics.restoreListeners, 'scene restart does not leak texture restoration listeners');
    const reloaded = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
    for (const key of ['units', 'cities', 'turn', 'humanNationId']) assert.deepEqual(reloaded[key], afterUi[key], `reload preserves ${key}`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ version: expected, mode, ...metrics }));
    await page.close();
  }
} finally { await browser.close(); }
