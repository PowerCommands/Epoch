import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { getDefaultLeaderByNationId } from '../src/data/leaders.ts';

const ids = ['nation_canada', 'nation_mexico', 'nation_argentina', 'nation_ukraine'];
const leaders = ids.map(getDefaultLeaderByNationId);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/editor.html`);
  await page.waitForFunction(() => typeof window.EpochLeaderEditor?.open === 'function');
  await page.evaluate(ids => {
    const data = buildBlankScenario('Four new nations', ids, 8, 8, 32, null);
    startEditor({ label: 'Four new nations', file: 'four-new-nations.json', isNew: true }, data, null);
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
  assert.deepEqual(errors, []);
  console.log('Four nations passed Editor export/import, default leader assignment, Game Setup details, eight image decodes and eight audio fetches.');
} finally { await browser.close(); }
