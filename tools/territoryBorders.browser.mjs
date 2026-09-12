import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const save = JSON.parse(await fs.readFile(process.env.EPOCH_SAVE ?? 'autorun-input/boundries.json', 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/systems/TerritoryRenderer.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('this.scene = scene;', 'window.testTerritory = this; this.scene = scene;') });
  });
  await page.goto(`${process.env.EPOCH_URL ?? 'http://127.0.0.1:5174'}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, { timeout: 90000 });
  assert.equal((await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save)).ok, true);
  await page.waitForFunction(() => window.testTerritory?.activeSegments.size > 0, undefined, { timeout: 90000 });
  const result = await page.evaluate(() => {
    const r = window.testTerritory;
    const map = r.mapData;
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const verify = () => {
      const expected = new Map();
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const owner = map.tiles[y][x].ownerId;
        if (owner === undefined) continue;
        for (const n of r.gridSystem.getAdjacentCoords({ x, y })) {
          const other = map.tiles[n.y]?.[n.x]?.ownerId;
          if (owner !== other) {
            const key = `${x},${y}`;
            expected.set(key, (expected.get(key) ?? 0) + 1);
          }
        }
      }
      const actual = new Map();
      for (const s of r.activeSegments.values()) {
        check(map.tiles[s.tileY][s.tileX].ownerId === s.ownerId, 'segment belongs to its tile');
        const key = `${s.tileX},${s.tileY}`;
        actual.set(key, (actual.get(key) ?? 0) + 1);
        if (s.shared) check([...r.activeSegments.values()].some(t => t.ownerId !== s.ownerId && t.shared && Math.hypot(t.ax - s.bx, t.ay - s.by, t.bx - s.ax, t.by - s.ay) < 0.01), 'shared border has both nation colors');
      }
      check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), 'all exposed edges are present');
    };
    verify();
    const initial = r.activeSegments.size;
    const shared = [...r.activeSegments.values()].filter(s => s.shared);
    check(shared.some(s => s.ownerId === 'nation_usa') && shared.some(s => s.ownerId === 'nation_canada'), 'USA and Canada fixture');
    const s = shared[0];
    const tile = map.tiles[s.tileY][s.tileX];
    const original = tile.ownerId;
    for (const owner of [undefined, 'test_nation', original]) {
      tile.ownerId = owner;
      r.flush();
      verify();
      const incremental = JSON.stringify([...r.activeSegments.entries()].sort((a, b) => a[0] - b[0]));
      r.rebuildAllSegments();
      check(JSON.stringify([...r.activeSegments.entries()].sort((a, b) => a[0] - b[0])) === incremental, 'incremental update matches full rebuild');
    }
    const camera = r.scene.cameras.main;
    const outline = r.tileMap.getTileOutlinePoints(44, 37);
    camera.setZoom(1.4);
    camera.centerOn(outline.reduce((a, p) => a + p.x, 0) / 6, outline.reduce((a, p) => a + p.y, 0) / 6);
    r.flush();
    return { segments: initial, sharedHalves: shared.length };
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/epoch-territory-borders.png' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
