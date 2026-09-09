/** Run with a local Vite server: node tools/airBaseRenderer.browser.mjs http://127.0.0.1:5173 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, executablePath: process.env.EPOCH_BROWSER_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  await page.route('**/__airbase_test', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto(`${url}/__airbase_test`);

  await page.evaluate(async () => {
    const { default: Phaser } = await import('/node_modules/.vite/deps/phaser.js');
    const { AirBaseRenderer } = await import('/src/renderers/AirBaseRenderer.ts');
    const { GREAT_WAR_BOMBER, TRIPLANE } = await import('/src/data/units.ts');

    // Authoritative air state stub: one land base ('airfield') with capacity 2,
    // plus a fog-hidden base the renderer must skip.
    const AIRFIELD_SITE = { x: 1, y: 1, base: { kind: 'city', id: 'london' }, ownerId: 'a', name: 'Airfield — London', capacity: 2 };
    const HIDDEN_SITE = { x: 9, y: 9, base: { kind: 'city', id: 'hidden' }, ownerId: 'b', name: 'Airfield — Hidden', capacity: 2 };
    const aircraft = [];
    const air = {
      allSites: () => [AIRFIELD_SITE, HIDDEN_SITE],
      aircraftAt: (base) => aircraft.filter(u => u.airBase.id === base.id).sort((p, q) => p.id.localeCompare(q.id)),
      onFlight: () => {},
    };
    let selected = null;
    const selection = { getSelected: () => selected, onSelectionChanged: (cb) => { window.airBaseTest.selectionCb = cb; } };
    const unitManager = { onUnitChanged: () => {} };
    const cityManager = { onCityChanged: () => {} };

    for (const type of [GREAT_WAR_BOMBER, TRIPLANE]) {
      const g = new Phaser.Game({ type: Phaser.CANVAS, width: 4, height: 4, audio: { noAudio: true } });
      g.destroy(true);
    }

    window.airBaseTest = { Phaser, aircraft, air, selection, AIRFIELD_SITE, GREAT_WAR_BOMBER, TRIPLANE,
      setSelected: (u) => { selected = u; } };

    new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 400, audio: { noAudio: true }, scene: {
      create() {
        for (const type of [GREAT_WAR_BOMBER, TRIPLANE]) {
          const gg = this.make.graphics({ x: 0, y: 0 });
          gg.fillStyle(type === GREAT_WAR_BOMBER ? 0x00ff00 : 0xff0000).fillRect(0, 0, 32, 32);
          gg.generateTexture(`unit_${type.id}`, 32, 32); gg.destroy();
        }
        const tileMap = { tileToWorld: (x, y) => ({ x: 40 + x * 40, y: 40 + y * 40 }), getTileRect: () => ({ width: 40, height: 40 }) };
        window.airBaseTest.renderer = new AirBaseRenderer(this, tileMap, air, unitManager, cityManager, selection, (x) => x < 5);
        window.airBaseTest.scene = this;
      },
    } });
  });

  await page.waitForFunction(() => window.airBaseTest?.renderer);

  const readState = () => page.evaluate(() => {
    const scene = window.airBaseTest.scene;
    const containers = scene.children.list.filter(o => o.type === 'Container');
    return containers.map(c => {
      const sprite = c.list.find(o => o.type === 'Image');
      const text = c.list.find(o => o.type === 'Text');
      return { x: c.x, y: c.y, spriteVisible: !!sprite && sprite.visible, spriteTexture: sprite?.texture?.key, badge: text?.text };
    });
  });

  // 1. Empty visible base → one container, no aircraft sprite, "✈ 0 / 2".
  //    Hidden (fog) base is skipped entirely.
  let state = await readState();
  assert.equal(state.length, 1, 'only the fog-visible base is drawn');
  assert.equal(state[0].badge, '✈ 0 / 2', 'empty base reads 0 / 2');
  assert.equal(state[0].spriteVisible, false, 'no aircraft sprite when base is empty');
  assert.equal(state[0].x, 80, 'positioned at its base tile');

  // 2. One aircraft → representative sprite visible, "✈ 1 / 2".
  await page.evaluate(() => {
    window.airBaseTest.aircraft.push({ id: 'u1', unitType: window.airBaseTest.GREAT_WAR_BOMBER, airBase: { kind: 'city', id: 'london' } });
    window.airBaseTest.renderer.refreshAll();
  });
  state = await readState();
  assert.equal(state[0].badge, '✈ 1 / 2');
  assert.equal(state[0].spriteVisible, true, 'aircraft sprite shown over the base');
  assert.equal(state[0].spriteTexture, 'unit_great_war_bomber');

  // 3. Two aircraft → single representative (stable id order), "✈ 2 / 2".
  await page.evaluate(() => {
    window.airBaseTest.aircraft.push({ id: 'u0', unitType: window.airBaseTest.TRIPLANE, airBase: { kind: 'city', id: 'london' } });
    window.airBaseTest.renderer.refreshAll();
  });
  state = await readState();
  assert.equal(state[0].badge, '✈ 2 / 2', 'full base reads 2 / 2');
  assert.equal(state[0].spriteTexture, 'unit_triplane', 'lowest id (u0) is the stable representative');

  // 4. Selecting the other stationed aircraft makes it the representative.
  await page.evaluate(() => {
    window.airBaseTest.setSelected({ kind: 'unit', unit: { id: 'u1' } });
    window.airBaseTest.selectionCb();
  });
  state = await readState();
  assert.equal(state[0].spriteTexture, 'unit_great_war_bomber', 'selected aircraft becomes representative');

  // 6. Removing aircraft immediately updates the indicator back down.
  await page.evaluate(() => {
    window.airBaseTest.aircraft.length = 0;
    window.airBaseTest.setSelected(null);
    window.airBaseTest.renderer.refreshAll();
  });
  state = await readState();
  assert.equal(state[0].badge, '✈ 0 / 2');
  assert.equal(state[0].spriteVisible, false);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('airBaseRenderer.browser: PASS');
} finally {
  await browser.close();
}
