import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { getBuildingById } from './src/data/buildings';
  import { CityView } from './src/ui/CityView';
  import { City } from './src/entities/City';
  import { CityBuildings } from './src/entities/CityBuildings';
  import { getSettlementProgress } from './src/systems/SettlementProgress';
  const city = new City({ id:'test', name:'Malmö', ownerId:'human', tileX:4, tileY:4 });
  const buildings = new CityBuildings(city.id);
  buildings.addEntry('forge', false);
  const view = new CityView();
  view.setSettlementStageProvider(() => city.settlementStage);
  view.setSettlementProgressProvider(() => getSettlementProgress(city, buildings, () => false));
  const options=['forge','aqueduct','monument','water_mill','market','sewers','dock','lighthouse','harbor','seaport','railway_station','university','bank','factory','hospital','opera_house','granary'].map(id=> { const b=getBuildingById(id);return {id,name:b.name,cost:b.productionCost,placement:b.placement,disabled:id==='bank',reason:id==='bank'?'Requires Banking':undefined}; });
  window.showCity = () => view.show(city, [], options, { active:false }, { visible:false, enabled:false, buttonLabel:'' }, [], [], [], []);
  window.coastal = () => { city.settlementStage='Village';city.urbanDevelopment={requirements:['dock','lighthouse','harbor','water_mill','market','sewers'],waterMask:7};for(const id of buildings.getAll())buildings.remove(id);window.showCity(); };
  window.finished = () => { city.settlementStage='City';window.showCity(); };
  window.port = () => { buildings.remove('railway_station'); buildings.addEntry('seaport',false); window.showCity(); };
  window.town = () => { city.settlementStage='Town'; buildings.addEntry('railway_station',false); buildings.addEntry('university',false); window.showCity(); };
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
  assert.match(await page.locator('.development-warning').innerText(), /cannot develop into a Town/);
  assert.equal(await page.locator('.requirements').count(), 0);
  await page.setViewportSize({ width:390,height:844 });
  assert.ok(await page.getByRole('button', { name:'Progress to next level' }).isVisible());
  await page.evaluate(() => window.town());
  assert.equal(await page.locator('.development-requirements > div').count(),6);
  assert.equal(await page.locator('.development-map').count(),0);
  const requirements=await page.locator('.development-requirements').innerText();
  assert.equal((requirements.match(/■/g)??[]).length,2);
  assert.equal((requirements.match(/□/g)??[]).length,4);
  assert.match(requirements,/Railway Station OR Seaport/);
  await page.evaluate(() => window.port());
  assert.equal(await page.locator('.development-requirements > div').count(),6);
  assert.match(await page.locator('.development-requirements > div').first().innerText(),/^■ Railway Station OR Seaport$/);assert.match(requirements,/Opera House/);
  await page.screenshot({path:'/tmp/epoch-town-progress.png'});
  await page.getByRole('button',{name:'⚙️ Production',exact:true}).click();
  await page.getByRole('button',{name:/Buildings$/}).click();
  const card=name=>page.locator('.city-view-production-button').filter({has:page.locator('strong',{hasText:new RegExp('^'+name+'$')})});
  assert.equal(await page.locator('.city-view-development-caption').count(),4);
  assert.equal(await card('Bank').locator('.city-view-development-caption').innerText(),'City building');
  assert.equal(await card('Bank').getAttribute('aria-disabled'),'true');
  assert.equal(await card('Railway Station').locator('.city-view-development-caption').count(),0,'completed Seaport satisfies transport');
  assert.equal(await card('Granary').locator('.city-view-development-caption').count(),0);
  await page.evaluate(()=>window.coastal());
  for(const name of ['Dock','Lighthouse','Harbor','Seaport','Water Mill','Market','Sewers']) {
    assert.equal(await card(name).locator('.city-view-development-caption').innerText(),'Town building');
  }
  for(const name of ['Forge','Aqueduct','Monument','Granary'])assert.equal(await card(name).locator('.city-view-development-caption').count(),0);
  const colors=await Promise.all([card('Dock'),card('Granary')].map(c=>c.evaluate(el=>getComputedStyle(el).backgroundColor)));
  assert.notEqual(colors[0],colors[1]);
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'/tmp/epoch-city-view-building-guidance.png'});
  await page.evaluate(()=>window.finished());
  assert.equal(await page.locator('.city-view-development-caption').count(),0);
  assert.deepEqual(errors, []);
  console.log('Settlement progress browser checks passed.');
} finally { await browser.close(); }
