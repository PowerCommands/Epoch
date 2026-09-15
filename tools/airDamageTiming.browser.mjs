/** Real GameScene regression: apply actual damage only after the explosion. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const url=process.argv[2]??'http://127.0.0.1:5173';
await mkdir('/tmp/epoch-city-damage',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EPOCH_BROWSER_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  await page.route('**/src/scenes/GameScene.ts*',async route=>{
    const response=await route.fetch();const source=(await response.text()).replace('new AirMissionRenderer(', 'window.airDamageRenderer = new AirMissionRenderer(');
    const marker='    const openCityView = (city) => {';
    assert.ok(source.includes(marker));
    await route.fulfill({response,body:source.replace(marker,
      '    window.cityDamageGame = { cityManager, nationManager, cityRenderer, cityBannerRenderer, unitManager, combatSystem, healingSystem, tileMap, visibilitySystem, scene:this };\n'+marker)});
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
  await page.evaluate(() => window.cityDamageGame.scene.game.loop.stop());
  await page.mouse.click(640,360); await page.mouse.move(960,600);
  const phase = async (name, age) => {
    const state = await page.evaluate(async age => {
      const r = window.cityDamageGame, renderer = window.airDamageRenderer;
      const flight = renderer.flights[0];
      const reveal = Math.max(...flight.plan.weapons.map(w => w.impactMs)) + 420;
      const time = age === 'approach' ? flight.plan.weapons[0].releaseMs - 80 : age === 'over-city' ? flight.plan.passMs : age === 'impact' ? flight.plan.weapons[0].impactMs + 120 : age === 'before' ? reveal - 1 : reveal + 1;
      renderer.update(0, time - flight.age);
      await Promise.resolve();
      const scene = r.scene, engine = scene.game.renderer;
      engine.preRender(); scene.sys.render(engine); engine.postRender();
      return { aircraftVisible: flight.aircraft.image.visible, impactVisible: flight.graphics.commandBuffer.length > 0, snapshot: !!scene.children.getByName('air-target-before-damage'), health: r.cityManager.getCity('target').health, damaged: r.cityRenderer.getCityContainer('target').getData('damaged') };
    }, age);
    if (age === 'over-city') assert.equal(state.aircraftVisible, true, 'aircraft must stay visible above the city');
    if (age === 'impact') assert.equal(state.impactVisible, true, 'explosion must stay visible above the city');
    assert.equal(state.damaged, age === 'after', `actual city damage waits for explosion: ${JSON.stringify(state)}`);
    assert.equal(state.snapshot, false, 'no rectangular copy covers the world');
    await page.screenshot({ path: `/tmp/epoch-city-damage/timing-${name}.png` });
  };
  await phase('approach', 'approach');
  await phase('over-city', 'over-city');
  await phase('impact', 'impact');
  await phase('explosion', 'before');
  await phase('after-explosion', 'after');
  // A discovered city remains drawn after it leaves current vision.
  for (const stage of ['Town', 'City', 'Metropolis']) for (const role of ['bomber', 'fighter']) {
    await page.evaluate(async ({stage, bomber, role}) => {
      const { FIGHTER, GREAT_WAR_BOMBER } = await import('/src/data/units.ts');
      const r = window.cityDamageGame;
      window.airDamageRenderer.update(0, 60000);
      const city = r.cityManager.getCity('target');
      city.settlementStage = stage; city.health = 103;
      r.cityManager.notifyHealthChanged(city);
      r.cityRenderer.getCityContainer(city.id).setAlpha(1);
      r.visibilitySystem.discoverCity(city);
      const canRender = r.visibilitySystem.canRenderObjectAt.bind(r.visibilitySystem);
      r.visibilitySystem.canRenderObjectAt = (x, y) => x >= 14 ? false : canRender(x, y);
      const plane = r.unitManager.getUnit(bomber);
      plane.changeUnitType(role === 'fighter' ? FIGHTER : GREAT_WAR_BOMBER); plane.resetMovement();
      if (!r.combatSystem.tryAttack(plane, 14, 10)) throw new Error('Strike was rejected');
    }, {stage, bomber, role});
    await phase(`${stage}-${role}-known-approach`, 'approach');
    await phase(`${stage}-${role}-known-over-city`, 'over-city');
    await phase(`${stage}-${role}-known-impact`, 'impact');
    await phase(`${stage}-${role}-known-after-explosion`, 'after');
  }
  const saved = await page.evaluate(() => {
    const r = window.cityDamageGame;
    window.airDamageRenderer.update(0, 60000);
    const city = r.cityManager.getCity('target'); city.health = 103;
    r.cityManager.notifyHealthChanged(city);
    const plane = r.unitManager.getAllUnits().find(u => u.unitType.aircraftRole);
    plane.resetMovement();
    r.combatSystem.tryAttack(plane, 14, 10);
    return window.__epochDiagnostics.getSaveState();
  });
  assert.equal(saved.cities.find(c => c.id === 'target').health, 103);
  assert.equal(saved.pendingAirMissions.length, 1);
  await page.goto(url + '/?epochDiagnostics=1');
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 60000 });
  const loaded = await page.evaluate(saved => window.__epochDiagnostics.startSavedGame(saved), saved);
  assert.equal(loaded.ok, true, loaded.error);
  await page.waitForFunction(() => window.airDamageRenderer?.flights.length && window.cityDamageGame, undefined, { timeout: 60000 });
  await page.evaluate(() => window.cityDamageGame.scene.game.loop.stop());
  await phase('restored-before-impact', 'approach');
  await phase('restored-after-impact', 'after');
  assert.deepEqual(errors, []);
  console.log('PASS real GameScene: intact target until explosion; fighter and bomber stay visible over known Town, City and Metropolis outside current sight.');
} finally { await browser.close(); }
