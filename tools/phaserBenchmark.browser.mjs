import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// CPU render-submission timing, not GPU frame time. Compare identical saves and
// viewports sequentially; keep other browser tests closed during measurement.
const current = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const baseline = process.env.EPOCH_BASELINE_URL;
const urls = baseline ? [baseline, current, current, baseline] : [current, current];
const save = JSON.parse(await fs.readFile(process.env.EPOCH_SAVE ?? 'autorun-output/latest-save.json', 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.benchGame = game; window.benchVersion = Phaser.VERSION;` });
    });
    await page.goto(`${url}/?epochDiagnostics=1`);
    await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
    assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save)).ok, true);
    await page.waitForFunction(() => window.__epochDiagnostics?.getSaveState, undefined, { timeout: 90000 });
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => new Promise((resolve, reject) => {
      const game = window.benchGame;
      const samples = [];
      let start = 0;
      const cleanup = () => { game.events.off('prerender', before); game.events.off('postrender', after); clearTimeout(timeout); };
      const before = () => { start = performance.now(); };
      const after = () => {
        samples.push(performance.now() - start);
        if (samples.length !== 60) return;
        cleanup();
        const sorted = samples.slice(10).sort((a, b) => a - b);
        const gl = game.renderer.gl;
        const extension = gl?.getExtension('WEBGL_debug_renderer_info');
        const scene = game.scene.getScene('GameScene');
        resolve({
          version: window.benchVersion, renderer: game.renderer.type,
          objects: scene.children.length, zoom: scene.cameras.main.zoom,
          samples: sorted.length, medianRenderMs: sorted[25], p95RenderMs: sorted[47],
          gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
        });
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Timed out collecting render samples')); }, 90000);
      game.events.on('prerender', before); game.events.on('postrender', after);
    }));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ url, ...result }));
    await page.close();
  }
} finally { await browser.close(); }
