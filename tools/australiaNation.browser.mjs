import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { AUSTRALIAN_LEADERS as leaders } from '../src/data/australianLeaders.ts';

const base = process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/editor.html`);
  await page.waitForFunction(() => typeof window.EpochLeaderEditor?.open === 'function');
  await page.evaluate(ids => {
    const data = buildBlankScenario('Alternative governments', ids, 64, 64, 32, null);
    startEditor({ label: 'Alternative governments', file: 'alternative-governments.json', isNew: true }, data, null);
  }, [...new Set(leaders.map(l => l.nationId))]);
  await page.getByRole('button', { name: 'Leaders & AI', exact: true }).click();
  const dialog = page.locator('dialog.le-dialog');
  for (const leader of leaders) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias));
    assert.equal(await dialog.getByLabel('Opportunism', { exact: true }).isChecked(), leader.opportunism);
    const national = dialog.locator('details[data-section="Scenario Nation & Inherited Rules"]');
    if (await national.getAttribute('open') === null) await national.locator('summary').click();
    await dialog.getByRole('button', { name: 'Use this leader for this nation', exact: true }).click();
    assert.ok((await dialog.textContent()).includes('Scenario selection: ' + leader.name));
  }
  await dialog.getByRole('button', { name: 'Apply to Scenario', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const output = await page.evaluate(() => buildScenarioOutput());
  assert.equal(output.nations.find(n => n.id === 'nation_australia').leaderId, 'leader_bob_hawke');
  await page.evaluate(data => window.EpochLeaderEditor.open(JSON.parse(JSON.stringify(data)), () => {}), output);
  for (const leader of leaders) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias));
    assert.ok((await dialog.textContent()).includes('Scenario selection: Bob Hawke'));
  }
  await dialog.getByRole('button', { name: 'Discard / Close', exact: true }).click();
  for (const leader of leaders) {
    for (const [path, expected] of [[leader.image, [416, 416]], [leader.image.replace('.png', '-room.webp'), [2048, 872]]]) {
      const dimensions = await page.evaluate(async path => {
        const img = new Image(); img.src = path; await img.decode(); return [img.naturalWidth, img.naturalHeight];
      }, path);
      assert.deepEqual(dimensions, expected);
    }
    const audio = await page.evaluate(async id => {
      const manifest = await (await fetch('/assets/sounds/manifest.json')).json();
      const tracks = manifest.playlists[id];
      return Promise.all(tracks.map(async path => (await fetch(path)).status));
    }, leader.nationId);
    assert.ok(audio.length > 0 && audio.every(status => status === 200));
  }
  await page.goto(`${base}/?epochDiagnostics=1`);
  await page.locator('#mm-new-game-btn').click({ timeout: 120000 });
  const randomOption = await page.locator('#mm-map-select optgroup[label="Random Scenarios"] option').first().getAttribute('value');
  await page.locator('#mm-map-select').selectOption(randomOption);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  for (const id of ['nation_australia', 'nation_england']) await page.locator(`#random-scenario-nations input[value="${id}"]`).check();
  await page.locator('#random-scenario-size').selectOption('small');
  await page.locator('#random-scenario-seed').fill('2026');
  await page.locator('#random-scenario-generate').click();
  const card = page.locator('.mm-nation-card[data-nation-id="nation_australia"]');
  assert.equal(await card.locator('.mm-card-leader').textContent(), 'John Howard');
  for (const leader of [leaders[1], leaders[0]]) {
    await card.locator('.mm-nation-details-btn').click();
    const details = page.locator('.mm-nation-details-dialog');
    await details.locator('select').first().selectOption(leader.id);
    assert.equal(await details.locator('.mm-nd-leader-portrait').getAttribute('src'), leader.image);
    await details.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await card.locator('.mm-card-leader').textContent(), leader.name);
  }
  await card.click();
  await page.locator('#mm-start-btn').click();
  await page.waitForFunction(() => !!window.__epochDiagnostics?.getStateSummary, null, { timeout: 120000 });
  const state = await page.evaluate(async () => {
    const roster = await import('/src/data/leaders.ts');
    return { leader: roster.getLeaderByNationId('nation_australia').id, summary: window.__epochDiagnostics.getStateSummary() };
  });
  assert.equal(state.leader, 'leader_john_howard');
  assert.ok(state.summary.nations.some(n => n.id === 'nation_australia' || n.nationId === 'nation_australia'));
  const autoplay = await page.evaluate(() => window.__epochDiagnostics.startAutoplay(1));
  assert.ok(autoplay.completedRounds >= 1);
  assert.deepEqual(errors, []);
  console.log('Australia editor leader selection, export/import, portraits, rooms, shared audio, game setup and one gameplay round verified.');
} finally { await browser.close(); }
