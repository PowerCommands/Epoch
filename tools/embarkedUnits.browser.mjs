import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-embarked-units';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.reviewGame=game;window.reviewPhaser=Phaser;` });
  });
  await page.goto(base + '/?epochDiagnostics=1');
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame);
  await page.evaluate(async () => {
    const [{ UnitRenderer }, { UnitManager }, { NationManager }, { Nation }, { Unit }, { ARCHAEOLOGIST, CARGO_SHIP }, { TileType }, { AmbientSprites }] = await Promise.all([
      import('/src/systems/UnitRenderer.ts'), import('/src/systems/UnitManager.ts'), import('/src/systems/NationManager.ts'),
      import('/src/entities/Nation.ts'), import('/src/entities/Unit.ts'), import('/src/data/units.ts'),
      import('/src/types/map.ts'), import('/src/systems/rendering/AmbientSprites.ts'),
    ]);
    const game = window.reviewGame;
    for (const active of game.scene.getScenes(true)) game.scene.stop(active.scene.key);
    const scene = new window.reviewPhaser.Scene('EmbarkedReview');
    scene.preload = function () {
      this.load.image('unit_embarked_boat', '/assets/sprites/units/embarked_boat.png');
      this.load.image('unit_archaeologist', '/assets/sprites/units/archaeologist.png');
      this.load.image('unit_cargo_ship', '/assets/sprites/units/cargo_ship.png');
    };
    scene.create = function () {
      this.cameras.main.setBackgroundColor('#205e83').setZoom(5).centerOn(400, 300);
      const map = { width: 2, height: 1, tileSize: 48, tiles: [[{ x: 0, y: 0, type: TileType.Plains }, { x: 1, y: 0, type: TileType.Ocean }]] };
      const units = new UnitManager(2, 1), nations = new NationManager();
      nations.addNation(new Nation({ id: 'human', name: 'Human', color: 0xc82323 }));
      const passenger = new Unit({ id: 'passenger', name: 'Archaeologist', ownerId: 'human', tileX: 0, tileY: 0, unitType: ARCHAEOLOGIST });
      units.addUnit(passenger);
      const renderer = new UnitRenderer(this, { tileToWorld: () => ({ x: 400, y: 300 }), getTileRect: () => ({ width: 48, height: 48 }) }, units, nations, map);
      const ambient = AmbientSprites.forScene(this);
      window.embarkReview = { scene: this, units, passenger, renderer, ambient, CARGO_SHIP, Unit };
      window.reviewReady = true;
    };
    game.scene.add('EmbarkedReview', scene, true);
  });
  await page.waitForFunction(() => window.reviewReady, undefined, { timeout: 90000 });
  const state = () => page.evaluate(() => {
    const { renderer, passenger } = window.embarkReview;
    const container = renderer.getUnitContainer(passenger.id);
    return { texture: container?.list.find(child => child.type === 'Image')?.texture.key, badges: container?.list.filter(child => child.type === 'Text').map(child => child.text) };
  });
  assert.deepEqual(await state(), { texture: 'unit_archaeologist', badges: [] });
  await page.evaluate(() => window.embarkReview.units.moveUnit('passenger', 1, 0));
  assert.deepEqual(await state(), { texture: 'unit_embarked_boat', badges: ['1'] });
  const positions = [];
  for (const time of [0, 700, 1400]) {
    positions.push(await page.evaluate(time => {
      const { ambient, scene } = window.embarkReview;
      window.reviewGame.loop.stop();
      ambient.elapsed = time; ambient.lastDraw = -Infinity; ambient.update(0, 0);
      const binding = [...ambient.bindings].find(item => item.sprite.texture.key === 'unit_embarked_boat');
      const renderer = window.reviewGame.renderer;
      renderer.preRender(); scene.sys.render(renderer); renderer.postRender();
      if (!binding?.drawing || !binding.mesh?.vertices.every(Number.isFinite)) throw Error('Embarked boat animation missing: ' + JSON.stringify({ profile: binding?.profile, drawing: binding?.drawing, mesh: !!binding?.mesh, visible: binding?.sprite.visible, enabled: ambient.isEnabled(), camera: scene.cameras.main.worldView, position: binding?.sprite.getWorldTransformMatrix(), parent: binding?.sprite.parentContainer?.visible }));
      return Array.from(binding.mesh.vertices);
    }, time));
    await page.screenshot({ path: `${output}/boat-${time}.png` });
  }
  assert.notDeepEqual(positions[0], positions[1], 'boat must visibly bob over time');
  await page.evaluate(() => window.embarkReview.renderer.rebuildAll());
  assert.deepEqual(await state(), { texture: 'unit_embarked_boat', badges: ['1'] });
  await page.evaluate(() => window.embarkReview.units.moveUnit('passenger', 0, 0));
  assert.deepEqual(await state(), { texture: 'unit_archaeologist', badges: [] });
  await page.evaluate(() => {
    const { units, Unit, CARGO_SHIP } = window.embarkReview;
    units.addUnit(new Unit({ id: 'carrier', name: 'Cargo Ship', ownerId: 'human', tileX: 1, tileY: 0, unitType: CARGO_SHIP }));
    units.boardUnit('passenger', 'carrier');
  });
  assert.equal(await page.evaluate(() => window.embarkReview.renderer.getUnitContainer('passenger') === undefined), true);
  assert.deepEqual(errors, []);
  console.log('Embark swaps portrait to bobbing boat + 1, survives rebuild, restores land portrait, and hides boarded cargo.');
} finally {
  await browser.close();
}
