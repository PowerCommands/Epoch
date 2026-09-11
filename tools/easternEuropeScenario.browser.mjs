import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5176';
const artifacts=process.env.EPOCH_ARTIFACTS??'/tmp/epoch-eastern-europe-validation';
fs.mkdirSync(artifacts,{recursive:true});
const data=JSON.parse(fs.readFileSync('public/assets/maps/eastern-europe.json','utf8'));
const expected=['Boris Johnson','Charles de Gaulle','Angela Merkel','Donald Tusk','Olof Palme','Alexander Stubb','Vladimir Putin','Volodymyr Zelenskyy','Mette Frederiksen'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(`${base}/editor.html?map=map_eastern_europe`);
 await page.waitForFunction(()=>currentMap?.key==='map_eastern_europe');
 await page.locator('#landing-edit-btn').click();await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='Eastern Europe');
 const out=await page.evaluate(()=>buildScenarioOutput());
 for(const field of ['map','units','cities','historicalEvents','initialDiplomacy','nationDetails'])assert.deepEqual(out[field],data[field],`editor ${field}`);
 for(const n of data.nations){const edited=out.nations.find(e=>e.id===n.id);for(const [field,value] of Object.entries(n))assert.deepEqual(edited[field],value,`${n.id} ${field}`);}
 assert.equal(await page.locator('#nation-list .nation-row').count(),9);
 assert.deepEqual(await page.evaluate(()=>validateScenario()),[]);
 // Make an actual terrain edit and a city-territory edit, export, then restore.
 const edits=await page.evaluate(()=>{
  const old=tiles[0][0];tiles[0][0]='meadow';
  const city=scenario.cities[0],last=city.ownedTileCoords.pop();
  const changed=structuredClone(buildScenarioOutput());
  tiles[0][0]=old;city.ownedTileCoords.push(last);
  return {changed,restored:buildScenarioOutput()};
 });
 assert.equal(edits.changed.map.tiles[0].type,'meadow');
 assert.equal(edits.changed.cities[0].ownedTileCoords.length,data.cities[0].ownedTileCoords.length-1);
 assert.deepEqual(edits.restored,out);
 fs.writeFileSync(`${artifacts}/editor-export.json`,JSON.stringify(out,null,2)+'\n');
 await page.screenshot({path:`${artifacts}/editor.png`});
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 assert.equal(await page.locator('#mm-map-select option[value="map_eastern_europe"]').count(),1);
 await page.locator('#mm-map-select').selectOption('map_eastern_europe');
 assert.equal(await page.locator('.mm-nation-card').count(),9);
 assert.deepEqual(await page.locator('.mm-card-leader').allTextContents(),expected);
 await page.locator('.mm-nation-card[data-nation-id="nation_england"]').click();
 await page.screenshot({path:`${artifacts}/setup.png`});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.mapKey,'map_eastern_europe');assert.equal(state.activeNationIds.length,9);
 assert.equal(state.tiles.length,11900);assert.equal(state.cities.length,9);
 assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,9);
 assert.equal(state.units.filter(u=>u.unitTypeId==='scout').length,9);
 assert.equal(state.units.length,18);
 for(const nation of data.nations){
  if(nation.leaderId)assert.equal(state.leaderSelections[nation.id],nation.leaderId);
  const u=state.units.find(u=>u.ownerId===nation.id&&u.unitTypeId==='settler');
  assert.deepEqual([u.tileX,u.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 const liveTiles=new Map(state.tiles.map(t=>[`${t.q},${t.r}`,t]));
 for(const c of data.cities){const live=state.cities.find(l=>l.name===c.name);assert.ok(live,c.name);assert.equal(live.ownerId,c.nationId);for(const p of c.ownedTileCoords)assert.equal(liveTiles.get(`${p.q},${p.r}`).ownerId,c.nationId);}
 const expectedOwners=new Map(data.cities.flatMap(c=>c.ownedTileCoords.map(p=>[`${p.q},${p.r}`,c.nationId])));
 for(const t of state.tiles)if(!['ocean','coast'].includes(data.map.tiles[t.r*170+t.q].type))assert.equal(t.ownerId,expectedOwners.get(`${t.q},${t.r}`),`live land border ${t.q},${t.r}`);
 const leaders=await page.evaluate(async()=>{const {getLeaderByNationId}=await import('/src/data/leaders.ts');return ['england','france','germany','poland','sweden','finland','russia','ukraine','denmark'].map(id=>getLeaderByNationId('nation_'+id)?.name);});
 assert.deepEqual(leaders,expected);
 assert.deepEqual(state.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]),data.map.tiles.filter(t=>t.riverConnections).map(t=>[t.q,t.r,t.riverConnections]));
 await page.screenshot({path:`${artifacts}/game.png`});
 const rounds=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(2));assert.ok(rounds.completedRounds>=2);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${artifacts}/validation.json`,JSON.stringify({size:[170,70],leaders,settlers:9,defaultScouts:9,capitals:9,rounds,errors},null,2)+'\n');
 console.log('Eastern Europe: editor edits/export, Game Setup, all leaders, capital Settlers, default Scouts, borders, rivers and two live rounds passed.',artifacts);
} finally {await browser.close();}
