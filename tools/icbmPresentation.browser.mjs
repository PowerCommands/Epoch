/** EPOCH_URL=http://127.0.0.1:5174 node tools/icbmPresentation.browser.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-icbm-presentation';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/tools/icbm-review', route => route.fulfill({ contentType: 'text/html', body: `
    <style>body{margin:0;background:#111b26}canvas{display:block}</style><script type="module">
    import Phaser from '/node_modules/phaser/dist/phaser.esm.js';
    window.Phaser = Phaser;
    window.game = new Phaser.Game({type:Phaser.WEBGL,width:1280,height:900,
      scene:{create(){window.scene=this;window.ready=true;}}});</script>` }));
  await page.goto(base + '/tools/icbm-review');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    const [{ ICBMStrikeRenderer }, { TileMap }, { HexGridLayout }, { CameraController }, { WorldInputGate }, projection] = await Promise.all([
      import('/src/renderers/ICBMStrikeRenderer.ts'), import('/src/systems/TileMap.ts'),
      import('/src/systems/gridLayout/HexGridLayout.ts'), import('/src/systems/CameraController.ts'),
      import('/src/systems/input/WorldInputGate.ts'), import('/src/systems/rendering/PlanetaryProjection.ts'),
    ]);
    window.game.loop.stop();
    const s = window.scene;
    const map = TileMap.generatePlaceholder(48, 30, 48);
    window.map = map;
    const tileMap = new TileMap(s, map, new HexGridLayout());
    window.tileMap = tileMap;
    const bounds = tileMap.getWorldBounds();
    const input = new WorldInputGate(); window.inputGate = input;
    const camera = new CameraController(s, bounds.width, bounds.height, input, 0.15, projection.hexPlanetarySurface(48, 30, 48));
    window.control = camera;
    const origin = tileMap.tileToWorld(6, 22);
    camera.focusOn(origin.x, origin.y, 1);
    window.allowed = true; window.visibility = 'all'; window.owned = false;
    const callbacks = new Set();
    const weapons = { onDetonation(callback) { callbacks.add(callback); return () => callbacks.delete(callback); } };
    window.weapons = weapons; window.emitStrike = event => { for (const callback of callbacks) callback(event); };
    window.finishedCount = 0; window.finishStates = [];
    window.onCinematicFinished = () => {
      window.finishedCount++;
      window.finishStates.push({ camera: camera.isCinematicActive, input: input.isWorldInteractionBlocked() });
    };
    window.effect = new ICBMStrikeRenderer(s, tileMap, weapons, camera, input, () => window.allowed,
      (x, y) => window.visibility === 'all' || window.visibility === 'origin' && x < 10, () => window.owned, window.onCinematicFinished);
    // Static markers anchor the launch and target to the real filtered map.
    for (const [x, y, color] of [[6, 22, 0x66ddff], [38, 10, 0xff7766], [36, 11, 0x99ccdd]]) {
      const point = tileMap.tileToWorld(x, y);
      s.add.rectangle(point.x, point.y, 20, 20, color).setDepth(20);
    }
    window.render = () => { camera.update(0); const r = window.game.renderer; r.preRender(); s.sys.render(r); r.postRender(); };
    window.advance = age => { window.effect.update(0, age - (window.effect.active?.age ?? 0)); window.render(); };
    window.launch = (kind = 'conventional') => {
      const nuclear = kind === 'nuclear' || kind === 'intercepted';
      const interceptions = kind === 'intercepted' || kind === 'failed' ? [
        { battery: { x: 36, y: 11 }, nationId: 'b', success: false },
        { battery: { x: 39, y: 9 }, nationId: 'b', success: kind === 'intercepted' },
      ] : [];
      const event = { weaponId: 'icbm', nationId: 'a', platform: 'missile_launch_pad', origin: { x: 6, y: 22 },
        target: { x: 38, y: 10 }, nuclear, radius: nuclear ? 3 : 2, victimNationIds: ['b'],
        tiles: 0, unitsDestroyed: 0, contaminatedTiles: 0, intercepted: kind === 'intercepted', interceptions };
      for (const callback of callbacks) callback(event);
      window.render();
      return { active: !!window.effect.active, impactAt: window.effect.active?.impactAt, hold: window.effect.active?.hold };
    };
    window.render();
  });

  async function capture(name, age) {
    await page.evaluate(age => window.advance(age), age);
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  const stateBefore = await page.evaluate(() => JSON.stringify(window.map));
  for (const kind of ['conventional', 'nuclear', 'intercepted', 'failed']) {
    const finishedBefore = await page.evaluate(() => window.finishedCount);
    const launch = await page.evaluate(kind => window.launch(kind), kind);
    assert.ok(launch.active);
    assert.equal(await page.evaluate(() => window.inputGate.isWorldInteractionBlocked()), true);
    await capture(`${kind}-01-ignition`, 300);
    await capture(`${kind}-02-ascent`, 1450);
    await capture(`${kind}-03-globe-flight`, 5000);
    await capture(`${kind}-04-reentry`, kind === 'intercepted' ? 6570 : 7350);
    await capture(`${kind}-05-impact`, launch.impactAt + 80);
    assert.equal(await page.evaluate(() => window.control.cinematicGlobeView.strength), 1, 'impact remains in existing Globe Mode');
    if (kind === 'intercepted') {
      assert.equal(await page.locator('.icbm-cinematic').innerText().then(text => text.includes('MISSILE INTERCEPTED')), true);
    }
    await capture(`${kind}-06-cloud`, launch.impactAt + Math.min(3100, launch.hold - 400));
    if (kind === 'nuclear' || kind === 'conventional') {
      const cloudPixels = await page.evaluate(() => {
        const canvas = window.effect.canvas, ctx = window.effect.context;
        const pixels = ctx.getImageData(0, 0, canvas.width, Math.floor(canvas.height * 0.4)).data;
        let bright = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 75 && pixels[i + 1] > 75 && pixels[i + 2] > 70 && pixels[i + 3] > 100) bright++;
        return bright;
      });
      assert.ok(kind === 'nuclear' ? cloudPixels > 5000 : cloudPixels < 1000,
        `${kind}: only nuclear payload forms a tall bright cloud (${cloudPixels} upper-frame pixels)`);
    }
    if (kind === 'nuclear') await capture(`${kind}-07-lingering`, launch.impactAt + 5400);
    await capture(`${kind}-08-return`, launch.impactAt + launch.hold + 850);
    await page.evaluate(age => window.advance(age), launch.impactAt + launch.hold + 1600);
    assert.equal(await page.locator('.icbm-cinematic').count(), 0);
    assert.equal(await page.evaluate(() => window.control.isCinematicActive || window.inputGate.isWorldInteractionBlocked()), false);
    assert.equal(await page.evaluate(() => window.finishedCount), finishedBefore + 1, 'natural completion resumes deferred presentation UI once');
    assert.equal(await page.evaluate(() => JSON.stringify(window.map)), stateBefore, 'presentation never changes authoritative gameplay');
  }

  await page.evaluate(() => window.launch('nuclear'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.icbm-cinematic').count(), 0, 'Escape disposes the cinematic immediately');
  assert.equal(await page.evaluate(() => window.inputGate.isWorldInteractionBlocked()), false);
  assert.equal(await page.evaluate(() => window.finishedCount), 5, 'Escape resumes deferred UI once');

  await page.evaluate(() => { window.launch(); window.allowed = false; window.effect.update(0, 50); });
  assert.equal(await page.locator('.icbm-cinematic').count(), 0, 'autorun clears presentation immediately');
  assert.equal(await page.evaluate(() => window.finishedCount), 6, 'autorun cancellation releases deferred UI once');
  assert.equal((await page.evaluate(() => window.launch())).active, false, 'autorun bypasses new movies');
  await page.evaluate(() => { window.allowed = true; window.visibility = 'none'; });
  assert.equal((await page.evaluate(() => window.launch())).active, false, 'hidden attacks create no movie');
  await page.evaluate(() => { window.visibility = 'origin'; window.launch('nuclear'); window.advance(10000); });
  assert.equal(await page.locator('.icbm-cinematic').innerText().then(text => text.includes('SIGNAL LOST')), true, 'hidden impacts reveal no nuclear payload');
  await page.evaluate(() => { window.effect.skip(); window.owned = true; window.launch('nuclear'); window.advance(10000); });
  assert.equal(await page.locator('.icbm-cinematic').innerText().then(text => text.includes('NUCLEAR DETONATION')), true, 'owner sees their distant impact over fog');
  assert.equal(await page.evaluate(() => window.effect.active.terrain === undefined), true, 'owner observation never captures hidden terrain');
  assert.equal(await page.evaluate(() => JSON.stringify(window.map)), stateBefore, 'owner observation does not mutate fog or occupants');
  await page.evaluate(() => { window.game.scale.resize(1000, 720); window.effect.update(0, 50); window.render(); });
  assert.equal(await page.evaluate(() => window.effect.canvas.width), 1000, 'overlay follows scene resize');
  await page.evaluate(() => { window.effect.skip(); window.visibility = 'all'; for (let i = 0; i < 5; i++) window.launch(); });
  assert.equal(await page.evaluate(() => window.effect.pending.length), 2, 'salvo queue is bounded');
  const queueNotifications = await page.evaluate(() => {
    const before = window.finishedCount, afterEach = [];
    for (let i = 0; i < 3; i++) {
      const strike = window.effect.active;
      window.advance(strike.impactAt + strike.hold + 1600);
      afterEach.push(window.finishedCount - before);
    }
    return afterEach;
  });
  assert.deepEqual(queueNotifications, [0, 0, 1], 'salvo resumes deferred dialogs after all pending clips finish');
  const beforeShutdown = await page.evaluate(() => { window.launch(); return window.finishedCount; });
  await page.evaluate(() => window.effect.shutdown());
  assert.equal(await page.locator('.icbm-cinematic').count(), 0);
  assert.equal(await page.evaluate(() => window.inputGate.isWorldInteractionBlocked()), false);
  assert.equal((await page.evaluate(() => window.launch())).active, false, 'shutdown unsubscribes from outcomes');
  assert.equal(await page.evaluate(() => window.finishedCount), beforeShutdown, 'renderer shutdown never reopens deferred dialogs');
  assert.equal(await page.evaluate(() => window.finishStates.every(state => !state.camera && !state.input)), true, 'completion callbacks run after camera and input ownership are released');
  await page.evaluate(async () => {
    const { NuclearStrikeRenderer } = await import('/src/renderers/NuclearStrikeRenderer.ts');
    window.tacticalEffect = new NuclearStrikeRenderer(window.scene, window.tileMap, window.weapons, () => true, () => true);
  });
  for (const weaponId of ['guided_missile', 'nuclear_missile']) {
    const result = await page.evaluate(weaponId => {
      window.emitStrike({ weaponId, nationId: 'a', platform: 'missile_launch_pad', origin: { x: 6, y: 22 },
        target: { x: 12, y: 22 }, nuclear: false, radius: 0, victimNationIds: [], tiles: 0, unitsDestroyed: 0,
        contaminatedTiles: 0, intercepted: true, interceptions: [{ battery: { x: 11, y: 21 }, nationId: 'b', success: true }] });
      const strike = window.tacticalEffect.strikes[0];
      window.tacticalEffect.update(0, strike.flightMs + 80); window.render();
      const result = { active: !!strike, cloudVisible: strike.cloud.visible, fireballVisible: strike.fireball.visible, terrain: !!strike.terrain };
      window.tacticalEffect.update(0, 1700);
      return result;
    }, weaponId);
    assert.deepEqual(result, { active: true, cloudVisible: false, fireballVisible: false, terrain: false }, `${weaponId} interception has no nuclear impact`);
  }
  await page.evaluate(async () => {
    const { ICBMStrikeRenderer } = await import('/src/renderers/ICBMStrikeRenderer.ts');
    window.effect = new ICBMStrikeRenderer(window.scene, window.tileMap, window.weapons, window.control, window.inputGate,
      () => true, () => true, () => true, window.onCinematicFinished);
    window.launch();
    window.scene.events.emit(window.Phaser.Scenes.Events.SHUTDOWN);
  });
  assert.equal(await page.locator('.icbm-cinematic').count(), 0, 'scene shutdown disposes an active movie');
  assert.equal(await page.evaluate(() => window.control.isCinematicActive || window.inputGate.isWorldInteractionBlocked()), false, 'camera filter shutdown order releases cinematic ownership');
  assert.equal(await page.evaluate(() => window.finishedCount), beforeShutdown, 'scene shutdown never reopens deferred dialogs');
  assert.deepEqual(errors, []);
  console.log(`PASS ICBM: globe launch/flight, conventional/nuclear distinction, Patriot success/failure, input/skip, autorun, visibility, bounded queue and cleanup. Screenshots: ${output}`);
} finally { await browser.close(); }
