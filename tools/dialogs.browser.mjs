import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-dialog-review';
await mkdir(output, { recursive: true });
const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import Phaser from 'phaser';
  import { installDomInputIsolation } from './src/utils/domInputIsolation';
  import { TileInspectorDialog } from './src/ui/TileInspectorDialog';
  import { GamesOfNationsDialog } from './src/ui/GamesOfNationsDialog';
  import { ProposalDialog } from './src/ui/hud/ProposalDialog';
  import { WorldCouncilSessionDialog } from './src/ui/hud/WorldCouncilSessionDialog';
  import { WorldInputGate } from './src/systems/input/WorldInputGate';
  import { WorldCouncilFoundationDialog } from './src/ui/hud/WorldCouncilFoundationDialog';
  import { WorldCouncilContributionDialog } from './src/ui/hud/WorldCouncilContributionDialog';
  import { WorldCouncilOverviewDialog } from './src/ui/hud/WorldCouncilOverviewDialog';
  import { gamesModel, councilModel } from './tools/fixtures/dialogReview';
  window.applies = [];
  window.hudDowns = 0;
  window.hudUps = 0;
  window.model = gamesModel();
  const game = new Phaser.Game({ type: Phaser.CANVAS, width: 1280, height: 800, parent: 'game',
    banner: false, audio: { noAudio: true }, scene: { create() {
      this.add.rectangle(640, 400, 1280, 800, 0x203943).setInteractive()
        .on('pointerdown', () => window.hudDowns++)
        .on('pointerup', () => window.hudUps++);
      const gate = new WorldInputGate();
      this.input.setTopOnly(false);
      window.proposal = new ProposalDialog(this, object => this.add.existing(object), gate, {
        getNationName: id => id, getNationColor: () => 0xb7894c, getResourceName: id => id,
      });
      window.proposal.setOnReject(() => window.proposal.hide());
      window.foundation = new WorldCouncilFoundationDialog(this, object => this.add.existing(object), gate);
      window.contribution = new WorldCouncilContributionDialog(this, object => this.add.existing(object), gate);
      window.foundation.setOnDecline(() => window.foundation.hide());
      window.contribution.setOnConfirm(() => window.contribution.hide());
      window.ready = true;
    } } });
  window.removeIsolation = installDomInputIsolation(() => game.canvas);
  const tile = new TileInspectorDialog();
  window.tile = tile;
  window.showTile = () => tile.open({ title: 'Tile (38, 37)', sections: [{ heading: 'Tile', rows: [{ label: 'Terrain', value: 'Plains' }] }] });
  const council = new WorldCouncilOverviewDialog();
  council.setOnClose(() => council.hide());
  window.council = council;
  window.showCouncil = () => council.show(councilModel);
  const session = new WorldCouncilSessionDialog({
    getState: () => ({ organizationName: 'United Nations', meetingKindLabel: 'Regular Meeting', cityName: 'Paris',
      cityNationName: 'France', round: 151, availableInfluence: 100,
      proposals: [{ key: 'climate', title: 'Climate Accord', icon: '🌍', description: 'Work together to reduce global pollution.',
        requiresVote: true, suggestedSupport: true, suggestedInfluence: 20 }] }),
    onSubmitVotes: votes => { window.votes = votes; return { proposals: [{ title: 'Climate Accord', outcome: 'passed' }] }; },
    onClose: () => session.hide(),
  });
  window.session = session;
  const callbacks = {
    getModel: () => window.model,
    onApply: (...args) => { window.applies.push(args); return true; },
    onStrategyAdjustmentSeen: () => {},
    onParticipationDecision: () => true, onAllocateGamesPoints: () => true,
    onDistributeRemainingGamesPoints: () => true, onHostingDecision: () => true,
    onHostCitySelected: () => true, onSportAuctionBid: () => true, onSportAuctionAbstain: () => true,
  };
  const games = new GamesOfNationsDialog(callbacks);
  window.games = games;
  window.showGames = (host) => { window.model = gamesModel(host); games.showPanel(); };
` }, bundle: true, write: false, format: 'iife', logLevel: 'silent' });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: touch });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://epoch.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/assets/')) await route.fulfill({ path: `${process.cwd()}/public${path}` });
      else await route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0}#game{position:absolute;inset:0}</style><div id="game"></div><div id="app-layout"></div>' });
    });
    await page.goto('https://epoch.test/');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => window.ready);
    const click = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
    // Tile inspector used to pass both halves of the click to Phaser.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.showTile());
      await click('#tile-inspector-dialog button');
      assert.equal(await page.evaluate(() => window.tile.isOpen()), false);
    }
    // Covers all DOM dialogs, including removed roots and embedded preview canvases.
    await page.evaluate(() => {
      for (const tag of ['button', 'input', 'select', 'canvas', 'div']) {
        const dialog = document.createElement('div');
        const control = document.createElement(tag); dialog.append(control); document.body.append(dialog);
        control.addEventListener('click', () => dialog.remove());
        for (const name of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
          control.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
        }
      }
    });
    await page.evaluate(() => window.showCouncil());
    for (const tab of ['Members', 'Resolutions', 'Meetings', 'Overview']) {
      const loc = page.getByRole('tab', { name: tab, exact: true });
      if (touch) await loc.tap(); else await loc.click();
      assert.equal(await loc.getAttribute('aria-selected'), 'true');
    }
    if (!touch) await page.screenshot({ path: `${output}/un-overview.png` });
    await click('.wc-close');
    assert.equal(await page.locator('.wc-overlay').count(), 0);
    await page.evaluate(() => window.session.show());
    await click('.wcs-no');
    await page.locator('.wcs-influence-input').fill('30');
    if (!touch) await page.screenshot({ path: `${output}/un-session.png` });
    await click('.wcs-primary');
    assert.equal(await page.evaluate(() => window.votes[0].support), false);
    assert.equal(await page.evaluate(() => window.votes[0].influence), 30);
    await click('.wcs-primary');
    assert.equal(await page.locator('.wcs-overlay').count(), 0);
    for (const host of [false, true]) {
      await page.evaluate(host => window.showGames(host), host);
      assert.equal(await page.locator('.gon-step').count(), host ? 3 : 2);
      if (host) {
        assert.equal(await page.locator('.gon-next').isDisabled(), true);
        await click('.gon-host-sport:first-child');
        assert.equal(await page.locator('.gon-next').isDisabled(), false);
        if (!touch) await page.screenshot({ path: `${output}/games-host.png` });
        await click('.gon-next');
      }
      assert.equal(await page.locator('#gon-culture-commitment').isVisible(), true);
      await page.locator('#gon-culture-commitment').fill('100');
      assert.match(await page.locator('.gon-commitment-status').first().textContent(), /Cannot be fulfilled/);
      assert.match(await page.locator('.gon-points-summary').textContent(), /Currently achievable1000 GP/);
      await page.locator('#gon-culture-commitment').fill('10');
      assert.equal(await page.locator('.gon-commitment-status').first().textContent(), 'Available');
      if (!touch) await page.screenshot({ path: `${output}/games-investment.png` });
      await click('.gon-next');
      assert.equal(await page.locator('#gon-culture-commitment').isVisible(), false);
      assert.equal(await page.locator('.gon-apply').isDisabled(), true);
      await click('.gon-distribute');
      assert.equal(await page.locator('.gon-apply').isDisabled(), false);
      await click('.gon-back');
      assert.equal(await page.locator('#gon-culture-commitment').inputValue(), '10');
      await click('.gon-next');
      assert.equal(await page.locator('.gon-apply').isDisabled(), false);
      if (!touch) await page.screenshot({ path: `${output}/games-allocation.png` });
      assert.equal(await page.evaluate(() => window.applies.length), host ? 1 : 0, 'navigation must not commit changes');
      await click('.gon-apply');
      const applied = await page.evaluate(() => window.applies.at(-1));
      assert.equal(applied[0], 10); assert.equal(applied[1], 100);
      assert.equal(Object.values(applied[2]).reduce((a, b) => a + b, 0), 1100);
      assert.equal(applied[3], host ? 'Wrestling' : undefined);
      await click('.gon-close');
    }
    // Reopening discards unconfirmed drafts, Escape works, read-only phases stay read-only.
    await page.evaluate(() => window.showGames(false));
    await page.locator('#gon-culture-commitment').fill('20');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.gon-overlay').count(), 0);
    await page.evaluate(() => window.showGames(false));
    assert.equal(await page.locator('#gon-culture-commitment').inputValue(), '0');
    await page.evaluate(() => {
      window.model.controlsEditable = false;
      window.model.excluded = true;
      window.games.showPanel();
    });
    assert.equal(await page.locator('#gon-culture-commitment').isDisabled(), true);
    await click('.gon-next');
    assert.equal(await page.locator('.gon-apply').isDisabled(), true);
    await click('.gon-close');
    assert.deepEqual(await page.evaluate(() => [window.hudDowns, window.hudUps]), [0, 0], 'all DOM dialogs isolate mouse and touch');
    // Older Phaser dialogs must also intercept clicks on their backdrop and
    // consume the release before a button callback hides the dialog.
    for (const kind of ['foundation', 'contribution', 'proposal']) {
      const target = await page.evaluate(kind => {
        const dialog = window[kind];
        if (kind === 'foundation') {
          dialog.show({ organizationName: 'World Council', nationName: 'Canada', cityName: 'Ottawa',
            maxGold: 500, sciencePerTurn: 30, culturePerTurn: 20 });
        } else if (kind === 'contribution') {
          dialog.show({ organizationName: 'World Council', nationName: 'Canada', maxGold: 500,
            currentGold: 100, currentSciencePercent: 5, currentCulturePercent: 5 });
        }
        if (kind === 'proposal') dialog.showProposal({ id: 'p', fromNationId: 'France', toNationId: 'Canada', payload: { kind: 'open_borders' } });
        const area = kind === 'foundation' ? dialog.declineButton.hitArea
          : kind === 'proposal' ? dialog.rejectButton.hitArea : dialog.buttons.at(-1).hitArea;
        return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      }, kind);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (touch) await page.touchscreen.tap(20, 20); else await page.mouse.click(20, 20);
      if (touch) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y);
      assert.equal(await page.evaluate(kind => window[kind].isShowing(), kind), false, `${kind}: button at ${JSON.stringify(target)} closes dialog`);
      assert.deepEqual(await page.evaluate(() => [window.hudDowns, window.hudUps]), [0, 0]);
    }
    // Canvas input remains immediately usable.
    if (touch) await page.touchscreen.tap(20, 20); else await page.mouse.click(20, 20);
    assert.deepEqual(await page.evaluate(() => [window.hudDowns, window.hudUps]), [1, 1]);
    for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 700 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.showGames(true));
      await click('.gon-host-sport:first-child');
      for (let step = 0; step < 3; step++) {
        const close = await page.locator('.gon-close').boundingBox();
        const footer = await page.locator('.gon-panel-footer').boundingBox();
        assert.ok(close.y >= 0 && close.x + close.width <= size.width);
        assert.ok(footer.y + footer.height <= size.height, 'navigation stays on screen');
        assert.equal(await page.locator('.gon-panel-card').evaluate(el => el.scrollWidth <= el.clientWidth), true);
        if (step < 2) await click('.gon-next');
      }
      if (!touch) await page.screenshot({ path: `${output}/games-${size.width}.png` });
      await click('.gon-close');
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => { window.removeIsolation(); window.showTile(); });
    const beforeLeak = await page.evaluate(() => window.hudUps);
    await click('#tile-inspector-dialog button');
    assert.ok(await page.evaluate(() => window.hudUps) > beforeLeak, 'regression test reproduces the original leak without the boundary');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${touch ? 'Touch' : 'Mouse'}: dialog isolation, Council tabs, host/participant steps, draft persistence, apply, read-only and responsive layouts passed.`);
  }
} finally { await browser.close(); }
