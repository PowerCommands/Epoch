import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const artifacts=process.env.EPOCH_ARTIFACTS??'/tmp/epoch-world-validation';
fs.mkdirSync(artifacts,{recursive:true});
const data=JSON.parse(fs.readFileSync(new URL('../public/assets/maps/world.json',import.meta.url),'utf8'));
const names=['Donald J. Trump','Jair Bolsonaro','Boris Johnson','Angela Merkel','Bola Tinubu','Nelson Mandela','Mao Zedong','Narendra Modi','Oda Nobunaga','John Howard'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1400}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('epoch.tutorialDontShowAgain','true'));
// Expose existing runtime controls only in this validation browser.
await page.route('**/src/main.ts*',async route=>{
 const response=await route.fetch();
 await route.fulfill({response,body:`${await response.text()}\nwindow.worldTestGame = game;`});
});
await page.route('**/src/ui/CheatConsole.ts*',async route=>{
 const response=await route.fetch();
 await route.fulfill({response,body:(await response.text()).replace('this.cheatSystem = cheatSystem;', 'this.cheatSystem = cheatSystem; window.worldTestCheats = cheatSystem;')});
});
try{
 await page.goto(`${base}/editor.html?map=map_world`);
 await page.waitForFunction(()=>currentMap?.key==='map_world');
 await page.locator('#landing-edit-btn').click();
 await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='World');
 const out=await page.evaluate(()=>buildScenarioOutput());
 for(const key of ['map','cities','units','worldMarkers','nationDetails','initialDiplomacy','historicalEvents','turningPointEventsConfigured'])assert.deepEqual(out[key],data[key],`editor roundtrip: ${key}`);
 // The editor makes omitted default metadata explicit and may omit default leader IDs.
 assert.equal(out.meta.startYear,4000);assert.equal(out.meta.startYearIsBC,true);assert.equal(out.meta.timeProgression.mode,'auto');
 assert.equal(out.nations.length,10);
 const editorLeaders=await page.evaluate(()=>scenario.nations.map(n=>getRegistryLeader(n,n.leaderId)?.leaderId));
 assert.deepEqual(editorLeaders,data.nations.map(n=>n.leaderId));
 await page.screenshot({path:path.join(artifacts,'editor-world.png')});
 // Closer view of the most constrained island starts and their straits.
 for(const [name,q,r]of [['europe',85,26],['east-asia',123,32]]){
  await page.evaluate(({q,r})=>{zoom=.8;const p=tileToWorld(q,r);camX=p.x-viewport.clientWidth/(2*zoom);camY=p.y-viewport.clientHeight/(2*zoom);render();},{q,r});
  await page.screenshot({path:path.join(artifacts,`editor-${name}.png`)});
 }
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 assert.equal(await page.locator('#mm-map-select').inputValue(),'map_world','default selection');
 assert.equal(await page.locator('#mm-map-select optgroup[label="Scenarios"] option').first().getAttribute('value'),'map_world');
 assert.equal(await page.locator('.mm-nation-card').count(),10);
 assert.deepEqual(await page.locator('.mm-card-leader').allTextContents(),names);
 assert.equal(await page.locator('#mm-resource-abundance-select').inputValue(),'scenario');
 await page.locator('.mm-nation-card[data-nation-id="nation_usa"]').click();
 await page.screenshot({path:path.join(artifacts,'game-setup.png')});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,10);assert.equal(state.cities.length,0);
 // GameScene normally adds one Scout per nation, independently of authored units.
 assert.equal(state.units.filter(u=>u.unitTypeId==='scout').length,10);
 for(const nation of data.nations){
  const u=state.units.find(u=>u.ownerId===nation.id&&u.unitTypeId==='settler');assert.ok(u,nation.name);
  assert.deepEqual([u.tileX,u.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 // Read the game's own registry snapshot; importing a fresh Vite module can
 // create a second registry when the running dev server has HMR timestamps.
 const liveLeaders=data.nations.map(n=>state.leaderSelections[n.id]);
 assert.deepEqual(liveLeaders,data.nations.map(n=>n.leaderId));
 const authoredResources=data.map.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]);
 const authoredRivers=data.map.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]);
 assert.deepEqual(state.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]),authoredResources);
 assert.deepEqual(state.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]),authoredRivers);
 assert.equal(state.mapKey,'map_world');assert.equal(state.activeNationIds.length,10);
 await page.screenshot({path:path.join(artifacts,'game-start.png')});
 const rounds=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(2));
 assert.ok(rounds.completedRounds>=2);
 const progressed=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 for(const nation of data.nations){
  const city=progressed.cities.find(c=>c.ownerId===nation.id);assert.ok(city,`${nation.name} founded a city`);
  // Normal AI may relocate a Settler (notably the close European starts).
  const dq=city.tileX-nation.startTerritoryCenter.q,dr=city.tileY-nation.startTerritoryCenter.r;
  assert.ok(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))<=8,`${nation.name}: first city remains near its start`);
 }
 // Inspect the actual Globe zoom and both compact polar caps with fog removed.
 await page.evaluate(()=>window.worldTestCheats.execute('fog off'));
 for(const [name,latitude]of [['equator',0],['north',-1.3],['south',1.3]]){
  const view=await page.evaluate(latitude=>{
   const scene=window.worldTestGame.scene.getScene('GameScene');
   const control=scene.cameraController;
   control.setZoom(control.planetary.range.min);
   control.enterGlobeNavigation();
   control.planetary.navigation.longitude=0;
   control.planetary.navigation.latitude=latitude;
   control.syncGlobeCamera();control.planetary.update();
   return {active:control.isGlobeNavigationActive,strength:control.planetary.view.strength};
  },latitude);
  assert.ok(view.active&&view.strength>.99);
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(artifacts,`globe-${name}.png`)});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify({map:data.meta.name,size:[150,100],leaders:liveLeaders,initialSettlers:10,resources:authoredResources.length,riverTiles:authoredRivers.length,completedRounds:rounds.completedRounds,cities:progressed.cities.map(c=>({name:c.name,nation:c.ownerId,q:c.tileX,r:c.tileY})),errors},null,2)+'\n');
 console.log('World: editor roundtrip, first/default selection, ten leaders/Settlers, live resources/rivers two rounds and Globe views passed. Artifacts:',artifacts);
}finally{await browser.close();}
