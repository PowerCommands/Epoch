import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { getDefaultLeaderByNationId } from '../src/data/leaders.ts';

const ids = ['nation_belarus', 'nation_yugoslavia', 'nation_czechoslovakia'];
const leaders = ids.map(getDefaultLeaderByNationId);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/editor.html`);
  await page.waitForFunction(() => typeof window.EpochLeaderEditor?.open === 'function');
  await page.evaluate(ids => {
    const data = buildBlankScenario('Three European nations', ids, 8, 8, 32, null);
    startEditor({ label: 'Three European nations', file: 'three-european-nations.json', isNew: true }, data, null);
  }, ids);
  await page.getByRole('button', { name: 'Leaders & AI', exact: true }).click();
  const dialog = page.locator('dialog.le-dialog');
  for (const leader of leaders) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias));
    assert.equal(await dialog.getByLabel('Opportunism', { exact: true }).isChecked(), false);
    const national = dialog.locator('details[data-section="Scenario Nation & Inherited Rules"]');
    if (await national.getAttribute('open') === null) await national.locator('summary').click();
    await dialog.getByRole('button', { name: 'Use this leader for this nation', exact: true }).click();
    assert.ok((await dialog.textContent()).includes('Scenario selection: ' + leader.name));
  }
  await dialog.getByRole('button', { name: 'Apply to Scenario', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const output = await page.evaluate(() => buildScenarioOutput());
  for (const leader of leaders) assert.equal(output.nations.find(n => n.id === leader.nationId).leaderId ?? getDefaultLeaderByNationId(leader.nationId)?.id, leader.id);
  await page.evaluate(data => window.EpochLeaderEditor.open(JSON.parse(JSON.stringify(data)), () => {}), output);
  for (const leader of leaders) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias));
  }
  await dialog.getByRole('button', { name: 'Discard / Close', exact: true }).click();
  for (const leader of leaders) {
    await page.evaluate(async leader => {
      const { NationDetailsDialog } = await import('/src/ui/NationDetailsDialog.ts');
      const roster = await import('/src/data/leaders.ts');
      const { getNationDefinitionById } = await import('/src/data/nations.ts');
      NationDetailsDialog.show({
        nation: { ...getNationDefinitionById(leader.nationId), isHuman: true, startTerritoryCenter: { q: 0, r: 0 } },
        leaders: roster.getLeadersByNationId(leader.nationId), selectedLeaderId: roster.getDefaultLeaderByNationId(leader.nationId)?.id,
        onSave: (_, id) => { roster.setActiveLeaderSelections({ [leader.nationId]: id }); window.selectedSetupLeader = roster.getLeaderByNationId(leader.nationId)?.id; },
      });
    }, leader);
    const setup = page.locator('.mm-nation-details-dialog');
    assert.equal(await setup.locator('select').first().inputValue(), leader.id);
    assert.equal(await setup.locator('.mm-nd-leader-portrait').getAttribute('src'), leader.image);
    await setup.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.evaluate(() => window.selectedSetupLeader), leader.id);
    for (const [path, width, height] of [[leader.image, 416, 416], [leader.image.replace('.png', '-room.webp'), 2048, 872]]) {
      const dimensions = await page.evaluate(async path => {
        const img = new Image(); img.src = path; await img.decode(); return [img.naturalWidth, img.naturalHeight];
      }, path);
      assert.deepEqual(dimensions, [width, height]);
    }
    const audio = await page.evaluate(async id => {
      const manifest = await (await fetch('/assets/sounds/manifest.json')).json();
      return Promise.all(manifest.playlists[id].map(async path => (await fetch(path)).status));
    }, leader.nationId);
    assert.deepEqual(audio, [200, 200]);
  }
  for (const id of ids) {
    await page.evaluate(async id => {
      const { SetupMusicManager } = await import('/src/systems/SetupMusicManager.ts');
      const manifest = await (await fetch('/assets/sounds/manifest.json')).json();
      window.expectedTracks = manifest.playlists[id];
      window.nationMusic = new SetupMusicManager();
      window.nationMusic.setEnabled(true);
      window.nationMusic.playPlaylist(id);
    }, id);
    await page.waitForFunction(id => window.nationMusic.getCurrentPlaylistKey() === id && window.nationMusic.audio?.currentTime > 0 && !window.nationMusic.audio.paused, id);
    for (const index of [0, 1, 0]) {
      await page.waitForFunction(index => window.nationMusic.audio?.src.endsWith(window.expectedTracks[index]) && window.nationMusic.audio.currentTime > 0, index);
      await page.evaluate(() => window.nationMusic.audio.dispatchEvent(new Event('ended')));
    }
    await page.evaluate(() => window.nationMusic.setEnabled(false));
  }
  for (const leader of leaders) {
    await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/?epochDiagnostics=1`);
    await page.locator('#mm-new-game-btn').click({ timeout: 120000 });
    const randomOption = await page.locator('#mm-map-select optgroup[label="Random Scenarios"] option').first().getAttribute('value');
    await page.locator('#mm-map-select').selectOption(randomOption);
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    for (const id of ids) await page.locator(`#random-scenario-nations input[value="${id}"]`).check();
    await page.locator('#random-scenario-size').selectOption('small');
    await page.locator('#random-scenario-seed').fill('2026');
    await page.locator('#random-scenario-generate').click();
    const card = page.locator(`.mm-nation-card[data-nation-id="${leader.nationId}"]`);
    assert.equal(await card.locator('.mm-card-leader').textContent(), leader.name);
    await card.click();
    assert.ok((await card.getAttribute('class')).includes('selected-player'));
    await page.locator('#mm-start-btn').click();
    await page.waitForFunction(() => !!window.__epochDiagnostics?.getStateSummary, null, { timeout: 120000 });
    const summary = await page.evaluate(() => window.__epochDiagnostics.getStateSummary());
    for (const id of ids) assert.ok(summary.nations.some(n => n.id === id || n.nationId === id), JSON.stringify(summary));
    const selected = await page.evaluate(async id => (await import('/src/data/leaders.ts')).getLeaderByNationId(id)?.id, leader.nationId);
    assert.equal(selected, leader.id);
    await page.keyboard.press('Control+s');
    await page.locator('.save-game-input').waitFor({ state: 'visible' });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.save-game-input').press('Enter');
    const download = await downloadPromise;
    const saved = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(saved.humanNationId, leader.nationId);
    for (const other of leaders) {
      assert.equal(saved.leaderSelections?.[other.nationId] ?? getDefaultLeaderByNationId(other.nationId)?.id, other.id);
      assert.ok(saved.nations.some(n => n.id === other.nationId));
    }
    await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/?epochDiagnostics=1`);
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#mm-load-btn').click({ timeout: 120000 });
    await (await chooserPromise).setFiles({name: 'three-nations-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved))});
    await page.waitForFunction(() => !!window.__epochDiagnostics?.getStateSummary, null, { timeout: 120000 });
    const restored = await page.evaluate(async ids => {
      const roster = await import('/src/data/leaders.ts');
      return ids.map(id => roster.getLeaderByNationId(id)?.id);
    }, ids);
    assert.deepEqual(restored, leaders.map(l => l.id));
    const loadedSummary = await page.evaluate(() => window.__epochDiagnostics.getStateSummary());
    for (const id of ids) assert.ok(loadedSummary.nations.some(n => n.id === id || n.nationId === id));
    console.log(`${leader.name}: normal game started, saved and loaded with all three identities`);
  }
  assert.deepEqual(errors, []);
  console.log('Editor roundtrip, leader selection, six asset decodes, three playlist loops and three normal game starts and live save/load roundtrips passed.');
} finally { await browser.close(); }
