/** Run with a local Vite server: node tools/airOperations.browser.mjs http://127.0.0.1:5173 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, executablePath: process.env.EPOCH_BROWSER_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  await page.route('**/__air_test', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto(`${url}/__air_test`);
  await page.evaluate(async () => {
    const { default: Phaser } = await import('/node_modules/.vite/deps/phaser.js');
    const { AirMissionRenderer } = await import('/src/renderers/AirMissionRenderer.ts');
    const { GREAT_WAR_BOMBER, TRIPLANE, MOBILE_SAM } = await import('/src/data/units.ts');
    let emit;
    window.airTest = { enabled: true };
    new Phaser.Game({ type: Phaser.CANVAS, width: 700, height: 400, audio: { noAudio: true }, scene: {
      create() {
        window.airTest.scene = this;
        for (const type of [GREAT_WAR_BOMBER,TRIPLANE]) {
          const g = this.make.graphics({x:0,y:0}); g.fillStyle(0xffffff).fillTriangle(0,16,32,16,16,0); g.generateTexture(`unit_${type.id}`,32,32); g.destroy();
        }
        new AirMissionRenderer(this,{tileToWorld:(x,y)=>({x:80+x*80,y:80+y*80})}, {onFlight: callback => emit=callback},()=>window.airTest.enabled,()=>true);
        window.airTest.fire = (kind='strike',defense='fighter',destroyed=false) => emit({ aircraft:{unitType:GREAT_WAR_BOMBER},origin:{x:0,y:1},destination:{x:5,y:1},kind,destroyed,
          ...(kind==='intercepted' ? {interceptor:{unitType:defense==='fighter'?TRIPLANE:MOBILE_SAM},interceptorOrigin:{x:3,y:0}} : {}) });
      },
    } });
  });
  await page.waitForFunction(()=>window.airTest?.fire);
  await page.evaluate(()=>window.airTest.fire());
  await page.waitForFunction(()=>window.airTest.scene.children.list.some(o=>o.type==='Image' && o.x>100 && o.x<450));
  const outward=await page.evaluate(()=>window.airTest.scene.children.list.find(o=>o.type==='Image').x);
  await page.waitForFunction(()=>window.airTest.scene.children.list.some(o=>o.type==='Image' && o.x>450));
  await page.waitForFunction(()=>window.airTest.scene.children.list.some(o=>o.type==='Image' && o.x<300));
  await page.waitForFunction(()=>window.airTest.scene.children.list.length===0);
  await page.evaluate(()=>window.airTest.fire('intercepted'));
  await page.waitForFunction(()=>window.airTest.scene.children.list.filter(o=>o.type==='Image').length===2);
  await page.waitForFunction(()=>window.airTest.scene.children.list.length===0);
  await page.evaluate(()=>window.airTest.fire('intercepted','sam',true));
  await page.waitForFunction(()=>window.airTest.scene.children.list.some(o=>o.type==='Arc'));
  await page.waitForFunction(()=>window.airTest.scene.children.list.length===0);
  await page.evaluate(()=>window.airTest.fire('rebase'));
  await page.waitForFunction(()=>window.airTest.scene.children.list.some(o=>o.type==='Image' && o.x>300));
  await page.waitForFunction(()=>window.airTest.scene.children.list.length===0);
  await page.evaluate(()=>{window.airTest.enabled=false;window.airTest.fire();});
  assert.equal(await page.evaluate(()=>window.airTest.scene.children.list.length),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS: real Phaser outbound flight (${Math.round(outward)}px sampled), return, fighter launch/return, stationary SAM projectile, destruction, Rebase, and skipped autorun visuals.`);
  // Exercise the real GameScene, HUD actions, map pointer input, save/load and autorun.
  const scenario = {
    meta:{name:'Air warfare regression',version:1,startYear:1930,startYearIsBC:false,originalCapitalCollapsePercent:0},
    map:{width:40,height:26,tileSize:48,tiles:Array.from({length:26},(_,r)=>Array.from({length:40},(_,q)=>({q,r,type:'plains'}))).flat()},
    nations:[{id:'nation_england',name:'England',color:'#dd203f',gold:100000,researchedTechIds:['flight'],startTerritoryCenter:{q:10,r:10}},{id:'nation_germany',name:'Germany',color:'#444466',gold:100000,startTerritoryCenter:{q:20,r:10}}],
    cities:[
      {id:'air_home',name:'Air Home',nationId:'nation_england',q:10,r:10,isCapital:true,buildings:[{buildingId:'airfield',q:10,r:10}]},
      {id:'air_forward',name:'Air Forward',nationId:'nation_england',q:10,r:15,buildings:[{buildingId:'airfield',q:10,r:15}]},
      {id:'air_enemy',name:'Air Enemy',nationId:'nation_germany',q:20,r:10,isCapital:true,buildings:[{buildingId:'airfield',q:20,r:10}]},
    ],
    units:[{nationId:'nation_england',unitTypeId:'great_war_bomber',q:10,r:10},{nationId:'nation_england',unitTypeId:'scout',q:13,r:10},{nationId:'nation_germany',unitTypeId:'warrior',q:14,r:10}],
    initialDiplomacy:[{nationA:'nation_england',nationB:'nation_germany',state:'WAR'}],
  };
  await page.evaluate(s=>localStorage.setItem('epoch.customScenarios',JSON.stringify({version:1,entries:[{metadata:{id:'custom-air_test',name:s.meta.name,createdAt:1,updatedAt:1},scenario:s}]})),scenario);
  await page.goto(`${url}/?epochDiagnostics=1`);
  await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:30000});
  const started=await page.evaluate(()=>window.__epochDiagnostics.startNewGame({scenario:'custom-air_test',humanNationId:'nation_england',resourceAbundance:'scenario'}));
  assert.equal(started.ok,true,started.error);
  await page.waitForFunction(()=>window.__epochDiagnostics?.prepareAirAction,undefined,{timeout:30000});
  console.log('GameScene loaded');
  let save=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
  const bomber=save.units.find(u=>u.unitTypeId==='great_war_bomber');
  assert.equal(bomber.airBase?.id,'air_home');
  let preview=await page.evaluate(id=>window.__epochDiagnostics.prepareAirAction(id,14,10),bomber.id);
  assert.ok(preview.actions.some(a=>a.label==='Air Mission' && a.isActive));
  assert.ok(preview.actions.some(a=>a.mode==='rebase'));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  console.log('Clicking air action');
  await page.screenshot({path:'/tmp/epoch-air-game-ui.png'});
  await page.mouse.click(640,360);
  await page.waitForFunction(id=>window.__epochDiagnostics.getSaveState().units.find(u=>u.id===id)?.movementPoints===0,bomber.id);
  save=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
  assert.equal(save.units.find(u=>u.unitTypeId==='warrior').health,50);
  assert.equal(save.units.find(u=>u.id===bomber.id).airBase.id,'air_home');
  // Save while the visual flight may still be in progress, then restore it.
  save.units.find(u=>u.id===bomber.id).movementPoints=2;
  await page.goto(`${url}/?epochDiagnostics=1`);
  await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:30000});
  const loaded=await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save);
  assert.equal(loaded.ok,true,loaded.error);
  await page.waitForFunction(()=>window.__epochDiagnostics?.prepareAirAction,undefined,{timeout:30000});
  preview=await page.evaluate(id=>window.__epochDiagnostics.prepareAirAction(id,10,15,'rebase'),bomber.id);
  assert.ok(preview.actions.some(a=>a.mode==='rebase' && a.isActive));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  console.log('Clicking air action');
  await page.screenshot({path:'/tmp/epoch-air-game-ui.png'});
  await page.mouse.click(640,360);
  await page.waitForFunction(id=>window.__epochDiagnostics.getSaveState().units.find(u=>u.id===id)?.airBase?.id==='air_forward',bomber.id);
  // Queue an aircraft using the production destination map cursor, then round-trip its target.
  await page.evaluate(()=>window.__epochDiagnostics.prepareAircraftProduction('air_home','triplane',10,15));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'/tmp/epoch-air-production-destinations.png'});
  await page.mouse.click(640,360);
  await page.waitForFunction(()=>window.__epochDiagnostics.getSaveState().cities.find(c=>c.id==='air_home').productionQueue.some(e=>e.item.aircraftBase?.id==='air_forward'));
  save=await page.evaluate(()=>window.__epochDiagnostics.getSaveState());
  const queued=save.cities.find(c=>c.id==='air_home').productionQueue.find(e=>e.item.id==='triplane');
  assert.deepEqual(queued.item.aircraftBase,{kind:'city',id:'air_forward'});
  await page.goto(`${url}/?epochDiagnostics=1`);
  await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:30000});
  assert.equal((await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save)).ok,true);
  await page.waitForFunction(()=>window.__epochDiagnostics?.prepareAircraftProduction,undefined,{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>window.__epochDiagnostics.getSaveState().cities.find(c=>c.id==='air_home').productionQueue.find(e=>e.item.id==='triplane').item.aircraftBase),{kind:'city',id:'air_forward'});
  console.log('PASS: aircraft production destination map click and saved queue destination round-trip.');
  const autoplay=await page.evaluate(()=>window.__epochDiagnostics.startAutoplay(3));
  assert.ok(autoplay.completedRounds>=3);
  assert.deepEqual(errors,[]);
  console.log('PASS: full GameScene scenario basing, Air Mission HUD/map click, atomic save/load, Rebase HUD/map click and three autorun rounds.');
} finally { await browser.close(); }
