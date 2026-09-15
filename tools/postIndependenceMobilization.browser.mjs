// Run against Vite: EPOCH_URL=http://127.0.0.1:5189 node tools/postIndependenceMobilization.browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const url = process.env.EPOCH_URL ?? 'http://127.0.0.1:5189';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/editor.html`);
  await page.waitForFunction(() => typeof buildBlankScenario === 'function');
  await page.evaluate(() => {
    const data = buildBlankScenario('Independence test', ['england', 'mongolia'], 8, 8, 32, null);
    startEditor({ label: 'Independence test', file: 'independence-test.json', isNew: true }, data, null);
    openScenarioDetails();
  });
  assert.equal(await page.locator('#sd-independence-cooldown').inputValue(), '100');
  await page.locator('#sd-independence-cooldown').fill('37');
  await page.evaluate(() => saveScenarioDetails());
  const authored = await page.evaluate(() => buildScenarioOutput());
  assert.equal(authored.meta.independenceCooldownTurns, 37);
  await page.evaluate(data => {
    startEditor({ label: 'Reload', file: 'independence-test.json', isNew: false }, data, null);
    openScenarioDetails();
  }, authored);
  assert.equal(await page.locator('#sd-independence-cooldown').inputValue(), '37');
  console.log('Scenario editor default, authoring, export and reload passed.');

  await page.goto(url);
  await page.waitForFunction(() => !!window.__epochDiagnostics?.startNewGame);
  const result = await page.evaluate(() => window.__epochDiagnostics.startNewGame({ scenario: 'map_astra_europa', activeNationIds: ['nation_england', 'nation_france'] }));
  assert.equal(result.ok, true);
  await page.waitForFunction(() => !!window.__epochDiagnostics?.getSaveState, null, { timeout: 120000 });
  const saved = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(saved.independenceCooldownTurns, 100);
  const [master, freed] = saved.nations.map(n => n.id);
  assert.ok(freed, 'scenario has at least two nations');
  saved.independenceCooldownTurns = 3;
  const shape = await page.evaluate(async ({ master, freed }) => {
    const { DiplomacyManager } = await import('/src/systems/DiplomacyManager.ts');
    const { SaveLoadService } = await import('/src/systems/SaveLoadService.ts');
    const dm = new DiplomacyManager();
    dm.recognizePurchasedIndependence(freed, master);
    return SaveLoadService.serializeDiplomacy(dm)[0];
  }, { master, freed });
  const round = saved.turn.currentRound;
  shape.independenceSettlement = { nationId: freed, formerMasterId: master, startedTurn: round, expiresTurn: round + 3 };
  saved.diplomacy = [shape];
  await page.goto(url);
  await page.waitForFunction(() => !!window.__epochDiagnostics?.startSavedGame);
  assert.equal((await page.evaluate(state => window.__epochDiagnostics.startSavedGame(state), saved)).ok, true);
  await page.waitForFunction(() => !!window.__epochDiagnostics?.getSaveState, null, { timeout: 120000 });
  const restored = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(restored.independenceCooldownTurns, 3);
  assert.deepEqual(restored.diplomacy.find(d => d.independenceSettlement)?.independenceSettlement, shape.independenceSettlement);
  await page.evaluate(() => window.__epochDiagnostics.startAutoplay(4));
  const expired = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(expired.diplomacy.some(d => d.independenceSettlement), false);
  assert.deepEqual(errors, []);
  console.log('Game save/load, AI turns and settlement expiry passed.');
} finally { await browser.close(); }
