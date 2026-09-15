/** Run against Vite: EPOCH_URL=http://127.0.0.1:5174 node tools/nuclearPresentation.browser.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
const base = process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
const output = process.env.EPOCH_TEST_OUTPUT ?? '/tmp/epoch-nuclear-presentation';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  for (const mode of ['webgl', 'canvas']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // A real Phaser scene and real strategic combat, isolated from menus and AI setup.
    await page.route('**/tools/nuclear-review', route => route.fulfill({ contentType: 'text/html', body: `
      <style>body{margin:0;background:#182321}</style><script type="module">
      import Phaser from '/node_modules/phaser/dist/phaser.esm.js';
      window.Phaser = Phaser;
      window.game = new Phaser.Game({type:Phaser.${mode === 'canvas' ? 'CANVAS' : 'WEBGL'},width:1200,height:900,
        scene:{create(){window.scene=this;window.ready=true;}}});
      </script>` }));
    await page.goto(base + '/tools/nuclear-review');
    await page.waitForFunction(() => window.ready);
    await page.evaluate(async () => {
      const [{ NuclearStrikeRenderer }, { TileMap }, { HexGridLayout }, { HexGridSystem }, { StrategicWeaponsSystem },
        { UnitManager }, { CityManager }, { Unit }, { City }, types, buildings, { SaveLoadService }] = await Promise.all([
        import('/src/renderers/NuclearStrikeRenderer.ts'), import('/src/systems/TileMap.ts'),
        import('/src/systems/gridLayout/HexGridLayout.ts'), import('/src/systems/grid/HexGridSystem.ts'),
        import('/src/systems/StrategicWeaponsSystem.ts'), import('/src/systems/UnitManager.ts'),
        import('/src/systems/CityManager.ts'), import('/src/entities/Unit.ts'), import('/src/entities/City.ts'),
        import('/src/data/units.ts'), import('/src/data/buildings.ts'), import('/src/systems/SaveLoadService.ts'),
      ]);
      window.game.loop.stop();
      const s = window.scene;
      window.allowed = true; window.visibility = 'all';
      const map = TileMap.generatePlaceholder(24, 24, 48);
      // Include visible improvements and a distinctive terrain pattern to compare after clearing.
      window.map = map;
      const tileMap = new TileMap(s, map, new HexGridLayout());
      const units = new UnitManager(24, 24), cities = new CityManager();
      const target = new City({ id: 'target', name: 'Target', ownerId: 'b', tileX: 10, tileY: 10 });
      target.health = 400; target.population = 20; cities.addCity(target);
      map.tiles[10][10].ownerId = 'b';
      const silo = new City({ id: 'silo', name: 'Silo', ownerId: 'a', tileX: 2, tileY: 10 });
      cities.addCity(silo); cities.getBuildings(silo.id).add(buildings.NUCLEAR_SILO);
      const weapons = new StrategicWeaponsSystem(units, cities, map, new HexGridSystem());
      const visible = (x, y) => window.visibility === 'all' || (window.visibility === 'origin' && x < 4);
      window.effect = new NuclearStrikeRenderer(s, tileMap, weapons, () => window.allowed, visible);
      weapons.onDetonation(() => tileMap.rebuildTerrain());
      const center = tileMap.tileToWorld(10, 10);
      s.cameras.main.setZoom(0.9).centerOn(center.x - 90, center.y - 110);
      window.render = () => { const r = window.game.renderer; r.preRender(); s.sys.render(r); r.postRender(); };
      window.advance = age => {
        const strike = window.effect.strikes[0];
        const delta = age - (strike?.age ?? 0);
        window.effect.update(0, delta); window.render();
      };
      let serial = 0;
      window.launch = (kind = 'nuclear_missile') => {
        const type = kind === 'atomic_bomb' ? types.ATOMIC_BOMB : types.NUCLEAR_MISSILE;
        const missile = new Unit({ id: 'ordnance' + serial++, name: type.name, ownerId: 'a', tileX: 2, tileY: 10, unitType: type });
        units.addUnit(missile);
        if (kind === 'atomic_bomb') {
          const bomber = new Unit({ id: 'bomber' + serial++, name: 'Bomber', ownerId: 'a', tileX: 2, tileY: 10, unitType: types.BOMBER });
          units.addUnit(bomber); units.boardUnit(missile.id, bomber.id, 0);
        }
        const ok = weapons.launch(missile, 10, 10);
        const save = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(map)));
        const restored = TileMap.generatePlaceholder(24, 24, 48);
        SaveLoadService.restoreTiles(save, restored);
        window.render();
        return { ok, consumed: !units.getUnit(missile.id), health: target.health,
          waste: map.tiles.flat().filter(t => t.type === 'nuclear_waste').length,
          restored: JSON.stringify(SaveLoadService.serializeTiles(restored)) === JSON.stringify(save),
          active: window.effect.strikes.length, flightMs: window.effect.strikes.at(-1)?.flightMs,
          radius: window.effect.strikes.at(-1)?.radius };
      };
      window.render();
    });
    const initial = await page.locator('canvas').screenshot();
    const launch = await page.evaluate(() => window.launch());
    assert.ok(launch.ok && launch.consumed && launch.waste > 0 && launch.restored);
    assert.equal(launch.health, 160, 'damage is committed while the missile is still at launch');
    async function capture(name, age) {
      await page.evaluate(age => window.advance(age), age);
      const shot = await page.locator('canvas').screenshot();
      await fs.writeFile(`${output}/${mode}-${name}.png`, shot);
      return shot;
    }
    const takeoff = await capture('01-launch', 350);
    await capture('02-flight', launch.flightMs * 0.62);
    await capture('03-flash', launch.flightMs + 80);
    await capture('04-fireball', launch.flightMs + 650);
    const cloud = await capture('05-cloud', launch.flightMs + 3300);
    const settling = await capture('06-settling', launch.flightMs + 6500);
    const clear = await capture('07-clear', launch.flightMs + 11000);
    assert.equal(await page.evaluate(() => window.effect.strikes.length), 0);
    // Compare actual rendered terrain, not just draw calls: old ground during flight,
    // dense dust at impact, and changed terrain after all temporary objects are gone.
    async function pixel(buffer, x, y) {
      const image = await loadImage(buffer), ctx = createCanvas(image.width, image.height).getContext('2d');
      ctx.drawImage(image, 0, 0); return [...ctx.getImageData(x, y, 1, 1).data];
    }
    const point = await page.evaluate(() => {
      const s = window.scene, target = window.effect.tileMap.tileToWorld(10, 10), c = s.cameras.main;
      return { x: Math.round((target.x - c.worldView.x) * c.zoom), y: Math.round((target.y - c.worldView.y) * c.zoom) };
    });
    assert.deepEqual(await pixel(initial, point.x, point.y), await pixel(takeoff, point.x, point.y), 'old terrain remains during flight');
    assert.notDeepEqual(await pixel(initial, point.x, point.y), await pixel(clear, point.x, point.y), 'waste appears after settling');
    assert.notDeepEqual(await pixel(cloud, point.x, point.y), await pixel(clear, point.x, point.y), 'dust obscures the blast center');
    assert.notDeepEqual(await pixel(settling, point.x, point.y), await pixel(cloud, point.x, point.y), 'dust evolves as it clears');
    const bomb = await page.evaluate(() => window.launch('atomic_bomb'));
    assert.ok(bomb.radius < launch.radius);
    await capture('08-atomic-cloud', bomb.flightMs + 3300);
    await page.evaluate(() => { window.allowed = false; window.effect.update(0, 40); });
    assert.equal(await page.evaluate(() => window.effect.strikes.length), 0, 'switching on autoplay clears active effects');
    assert.equal((await page.evaluate(() => window.launch())).active, 0, 'autoplay skips new effects');
    await page.evaluate(() => { window.allowed = true; window.visibility = 'none'; });
    assert.equal((await page.evaluate(() => window.launch())).active, 0, 'hidden AI launches skip effects');
    await page.evaluate(() => { window.visibility = 'origin'; window.launch(); window.advance(5000); });
    assert.equal(await page.evaluate(() => window.effect.strikes[0].cloud.visible), false, 'visible launch cannot reveal hidden impact');
    await page.evaluate(() => { window.visibility = 'all'; for (let i = 0; i < 5; i++) window.launch(); });
    assert.equal(await page.evaluate(() => window.effect.strikes.length), 3, 'concurrent effects stay bounded');
    await page.evaluate(() => window.effect.shutdown());
    assert.equal(await page.evaluate(() => window.scene.children.list.filter(c => c.name.startsWith('nuclear-')).length), 0);
    assert.equal((await page.evaluate(() => window.launch())).active, 0, 'shutdown unsubscribes from strategic events');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${mode}: launch, growing cloud, terrain reveal, blast sizes, synchronous damage/save roundtrip, visibility, autoplay, cleanup`);
  }
} finally { await browser.close(); }
