import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import Phaser from 'phaser';
    import { SelectionManager } from './src/systems/SelectionManager';
    import { CameraController } from './src/systems/CameraController';
    import { WorldInputGate } from './src/systems/input/WorldInputGate';
    import { TileInspectorDialog } from './src/ui/TileInspectorDialog';
    import { buildTileInspection } from './src/systems/TileInspectionData';
    import { UnitManager } from './src/systems/UnitManager';
    import { CityManager } from './src/systems/CityManager';
    import { NationManager } from './src/systems/NationManager';
    import { AirOperationsSystem } from './src/systems/AirOperationsSystem';
    import { HexGridSystem } from './src/systems/grid/HexGridSystem';
    import { Unit } from './src/entities/Unit';
    import { City } from './src/entities/City';
    import { WARRIOR, FIGHTER, TRANSPORT_SHIP, CARRIER, SPY } from './src/data/units';
    import { AIR_BASE, AIRPORT } from './src/data/buildings';
    const game = new Phaser.Game({ type: Phaser.CANVAS, width: 800, height: 600,
      banner: false, audio: { noAudio: true }, scene: { create() {
        const scene = this;
        window.setup = (kind) => {
          window.dialog?.shutdown();
          const mapData = { width: 10, height: 10, tileSize: 32,
            tiles: Array.from({length:10}, (_, y) => Array.from({length:10}, (_, x) => ({x,y,type:'plains'}))) };
          const unitManager = new UnitManager(10,10), cityManager = new CityManager();
          const gridSystem = new HexGridSystem();
          const spawn = (id, unitType, x=2, y=2) => {
            const unit = new Unit({id,name:id,ownerId:'a',tileX:x,tileY:y,unitType});
            unitManager.addUnit(unit); return unit;
          };
          if (kind === 'airport' || kind === 'airbase') {
            const building = kind === 'airport' ? AIRPORT : AIR_BASE;
            const city = new City({id:'city',name:'City',ownerId:'a',tileX:1,tileY:2});
            city.ownedTileCoords = [{x:1,y:2},{x:2,y:2}]; cityManager.addCity(city);
            cityManager.getBuildings('city').add(building); mapData.tiles[2][2].buildingId = building.id;
            new AirOperationsSystem(unitManager, cityManager, mapData, gridSystem, undefined, () => 1, () => 'a', () => true);
            for (let i=0;i<4;i++) spawn('plane'+i,FIGHTER);
            unitManager.airOperations.reconcile();
          } else if (kind === 'transport') {
            const ship = spawn('ship',TRANSPORT_SHIP);
            for (let i=0;i<3;i++) { const cargo = spawn('cargo'+i,WARRIOR,1,2); unitManager.boardUnit(cargo.id,ship.id); }
          } else if (kind === 'carrier') {
            spawn('carrier',CARRIER);
            new AirOperationsSystem(unitManager, cityManager, mapData, gridSystem, undefined, () => 1, () => 'a', () => true);
            for (let i=0;i<2;i++) spawn('plane'+i,FIGHTER);
            unitManager.airOperations.reconcile();
          } else { spawn('soldier',WARRIOR); if (kind === 'covert') spawn('spy',SPY); }
          const tileMap = { tileToWorld: (x,y) => ({x:x*32,y:y*32}), getTileOutlinePoints: () => [] };
          const gate = new WorldInputGate();
          const camera = new CameraController(scene,3200,3200,gate);
          const selection = new SelectionManager(scene,tileMap,camera,cityManager,unitManager,gate);
          selection.selectTile(mapData.tiles[2][2]);
          camera.setHorizontalArrowsCaptured(() => selection.canCycleUnits());
          window.selection = selection; window.camera = camera; window.scene = scene;
          window.units = unitManager;
          window.dialog = new TileInspectorDialog(id => {
            const unit = unitManager.getUnit(id); if (!unit) return false;
            selection.selectUnit(unit); return true;
          });
          window.openInfo = () => window.dialog.open(buildTileInspection({x:2,y:2}, {
            mapData, unitManager, cityManager, gridSystem, nationManager: new NationManager()
          }));
          window.selectedId = () => selection.getSelected()?.unit?.id;
        };
        window.ready = true;
      } }
    });
  ` }, bundle: true, write: false, format: 'iife', logLevel: 'silent',
});
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<body style="margin:0"></body>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForFunction(() => window.ready);
  for (const [kind, expected] of [
    ['airport',['plane0','plane1','plane2','plane3']],
    ['airbase',['plane0','plane1','plane2','plane3']],
    ['transport',['ship','cargo0','cargo1','cargo2']],
    ['carrier',['carrier','plane0','plane1']],
    ['covert',['soldier','spy']],
  ]) {
    await page.evaluate(kind => window.setup(kind),kind);
    const actual = await page.evaluate(n => Array.from({length:n+1}, () => {
      window.selection.cycleUnits(1); return window.selectedId();
    }),expected.length);
    assert.deepEqual(actual,[...expected,expected[0]],kind+' cycles forward and wraps');
    await page.evaluate(() => window.selection.cycleUnits(-1));
    assert.equal(await page.evaluate(() => window.selectedId()),expected.at(-1),kind+' wraps backward');
    await page.evaluate(() => window.openInfo());
    assert.equal(await page.locator('.tile-unit-select').count(),expected.length);
    await page.locator('[data-unit-id="'+expected[1]+'"] img').click();
    assert.equal(await page.evaluate(() => window.selectedId()),expected[1]);
    assert.equal(await page.evaluate(() => window.dialog.isOpen()),false);
    // The camera reads held keys each frame; cycling arrows must not also pan.
    const movement = await page.evaluate(() => {
      const camera = window.camera;
      window.scene.cameras.main.scrollX = 500;
      camera.keys.right.isDown = true;
      camera.update(100);
      const stacked = camera.scrollX;
      camera.keys.right.isDown = false;
      camera.keys.d.isDown = true; camera.update(100); camera.keys.d.isDown = false;
      return {stacked,wasd:camera.scrollX};
    });
    assert.equal(movement.stacked,500); assert.ok(movement.wasd>500);
    console.log(kind+': forward/backward wrap, portrait selection and camera arbitration passed');
  }
  await page.evaluate(() => {
    window.setup('covert');
    window.selection.setVisibilityPredicates(() => true, () => true, u => u.id !== 'spy');
  });
  assert.equal(await page.evaluate(() => window.selection.cycleUnits(1)),false,'hidden spy is not selectable');
  await page.evaluate(() => window.selection.setVisibilityPredicates(() => false, () => true));
  assert.equal(await page.evaluate(() => window.selection.canCycleUnits()),false,'fog blocks cycling');
  await page.evaluate(() => { window.setup('single'); window.openInfo(); });
  assert.equal(await page.evaluate(() => window.selection.cycleUnits(-1)),false,'single unit does not consume arrows');
  // Native keyboard activation selects the portrait without leaking Enter to turn hotkeys.
  await page.evaluate(() => {
    window.enterLeaks = 0;
    window.addEventListener('keydown', e => { if (e.key === 'Enter') window.enterLeaks++; });
  });
  await page.locator('.tile-unit-select').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.selectedId()),'soldier');
  assert.equal(await page.evaluate(() => window.dialog.isOpen()),false);
  assert.equal(await page.evaluate(() => window.enterLeaks),0);
  await page.evaluate(() => window.openInfo());
  // Removed units cannot be selected through a stale snapshot.
  await page.evaluate(() => window.units.removeUnit('soldier'));
  await page.locator('.tile-unit-select').click();
  assert.equal(await page.evaluate(() => window.dialog.isOpen()),true);
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
