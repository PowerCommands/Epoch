import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5175';
const artifacts=process.env.EPOCH_ARTIFACTS??'/tmp/epoch-scandinavia-validation';
fs.mkdirSync(artifacts,{recursive:true});
const data=JSON.parse(fs.readFileSync('public/assets/maps/scandinavia.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1500}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/editor.html?map=map_scandinavia`);
 await page.waitForFunction(()=>currentMap?.key==='map_scandinavia');
 await page.locator('#landing-edit-btn').click();await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='Scandinavia');
 const out=await page.evaluate(()=>buildScenarioOutput());
 assert.deepEqual(out.map,data.map);assert.deepEqual(out.units,data.units);
 assert.equal(await page.locator('#nation-list .nation-row').count(),6);
 await page.screenshot({path:`${artifacts}/editor.png`});
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 const options=await page.locator('#mm-map-select option').evaluateAll(options=>options.map(o=>({value:o.value,text:o.textContent})));
 const authored=options.filter(o=>o.value.startsWith('map_'));
 assert.equal(authored[3].value,'map_scandinavia');assert.equal(authored.filter(o=>o.text==='Scandinavia').length,1);
 await page.locator('#mm-map-select').selectOption('map_scandinavia');
 assert.equal(await page.locator('.mm-nation-card').count(),6);
 assert.deepEqual(await page.locator('.mm-card-leader').allTextContents(),['Gustav Vasa','Christian IV','Alexander Stubb','Marfa Boretskaya','Vytautas the Great','Donald Tusk']);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.mm-card-portrait img')).every(img=>img.complete&&img.naturalWidth>0));
 await page.locator('.mm-nation-card[data-nation-id="nation_sweden"]').click();
 await page.screenshot({path:`${artifacts}/setup.png`});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,6);
 for(const n of data.nations){
  const units=state.units.filter(u=>u.ownerId===n.id&&u.unitTypeId==='settler');assert.equal(units.length,1);
  assert.deepEqual([units[0].tileX,units[0].tileY],[n.startTerritoryCenter.q,n.startTerritoryCenter.r]);
 }
 assert.equal(state.cities.length,0);assert.equal(state.units.filter(u=>u.unitTypeId==='scout').length,6);
 assert.equal(state.units.length,12);assert.equal(state.tiles.length,11250);
 assert.equal(state.mapKey,'map_scandinavia');assert.equal(state.activeNationIds.length,6);
 const liveLeaders=await page.evaluate(async()=>{const {getLeaderByNationId}=await import('/src/data/leaders.ts');return ['sweden','denmark','finland','novgorod','lithuania','poland'].map(id=>getLeaderByNationId('nation_'+id)?.name);});
 assert.deepEqual(liveLeaders,['Gustav Vasa','Christian IV','Alexander Stubb','Marfa Boretskaya','Vytautas the Great','Donald Tusk']);
 assert.deepEqual(state.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]),data.map.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]));
 await page.screenshot({path:`${artifacts}/game.png`});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${artifacts}/validation.json`,JSON.stringify({size:[150,75],leaders:liveLeaders,settlers:6,defaultScouts:6,errors},null,2)+'\n');
 console.log('Scandinavia: editor, fourth setup position, six leaders, six Settlers and six default Scouts verified.',artifacts);
}finally{await browser.close();}
