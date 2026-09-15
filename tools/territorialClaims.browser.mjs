import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const save = process.env.EPOCH_SAVE ? JSON.parse(await fs.readFile(process.env.EPOCH_SAVE, 'utf8')) : undefined;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('epoch.tutorialDontShowAgain', 'true'));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/src/scenes/GameScene.ts*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('unitActionToolbox.setClaimAvailabilityProvider(territorialClaimSystem);',
      'window.claimTest = { territorialClaimSystem, territoryRenderer, unitManager, nationManager, turnManager, cityManager, cityTerritorySystem, mapData, gridSystem, selectionManager, unitActionToolbox, cityView, historicalTimeline, diplomacyManager, aiSystem, productionSystem, productionPurchaseSystem, foundCitySystem, openCity: (city) => openCityView(city) }; unitActionToolbox.setClaimAvailabilityProvider(territorialClaimSystem);');
    await route.fulfill({ response, body });
  });
  await page.goto(`${process.env.EPOCH_URL ?? 'http://127.0.0.1:5173'}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  const loaded = await page.evaluate(s => s ? window.__epochDiagnostics.startSavedGame(s) : window.__epochDiagnostics.startNewGame({ scenario: 'map_maritime_expansion' }), save);
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  await page.waitForFunction(() => !!window.claimTest?.unitManager, undefined, { timeout: 90000 });
  const setup = await page.evaluate(async () => {
    const h = window.claimTest;
    const { SURVEYOR } = await import('/src/data/units.ts');
    const { isClaimableNeutralLand } = await import('/src/systems/TerritorialClaimSystem.ts');
    const nation = h.turnManager.getCurrentNation().id;
    let city = h.cityManager.getCitiesByOwner(nation)[0];
    if (!city) {
      const settler = h.unitManager.getUnitsByOwner(nation).find(u=>h.foundCitySystem.canFound(u));
      if (!settler) throw new Error('No founding Settler in fixture');
      city = h.foundCitySystem.foundCity(settler);
    }
    h.nationManager.getResources(nation).gold = 100000;
    const tile = h.gridSystem.getTilesInRange({ x: city.tileX, y: city.tileY }, 10, h.mapData)
      .find(t => isClaimableNeutralLand(t) && !h.unitManager.getUnitAt(t.x,t.y));
    if (!tile) throw new Error('No claimable fixture tile');
    const unit = h.unitManager.createUnit({ type: SURVEYOR, ownerId: nation, tileX: tile.x, tileY: tile.y });
    h.selectionManager.selectUnit(unit);
    h.unitActionToolbox.tryActivate('claimTerritory');
    if (h.unitManager.getUnit(unit.id)) throw new Error('HUD failed to consume Surveyor');
    if (tile.territorialClaimNationId !== nation) throw new Error('HUD failed to create claim');
    if (h.nationManager.getResources(nation).gold !== 99800) throw new Error('Gold was not paid');
    const r = h.territoryRenderer;
    r.visibilityPredicate = () => true;
    r.flush();
    if ([...r.activeSegments.values()].some(s => s.tileX === tile.x && s.tileY === tile.y)) throw new Error('Claim rendered a territorial border');
    if (!r.claimGfx.commandBuffer.length) throw new Error('Claim tint was not drawn');
    if (!r.scene.textures.exists('unit_surveyor')) throw new Error('Surveyor sprite not loaded');
    const center = r.tileMap.getTileOutlinePoints(tile.x, tile.y);
    r.scene.cameras.main.setZoom(1.3).centerOn(center.reduce((s,p)=>s+p.x,0)/6,center.reduce((s,p)=>s+p.y,0)/6);
    h.claimedTile = tile;
    h.savedSurveyor = h.unitManager.createUnit({ type: SURVEYOR, ownerId: nation, tileX: tile.x, tileY: tile.y });
    return { nation, tile: { x: tile.x, y: tile.y }, unitId: h.savedSurveyor.id };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/epoch-territorial-claim.png' });
  const saved = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.ok(saved.tiles.some(t => t.q === setup.tile.x && t.r === setup.tile.y && t.territorialClaimNationId === setup.nation));
  assert.ok(saved.units.some(u => u.id === setup.unitId && u.unitTypeId === 'surveyor'));
  await page.reload();
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), saved)).ok, true);
  await page.waitForFunction(() => !!window.claimTest?.unitManager.getAllUnits().some(u => u.unitType.id === 'surveyor'), undefined, { timeout: 90000 });
  const purchase = await page.evaluate(({ tile: coord, unitId, nation }) => {
    const h = window.claimTest;
    const claim = h.mapData.tiles[coord.y][coord.x];
    if (claim.territorialClaimNationId !== nation || claim.ownerId) throw new Error('Claim lost on game reload');
    if (!h.unitManager.getUnit(unitId)) throw new Error('Surveyor lost on game reload');
    const city = h.cityManager.getCitiesByOwner(nation).find(c => h.cityTerritorySystem.getClaimableTiles(c, h.mapData).some(t => h.gridSystem.getNeighbors(t,h.mapData).some(n => c.ownedTileCoords.some(o=>o.x===n.x&&o.y===n.y))));
    if (!city) throw new Error('No purchase city');
    const coord2 = h.cityTerritorySystem.getClaimableTiles(city,h.mapData).find(t => h.gridSystem.getNeighbors(t,h.mapData).some(n=>city.ownedTileCoords.some(o=>o.x===n.x&&o.y===n.y)));
    const tile = h.mapData.tiles[coord2.y][coord2.x];
    const foreign = h.nationManager.getAllNations().find(n=>n.id!==nation).id;
    tile.territorialClaimNationId = foreign;
    city.lastTilePurchaseTurn = undefined;
    h.cityTerritorySystem.setNextExpansionTile(city,tile,h.mapData);
    h.selectionManager.selectCity(city);
    h.openCity(city);
    h.cityView.buyTileRequestCallbacks.forEach(cb=>cb());
    h.purchaseTest = {city,tile,foreign,before:h.nationManager.getResources(nation).gold,events:h.historicalTimeline.getEvents().length};
    return { foreign, nation, cost:h.cityTerritorySystem.getGoldTilePurchaseCost(city) };
  }, setup);
  await page.waitForSelector('#diplomacy-modal');
  assert.match(await page.locator('#diplomacy-modal').innerText(), /This territory is claimed by .*diplomatic incident/);
  await page.locator('#diplomacy-modal button', { hasText: 'Cancel' }).click();
  assert.equal(await page.evaluate(() => {
    const h=window.claimTest, p=h.purchaseTest;
    return p.tile.territorialClaimNationId===p.foreign && h.nationManager.getResources(p.city.ownerId).gold===p.before;
  }), true);
  await page.evaluate(() => window.claimTest.cityView.buyTileRequestCallbacks.forEach(cb=>cb()));
  await page.locator('#diplomacy-modal button', { hasText: 'Buy Tile' }).click();
  const result = await page.evaluate(({ nation, cost }) => {
    const h=window.claimTest,p=h.purchaseTest;
    if(p.tile.territorialClaimNationId!==undefined || p.tile.ownerId!==nation) throw new Error('Purchase did not absorb claim');
    if(h.nationManager.getResources(nation).gold!==p.before-cost) throw new Error('Wrong purchase cost');
    if(!h.historicalTimeline.getEvents().slice(p.events).some(e=>e.text.includes('Territorial Claim Violated'))) throw new Error('Missing diplomatic history');
    h.territoryRenderer.flush();
    if(![...h.territoryRenderer.activeSegments.values()].some(s=>s.tileX===p.tile.x&&s.tileY===p.tile.y)) throw new Error('Absorbed claim did not gain normal territory border');
    return { claimSaveLoad:true,surveyorSaveLoad:true,purchaseCancel:true,purchaseConfirmed:true,history:true,rendering:true };
  },purchase);
  const claimsBefore = await page.evaluate(() => window.claimTest.mapData.tiles.flat()
    .filter(t=>t.territorialClaimNationId).map(t=>`${t.x},${t.y}:${t.territorialClaimNationId}`));
  const autoplay = await page.evaluate(() => window.__epochDiagnostics.startAutoplay(2, {continueAfterVictory:true}));
  assert.equal(autoplay.completedRounds, 2);
  assert.equal(await page.evaluate(({unitId,before}) => {
    const h=window.claimTest;
    return !!h.unitManager.getUnit(unitId) && h.mapData.tiles.flat().filter(t=>t.territorialClaimNationId)
      .every(t=>before.includes(`${t.x},${t.y}:${t.territorialClaimNationId}`));
  },{...setup,before:claimsBefore}),true,'autorun neither consumes Surveyors nor creates claims');
  await page.evaluate(async () => {
    const h=window.claimTest;
    const {SURVEYOR}=await import('/src/data/units.ts');
    const city=h.cityManager.getAllCities().find(c=>!h.nationManager.getNation(c.ownerId).isHuman);
    if(!city) throw new Error('No AI city after autorun');
    const item={kind:'unit',unitType:SURVEYOR};
    h.nationManager.getResources(city.ownerId).gold=100000;
    if(h.aiSystem.canBuildUnit(city.ownerId,SURVEYOR.id)) throw new Error('AI selects Surveyor production');
    const before=h.productionSystem.getQueue(city.id).length;
    h.productionSystem.enqueue(city.id,item);
    if(h.productionSystem.getQueue(city.id).length!==before) throw new Error('AI can enqueue Surveyor');
    h.productionSystem.restoreQueue(city.id,[{item,accumulated:10000}]);
    if(h.productionSystem.completeQueueEntry(city.id,0).ok) throw new Error('Restored AI Surveyor completes');
    const gold=h.nationManager.getResources(city.ownerId).gold;
    if(h.productionPurchaseSystem.purchase(city.id,0).ok) throw new Error('AI purchases Surveyor');
    if(h.nationManager.getResources(city.ownerId).gold!==gold) throw new Error('Blocked purchase costs Gold');
    const unit=h.unitManager.createUnit({type:SURVEYOR,ownerId:city.ownerId,tileX:city.tileX,tileY:city.tileY});
    if(h.territorialClaimSystem.claimTerritory(unit)) throw new Error('AI creates claim');
    h.productionSystem.restoreQueue(city.id,[]);
  });
  result.autorun = true;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
