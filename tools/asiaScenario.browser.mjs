import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const artifacts=process.env.EPOCH_ARTIFACTS ?? '/tmp/epoch-asia-validation';
fs.mkdirSync(artifacts,{recursive:true});
const data=JSON.parse(fs.readFileSync(new URL('../public/assets/maps/asia.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1500}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/editor.html?map=map_asia`);
 await page.waitForFunction(()=>currentMap?.key==='map_asia');
 await page.locator('#landing-edit-btn').click();
 await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='Asia');
 const out=await page.evaluate(()=>buildScenarioOutput());
 assert.deepEqual(out,data);
 assert.equal(await page.locator('#nation-list .nation-row').count(),9);
 assert.equal(await page.locator('#nation-list img[alt$=" flag"]').count(),3);
 assert.ok(await page.locator('#nation-list img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)));
 await page.screenshot({path:path.join(artifacts,'editor-full.png')});
 for(const [name,q,r]of [['korea',94,38],['thailand',56,64]]){
  await page.evaluate(({q,r})=>{zoom=1.3;const p=tileToWorld(q,r);camX=p.x-viewport.clientWidth/(2*zoom);camY=p.y-viewport.clientHeight/(2*zoom);render();},{q,r});
  await page.screenshot({path:path.join(artifacts,`editor-${name}.png`)});
 }

 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 await page.locator('#mm-map-select').selectOption('map_asia');
 assert.equal(await page.locator('.mm-nation-card').count(),9);
 console.log('leaders',await page.locator('.mm-card-leader').allTextContents());
 assert.deepEqual(await page.locator('.mm-card-leader').allTextContents(),['Qin Shi Huang','Gandhi','Oda Nobunaga','Genghis Khan','Koxinga','Ivan IV','Anutin Charnvirakul','Lee Jae Myung','Kim Jong Un']);
 assert.equal(await page.locator('.mm-nation-flag').count(),3);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.mm-nation-flag,.mm-card-portrait img')).every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('#mm-resource-abundance-select').inputValue(),'scenario');
 await page.locator('.mm-nation-card[data-nation-id="nation_china"]').click();
 await page.screenshot({path:path.join(artifacts,'game-setup.png')});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 await page.waitForTimeout(1500);
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,9);
 for(const nation of data.nations){
  const u=state.units.find(u=>u.ownerId===nation.id&&u.unitTypeId==='settler');
  assert.deepEqual([u.tileX,u.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 const liveLeaders=await page.evaluate(async()=>{
  const {getLeaderByNationId}=await import('/src/data/leaders.ts');
  return ['china','india','japan','mongolia','taiwan','russia','thailand','south_korea','north_korea'].map(id=>getLeaderByNationId('nation_'+id)?.id);
 });
 assert.deepEqual(liveLeaders,['leader_qin-shi-huang','leader_mahatma-gandhi','leader_oda-nobunaga','leader_genghis-khan','leader_koxinga','ivan-iv','leader_anutin_charnvirakul','leader_lee_jae_myung','leader_kim_jong_un']);
 const authoredResources=data.map.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]);
 const authoredRivers=data.map.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]);
 assert.deepEqual(state.tiles.filter(t=>t.resourceId).map(t=>[t.q,t.r,t.resourceId]),authoredResources);
 assert.deepEqual(state.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]),authoredRivers);
 await page.screenshot({path:path.join(artifacts,'game-start.png')});
 assert.equal(state.cities.length,0);
 assert.ok(state.tiles.every(t=>!t.buildingId&&!t.improvementId));
 // NationManager's canonical startup claims radius one for AI nations only.
 const claimed=state.tiles.filter(t=>t.ownerId);
 assert.equal(claimed.length,56);
 for(const t of claimed){
  const n=data.nations.find(n=>n.id===t.ownerId);
  assert.ok(n&&!n.isHuman);
  const p=n.startTerritoryCenter;
  assert.ok(Math.max(Math.abs(t.q-p.q),Math.abs(t.r-p.r),Math.abs(t.q-p.q+t.r-p.r))<=1);
 }

 assert.equal(state.units.filter(u=>u.unitTypeId==='scout').length,9);
 assert.ok(state.units.every(u=>['settler','scout'].includes(u.unitTypeId)));
 assert.equal(state.mapKey,'map_asia');
 assert.equal(state.activeNationIds.length,9);
 for(const entry of state.diplomacy) assert.equal(entry.state,'PEACE');
 const music=await page.evaluate(async()=>{
  const manifest=await (await fetch('/assets/sounds/manifest.json')).json();
  return ['nation_japan','nation_thailand','nation_south_korea','nation_north_korea'].map(id=>manifest.playlists[id]);
 });
 for(const playlist of music.slice(1))assert.deepEqual(playlist,music[0]);
 // Existing diagnostics advances the already-started game through normal AI turns.
 const rounds=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(2));
 assert.ok(rounds.completedRounds>=2);
 const progressed=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 for(const nation of data.nations){
  const city=progressed.cities.find(c=>c.ownerId===nation.id);
  assert.ok(city,`${nation.name} founded its first city`);
  const capitals={nation_thailand:'Bangkok',nation_south_korea:'Seoul',nation_north_korea:'Pyongyang'};
  if(capitals[nation.id])assert.equal(city.name,capitals[nation.id]);
  assert.deepEqual([city.tileX,city.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify({
  map:data.meta.name,size:[data.map.width,data.map.height],leaders:liveLeaders,
  initialSettlers:9,defaultScouts:9,defaultAiClaimedTiles:claimed.length,resources:authoredResources.length,riverTiles:authoredRivers.length,
  completedRounds:rounds.completedRounds,cities:progressed.cities.map(c=>({name:c.name,nation:c.ownerId,q:c.tileX,r:c.tileY})),errors
 },null,2)+'\n');
 assert.deepEqual(errors,[]);
 console.log('Asia: editor roundtrip, nine leaders/Settlers, live resources/rivers, normal Game Setup and two rounds passed. Artifacts:',artifacts);
}finally{await browser.close();}
