import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import { createCanvas, loadImage } from 'canvas';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-phaser-migration';
await fs.mkdir(output, { recursive: true });
const browserName = process.env.EPOCH_BROWSER ?? 'chromium';
const browserType = { chromium, firefox, webkit }[browserName];
assert.ok(browserType, `Unknown browser ${browserName}`);
const browser = await browserType.launch(browserName === 'chromium' ? {
  headless: true,
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
} : { headless: true });

async function pixels(page) {
  // Screenshot readback includes the actual composited canvas, not just draw calls.
  const image = await loadImage(await page.locator('canvas').screenshot());
  const context = createCanvas(image.width, image.height).getContext('2d');
  context.drawImage(image, 0, 0);
  return (x, y) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
}

try {
  for (const mode of process.env.EPOCH_RENDERER ? [process.env.EPOCH_RENDERER] : ['webgl', 'canvas']) {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/tools/phaser4-migration.html${mode === 'canvas' ? '?canvas' : ''}`);
    await page.waitForFunction(() => window.migrationChecks);
    assert.equal(await page.evaluate(() => window.migrationChecks.version), '4.2.1');
    await page.waitForTimeout(100);
    let pixel = await pixels(page);
    assert.deepEqual(pixel(50, 50), [255, 0, 0], `${mode}: world clip interior`);
    assert.deepEqual(pixel(20, 20), [0, 0, 0], `${mode}: world clip exterior`);
    assert.deepEqual(pixel(150, 50), [0, 255, 0], `${mode}: stencil does not leak onto sibling`);
    assert.ok(pixel(250, 50)[2] >= 126 && pixel(250, 50)[2] <= 128, `${mode}: container alpha`);
    assert.deepEqual(pixel(220, 20), [0, 0, 0], `${mode}: container child clipping`);
    assert.deepEqual(pixel(325, 35), [255, 255, 0], `${mode}: UI camera interior`);
    assert.deepEqual(pixel(305, 35), [0, 0, 0], `${mode}: UI camera exterior`);
    assert.deepEqual(pixel(325, 65), [255, 0, 255], `${mode}: shared clip second object`);
    assert.deepEqual(pixel(350, 120), [0, 255, 255], `${mode}: subsequent UI sibling`);
    assert.deepEqual(pixel(20, 215), [255, 136, 0], `${mode}: baked terrain survives source destruction`);
    assert.deepEqual(pixel(80, 215), [0, 255, 0], `${mode}: final chunk contents`);
    assert.deepEqual(await page.evaluate(() => window.migrationChecks.chunks), [
      { width: 4096, height: 11 }, { width: 2, height: 11 },
    ]);

    if (mode === 'webgl') {
      const supported = await page.evaluate(() => {
        const scene = window.migrationChecks.scene;
        const extension = scene.renderer.gl.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        window.contextRestored = false;
        scene.renderer.once('restorewebgl', () => { window.contextRestored = true; });
        extension.loseContext();
        setTimeout(() => extension.restoreContext(), 100);
        return true;
      });
      assert.ok(supported, 'Test runtime must support context-loss testing');
      await page.waitForFunction(() => window.contextRestored);
      await page.waitForTimeout(100);
      pixel = await pixels(page);
      assert.deepEqual(pixel(20, 215), [255, 136, 0], 'rebaked terrain after context restoration');
      assert.deepEqual(pixel(80, 215), [0, 255, 0], 'relocated final chunk after restoration');
      assert.deepEqual(pixel(50, 50), [255, 0, 0], 'clipping after context restoration');
      if (process.env.EPOCH_BENCHMARK) {
        for (const strategy of ['stencil', 'filter']) {
          console.log(await page.evaluate(value => window.migrationChecks.benchmark(value), strategy));
        }
      }
    }

    await page.evaluate(() => window.migrationChecks.moveMask());
    await page.waitForTimeout(50);
    pixel = await pixels(page);
    assert.deepEqual(pixel(50, 50), [0, 0, 0], `${mode}: moved clip excludes old center`);
    assert.deepEqual(pixel(80, 50), [255, 0, 0], `${mode}: moved clip includes new center`);
    await page.evaluate(() => window.migrationChecks.clear());
    await page.waitForTimeout(50);
    pixel = await pixels(page);
    assert.deepEqual(pixel(20, 20), [255, 0, 0], `${mode}: clearing restores full object`);
    await page.evaluate(() => { window.migrationChecks.reattach(); window.migrationChecks.destroySource(); window.migrationChecks.destroyShared(); });
    await page.waitForTimeout(50);
    pixel = await pixels(page);
    assert.deepEqual(pixel(20, 20), [255, 0, 0], `${mode}: source destruction detaches clip`);
    assert.deepEqual(pixel(325, 65), [255, 0, 255], `${mode}: destroying one shared target preserves the other`);
    assert.equal(await page.evaluate(() => window.migrationChecks.lifecycle()), true, `${mode}: repeated clipping leaves no scene objects`);
    assert.equal(await page.evaluate(() => window.migrationChecks.destroyTerrain()), true, `${mode}: restoration listeners cleaned up`);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/clipping-${mode}.png` });
    await page.close();
    console.log(`PASS ${mode}: clipping, cameras, alpha, lifecycle, chunk baking${mode === 'webgl' ? ', context restoration' : ''}`);
  }
} finally {
  await browser.close();
}
