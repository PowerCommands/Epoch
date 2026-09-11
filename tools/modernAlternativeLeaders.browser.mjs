import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { MODERN_ALTERNATIVE_LEADERS } from '../src/data/modernAlternativeLeaders.ts';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.EPOCH_EDITOR_URL ?? 'http://127.0.0.1:5174'}/editor.html`);
  await page.waitForFunction(() => typeof window.EpochLeaderEditor?.open === 'function');
  await page.evaluate(nationIds => {
    const data = buildBlankScenario('Modern alternative leaders', nationIds, 4, 4, 32, null);
    startEditor({ label: 'Modern alternative leaders', file: 'modern-leaders.json', isNew: true }, data, null);
    window.editorTestScenario = data;
  }, [...new Set(MODERN_ALTERNATIVE_LEADERS.map(l => l.nationId))]);
  await page.getByRole('button', { name: 'Leaders & AI', exact: true }).click();
  const dialog = page.locator('dialog.le-dialog');
  for (const leader of MODERN_ALTERNATIVE_LEADERS) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Impulsive Bully', { exact: true }).isChecked(), leader.impulsiveBully);
    assert.equal(await dialog.getByLabel('Opportunism', { exact: true }).isChecked(), leader.opportunism);
    assert.equal(await dialog.getByLabel('Showman', { exact: true }).isChecked(), leader.showman ?? false);
    await dialog.getByLabel('Economy', { exact: true }).fill(String(leader.aiPersonality.economyBias + 1));
    await dialog.getByLabel('Economy', { exact: true }).press('Tab');
    const national = dialog.locator('details[data-section="Scenario Nation & Inherited Rules"]');
    if (await national.getAttribute('open') === null) await national.locator('summary').click();
    await dialog.getByRole('button', { name: 'Use this leader for this nation', exact: true }).click();
    assert.ok((await dialog.textContent()).includes('Scenario selection: ' + leader.name));
  }
  await page.screenshot({ path: '/tmp/epoch-modern-leader-editor.png' });
  await dialog.getByRole('button', { name: 'Apply to Scenario', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const output = await page.evaluate(() => buildScenarioOutput());
  for (const leader of MODERN_ALTERNATIVE_LEADERS) {
    assert.equal(output.leaderConfiguration.leaders[leader.id].aiPersonality.economyBias, leader.aiPersonality.economyBias + 1);
  }
  for (const [nationId, leaderId] of Object.entries(Object.fromEntries(MODERN_ALTERNATIVE_LEADERS.map(l => [l.nationId, l.id])))) {
    assert.equal(output.nations.find(n => n.id === nationId).leaderId, leaderId);
  }
  // Reopen a JSON roundtrip of the exported scenario, as an imported scenario would.
  await page.evaluate(data => window.EpochLeaderEditor.open(JSON.parse(JSON.stringify(data)), () => {}), output);
  for (const leader of MODERN_ALTERNATIVE_LEADERS) {
    await dialog.locator('.le-side input').fill(leader.name);
    await dialog.getByRole('button', { name: leader.name, exact: true }).click();
    assert.equal(await dialog.getByLabel('Economy', { exact: true }).inputValue(), String(leader.aiPersonality.economyBias + 1));
    assert.equal(await dialog.getByLabel('Impulsive Bully', { exact: true }).isChecked(), leader.impulsiveBully);
    assert.equal(await dialog.getByLabel('Opportunism', { exact: true }).isChecked(), leader.opportunism);
    assert.equal(await dialog.getByLabel('Showman', { exact: true }).isChecked(), leader.showman ?? false);
  }
  await dialog.getByRole('button', { name: 'Discard / Close', exact: true }).click();
  // Exercise the actual Game Setup nation-details component with expanded lists.
  for (const leader of MODERN_ALTERNATIVE_LEADERS) {
    await page.evaluate(async leader => {
      const { NationDetailsDialog } = await import('/src/ui/NationDetailsDialog.ts');
      const roster = await import('/src/data/leaders.ts');
      NationDetailsDialog.show({
        nation: { id: leader.nationId, name: leader.nationId, color: '#123456', isHuman: true, startTerritoryCenter: { q: 0, r: 0 } },
        leaders: roster.getLeadersByNationId(leader.nationId),
        selectedLeaderId: roster.getLeaderByNationId(leader.nationId)?.id,
        onSave: (_, id) => {
          roster.setActiveLeaderSelections({ [leader.nationId]: id });
          window.selectedSetupLeader = roster.getLeaderByNationId(leader.nationId)?.id;
        },
      });
    }, leader);
    const setup = page.locator('.mm-nation-details-dialog');
    const selection = setup.locator('select').first();
    if (leader.nationId === 'nation_usa') assert.equal(await selection.locator('option').count(), 3);
    await selection.selectOption(leader.id);
    assert.equal(await setup.locator('.mm-nd-leader-portrait').getAttribute('src'), leader.image);
    await setup.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.evaluate(() => window.selectedSetupLeader), leader.id);
  }
  console.log(`All ${MODERN_ALTERNATIVE_LEADERS.length} leaders passed editor roundtrips, scenario assignment, and Game Setup selection.`);
  for (const leader of MODERN_ALTERNATIVE_LEADERS) {
    for (const [path, width, height] of [
      [leader.image, 416, 416], [leader.image.replace('.png', '-room.webp'), 2048, 872],
    ]) {
      const dimensions = await page.evaluate(async path => {
        const img = new Image(); img.src = path; await img.decode();
        return [img.naturalWidth, img.naturalHeight];
      }, path);
      assert.deepEqual(dimensions, [width, height], path);
    }
  }
  assert.deepEqual(errors, []);
  console.log(`All ${MODERN_ALTERNATIVE_LEADERS.length * 2} portrait and room assets decoded at the expected dimensions; no browser errors.`);
} finally { await browser.close(); }
