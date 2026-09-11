/** Local Vite integration check: EPOCH_BASE_URL=http://127.0.0.1:5187 node tools/mutualFoeAgreement.browser.mjs */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5187';
const output=process.env.EPOCH_ARTIFACTS ?? '/tmp/epoch-mutual-foe';
await fs.mkdir(output,{recursive:true});
const R='nation_russia',U='nation_ukraine',S='nation_sweden',G='nation_germany';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await page.goto(`${base}/editor.html`);
 await page.waitForFunction(()=>window.EpochMutualFoeEditor?.open && typeof buildBlankScenario==='function');
 await page.evaluate(()=>{
  const data=buildBlankScenario('Mutual Foe integration',['nation_russia','nation_ukraine','nation_sweden','nation_germany'],32,24,32,null);
  startEditor({label:'Mutual Foe integration',file:'mutual-foe-test.json',isNew:true},data,null);
 });
 await page.getByRole('button',{name:'Mutual Foe Agreements',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Mutual Foe Agreements',exact:true});
 await dialog.getByRole('button',{name:'Create Agreement',exact:true}).click();
 await dialog.getByLabel('Agreement name',{exact:true}).fill('European Mutual Defense Agreement');
 await dialog.getByLabel('Antagonist nation',{exact:true}).selectOption(R);
 await dialog.getByLabel('Support (%)',{exact:true}).fill('20');
 for(const name of ['Volodymyr Zelenskyy — Ukraine','Olof Palme — Sweden','Angela Merkel — Germany']) await dialog.getByLabel(name,{exact:true}).check();
 assert.equal(await dialog.locator('input[type=number]').count(),1);
 assert.equal(await dialog.getByLabel('Ivan IV — Russia',{exact:true}).count(),0);
 await page.screenshot({path:`${output}/editor.png`});
 await dialog.getByRole('button',{name:'Apply to Scenario',exact:true}).click();
 let data=await page.evaluate(()=>buildScenarioOutput());
 assert.equal(data.mutualFoeAgreements[0].supportPercent,20);
 assert.equal(data.mutualFoeAgreements[0].memberLeaderIds.length,3);
 const id=data.mutualFoeAgreements[0].id;
 // Edit/reopen/validation/deletion/cancel all use the real standalone editor.
 await page.getByRole('button',{name:'Mutual Foe Agreements',exact:true}).click();
 await dialog.getByLabel('Support (%)',{exact:true}).fill('101');
 await dialog.getByRole('button',{name:'Apply to Scenario',exact:true}).click();
 assert.match(await dialog.getByRole('alert').innerText(),/between 0 and 100/);
 await dialog.getByLabel('Support (%)',{exact:true}).fill('25');
 await dialog.getByRole('button',{name:'Apply to Scenario',exact:true}).click();
 assert.equal((await page.evaluate(()=>buildScenarioOutput())).mutualFoeAgreements[0].supportPercent,25);
 await page.getByRole('button',{name:'Mutual Foe Agreements',exact:true}).click();
 await dialog.getByRole('button',{name:'Remove Agreement',exact:true}).click();
 await dialog.getByRole('button',{name:'Apply to Scenario',exact:true}).click();
 assert.deepEqual((await page.evaluate(()=>buildScenarioOutput())).mutualFoeAgreements,[]);
 await page.evaluate(config=>{scenario.mutualFoeAgreements=config;},data.mutualFoeAgreements);
 await page.getByRole('button',{name:'Mutual Foe Agreements',exact:true}).click();
 assert.equal(await dialog.getByLabel('Agreement ID',{exact:true}).inputValue(),id);
 await dialog.getByLabel('Support (%)',{exact:true}).fill('90');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal((await page.evaluate(()=>buildScenarioOutput())).mutualFoeAgreements[0].supportPercent,20);
 // Place four real capital cities with enough land to remain normal gameplay participants.
 const leaderIds={[R]:'leader_vladimir_putin',[U]:'leader_volodymyr_zelenskyy',[S]:'leader_olof_palme',[G]:'leader_angela_merkel'};
 const positions=[[6,6],[22,6],[6,17],[22,17]];
 data.map.tiles=Array.from({length:32*24},(_,i)=>({q:i%32,r:Math.floor(i/32),type:'plains'}));
 data.nations.forEach((n,i)=>{n.leaderId=leaderIds[n.id];n.startTerritoryCenter={q:positions[i][0],r:positions[i][1]};n.gold=n.id===S?10000:n.id===G?25000:1000;});
 data.cities=data.nations.map((n,i)=>({id:`capital_${i}`,name:n.name,nationId:n.id,q:positions[i][0],r:positions[i][1],isCapital:true}));
 data.units=[];data.initialDiplomacy=[];data.historicalEvents=[];data.turningPointEventsConfigured=true;
 data.meta.startYear=2020;data.meta.startYearIsBC=false;
 await fs.writeFile(`${output}/scenario.json`,JSON.stringify(data,null,2));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.mutualFoeTestGame=game;'});});
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:120000});
 await page.evaluate(scenario=>{
  const game=window.mutualFoeTestGame;
  game.cache.json.add('map_mutual_foe_test',scenario);
  game.scene.getScene('MainMenuScene').cleanup();
  game.scene.start('GameScene',{mapKey:'map_mutual_foe_test',humanNationId:'nation_ukraine',activeNationIds:scenario.nations.map(n=>n.id),resourceAbundance:'scenario',gameSpeedId:'standard',worldSeed:123,autofocusOnEndTurn:false,victoryConditions:{domination:{enabled:false},science:{enabled:false},cultural:{enabled:false},diplomatic:{enabled:false}}});
 },data);
 await page.waitForFunction(()=>window.__epochDiagnostics?.getSaveState,undefined,{timeout:120000});
 async function attach() {
  await page.evaluate(()=>{
   const scene=window.mutualFoeTestGame.scene.getScene('GameScene');
   const provider=scene.rightSidebarPanel.dataProvider;
   window.mf={scene,provider,nations:provider.nationManager,diplomacy:provider.diplomacyManager,resources:provider.unitUpkeepSystem.resourceSystem};
   window.mf.system=window.mf.resources.mutualFoeSupport;
  });
 }
 await attach();
 const read=()=>page.evaluate(()=>({crises:window.mf.system.serialize(),nations:window.mf.nations.getAllNations().map(n=>({id:n.id,gold:window.mf.nations.getResources(n.id).gold,...window.mf.system.getGoldBreakdown(n.id)}))}));
 let state=await read();assert.equal(state.crises.length,0);
 const initial=Object.fromEntries(state.nations.map(n=>[n.id,n.gold]));
 assert.equal(initial[S],10000);assert.equal(initial[G],25000);
 await page.evaluate(()=>window.mf.diplomacy.declareWar('nation_russia','nation_ukraine'));
 state=await read();
 assert.equal(state.crises.length,1);assert.equal(state.crises[0].defendedNationId,U);
 assert.equal(state.nations.find(n=>n.id===S).gold,8000);assert.equal(state.nations.find(n=>n.id===G).gold,20000);assert.equal(state.nations.find(n=>n.id===U).gold,initial[U]+7000);
 // Supply deterministic ordinary national income through the existing manufactured-Gold provider.
 await page.evaluate(()=>{
  window.mf.resources.setManufacturedGoldProvider(id=>id==='nation_sweden'?100:id==='nation_germany'?250:0);
  for(const n of window.mf.nations.getAllNations())window.mf.resources.recalculateForNation(n.id);
 });
 state=await read(); assert.ok(state.nations.find(n=>n.id===S).outgoing>=20);assert.ok(state.nations.find(n=>n.id===G).outgoing>=50);
 const beforeIncome=state.nations.find(n=>n.id===U).gold;
 const scheduled=state.nations.filter(n=>n.id===S||n.id===G).reduce((sum,n)=>sum+n.outgoing,0);
 await page.evaluate(()=>{for(const id of ['nation_sweden','nation_germany'])window.mf.resources.handleTurnStart({round:2,nation:window.mf.nations.getNation(id)});});
 state=await read();assert.equal(state.nations.find(n=>n.id===U).gold,beforeIncome+scheduled);
 await page.evaluate(()=>window.mf.diplomacy.declareWar('nation_sweden','nation_russia'));
 state=await read();assert.equal(state.nations.find(n=>n.id===S).outgoing,0);assert.ok(state.nations.find(n=>n.id===G).outgoing>0);assert.ok(state.crises[0].fulfilledByWarLeaderIds.includes('leader_olof_palme'));
 await page.evaluate(()=>window.mf.diplomacy.reconcileWar('nation_sweden','nation_russia'));
 state=await read();assert.equal(state.nations.find(n=>n.id===S).outgoing,0);
 // Actual game save -> scene restart -> canonical SaveLoadService apply.
 const saved=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
 const balances=Object.fromEntries(saved.nations.map(n=>[n.id,n.gold]));
 await fs.writeFile(`${output}/active-save.json`,JSON.stringify(saved,null,2));
 await page.screenshot({path:`${output}/game-support.png`});
 await page.evaluate(save=>window.mf.scene.scene.restart({mapKey:save.mapKey,humanNationId:save.humanNationId,activeNationIds:save.activeNationIds,savedState:save,gameSpeedId:save.gameSpeedId,resourceAbundance:'scenario'}),saved);
 await page.waitForTimeout(1500);
 await page.waitForFunction(()=>window.__epochDiagnostics?.getSaveState && window.mutualFoeTestGame.scene.getScene('GameScene').rightSidebarPanel,undefined,{timeout:120000});
 await attach();state=await read();
 assert.equal(state.crises.length,1);assert.equal(state.nations.find(n=>n.id===S).outgoing,0);
 for(const n of state.nations)assert.equal(n.gold,balances[n.id],`${n.id} treasury unchanged by reload`);
 await page.evaluate(()=>window.mf.diplomacy.forceDeclareWar('nation_russia','nation_sweden'));
 state=await read();assert.equal(state.crises.length,1);assert.equal(state.crises[0].defendedNationId,U);
 await page.evaluate(()=>window.mf.diplomacy.reconcileWar('nation_russia','nation_ukraine'));
 assert.equal((await read()).crises.length,0);
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${output}/verification.json`,JSON.stringify({editor:'create/edit/remove/validation/cancel/roundtrip passed',gameplay:'activation, reserve transfers, income support, military fulfillment, separate peace, save/reload, reattack and crisis end passed',errors},null,2));
 console.log(`Mutual Foe editor and live GameScene integration passed. Artifacts: ${output}`);
} finally {await browser.close();}
