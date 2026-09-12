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
    const { GREAT_WAR_BOMBER, TRIPLANE, JET_FIGHTER, STEALTH_BOMBER } = await import('/src/data/units.ts');
    const { AmbientSprites } = await import('/src/systems/rendering/AmbientSprites.ts');

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

    window.airBaseTest = { Phaser, aircraft, air, selection, AIRFIELD_SITE, GREAT_WAR_BOMBER, TRIPLANE, JET_FIGHTER, STEALTH_BOMBER, AmbientSprites,
      setSelected: (u) => { selected = u; } };

    new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 400, audio: { noAudio: true }, scene: {
      preload() {
        for (const id of ['jet_fighter', 'stealth_bomber']) this.load.image(`unit_${id}`, `/assets/sprites/units/${id}.png`);
      },
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

  // The actual airbase representative must be attached, animate after texture
  // changes, respect fog and release its binding when the base disappears.
  const animation = await page.evaluate(() => {
    const t = window.airBaseTest;
    t.aircraft.push({ id: 'jet', unitType: t.JET_FIGHTER, airBase: { kind: 'city', id: 'london' } });
    t.renderer.refreshAll();
    const ambient = t.AmbientSprites.forScene(t.scene);
    const binding = [...ambient.bindings][0];
    const sample = (time) => { ambient.elapsed = time * 1000; ambient.lastDraw = -Infinity; ambient.update(0, 0); };
    sample(1.45 - binding.seed * 5 + 5);
    const jet = binding.profile.effects.some(e => e.kind === 'afterburner') && binding.drawing && !!binding.mesh;
    const vertices = [...binding.mesh.vertices];
    sample(1.7 - binding.seed * 5 + 5);
    const missilesMove = vertices.some((v, i) => v !== binding.mesh.vertices[i]);
    t.aircraft[0].unitType = t.STEALTH_BOMBER;
    t.renderer.refreshAll();
    sample(1.5 - binding.seed * 5 + 5);
    const bomber = binding.profile.bombs && !binding.mesh;
    const effects = [...ambient.layers.values()].some(g => g.commandBuffer.length > 1);
    ambient.canSee = () => false; sample(7);
    const hidden = [...ambient.layers.values()].every(g => g.commandBuffer.length <= 1);
    t.renderer.shutdown();
    return { jet, missilesMove, bomber, effects, hidden, released: ambient.bindings.size === 0 };
  });
  for (const [key, value] of Object.entries(animation)) assert.ok(value, key);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('airBaseRenderer.browser: PASS');
} finally {
  await browser.close();
}
