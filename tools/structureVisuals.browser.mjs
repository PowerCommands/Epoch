import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.EPOCH_URL ?? 'http://127.0.0.1:5174'}/tools/structure-visuals.html`);
  await page.waitForFunction(() => window.visualChecks || document.body.dataset.error, { timeout: 120000 });
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.body.dataset.error), undefined);
  const result = await page.evaluate(() => ({ checks: window.visualChecks, metrics: window.visualMetrics }));
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: '/tmp/epoch-structure-states.png' });
} finally { await browser.close(); }
