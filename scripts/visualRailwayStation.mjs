import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-railway';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/railway-review', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><script type="module">import Phaser from "/node_modules/phaser/dist/phaser.esm.js"; window.Phaser=Phaser;</script></body></html>' }));
  await page.goto((process.env.EPOCH_URL ?? 'http://127.0.0.1:5174') + '/railway-review');
  await page.waitForFunction(() => window.Phaser);
  await page.evaluate(async () => {
    const { AmbientSprites } = await import('/src/systems/rendering/AmbientSprites.ts');
    const scene = new window.Phaser.Scene('RailwayReview');
    scene.preload = function () { this.load.image('tile_building_railway_station', '/assets/sprites/buildings/railway_station.png'); };
    scene.create = function () {
      this.cameras.main.setBackgroundColor('#778078');
      const sprite = this.add.image(400, 260, 'tile_building_railway_station').setDisplaySize(512, 512).setDepth(14);
      const ambient = AmbientSprites.forScene(this);
      let enabled = true;
      ambient.attach(sprite, 'building', 'railway-review', () => [0, 0], () => enabled);
      this.events.off(window.Phaser.Scenes.Events.UPDATE, ambient.tick, ambient);
      [...ambient.bindings][0].seed = 0;
      window.frame = (t) => {
        ambient.elapsed = t * 1000 - 50; ambient.lastDraw = -Infinity; ambient.update(0, 50);
        return [...ambient.layers.values()].reduce((sum, layer) => sum + layer.commandBuffer.length, 0);
      };
      window.toggleStation = (value) => { enabled = value; };
      window.stationSprite = sprite;
      window.stationReady = true;
    };
    window.game = new window.Phaser.Game({ type: window.Phaser.WEBGL, width: 800, height: 600, scene, audio: { noAudio: true }, banner: false });
  });
  await page.waitForFunction(() => window.stationReady);
  const counts = [];
  for (const t of [0, 3, 7, 12, 15.9, 20, 27]) {
    counts.push(await page.evaluate(t => window.frame(t), t));
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${output}/station-${t}.png` });
  }
  assert.ok(counts[1] > counts[0], 'arrival renders');
  assert.ok(counts[2] > counts[5], 'platform stop renders; interval empty');
  assert.equal(counts[1], counts[6], 'next arrival renders the same primitives');
  assert.ok(await page.evaluate(() => { window.toggleStation(false); return window.frame(7); }) <= 1, 'disabled/broken station clears train');
  assert.deepEqual(await page.evaluate(() => ({ x: window.stationSprite.x, y: window.stationSprite.y, angle: window.stationSprite.angle })), { x: 400, y: 260, angle: 0 });
  assert.deepEqual(errors, []);
  console.log(`Railway browser checks passed; frames in ${output}`);
} finally { await browser.close(); }
