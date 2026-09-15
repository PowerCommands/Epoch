/** Real GameScene combat, city health events, healing and save/load. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const url=process.argv[2]??'http://127.0.0.1:5175';
await mkdir('/tmp/epoch-city-damage',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EPOCH_BROWSER_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  await page.route('**/src/scenes/GameScene.ts*',async route=>{
    const response=await route.fetch();const source=await response.text();
    const marker='    const openCityView = (city) => {';
    assert.ok(source.includes(marker));
    await route.fulfill({response,body:source.replace(marker,
      '    window.cityDamageGame = { cityManager, nationManager, cityRenderer, cityBannerRenderer, unitManager, combatSystem, healingSystem, tileMap, scene:this };\n'+marker)});
  });
  await page.goto(url+'/?epochDiagnostics=1');
  await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:60000});
  const scenario={
    meta:{name:'City damage regression',version:1,startYear:1930,startYearIsBC:false,originalCapitalCollapsePercent:0},
    map:{width:40,height:26,tileSize:48,tiles:Array.from({length:26},(_,r)=>Array.from({length:40},(_,q)=>({q,r,type:'plains'}))).flat()},
    nations:[{id:'nation_england',name:'England',color:'#dd203f',gold:100000,researchedTechIds:['flight'],startTerritoryCenter:{q:10,r:10}},
      {id:'nation_germany',name:'Germany',color:'#444466',gold:100000,startTerritoryCenter:{q:20,r:10}}],
    cities:[{id:'base',name:'Air Base',nationId:'nation_england',q:10,r:10,isCapital:true,buildings:[{buildingId:'airfield',q:10,r:10}]},
      {id:'target',name:'Target Town',nationId:'nation_germany',q:14,r:10},
      {id:'enemy',name:'Enemy Capital',nationId:'nation_germany',q:20,r:10,isCapital:true}],
    units:[{nationId:'nation_england',unitTypeId:'great_war_bomber',q:10,r:10},
      {nationId:'nation_england',unitTypeId:'rocket_artillery',q:12,r:10},{nationId:'nation_england',unitTypeId:'infantry',q:13,r:10}],
    initialDiplomacy:[{nationA:'nation_england',nationB:'nation_germany',state:'WAR'}],
  };
  await page.evaluate(s=>localStorage.setItem('epoch.customScenarios',JSON.stringify({version:1,entries:[{metadata:{id:'custom-city_damage',name:s.meta.name,createdAt:1,updatedAt:1},scenario:s}]})),scenario);
  await page.goto(url+'/?epochDiagnostics=1');
  await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:60000});
  const started=await page.evaluate(()=>window.__epochDiagnostics.startNewGame({scenario:'custom-city_damage',humanNationId:'nation_england',resourceAbundance:'scenario'}));
  assert.equal(started.ok,true,started.error);
  await page.waitForFunction(()=>window.cityDamageGame&&window.__epochDiagnostics?.prepareAirAction,undefined,{timeout:60000});
  const bomber=await page.evaluate(()=>{
    const r=window.cityDamageGame,c=r.cityManager.getCity('target');c.settlementStage='Town';c.health=130;r.cityManager.notifyHealthChanged(c);
    return r.unitManager.getAllUnits().find(u=>u.unitType.id==='great_war_bomber').id;
  });
  await page.evaluate(id=>window.__epochDiagnostics.prepareAirAction(id,14,10),bomber);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.mouse.click(640,360);await page.mouse.move(960,600);
  await page.waitForFunction(()=>{
    const r=window.cityDamageGame;return r.cityManager.getCity('target').health<102
      &&r.cityRenderer.getCityContainer('target').getData('damaged')
      &&r.scene.children.list.some(o=>o.name==='air-impact-smoke'&&o.visible&&o.alpha>.1);
  },undefined,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.cityDamageGame.cityBannerRenderer.banners.get('target').container.visible),false);
  await page.screenshot({path:'/tmp/epoch-city-damage/game-air-impact.png'});
  await page.waitForFunction(()=>window.cityDamageGame.cityBannerRenderer.banners.get('target').container.visible,undefined,{timeout:30000});
  await page.screenshot({path:'/tmp/epoch-city-damage/game-persistent-damage.png'});
  for (const stage of ['Village','Town','City','Metropolis']) for (const type of ['rocket_artillery','infantry']) {
    const hit=await page.evaluate(({stage,type})=>{
      const r=window.cityDamageGame,c=r.cityManager.getCity('target'),u=r.unitManager.getAllUnits().find(u=>u.unitType.id===type);
      c.health=130;c.settlementStage=stage;r.cityManager.notifyHealthChanged(c);u.health=100;u.resetMovement();
      return r.combatSystem.tryAttack(u,14,10,{source:'human-ui'});
    },{stage,type});
    assert.ok(hit,stage+' '+type);
    await page.waitForFunction(()=>window.cityDamageGame.cityRenderer.getCityContainer('target').getData('damaged'));
    assert.ok(await page.evaluate(()=>window.cityDamageGame.cityRenderer.damageEffects.sites.has('target')));
  }
  // Damage through a non-combat health notification, followed by normal turn healing.
  const health=await page.evaluate(()=>{
    const r=window.cityDamageGame,c=r.cityManager.getCity('target');c.health=92;c.lastTurnAttacked=null;r.cityManager.notifyHealthChanged(c);
    const before=r.cityRenderer.getCityContainer('target').getData('damaged');
    r.healingSystem.handleTurnStart({nation:r.nationManager.getNation(c.ownerId)});
    const after=r.cityRenderer.getCityContainer('target').getData('damaged');
    return {before,after,health:c.health,fire:r.cityRenderer.damageEffects.sites.has('target')};
  });
  assert.deepEqual(health,{before:true,after:false,health:102,fire:false});
  const save=await page.evaluate(()=>{
    const r=window.cityDamageGame,c=r.cityManager.getCity('target');c.health=101;r.cityManager.notifyHealthChanged(c);return window.__epochDiagnostics.getSaveState();
  });
  await page.goto(url+'/?epochDiagnostics=1');
  await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:60000});
  const loaded=await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save);assert.equal(loaded.ok,true,loaded.error);
  await page.waitForFunction(()=>window.cityDamageGame&&window.__epochDiagnostics?.getSaveState,undefined,{timeout:60000});
  const restored=await page.evaluate(()=>{
    const r=window.cityDamageGame,c=r.cityManager.getCity('target');return {health:c.health,stage:c.settlementStage,damaged:r.cityRenderer.getCityContainer(c.id).getData('damaged'),fire:r.cityRenderer.damageEffects.sites.has(c.id)};
  });
  assert.deepEqual(restored,{health:101,stage:'Metropolis',damaged:true,fire:true});
  assert.deepEqual(errors,[]);
  console.log('PASS real GameScene: bomber map click and hidden/restored city badge, melee and artillery damage for all four stages, non-combat health changes, 51% turn healing, saved Metropolis damage restored.');
} finally {await browser.close();}
