// Run with Vite serving the game. EPOCH_URL and CHROME_PATH can override defaults.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = process.env.EPOCH_URL ?? 'http://127.0.0.1:5173';
  const menu = async () => { await page.goto(url); await page.waitForFunction(() => !!window.__epochDiagnostics?.startNewGame); };
  const ready = async () => { await page.waitForFunction(() => !!window.__epochDiagnostics?.getSaveState); };
  const save = () => page.evaluate(() => { const state = window.__epochDiagnostics.getSaveState(); delete state.savedAt; return state; });
  const open = async () => {
    await page.keyboard.press('Control+Shift+C');
    const input = page.locator('input:visible').last(); await input.fill('history'); await input.press('Enter');
    await page.waitForSelector('#epoch-history-viewer');
  };
  const close = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('#epoch-history-viewer', { state: 'detached' }); await page.keyboard.press('Escape'); };
  await menu(); await page.evaluate(() => window.__epochDiagnostics.startNewGame({})); await ready();
  const initial = await save(); assert.equal(initial.historicalMap.snapshots[0].round, 1);
  await open(); await page.waitForTimeout(500); assert.deepEqual(await save(), initial); await close();
  await page.evaluate(() => window.__epochDiagnostics.startAutoplay(16));
  const accumulated = await save(); assert.ok(accumulated.historicalMap.snapshots.length > 3);
  assert.ok(accumulated.historicalTimeline.length > 0);
  await open();
  const viewer = page.locator('#epoch-history-viewer'); const slider = viewer.locator('input[type=range]');
  await viewer.getByRole('combobox', {name:'Playback speed'}).selectOption('10');
  await viewer.getByRole('combobox', {name:'Playback speed'}).selectOption('20');
  await slider.fill('1'); await slider.dispatchEvent('input');
  await viewer.getByRole('button', {name:'Next',exact:true}).click();
  await viewer.getByRole('button', {name:'Previous',exact:true}).click();
  await viewer.getByRole('button', {name:'Play',exact:true}).click();
  await viewer.getByRole('button', {name:'Pause',exact:true}).click();
  await slider.fill(await slider.getAttribute('max')); await slider.dispatchEvent('input');
  await page.screenshot({path: '/tmp/epoch-history-accumulated.png'});
  assert.deepEqual(await save(), accumulated); await close();
  // Opening during an autorun suspends its timer, then resumes the same run.
  await page.evaluate(() => { window.__historyRunDone = false; window.__epochDiagnostics.startAutoplay(10).then(() => { window.__historyRunDone = true; }); });
  await open(); const paused = await save(); await page.waitForTimeout(700); assert.deepEqual(await save(), paused); await close();
  await page.waitForFunction(() => window.__historyRunDone === true);
  const saved = await save();
  await menu();
  const loaded = await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), saved); assert.equal(loaded.ok, true); await ready();
  const restored = await save();
  assert.deepEqual(restored.historicalMap.snapshots.slice(0, saved.historicalMap.snapshots.length), saved.historicalMap.snapshots);
  assert.deepEqual(restored.worldHistoryMilestones, saved.worldHistoryMilestones);
  // Optional map corruption must not stop the game loading.
  await menu(); const corrupt = {...saved, historicalMap: {version:1, snapshots:[null]}};
  assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), corrupt)).ok, true); await ready();
  assert.equal((await save()).historicalMap.snapshots[0].round, saved.turn.currentRound);
  await open(); await close();
  // A high culture total exercises the real victory path without playing hundreds of rounds.
  await menu(); const winning = structuredClone(saved);
  winning.nations.find(n => n.id === winning.humanNationId).culture = 10000000;
  winning.victoryConditions.cultural = true;
  assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), winning)).ok, true); await ready();
  await page.evaluate(() => window.__epochDiagnostics.startAutoplay(1));
  assert.ok((await page.evaluate(() => window.__epochDiagnostics.getStateSummary())).victory);
  await page.screenshot({path: '/tmp/epoch-history-victory.png'});
  await page.getByRole('button', {name:'History / Timelapse',exact:true}).click();
  await page.waitForSelector('#epoch-history-viewer');
  assert.ok((await save()).newspaper.issues.some(issue => issue.issueType === 'victory'));
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('History browser checks passed: initial/accumulated maps, controls, read-only viewing, autoplay pause/resume, save/load, corrupt legacy fallback, victory replay action.');
} finally { await browser.close(); }
