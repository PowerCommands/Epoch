/** Standalone: node tools/airMissionAnimation.browser.mjs <vite-url> */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export async function checkAirMissionAnimations(page, url) {
  const output = '/tmp/epoch-air-animation';
  await mkdir(output, { recursive: true });
  await page.route('**/__air_test', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#263a34"></body></html>' }));
  for (const canvas of [false, true]) {
    await page.goto(`${url}/__air_test`);
    await page.evaluate(async canvas => {
      const { default: Phaser } = await import('/node_modules/.vite/deps/phaser.js');
      const { AirMissionRenderer } = await import('/src/renderers/AirMissionRenderer.ts');
      const { RangedPreviewRenderer } = await import('/src/systems/RangedPreviewRenderer.ts');
      const { GeometryClip } = await import('/src/systems/rendering/GeometryClip.ts');
      const { CombatAnimationSystem } = await import('/src/systems/CombatAnimationSystem.ts');
      const { ALL_UNIT_TYPES, TRIPLANE, MOBILE_SAM } = await import('/src/data/units.ts');
      const types = ALL_UNIT_TYPES.filter(type => type.aircraftRole);
      const listeners = new Set();
      const state = window.airTest = { enabled: true, fog: false, listeners, types };
      state.game = new Phaser.Game({ type: canvas ? Phaser.CANVAS : Phaser.WEBGL, width: 900, height: 600,
        backgroundColor: '#55694d', audio: { noAudio: true }, scene: {
          preload() { for (const type of types) this.load.image(`unit_${type.id}`, `/assets/sprites/units/${type.id}.png`); },
          create() {
            const scene = state.scene = this;
            const map = { getTileSize: () => 50,
              getTileOutlinePoints: (x, y) => [{ x: 25 + x * 50, y: 25 + y * 50 }, { x: 75 + x * 50, y: 25 + y * 50 }, { x: 75 + x * 50, y: 75 + y * 50 }, { x: 25 + x * 50, y: 75 + y * 50 }], tileToWorld: (x,y) => ({ x: 50 + x * 50, y: 50 + y * 50 }),
              worldToTile: (x,y) => ({ x: Math.round((x - 50) / 50), y: Math.round((y - 50) / 50) }) };
            state.renderer = new AirMissionRenderer(scene, map,
              { onFlight: callback => { listeners.add(callback); return () => listeners.delete(callback); } },
              () => state.enabled, () => !state.fog);
            state.groundAnimation = new CombatAnimationSystem(scene, map,
              { getUnitContainer: () => { throw new Error('Aircraft entered the ground projectile animation'); } }, { isActive: () => false });
            const preview = new RangedPreviewRenderer(scene, map);
            scene.add.rectangle(450, 350, 250, 250, 0x334455).setDepth(-1).setName('test-terrain');
            const ground = scene.add.graphics().setName('test-ground').setDepth(0);
            ground.lineStyle(1, 0x9ba880, .25);
            for (let x = 0; x < 900; x += 50) ground.lineBetween(x, 0, x, 600);
            for (let y = 0; y < 600; y += 50) ground.lineBetween(0, y, 900, y);
            ground.lineStyle(2, 0xffcc88, .8).strokeEllipse(450, 350, 44, 24);
            const targetSprite = state.targetSprite = scene.add.rectangle(450, 350, 40, 40, 0x00ff00).setDepth(14).setName('test-target');
            const clipSource = scene.add.graphics().setVisible(false).fillStyle(0xffffff).fillRect(430, 330, 40, 40);
            new GeometryClip(clipSource).attach(targetSprite);
            state.fire = (id = 'great_war_bomber', kind = 'strike', defense = 'fighter', destroyed = false) => {
              const event = { aircraft: { unitType: types.find(type => type.id === id) }, origin: { x: 1, y: 7 },
                destination: { x: 8, y: 6 }, kind, destroyed,
                ...(kind === 'intercepted' ? { interceptor: { unitType: defense === 'fighter' ? TRIPLANE : MOBILE_SAM }, interceptorOrigin: { x: 3, y: 2 } } : {}) };
              targetSprite.setFillStyle(0x00ff00);
              preview.showTargets(new Set(['9,6']));
              if (kind === 'strike') {
                let resolved = false;
                event.resolveImpact = () => {
                  if (resolved) return;
                  resolved = true; targetSprite.setFillStyle(0xff0000);
                };
              }
              preview.clear();
              const before = JSON.stringify(event);
              let animated = false;
              for (const listener of listeners) animated = listener(event) === true || animated;
              if (!animated) event.resolveImpact?.();
              if (JSON.stringify(event) !== before) throw new Error('Renderer mutated the resolved event');
            };
            state.stepTo = age => {
              const flight = state.renderer.flights[0];
              state.renderer.update(0, age - flight.age);
              const r = state.game.renderer; r.preRender(); scene.sys.render(r); r.postRender();
            };
            state.clean = () => state.renderer.update(0, 60000);
          },
        } });
    }, canvas);
    await page.waitForFunction(() => window.airTest?.fire);
    // Verify natural scene-clock progress before sampling exact visual phases.
    await page.evaluate(() => window.airTest.fire());
    await page.waitForFunction(() => window.airTest.renderer.flights[0]?.age > 100);
    await page.evaluate(() => { window.airTest.game.loop.stop(); window.airTest.clean(); });
    const ids = await page.evaluate(() => window.airTest.types.map(type => type.id));
    for (const id of ids) {
      const plan = await page.evaluate(async id => {
        const s = window.airTest;
        const type = s.types.find(type => type.id === id);
        await s.groundAnimation.playRangedAttack({ unitType: type }, 8, 6, { shakeOnImpact: true });
        s.fire(id);
        return s.renderer.flights[0].plan;
      }, id);
      assert.equal(await page.evaluate(() => window.airTest.targetSprite.fillColor), 0x00ff00, 'target is still intact after launch');
      assert.equal(await page.evaluate(() => window.airTest.scene.children.list.some(o => o.type === 'RenderTexture')), false, 'flight adds no rectangular ground copy');
      const fighter = plan.weapons[0].kind === 'missile';
      const phases = { approach: plan.weapons[0].releaseMs - 80,
        weapons: fighter ? plan.passMs - 160 : plan.passMs + 180,
        impact: plan.weapons[0].impactMs + 160, smoke: plan.weapons[0].impactMs + 850 };
      for (const [phase, age] of Object.entries(phases)) {
        const sample = await page.evaluate(age => {
          const s = window.airTest; s.stepTo(age);
          const f = s.renderer.flights[0];
          return { x: f.aircraft.image.x, y: f.aircraft.image.y, visible: f.aircraft.image.visible,
            engineCommands: f.aircraft.engines.commandBuffer.length,
            weaponCommands: f.graphics.commandBuffer.length,
            smoke: f.smoke.flat().some(puff => puff.visible && puff.alpha > 0),
            texture: f.aircraft.image.texture.key };
        }, age);
        assert.equal(sample.texture, `unit_${id}`);
        if (phase === 'approach') {
          assert.ok(sample.visible && sample.x > 450 && sample.y < 350);
          assert.ok(sample.engineCommands > 0);
          assert.equal(sample.smoke, false);
        }
        if (phase === 'weapons') { assert.ok(sample.weaponCommands > 0); assert.equal(sample.smoke, false); }
        if (phase === 'impact' || phase === 'smoke') assert.ok(sample.smoke);
        if (!canvas) await page.screenshot({ path: `${output}/${id}-${phase}.png` });
      }
      await page.evaluate(id => {
        const s = window.airTest;
        s.clean(); s.fire(id);
        const f = s.renderer.flights[0];
        const revealMs = Math.max(...f.plan.weapons.map(w => w.impactMs)) + 420;
        s.stepTo(revealMs - 1);
        if (s.targetSprite.fillColor !== 0x00ff00) throw new Error('Damage applied before final explosion ended');
        s.stepTo(revealMs);
        if (s.targetSprite.fillColor !== 0xff0000) throw new Error('Damage missing after final explosion');
        s.clean();
      }, id);
      for (const defense of ['fighter', 'sam']) for (const destroyed of [false, true]) {
        const result = await page.evaluate(({ id, defense, destroyed }) => {
          const s = window.airTest; s.fire(id, 'intercepted', defense, destroyed);
          const f = s.renderer.flights[0];
          let smoke = false;
          for (let t = 100; t < f.plan.endMs; t += 100) { s.stepTo(t); smoke ||= f.smoke.length > 0; }
          const result = { weapons: f.plan.weapons.length, smoke, visible: f.aircraft.image.visible };
          s.clean(); return result;
        }, { id, defense, destroyed });
        assert.deepEqual(result, { weapons: 0, smoke: false, visible: false });
      }
    }
    const lifecycle = await page.evaluate(() => {
      const s = window.airTest;
      s.fire('bomber', 'rebase'); s.stepTo(400);
      const f = s.renderer.flights[0];
      const transfer = f.aircraft.image.x > f.plan.start.x && f.aircraft.image.x < f.plan.end.x && f.plan.weapons.length === 0;
      s.clean();
      s.fire(); s.stepTo(s.renderer.flights[0].plan.passMs + 700);
      s.fog = true; s.renderer.update(0, 10);
      const fogged = s.scene.children.list.filter(o => !['test-ground', 'test-target', 'test-terrain'].includes(o.name)).every(o => !o.visible || o.type === 'Graphics' && o.commandBuffer.length === 0);
      s.clean(); s.fire(); const hiddenSkipped = s.renderer.flights.length === 0;
      s.fog = false; s.fire(); s.enabled = false; s.renderer.update(0, 10); s.fire();
      const disabled = s.renderer.flights.length === 0;
      s.enabled = true; for (let i = 0; i < 15; i++) s.fire();
      const bounded = s.renderer.flights.length === 8;
      s.scene.events.emit('shutdown');
      const clean = s.scene.children.list.filter(o => !['test-ground', 'test-target', 'test-terrain'].includes(o.name)).length === 0 && s.listeners.size === 0;
      return { transfer, fogged, hiddenSkipped, disabled, bounded, clean };
    });
    assert.deepEqual(lifecycle, { transfer: true, fogged: true, hiddenSkipped: true, disabled: true, bounded: true, clean: true });
    console.log(`PASS: ${canvas ? 'Canvas' : 'WebGL'}: six aircraft, timed weapons/impacts/smoke, 24 interception cases, rebase, fog, autorun, bounded cleanup and scene shutdown.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.EPOCH_BROWSER_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await checkAirMissionAnimations(page, process.argv[2] ?? 'http://127.0.0.1:5173');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
