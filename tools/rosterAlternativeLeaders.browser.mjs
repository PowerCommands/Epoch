import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ROSTER_ALTERNATIVE_LEADERS as leaders } from '../src/data/rosterAlternativeLeaders.ts';
import { getDefaultLeaderByNationId } from '../src/data/leaders.ts';

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
  }, leaders.map(l => l.nationId));
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
  for (const leader of leaders) assert.equal(output.nations.find(n => n.id === leader.nationId).leaderId, leader.id);
  await page.evaluate(data => window.EpochLeaderEditor.open(JSON.parse(JSON.stringify(data)), () => {}), output);
  for (const leader of leaders) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias));
    assert.ok((await dialog.textContent()).includes('Scenario selection: ' + leader.name));
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
      const tracks = manifest.playlists[id] ?? (id === 'nation_mali_empire' ? manifest.playlists.start : undefined);
      return Promise.all(tracks.map(async path => (await fetch(path)).status));
    }, leader.nationId);
    assert.ok(audio.length > 0 && audio.every(status => status === 200));
  }
  console.log('27 alternatives passed editor selection/export/import and 54 asset decodes; all national audio URLs returned HTTP 200.');
  for (let offset = 0; offset < leaders.length; offset += 9) {
    const batch = leaders.slice(offset, offset + 9);
    await page.goto(`${base}/?epochDiagnostics=1`);
    await page.locator('#mm-new-game-btn').click({ timeout: 120000 });
    const option = await page.locator('#mm-map-select optgroup[label="Random Scenarios"] option').first().getAttribute('value');
    await page.locator('#mm-map-select').selectOption(option);
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    for (const leader of batch) await page.locator(`#random-scenario-nations input[value="${leader.nationId}"]`).check();
    await page.locator('#random-scenario-size').selectOption('medium');
    await page.locator('#random-scenario-seed').fill(String(9400 + offset));
    await page.locator('#random-scenario-generate').click();
    for (const leader of batch) {
      const card = page.locator(`.mm-nation-card[data-nation-id="${leader.nationId}"]`);
      const original = getDefaultLeaderByNationId(leader.nationId);
      assert.equal(await card.locator('.mm-card-leader').textContent(), original.name);
      await card.locator('.mm-nation-details-btn').click();
      const details = page.locator('.mm-nation-details-dialog');
      const select = details.locator('select').first();
      assert.equal(await select.inputValue(), original.id);
      await select.selectOption(leader.id);
      assert.equal(await details.locator('.mm-nd-leader-portrait').getAttribute('src'), leader.image);
      await details.getByRole('button', {name: 'Done', exact: true}).click();
      assert.equal(await card.locator('.mm-card-leader').textContent(), leader.name);
    }
    await page.locator(`.mm-nation-card[data-nation-id="${batch[0].nationId}"]`).click();
    await page.locator('#mm-start-btn').click();
    await page.waitForFunction(() => !!window.__epochDiagnostics?.getStateSummary, null, {timeout: 120000});
    const verify = async () => {
      const actual = await page.evaluate(async ids => {
        const roster = await import('/src/data/leaders.ts');
        return ids.map(id => ({id: roster.getLeaderByNationId(id)?.id, personality: roster.getLeaderPersonalityByNationId(id)}));
      }, batch.map(l => l.nationId));
      assert.deepEqual(actual, batch.map(l => ({id: l.id, personality: l.aiPersonality})));
      const summary = await page.evaluate(() => window.__epochDiagnostics.getStateSummary());
      for (const leader of batch) assert.ok(summary.nations.some(n => n.id === leader.nationId || n.nationId === leader.nationId));
    };
    await verify();
    const autoplay = await page.evaluate(() => window.__epochDiagnostics.startAutoplay(1));
    assert.ok(autoplay.completedRounds >= 1);
    await page.keyboard.press('Control+s');
    await page.locator('.save-game-input').waitFor({state: 'visible'});
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.save-game-input').press('Enter');
    const download = await downloadPromise;
    const saved = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    for (const leader of batch) {
      assert.equal(saved.leaderSelections[leader.nationId], leader.id);
      assert.ok(saved.nations.some(n => n.id === leader.nationId));
    }
    await page.goto(`${base}/?epochDiagnostics=1`);
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#mm-load-btn').click({timeout: 120000});
    await (await chooserPromise).setFiles({name: 'alternative-governments-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved))});
    await page.waitForFunction(() => !!window.__epochDiagnostics?.getStateSummary, null, {timeout: 120000});
    await verify();
    console.log(`Batch ${offset / 9 + 1}: nine alternatives selected through Game Setup, ran a round, saved and loaded with matching identities and personalities.`);
  }
  assert.deepEqual(errors, []);
  console.log('All alternative-leader browser checks passed.');
} finally { await browser.close(); }
