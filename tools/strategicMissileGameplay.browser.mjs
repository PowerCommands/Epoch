/** Real GameScene smoke: EPOCH_URL=http://127.0.0.1:5174 node tools/strategicMissileGameplay.browser.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const save = process.env.EPOCH_SAVE
  ? JSON.parse(await fs.readFile(process.env.EPOCH_SAVE, 'utf8'))
  : { mapKey: 'map_maritime_expansion', humanNationId: 'nation_mongolia',
    activeNationIds: ['nation_mongolia', 'nation_england', 'nation_china', 'nation_india', 'nation_france'] };
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-strategic-gameplay';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => localStorage.setItem('epoch.tutorialDontShowAgain', 'true'));
  // Parallel implementation work must not let Vite HMR restart this test game.
  await page.routeWebSocket('**/*', socket => socket.close());
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  // Expose existing instances in the test response only; shipping code gets no new globals.
  await page.route('**/src/scenes/GameScene.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = 'diagnosticsWindow.__epochDiagnostics = {';
    assert.ok(source.includes(marker));
    await route.fulfill({ response, body: source.replace(marker, `window.strategicGameplay = {
      scene: this, nationManager, cityManager, unitManager, productionSystem, resourceAccessSystem,
      combatSystem, diplomacyManager, researchSystem, mapData, gridSystem, tileMap, turnManager,
      cityView, rightPanel, selectionManager, buildingPlacementSystem, worldInputGate, foundCitySystem, worldCouncilSystem, hudLayer,
      openCity: city => { selectionManager.clearSelection(); selectionManager.selectCity(city); }, closeCity: () => closeOpenCityView(),
      refreshCity: () => refreshOpenCityView(),
      placeAt: coord => { const world = tileMap.tileToWorld(coord.x, coord.y), camera = this.cameras.main;
        const screen = camera.matrixCombined.transformPoint(world.x, world.y);
        onCityViewPointerDown({ button: 0, x: screen.x, y: screen.y }); }
    }; ${marker}`) });
  });
  await page.goto(`${base}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90_000 });
  const loaded = await page.evaluate(saved => saved.version === 7
    ? window.__epochDiagnostics.startSavedGame(saved)
    : window.__epochDiagnostics.startNewGame({ scenario: saved.mapKey, humanNationId: saved.humanNationId, activeNationIds: saved.activeNationIds }), save);
  assert.equal(loaded.ok, true, loaded.error);
  await page.waitForFunction(() => window.strategicGameplay && window.__epochDiagnostics?.getSaveState, undefined, { timeout: 90_000 });
  const fixture = await page.evaluate(async () => {
    const g = window.strategicGameplay;
    const { ALL_TECHNOLOGIES } = await import('/src/data/technologies.ts');
    const human = g.nationManager.getAllNations().find(n => n.isHuman);
    const currentIndex = g.turnManager.getCurrentTurnIndex();
    for (const [index, nation] of g.nationManager.getAllNations().entries()) {
      if (g.cityManager.getCitiesByOwner(nation.id).length) continue;
      g.turnManager.restoreTurnState(1, index);
      const settler = g.unitManager.getUnitsByOwner(nation.id).find(unit => unit.unitType.canFound && g.foundCitySystem.canFound(unit));
      if (settler) g.foundCitySystem.foundCity(settler);
    }
    g.turnManager.restoreTurnState(1, currentIndex);
    human.researchedTechIds = ALL_TECHNOLOGIES.map(t => t.id);
    g.nationManager.getResources(human.id).gold = 1_000_000;
    for (const nation of g.nationManager.getAllNations()) if (nation.id !== human.id) {
      g.diplomacyManager.restoreState(human.id, nation.id, { ...g.diplomacyManager.getRelation(human.id, nation.id), state: 'WAR', peaceTreatyUntilTurn: null });
      g.nationManager.getResources(nation.id).gold = 0;
    }
    const city = g.cityManager.getCitiesByOwner(human.id)[0];
    g.productionSystem.clearAllQueues();
    const uranium = g.mapData.tiles[city.tileY][city.tileX];
    uranium.resourceId = 'uranium'; uranium.resourceRevealedByCheat = true;
    g.resourceAccessSystem.invalidateResourceIndex();
    if (!g.buildingPlacementSystem.getValidPlacementCoords(city, 'nuclear_silo', g.mapData).length) {
      const site = g.gridSystem.getTilesInRange({ x: city.tileX, y: city.tileY }, 4, g.mapData, { includeCenter: false })
        .find(t => !t.ownerId && !t.urbanSlot && !t.buildingId && !t.improvementId && !t.resourceId && ['plains', 'forest', 'meadow', 'desert'].includes(t.type));
      if (site) { site.ownerId = human.id; city.ownedTileCoords.push({ x: site.x, y: site.y }); }
    }
    const padCoords = g.buildingPlacementSystem.getValidPlacementCoords(city, 'nuclear_silo', g.mapData);
    if (!padCoords.length) throw new Error('Browser fixture needs one free Launch Pad tile');
    const target = g.cityManager.getAllCities().filter(c => c.ownerId !== human.id)
      .sort((a, b) => g.gridSystem.getDistance({ x: b.tileX, y: b.tileY }, padCoords[0]) - g.gridSystem.getDistance({ x: a.tileX, y: a.tileY }, padCoords[0]))[0];
    g.testEvents = [];
    g.combatSystem.strategicWeapons.onDetonation(event => g.testEvents.push(event));
    g.openCity(city);
    return { humanId: human.id, cityId: city.id, pad: padCoords[0], target: { x: target.tileX, y: target.tileY }, targetCityId: target.id };
  });

  async function addFromCityView(name, accordion) {
    await page.evaluate(id => {
      const g = window.strategicGameplay;
      if (g.cityView.getOpenCityId() !== id) g.openCity(g.cityManager.getCity(id));
      g.refreshCity();
    }, fixture.cityId);
    await page.getByRole('button', { name: '⚙️ Production', exact: true }).click();
    const header = page.locator('.city-view-accordion-header').filter({ hasText: accordion });
    if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
    const card = page.locator('.city-view-production-button').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });
    assert.equal(await card.getAttribute('aria-disabled'), 'false', `${name}: enabled in real CityView`);
    await card.click();
    await page.locator('.city-view-tooltip').getByRole('button', { name: 'Add to queue', exact: true }).click();
  }
  await addFromCityView('Missile Launch Pad', 'Buildings');
  assert.equal(await page.evaluate(() => window.strategicGameplay.buildingPlacementSystem.isActive()), true);
  await page.evaluate(coord => window.strategicGameplay.placeAt(coord), fixture.pad);
  const padComplete = await page.evaluate(id => window.strategicGameplay.productionSystem.completeCurrentProduction(id), fixture.cityId);
  assert.equal(padComplete.kind, 'completed');
  assert.equal(padComplete.item.buildingType.id, 'nuclear_silo');
  console.log('PASS: CityView Launch Pad placement and completion.');

  for (const name of ['ICBM', 'ICBM', 'Nuclear Warhead']) {
    await addFromCityView(name, 'Units & Strategic Weapons');
    assert.equal((await page.evaluate(id => window.strategicGameplay.productionSystem.completeCurrentProduction(id), fixture.cityId)).kind, 'completed');
  }
  await page.evaluate(({ pad }) => {
    const g = window.strategicGameplay;
    g.closeCity();
    const world = g.tileMap.tileToWorld(pad.x, pad.y);
    g.scene.cameraController.focusOn(world.x, world.y, 1);
  }, fixture);
  await page.waitForTimeout(100);
  await page.mouse.click(720, 500);
  const detailsPosition = await page.evaluate(() => {
    const bounds = window.strategicGameplay.hudLayer.mapLensToggle.detailsHitArea.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.click(detailsPosition.x, detailsPosition.y);
  await page.waitForFunction(() => window.strategicGameplay.scene.rightSidebarPanel.presentation === 'dialog'
    && !window.strategicGameplay.scene.rightSidebarPanel.collapsed);
  const mountPosition = await page.evaluate(() => {
    const panel = window.strategicGameplay.scene.rightSidebarPanel;
    const button = panel.contentButtons.find(button => button.row.text === 'Mount Nuclear Warhead' && !button.row.disabled);
    if (!button) throw new Error('Rendered pad details must offer mounting the produced warhead');
    panel.scrollOffset = Math.min(panel.maxScroll, Math.max(0, button.baseY - panel.scrollableContentTop - 180));
    panel.positionContentObjects();
    const bounds = button.hitArea.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.click(mountPosition.x, mountPosition.y);
  await page.waitForFunction(({ pad }) => window.strategicGameplay.combatSystem.strategicWeapons.storage
    .getStoredMissiles(pad.x, pad.y).some(missile => missile.nuclearArmed), fixture);
  const armedState = await page.evaluate(({ pad, humanId }) => {
    const g = window.strategicGameplay;
    const content = g.rightPanel.getDetailsContent();
    const rows = [...(content.rows ?? []), ...(content.sections ?? []).flatMap(section => section.rows ?? [])];
    const missiles = g.combatSystem.strategicWeapons.storage.getStoredMissiles(pad.x, pad.y);
    return { count: missiles.length, stock: g.nationManager.getNation(humanId).nuclearWarheads,
      armedId: missiles.find(m => m.nuclearArmed)?.id, conventionalId: missiles.find(m => !m.nuclearArmed)?.id,
      text: rows.map(row => row.text).filter(Boolean).join('\n') };
  }, fixture);
  assert.equal(armedState.count, 2);
  assert.equal(armedState.stock, 0);
  assert.ok(armedState.armedId && armedState.conventionalId);
  assert.match(armedState.text, /Missile Capacity: 2 \/ 4/);
  assert.match(armedState.text, /ICBM · Nuclear armed/);
  assert.match(armedState.text, /ICBM · Conventional/);
  assert.equal(await page.evaluate(() => window.strategicGameplay.scene.tutorialWizard?.isActive() ?? false), false);
  await page.waitForTimeout(150);
  console.log('PASS: CityView ICBM/warhead production and pad mounting action.');
  await page.screenshot({ path: `${output}/armed-pad.png` });
  if (process.env.EPOCH_INVENTORY_ONLY === '1') {
    assert.deepEqual(errors, []);
    console.log('PASS: normal pad click, Details control, visible mixed inventory, and rendered Mount button.');
    await browser.close();
    process.exit(0);
  }
  await page.evaluate(() => window.strategicGameplay.scene.rightSidebarPanel.closeDialog());

  // Restart the full GameScene, exercising real save restoration and listener setup.
  const saved = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  await page.evaluate(saved => {
    const scene = window.strategicGameplay.scene;
    window.strategicGameplay = null;
    scene.scene.start('GameScene', { mapKey: saved.mapKey, humanNationId: saved.humanNationId,
      activeNationIds: saved.activeNationIds, gameSpeedId: saved.gameSpeedId, resourceAbundance: 'normal', savedState: saved });
  }, saved);
  await page.waitForFunction(() => window.strategicGameplay, undefined, { timeout: 90_000 });
  const restored = await page.evaluate(({ armedId, conventionalId }) => {
    const g = window.strategicGameplay;
    g.testEvents = []; g.combatSystem.strategicWeapons.onDetonation(event => g.testEvents.push(event));
    return { armed: g.unitManager.getUnit(armedId).nuclearArmed, conventional: g.unitManager.getUnit(conventionalId).nuclearArmed,
      assignment: g.unitManager.getUnit(armedId).missileLaunchPad };
  }, armedState);
  assert.equal(restored.armed, true);
  assert.equal(restored.conventional, false);
  assert.deepEqual(restored.assignment, fixture.pad);
  console.log('PASS: full GameScene save/reload preserves mixed missile inventory.');

  async function launchByWorldClick(id) {
    const preview = await page.evaluate(({ id, target }) => window.__epochDiagnostics.prepareStrategicStrike(id, target.x, target.y), { id, target: fixture.target });
    assert.equal(preview.reason, undefined);
    await page.waitForTimeout(100);
    await page.mouse.click(720, 500);
    await page.waitForFunction(id => !window.strategicGameplay.unitManager.getUnit(id), id, { timeout: 15_000 });
  }
  await launchByWorldClick(armedState.conventionalId);
  const conventional = await page.evaluate(target => {
    const g = window.strategicGameplay;
    return { event: g.testEvents.at(-1), terrain: g.mapData.tiles[target.y][target.x].type,
      nuclearEvents: window.__epochDiagnostics.getSaveState().historicalTimeline?.filter(e => e.type === 'nuclearAttack').length ?? 0 };
  }, fixture.target);
  assert.equal(conventional.event.nuclear, false);
  assert.equal(conventional.event.contaminatedTiles, 0);
  assert.notEqual(conventional.terrain, 'nuclear_waste');
  assert.equal(conventional.nuclearEvents, 0);
  await page.waitForFunction(() => !window.strategicGameplay.worldInputGate.isWorldInteractionBlocked(), undefined, { timeout: 25_000 });
  await launchByWorldClick(armedState.armedId);
  const nuclear = await page.evaluate(target => {
    const g = window.strategicGameplay;
    return { events: g.testEvents, terrain: g.mapData.tiles[target.y][target.x].type,
      nuclearEvents: window.__epochDiagnostics.getSaveState().historicalTimeline?.filter(e => e.type === 'nuclearAttack').length ?? 0 };
  }, fixture.target);
  assert.equal(nuclear.events.length, 2);
  assert.equal(nuclear.events[1].nuclear, true);
  assert.ok(nuclear.events[1].contaminatedTiles > 0);
  assert.equal(nuclear.terrain, 'nuclear_waste');
  assert.equal(nuclear.nuclearEvents, 1);
  // An observer's emergency ballot is authoritative immediately, but its modal
  // waits for the nuclear cinematic to release the camera.
  const pending = await page.evaluate(() => {
    const g = window.strategicGameplay;
    const human = g.nationManager.getAllNations().find(n => n.isHuman);
    const others = g.nationManager.getAllNations().filter(n => n.id !== human.id).slice(0, 2);
    const ids = [human.id, ...others.map(n => n.id)];
    const city = g.cityManager.getCitiesByOwner(human.id)[0];
    g.worldCouncilSystem.restore({ organizationKind: 'un', foundingCityId: city.id, foundingNationId: human.id, foundingTurn: 1,
      constructionStartedTurn: 1, constructionTurnsRemaining: 0, status: 'active', memberNationIds: ids,
      members: ids.map(nationId => ({ nationId, goldContributed: 0, scienceContributionPercent: 0, cultureContributionPercent: 0,
        diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0, diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0,
        diplomacyScoreFromGold: 0, diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0 })),
      lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 1000, meetings: [], nextMeetingId: 1, enactedResolutions: [] });
    g.worldCouncilSystem.triggerEmergencyMeeting(g.turnManager.getCurrentRound(), {
      eventType: 'nuclearAttack', aggressorNationId: others[0].id, targetNationId: others[1].id,
    });
    g.hudLayer.refresh();
    return { pending: !!g.worldCouncilSystem.getPendingHumanVoteMeeting(), showing: g.hudLayer.worldCouncilSessionDialog.isShowing() };
  });
  assert.equal(pending.pending, true);
  assert.equal(pending.showing, false, 'UN modal defers while the camera presents nuclear flight');
  await page.waitForTimeout(9500);
  await page.screenshot({ path: `${output}/nuclear-globe.png` });
  assert.equal(await page.locator('.wcs-overlay').count(), 0, 'Emergency ballot must not obscure the globe impact');
  await page.getByRole('button', { name: 'Skip · Esc', exact: true }).click();
  await page.waitForFunction(() => window.strategicGameplay.hudLayer.worldCouncilSessionDialog.isShowing(), undefined, { timeout: 10_000 });
  await page.screenshot({ path: `${output}/deferred-un-ballot.png` });
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/result.json`, JSON.stringify({ fixture, armedState, conventional, nuclear }, null, 2));
  console.log('PASS: real CityView placement and production, pad arming, full save reload, conventional/global nuclear map clicks, single strike events, and deferred UN ballot.');
} catch (error) {
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
