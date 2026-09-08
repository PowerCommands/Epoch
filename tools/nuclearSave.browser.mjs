/** Canada save regression: start Vite, then run
 * node tools/nuclearSave.browser.mjs <save.json> <url> [custom-scenario.json]
 * The optional scenario supplies the save's missing browser-local custom map.
 * The source save is never changed. Uses real Phaser selection, action mode and pointer input.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const [savePath, url = 'http://127.0.0.1:5173', scenarioPath] = process.argv.slice(2);
assert.ok(savePath, 'Provide the Canada nuclear save path');
const save = JSON.parse(await fs.readFile(savePath, 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.EPOCH_BROWSER_PATH || '/usr/bin/google-chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (scenarioPath) {
    const scenario = JSON.parse(await fs.readFile(scenarioPath, 'utf8'));
    await page.addInitScript(({ scenario, id }) => {
      localStorage.setItem('epoch.customScenarios', JSON.stringify({ version: 1, entries: [{
        metadata: { id, name: 'Save regression map', createdAt: 1, updatedAt: 1 }, scenario,
      }] }));
    }, { scenario, id: save.mapKey });
  }
  await page.goto(`${url}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  const loaded = await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save);
  assert.equal(loaded.ok, true, loaded.error);
  await page.waitForFunction(() => window.__epochDiagnostics?.getSaveState, undefined, { timeout: 90000 });
  const missile = save.units.find(u => u.ownerId === 'nation_canada' && u.unitTypeId === 'nuclear_missile');
  const target = save.cities.find(c => c.ownerId === 'nation_usa' && c.name === 'Washington');
  assert.ok(missile && target);
  const preview = await page.evaluate(({ id, x, y }) => window.__epochDiagnostics.prepareStrategicStrike(id, x, y),
    { id: missile.id, x: target.tileX, y: target.tileY });
  assert.equal(preview.reason, undefined);
  assert.equal(preview.visible, false, 'Regression target must be outside tactical visibility');
  assert.equal(preview.actions.find(a => a.mode === 'ranged')?.isActive, true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // prepareStrategicStrike centres this inland coordinate; click through the actual world input path.
  await page.mouse.click(720, 500);
  await page.waitForFunction(id => !window.__epochDiagnostics.getSaveState().units.some(u => u.id === id), missile.id);
  const after = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(after.cities.find(c => c.id === target.id).health, 1);
  const waste = after.tiles.filter(t => t.terrainType === 'nuclear_waste');
  assert.ok(waste.length > 0);
  assert.ok(waste.every(t => t.originalTerrain));
  assert.deepEqual(errors, []);
  console.log(`PASS: Canada launched from Ottawa into fog at Washington; missile consumed; ${waste.length} contaminated tiles.`);
} finally {
  await browser.close();
}
