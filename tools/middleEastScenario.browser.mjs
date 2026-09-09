import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const base=process.env.EPOCH_URL ?? 'http://127.0.0.1:5176';
const artifacts=process.env.EPOCH_ARTIFACTS ?? '/tmp/epoch-middle-east-validation';
fs.mkdirSync(artifacts,{recursive:true});
const file=new URL('../public/assets/maps/middle-east.json',import.meta.url);
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1700,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/editor.html?map=map_middle_east`);
 await page.waitForFunction(()=>currentMap?.key==='map_middle_east');
 await page.locator('#landing-edit-btn').click();
 await page.locator('#open-template-confirm').click();
 await page.waitForFunction(()=>typeof scenario!=='undefined'&&scenario?.meta.name==='Middle East');
 const out=await page.evaluate(()=>buildScenarioOutput());
 // Persist editor normalization once while authoring, then require exact round trips.
 if(process.env.EPOCH_SAVE_EDITOR==='1')fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
 else assert.deepEqual(out,data);
 await page.screenshot({path:path.join(artifacts,'editor-full.png')});
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.locator('#mm-new-game-btn').click({timeout:120000});
 const options=await page.locator('#mm-map-select option').evaluateAll(options=>options.map(o=>o.value).filter(v=>v.startsWith('map_')));
 assert.equal(options[2],'map_middle_east');
 await page.locator('#mm-map-select').selectOption('map_middle_east');
 assert.equal(await page.locator('.mm-nation-card').count(),8);
 const leaders=await page.locator('.mm-card-leader').allTextContents();
 assert.deepEqual(leaders,['Ruhollah Khomeini','Saddam Hussein','Abdel Fattah el-Sisi','Benjamin Netanyahu','Recep Tayyip Erdoğan','Mohammed bin Salman','Donald J. Trump','Vladimir Putin']);
 await page.locator('.mm-nation-card[data-nation-id="nation_iran"]').click();
 await page.screenshot({path:path.join(artifacts,'game-setup.png')});
 await page.locator('#mm-start-btn').click();
 await page.waitForFunction(()=>!!window.__epochDiagnostics,{},{timeout:120000});
 const state=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 assert.equal(state.mapKey,'map_middle_east');assert.equal(state.activeNationIds.length,8);
 assert.equal(state.cities.length,17);assert.equal(state.units.filter(u=>u.unitTypeId==='settler').length,8);
 for(const nation of data.nations){
  if(nation.leaderId) assert.equal(state.leaderSelections[nation.id],nation.leaderId);
  const u=state.units.find(u=>u.ownerId===nation.id&&u.unitTypeId==='settler');
  assert.deepEqual([u.tileX,u.tileY],[nation.startTerritoryCenter.q,nation.startTerritoryCenter.r]);
 }
 for(const c of data.cities){const live=state.cities.find(l=>l.name===c.name);assert.ok(live,c.name);assert.equal(live.ownerId,c.nationId);assert.deepEqual([live.tileX,live.tileY],[c.q,c.r]);for(const p of c.ownedTileCoords){const t=state.tiles.find(t=>t.q===p.q&&t.r===p.r);assert.equal(t.ownerId,c.nationId,`${c.name}: ${p.q},${p.r}`);}}
 const liveLeaders=await page.evaluate(async()=>{const {getLeaderByNationId}=await import('/src/data/leaders.ts');return ['iran','iraq','egypt','israel','turkey','saudi_arabia','usa','russia'].map(id=>getLeaderByNationId('nation_'+id)?.id);});
 assert.deepEqual(liveLeaders,['ruhollah_khomeini','saddam_hussein','abdel_fattah_el_sisi','benjamin_netanyahu','recep_tayyip_erdogan','mohammed_bin_salman','donald_j_trump','vladimir_putin'].map(id=>'leader_'+id));
 for(const field of ['resourceId','riverConnections'])assert.deepEqual(state.tiles.filter(t=>t[field]).map(t=>[t.q,t.r,t[field]]),data.map.tiles.filter(t=>t[field]).map(t=>[t.q,t.r,t[field]]));
 await page.screenshot({path:path.join(artifacts,'game-start.png')});
 const rounds=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(2));assert.ok(rounds.completedRounds>=2);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify({map:data.meta.name,size:[125,75],leaders:liveLeaders,cities:17,settlers:8,completedRounds:rounds.completedRounds,errors},null,2)+'\n');
 console.log('Middle East: editor roundtrip, default third position, eight leaders, 17 cities, eight Settlers, territories/resources/rivers and two live rounds passed.',artifacts);
}finally{await browser.close();}
