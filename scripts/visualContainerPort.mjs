import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from 'canvas';

const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-container-port';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
  await page.route('**/container-port-review', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"></body></html>' }));
  await page.goto(url + '/container-port-review');
  await page.evaluate(async canvas => {
    const { default: Phaser } = await import('/node_modules/phaser/dist/phaser.esm.js');
    const { AmbientSprites } = await import('/src/systems/rendering/AmbientSprites.ts');
    const { TileBuildingRenderer } = await import('/src/systems/TileBuildingRenderer.ts');
    const ids = ['harbor', 'seaport', 'container_port'];
    const scene = new Phaser.Scene('PortReview');
    scene.preload = function () {
      for (const id of ids) for (const suffix of ['', '-broken']) this.load.image(`tile_building_${id}${suffix}`, `/assets/sprites/buildings/${id}${suffix}.png`);
    };
    scene.create = function () {
      this.cameras.main.setBackgroundColor('#526b70');
      const text = (x, y, label, size = 18) => this.add.text(x, y, label, { fontFamily: 'sans-serif', fontSize: size, color: '#f6e9c7' }).setOrigin(.5);
      text(500, 28, 'CONTAINER PORT — crane and terminal activity', 24);
      text(265, 78, 'Detail view'); text(750, 120, 'Harbor → Seaport → Container Port');
      text(750, 150, 'Actual tile renderer · gameplay zoom 1.0', 15);
      const preview = this.add.image(270, 350, 'tile_building_container_port').setDisplaySize(510, 510).setDepth(14);
      const smallPreview = this.add.image(750, 510, 'tile_building_container_port').setDisplaySize(40, 46).setDepth(14);
      text(750, 558, 'Small map scale · 40 px', 15);
      const tiles = ids.map((id, x) => ({ x, y: 0, type: 'coast', ownerId: 'test', buildingId: id }));
      const map = { width: 3, height: 1, tileSize: 112, tiles: [tiles] };
      const center = x => ({ x: 610 + x * 140, y: 300 });
      const outline = x => Array.from({ length: 6 }, (_, i) => ({ x: center(x).x + Math.cos((i * 60 - 30) * Math.PI / 180) * 62, y: 300 + Math.sin((i * 60 - 30) * Math.PI / 180) * 62 }));
      const tileMap = { tileToWorld: center, getTileRect: x => ({ x: center(x).x - 56, y: 238, width: 112, height: 124 }), getTileOutlinePoints: outline, getTileSize: () => 112 };
      for (let x = 0; x < 3; x++) {
        const g = this.add.graphics(); g.fillStyle(0x306372); const points = outline(x); g.beginPath(); g.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) g.lineTo(p.x, p.y); g.closePath(); g.fillPath();
        text(center(x).x, 392, ['Harbor', 'Seaport', 'Container Port'][x], 15);
      }
      let broken = false, visible = true;
      const renderer = new TileBuildingRenderer(this, tileMap, map, {});
      renderer.setBrokenPredicate(x => x === 2 && broken);
      renderer.setVisibilityPredicate(x => x !== 2 || visible);
      const ambient = AmbientSprites.forScene(this);
      ambient.attach(preview, 'building', 'container-port-detail', () => [2, 0], () => !broken && visible);
      ambient.attach(smallPreview, 'building', 'container-port-small', () => [2, 0], () => !broken && visible);
      this.events.off(Phaser.Scenes.Events.UPDATE, ambient.tick, ambient);
      for (const b of ambient.bindings) if (b.sprite.texture.key.includes('container_port')) b.seed = 0;
      const commands = () => [...ambient.layers.values()].reduce((n, g) => n + g.commandBuffer.length, 0);
      window.frame = t => { ambient.elapsed = t * 1000 - 50; ambient.lastDraw = -Infinity; ambient.update(0, 50); return commands(); };
      window.port = { ambient, scene: this, renderer, preview, map, commands,
        onlyPort() { preview.setVisible(false); smallPreview.setVisible(false); for (const b of ambient.bindings) if (!b.sprite.texture.key.includes('container_port')) b.sprite.setVisible(false); },
        broken(value) { broken = value; renderer.refreshTile(2, 0); },
        visible(value) { visible = value; renderer.refreshTile(2, 0); },
      };
      text(500, 650, '+2 Production · +2 Gold · +10% Production · +2 Happiness · +5 Trade Capacity', 18);
      text(500, 685, 'Unlocked by Combustion · Replaces Seaport on its existing water tile', 17);
      window.portReady = true;
    };
    window.game = new Phaser.Game({ type: canvas ? Phaser.CANVAS : Phaser.WEBGL, width: 1000, height: 800, scene, audio: { noAudio: true }, banner: false });
  }, process.env.EPOCH_CANVAS === '1');
  await page.waitForFunction(() => window.portReady);
  const snapshots = [];
  for (const t of [1, 4.5, 8, 11, 14, 17]) {
    await page.evaluate(t => window.frame(t), t); await page.waitForTimeout(70);
    const path = `${output}/port-${t}.png`; await page.screenshot({ path }); snapshots.push(path);
  }
  const crops = [];
  for (const path of snapshots) {
    const c = createCanvas(112, 124), ctx = c.getContext('2d'); ctx.drawImage(await loadImage(path), 834, 238, 112, 124, 0, 0, 112, 124);
    crops.push(ctx.getImageData(0, 0, 112, 124).data);
  }
  const changes = new Set();
  for (const data of crops.slice(1)) for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - crops[0][i]) + Math.abs(data[i + 1] - crops[0][i + 1]) + Math.abs(data[i + 2] - crops[0][i + 2]) > 35) changes.add(i / 4);
  assert.ok(changes.size > 30, `visible motion at normal tile size (${changes.size} changed pixels)`);
  const smallCrops = [];
  for (const path of snapshots) {
    const c = createCanvas(40, 46), ctx = c.getContext('2d'); ctx.drawImage(await loadImage(path), 730, 487, 40, 46, 0, 0, 40, 46);
    smallCrops.push(ctx.getImageData(0, 0, 40, 46).data);
  }
  const smallChanges = new Set();
  for (const data of smallCrops.slice(1)) for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - smallCrops[0][i]) + Math.abs(data[i + 1] - smallCrops[0][i + 1]) + Math.abs(data[i + 2] - smallCrops[0][i + 2]) > 35) smallChanges.add(i / 4);
  assert.ok(smallChanges.size > 10, `motion remains readable at 40px (${smallChanges.size} changed pixels)`);
  const savedMap = await page.evaluate(() => JSON.stringify(window.port.map));
  await page.evaluate(() => window.port.onlyPort());
  assert.ok(await page.evaluate(() => window.frame(4.5)) > 100, 'active port submits hoist/truck activity');
  await page.evaluate(() => window.port.broken(true));
  assert.ok(await page.evaluate(() => window.frame(4.5)) <= 1, 'broken port stops operation');
  await page.screenshot({ path: `${output}/port-broken.png` });
  await page.evaluate(() => window.port.broken(false));
  assert.ok(await page.evaluate(() => window.frame(4.5)) > 100, 'repair restores activity');
  await page.evaluate(() => window.port.visible(false));
  assert.ok(await page.evaluate(() => window.frame(4.5)) <= 1, 'fog removes activity');
  await page.evaluate(() => window.port.visible(true));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(await page.evaluate(() => window.frame(4.5)) <= 1, 'reduced motion disables operation');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.port.scene.cameras.main.setZoom(.4));
  assert.ok(await page.evaluate(() => window.frame(4.5)) <= 1, 'overview disables detail');
  await page.evaluate(() => {
    window.port.scene.cameras.main.setZoom(1);
    window.port.scene.events.on('update', window.port.ambient.tick, window.port.ambient);
  });
  const before = await page.evaluate(() => window.port.ambient.elapsed);
  await page.waitForTimeout(1100);
  const after = await page.evaluate(() => window.port.ambient.elapsed);
  assert.ok(after - before > 700, 'real render clock advances');
  assert.equal(await page.evaluate(() => JSON.stringify(window.port.map)), savedMap, 'animation leaves simulation untouched');
  await page.evaluate(() => window.game.scene.stop('PortReview'));
  assert.equal(await page.evaluate(() => window.port.ambient.bindings.size), 0, 'shutdown releases registrations');

  // Real City View production card, tooltip, sprite and settlement progress.
  const styles = (await fs.readFile('index.html', 'utf8')).match(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n');
  await page.goto(url + '/container-port-review');
  await page.setContent(`<base href="${url}/">${styles}<div id="app-layout"></div>`);
  await page.evaluate(async () => {
    const { CityView } = await import('/src/ui/CityView.ts');
    const { City } = await import('/src/entities/City.ts');
    const { CityBuildings } = await import('/src/entities/CityBuildings.ts');
    const { CONTAINER_PORT } = await import('/src/data/buildings.ts');
    const { getSettlementProgress } = await import('/src/systems/SettlementProgress.ts');
    const city = new City({ id: 'port-ui', name: 'Container Terminal', ownerId: 'test', tileX: 2, tileY: 2 }); city.settlementStage = 'Town';
    const buildings = new CityBuildings(city.id), view = new CityView();
    view.setSettlementStageProvider(() => city.settlementStage);
    view.setSettlementProgressProvider(() => getSettlementProgress(city, buildings, () => true));
    window.completePort = () => buildings.add(CONTAINER_PORT);
    view.show(city, [], [{ id: CONTAINER_PORT.id, name: CONTAINER_PORT.name, description: CONTAINER_PORT.description, cost: CONTAINER_PORT.productionCost, placement: CONTAINER_PORT.placement }], { active: false }, { visible: false, enabled: false, buttonLabel: '' }, [], [], [], []);
  });
  await page.getByRole('button', { name: '⚙️ Production', exact: true }).click();
  await page.getByRole('button', { name: /Buildings$/ }).click();
  const card = page.locator('.city-view-production-button').filter({ has: page.locator('strong', { hasText: /^Container Port$/ }) });
  assert.equal(await card.count(), 1); assert.equal(await card.getAttribute('aria-disabled'), 'false');
  assert.ok(await card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
  await card.hover(); await page.waitForTimeout(600);
  for (const modifier of ['+2 Production per turn', '+2 Gold per turn', '+10% Production', '+2 Happiness', '+5 Trade Capacity', 'Replaces Seaport']) {
    assert.ok((await page.locator('.city-view-tooltip').innerText()).includes(modifier));
  }
  await page.screenshot({ path: `${output}/city-view.png` });
  await page.evaluate(() => window.completePort());
  await page.getByRole('button', { name: 'Progress to next level' }).click();
  assert.match(await page.locator('.development-requirements > div').first().innerText(), /^■ Railway Station OR Seaport$/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, renderer: process.env.EPOCH_CANVAS === '1' ? 'Canvas' : 'WebGL', normalZoomChangedPixels: changes.size, smallScaleChangedPixels: smallChanges.size, output }));
} finally { await browser.close(); }
