import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run against Vite. The game reference is injected into the browser response;
// production code and the supplied save remain untouched.
// node scripts/visualWorldAmbient.mjs <save.json> [server-url] [output-dir]
const [savePath, baseUrl = 'http://127.0.0.1:5173', output = '/tmp/epoch-ambient'] = process.argv.slice(2);
if (!savePath) throw new Error('Supply a populated Epoch save JSON.');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.__visualGame = game;` });
  });
  await page.goto(`${baseUrl}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame);
  const save = JSON.parse(await fs.readFile(savePath, 'utf8'));
  const started = await page.evaluate((state) => window.__epochDiagnostics.startSavedGame(state), save);
  assert.equal(started.ok, true, JSON.stringify(started));
  await page.waitForFunction(() => window.__epochDiagnostics?.focusFirstCity);
  await page.waitForTimeout(1500);

  // Use the existing developer console in this disposable browser session.
  // Display it directly because in-game keyboard handlers can consume shortcuts.
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input')]
      .find((element) => element.parentElement.style.zIndex === '10000');
    if (input) input.parentElement.style.display = 'flex';
  });
  await page.locator('input:visible').last().fill('fog off');
  await page.locator('input:visible').last().press('Enter');
  await page.evaluate(() => {
    for (const input of document.querySelectorAll('input')) {
      if (input.parentElement.style.zIndex === '10000') input.parentElement.style.display = 'none';
    }
  });
  for (let i = 0; i < 3; i++) {
    const decline = page.getByRole('button', { name: 'Do not participate', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.waitForTimeout(300);
  }
  for (const zoom of [0.8, 1.4, 2.2]) {
    await page.evaluate((value) => window.__epochDiagnostics.focusFirstCity(value), zoom);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${output}/zoom-${zoom}.png` });
  }
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${output}/motion-${i}.png` });
  }

  const frameTiming = await page.evaluate(async () => {
    const scene = window.__visualGame.scene.getScene('GameScene');
    const events = scene.events._events.update;
    const listener = (Array.isArray(events) ? events : [events])
      .find((event) => event.context.constructor.name === 'WorldAmbientRenderer');
    const layers = scene.children.list.filter((object) => object.name?.startsWith('ambient-'));
    const sample = async () => {
      const times = [];
      let last;
      await new Promise((resolve) => {
        const frame = (now) => {
          if (last !== undefined) times.push(now - last);
          last = now;
          if (times.length < 24) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      times.sort((a, b) => a - b);
      return { medianMs: times[12], p95Ms: times[22] };
    };
    const enabled = await sample();
    scene.events.off('update', listener.fn, listener.context);
    layers.forEach((layer) => layer.setVisible(false));
    const disabled = await sample();
    layers.forEach((layer) => layer.setVisible(true));
    scene.events.on('update', listener.fn, listener.context);
    return { enabled, disabled };
  });
  console.log('Browser frame timing (environment dependent):', frameTiming);
  const checks = await page.evaluate(() => {
    const scene = window.__visualGame.scene.getScene('GameScene');
    // Test-only inspection of EventEmitter context avoids adding a production
    // diagnostics API for this small visual system.
    const asList = (event) => Array.isArray(event) ? event : [event];
    const listener = asList(scene.events._events.update)
      .find((event) => event.context.constructor.name === 'WorldAmbientRenderer');
    const ambient = listener.context;
    const snapshot = () => {
      const state = window.__epochDiagnostics.getSaveState();
      return JSON.stringify([state.tiles, state.cities, state.units, state.nations]);
    };
    const before = snapshot();
    const times = [];
    for (let i = 0; i < 120; i++) {
      const start = performance.now();
      ambient.update(0, 41);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const unchanged = before === snapshot();
    const countObjects = () => scene.children.list.filter((object) => object.name?.startsWith('ambient-')).length;
    const objects = countObjects();
    const water = scene.children.getByName('ambient-water');
    const habitation = scene.children.getByName('ambient-habitation');
    const commandCount = () => water.commandBuffer.length + habitation.commandBuffer.length;
    const activeCommands = commandCount();
    // Current visibility must suppress activity, including remembered cities.
    ambient.canSee = () => false;
    ambient.update(0, 41);
    const hiddenCommands = commandCount();
    ambient.canSee = () => true;
    scene.cameras.main.setZoom(0.4);
    ambient.update(0, 41);
    const overviewCommands = commandCount();
    ambient.shutdown();
    const remaining = countObjects();
    const detached = !asList(scene.events._events.update).some((event) => event?.context === ambient);
    return {
      medianMs: times[60], p95Ms: times[114], unchanged, objects,
      activeCommands, hiddenCommands, overviewCommands, remaining, detached,
    };
  });
  console.log('Ambient checks:', checks);
  assert.equal(checks.unchanged, true, 'Ambient drawing must not mutate gameplay state');
  assert.equal(checks.objects, 2);
  assert.ok(checks.activeCommands > checks.hiddenCommands, 'Visible world should have ambient drawing');
  assert.equal(checks.overviewCommands, checks.hiddenCommands, 'Overview should have no animated detail');
  assert.equal(checks.remaining, 0);
  assert.equal(checks.detached, true);
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/checks.json`, JSON.stringify({ ...checks, frameTiming }, null, 2));
} finally {
  await browser.close();
}
