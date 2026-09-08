import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const artifacts=process.env.EPOCH_ARTIFACTS ?? '/tmp/epoch-america-validation';
fs.mkdirSync(artifacts,{recursive:true});
const data=JSON.parse(fs.readFileSync(new URL('../public/assets/maps/america.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1500}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/editor.html?map=map_america`);
 await page.waitForFunction(()=>currentMap?.key==='map_america');
 await page.locator('#landing-edit-btn').click();
 await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='America');
 const out=await page.evaluate(()=>buildScenarioOutput());
 assert.deepEqual(out,data);
 await page.screenshot({path:path.join(artifacts,'editor-full.png')});
 // Inspect contiguous north/middle/south sections at a closer editor zoom.
 for(const [name,x,y]of [['north',51,27],['central',58,60],['south',94,110]]){
  await page.evaluate(({x,y})=>{zoom=.65;const p=tileToWorld(Math.round(x-y/2),y);camX=p.x-viewport.clientWidth/(2*zoom);camY=p.y-viewport.clientHeight/(2*zoom);render();},{x,y});
  await page.screenshot({path:path.join(artifacts,`editor-${name}.png`)});
 }
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 await page.locator('#mm-map-select').selectOption('map_america');
 assert.equal(await page.locator('.mm-nation-card').count(),5);
 console.log('leaders',await page.locator('.mm-card-leader').allTextContents());
 assert.deepEqual(await page.locator('.mm-card-leader').allTextContents(),['Justin Trudeau','Donald J. Trump','Claudia Sheinbaum Pardo','Jair Bolsonaro','Javier Milei']);
 assert.equal(await page.locator('#mm-resource-abundance-select').inputValue(),'scenario');
 await page.locator('.mm-nation-card[data-nation-id="nation_canada"]').click();
 await page.screenshot({path:path.join(artifacts,'game-setup.png')});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 await page.waitForTimeout(1500);
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,5);
 for(const nation of data.nations){
  const u=state.units.find(u=>u.ownerId===nation.id&&u.unitTypeId==='settler');
  assert.deepEqual([u.tileX,u.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 const liveLeaders=await page.evaluate(async()=>{
  const {getLeaderByNationId}=await import('/src/data/leaders.ts');
  return ['canada','usa','mexico','brazil','argentina'].map(id=>getLeaderByNationId('nation_'+id)?.id);
 });
 assert.deepEqual(liveLeaders,['leader_justin_trudeau','leader_donald_j_trump','leader_claudia_sheinbaum_pardo','leader_jair_bolsonaro','leader_javier_milei']);
 const authoredResources=data.map.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]);
 const authoredRivers=data.map.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]);
 assert.deepEqual(state.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]),authoredResources);
 assert.deepEqual(state.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]),authoredRivers);
 await page.screenshot({path:path.join(artifacts,'game-start.png')});
 assert.equal(state.mapKey,'map_america');
 assert.equal(state.activeNationIds.length,5);
 // Existing diagnostics advances the already-started game through normal AI turns.
 const rounds=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(2));
 assert.ok(rounds.completedRounds>=2);
 const progressed=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 for(const nation of data.nations){
  const city=progressed.cities.find(c=>c.ownerId===nation.id);
  assert.ok(city,`${nation.name} founded its first city`);
  assert.deepEqual([city.tileX,city.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify({
  map:data.meta.name,size:[data.map.width,data.map.height],leaders:liveLeaders,
  initialSettlers:5,resources:authoredResources.length,riverTiles:authoredRivers.length,
  completedRounds:rounds.completedRounds,cities:progressed.cities.map(c=>({name:c.name,nation:c.ownerId,q:c.tileX,r:c.tileY})),errors
 },null,2)+'\n');
 assert.deepEqual(errors,[]);
 console.log('America: editor roundtrip, five leaders/Settlers, live resources/rivers, normal Game Setup and two rounds passed. Artifacts:',artifacts);
}finally{await browser.close();}
