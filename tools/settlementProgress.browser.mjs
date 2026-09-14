import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { CityView } from './src/ui/CityView';
  import { City } from './src/entities/City';
  import { CityBuildings } from './src/entities/CityBuildings';
  import { getSettlementProgress } from './src/systems/SettlementProgress';
  const city = new City({ id:'test', name:'Malmö', ownerId:'human', tileX:4, tileY:4 });
  const buildings = new CityBuildings(city.id);
  buildings.addEntry('forge', false);
  const view = new CityView();
  view.setSettlementProgressProvider(() => getSettlementProgress(city, buildings, () => false));
  window.showCity = () => view.show(city, [], [], { active:false }, { visible:false, enabled:false, buttonLabel:'' }, [], [], [], []);
  window.block = () => { city.urbanDevelopment = { requirements:Array(6).fill(null), waterMask:15 }; window.showCity(); };
  window.showCity();
` }, bundle:true, write:false, format:'iife' });
const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args:['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('http://epoch.test/assets/**', async route => {
    try { await route.fulfill({ body:readFileSync('public/' + new URL(route.request().url()).pathname.slice(1)), contentType:'image/png' }); }
    catch { await route.abort(); }
  });
  const styles = readFileSync('index.html', 'utf8').match(/<style[^>]*>([\s\S]*?)<\/style>/g).join('\n');
  await page.setContent(`<base href="http://epoch.test/">${styles}<div id="app-layout"></div>`);
  await page.addScriptTag({ content:bundle.outputFiles[0].text });
  await page.getByRole('button', { name:'Progress to next level' }).click();
  assert.match(await page.locator('.settlement-progress').innerText(), /1 \/ 6 buildings complete/);
  assert.equal(await page.locator('.development-tile.complete').count(), 1);
  assert.equal(await page.locator('.empty-space').count(), 5);
  assert.equal(await page.locator('.requirements li').count(), 0);
  assert.equal(await page.locator('.settlement-progress progress').count(), 0);
  assert.ok(await page.getByRole('heading', { name:'Research still needed' }).isVisible());
  assert.ok(await page.locator('.city-view-mode-content').evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'Progression should fit without scrolling on a normal desktop');
  await page.setViewportSize({ width:390,height:600 });
  await page.getByRole('heading', { name:'Research still needed' }).scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.city-view-mode-content').evaluate(el => el.scrollTop > 0), 'Small screens retain scrolling');
  await page.setViewportSize({ width:1440,height:900 });
  await page.screenshot({ path:'/tmp/settlement-progress.png' });
  await page.getByRole('button', { name:'📋 Queue', exact:true }).click();
  assert.equal(await page.locator('.settlement-progress').count(), 0);
  await page.getByRole('button', { name:'Progress to next level' }).click();
  await page.evaluate(() => window.block());
  assert.match(await page.locator('.development-warning').innerText(), /cannot develop into a City/);
  assert.equal(await page.locator('.requirements').count(), 0);
  await page.setViewportSize({ width:390,height:844 });
  assert.ok(await page.getByRole('button', { name:'Progress to next level' }).isVisible());
  assert.deepEqual(errors, []);
  console.log('Settlement progress browser checks passed.');
} finally { await browser.close(); }
