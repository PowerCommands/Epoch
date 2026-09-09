import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { getDefaultLeaderByNationId } from '../src/data/leaders.ts';
import { MIDDLE_EASTERN_LEADERS } from '../src/data/middleEasternLeaders.ts';

const leaders = MIDDLE_EASTERN_LEADERS;
const ids = [...new Set(leaders.map(l => l.nationId))];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/editor.html`);
  await page.waitForFunction(() => typeof window.EpochLeaderEditor?.open === 'function');
  await page.evaluate(ids => {
    const data = buildBlankScenario('Middle Eastern nations', ids, 8, 8, 32, null);
    startEditor({ label: 'Middle Eastern nations', file: 'middle-eastern-nations.json', isNew: true }, data, null);
  }, ids);
  await page.evaluate(ids => {
    ids.forEach((id, index) => { selectNation(id); setStartPosition(index + 1, 2); });
  }, ids);
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
  for (const [index, id] of ids.entries()) assert.deepEqual(output.nations.find(n => n.id === id).startTerritoryCenter, { q: index + 1, r: 2 });
  for (const id of ids) assert.equal(output.nations.find(n => n.id === id).leaderId ?? getDefaultLeaderByNationId(id).id, leaders.filter(l => l.nationId === id).at(-1).id);
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
    assert.equal(await setup.locator('select').first().inputValue(), getDefaultLeaderByNationId(leader.nationId).id);
    if (leader.nationId === 'nation_egypt') await setup.locator('select').first().selectOption(leader.id);
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
      const music = new SetupMusicManager(); music.setEnabled(true); music.playPlaylist(id); window.middleEastMusic = music;
    }, id);
    for (const track of ['01', '02']) {
      await page.waitForFunction(track => window.middleEastMusic.audio?.src.endsWith(`nations_middle_east_theme-${track}.mp3`) && window.middleEastMusic.audio.currentTime > 0 && !window.middleEastMusic.audio.paused, track);
      await page.evaluate(() => window.middleEastMusic.audio.dispatchEvent(new Event('ended')));
    }
    await page.waitForFunction(() => window.middleEastMusic.audio?.src.endsWith('nations_middle_east_theme-01.mp3') && window.middleEastMusic.audio.currentTime > 0);
    await page.evaluate(() => window.middleEastMusic.setEnabled(false));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: six nations, seven leaders, Egypt alternative, editor export/import, setup selection, image decoding and both shared tracks per nation');
} finally { await browser.close(); }
