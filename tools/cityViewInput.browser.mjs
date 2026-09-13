import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Self-contained regression: the real CityView DOM sits above a Phaser HUD
// target. No running game, assets or development server are needed.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import Phaser from 'phaser';
      import { CityView } from './src/ui/CityView';
      import { installDomInputIsolation } from './src/utils/domInputIsolation';
      import { City } from './src/entities/City';
      window.closeCount = 0;
      window.hudClicks = 0;
      window.hudDowns = 0;
      const city = new City({ id: 'test', name: 'Ottawa', ownerId: 'a', tileX: 0, tileY: 0 });
      const view = new CityView();
      view.onCloseRequested(() => { window.closeCount++; view.close(); });
      window.view = view;
      window.showCity = () => view.show(city, [], [], { active: false },
        { visible: false, enabled: false, buttonLabel: '' }, [], [], [], []);
      const game = new Phaser.Game({
        type: Phaser.CANVAS, width: 1200, height: 900, parent: 'game',
        banner: false, audio: { noAudio: true },
        scene: { create() {
          let pressed = false;
          window.hud = this.add.rectangle(0, 0, 90, 60, 0x996633).setInteractive();
          window.hud.on('pointerdown', () => { pressed = true; window.hudDowns++; });
          window.hud.on('pointerup', () => {
            if (pressed) window.hudClicks++;
            pressed = false;
          });
          window.ready = true;
        } }
      });
      installDomInputIsolation(() => game.canvas);
    `,
  }, bundle: true, write: false, format: 'iife', logLevel: 'silent',
});
const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, hasTouch: touch });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>
      body { margin: 0; }
      #game { position: absolute; inset: 0; }
      .city-view-overlay { position: absolute; left: 300px; top: 100px; width: 600px; z-index: 10; }
      .city-view-panel { background: #123; color: white; padding: 20px; }
      .city-view-header { display: flex; justify-content: space-between; height: 60px; }
      .city-view-close { width: 80px; height: 45px; }
      .city-view-tooltip { display: none; }
    </style><div id="game"></div><div id="app-layout"></div>`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => window.ready);
    const activate = async locator => touch ? locator.tap() : locator.click();
    for (const [left, top] of [[300, 100], [50, 40], [480, 180]]) {
      await page.evaluate(({ left, top }) => {
        window.showCity();
        const root = document.querySelector('.city-view-overlay');
        root.style.left = left + 'px'; root.style.top = top + 'px';
        const rect = document.querySelector('.city-view-close').getBoundingClientRect();
        window.hud.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
      }, { left, top });
      const close = page.locator('.city-view-close');
      const rect = await close.boundingBox();
      const before = await page.evaluate(() => ({ closes: window.closeCount, hud: window.hudClicks, downs: window.hudDowns }));
      await activate(close);
      assert.equal(await page.evaluate(() => window.view.getOpenCityId()), null);
      assert.equal(await page.evaluate(() => window.closeCount), before.closes + 1);
      assert.equal(await page.evaluate(() => window.hudClicks), before.hud, 'Close must not activate the HUD underneath');
      assert.equal(await page.evaluate(() => window.hudDowns), before.downs, 'City View must not press the HUD underneath');
      // A separate deliberate click must work immediately after closing.
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      assert.equal(await page.evaluate(() => window.hudClicks), before.hud + 1);
    }
    await page.evaluate(() => window.showCity());
    const checkbox = page.locator('.city-view-auto-close input');
    assert.equal(await checkbox.isChecked(), true);
    await activate(checkbox);
    assert.equal(await checkbox.isChecked(), false, 'native controls must still receive clicks');
    if (!touch) {
      const root = page.locator('.city-view-overlay');
      const before = await root.boundingBox();
      const title = await page.locator('.city-view-title').boundingBox();
      await page.mouse.move(title.x + 20, title.y + 15);
      await page.mouse.down();
      await page.mouse.move(title.x - 80, title.y + 45, { steps: 5 });
      await page.mouse.up();
      const after = await root.boundingBox();
      assert.equal(Math.round(after.x - before.x), -100);
      assert.equal(Math.round(after.y - before.y), 30);
      await page.mouse.move(title.x - 50, title.y + 60);
      assert.deepEqual(await root.boundingBox(), after, 'releasing on the panel must end dragging');
    }
    await page.evaluate(() => window.view.shutdown());
    assert.equal(await page.locator('.city-view-overlay').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${touch ? 'Touch' : 'Mouse'}: Close isolates input at three positions; subsequent HUD clicks and native controls work.`);
  }
} finally {
  await browser.close();
}
