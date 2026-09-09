import Phaser from 'phaser';
import { ALL_BUILDINGS, GRAND_STADIUM } from '../src/data/buildings';
import { ALL_WONDERS } from '../src/data/wonders';
import { CITY_BASE_HEALTH } from '../src/data/cities';
import type { Era } from '../src/data/technologies';
import { TileBuildingRenderer } from '../src/systems/TileBuildingRenderer';
import { CityRenderer } from '../src/systems/CityRenderer';
import { City } from '../src/entities/City';
import { CityBuildings } from '../src/entities/CityBuildings';
import { WonderSystem } from '../src/systems/WonderSystem';
import { TileType, type MapData, type Tile } from '../src/types/map';
import type { TileMap } from '../src/systems/TileMap';
import type { CityManager } from '../src/systems/CityManager';
import type { NationManager } from '../src/systems/NationManager';
import type { ProductionSystem } from '../src/systems/ProductionSystem';
import { getBuildingSpritePath, getWonderSpritePath, getCitySpriteKey, getCitySpritePath } from '../src/utils/assetPaths';
import { MAX_VISIBLE_DAMAGE_EFFECTS } from '../src/renderers/StructureDamageEffects';

const eras: Era[] = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic', 'information', 'future'];
const buildings = [...ALL_BUILDINGS, GRAND_STADIUM].filter(b => b.placement !== 'city');
const checks: string[] = [];
function check(ok: unknown, description: string): asserts ok {
  if (!ok) throw new Error(description);
  checks.push(description);
}
const roundTrip = <T>(data: T): T => JSON.parse(JSON.stringify(data));

class Gallery extends Phaser.Scene {
  preload() {
    for (const b of [...buildings, { id: 'barbarian-camp' }]) for (const broken of [false, true]) {
      this.load.image(`tile_building_${b.id}${broken ? '-broken' : ''}`, '/' + getBuildingSpritePath(b.id, broken));
    }
    for (const w of ALL_WONDERS) for (const broken of [false, true]) {
      this.load.image(`tile_wonder_${w.id}${broken ? '-broken' : ''}`, '/' + getWonderSpritePath(w.id, broken));
    }
    for (const era of eras) for (const broken of [false, true]) this.load.image(getCitySpriteKey(era, broken), '/' + getCitySpritePath(era, broken));
    this.load.image('under_construction', '/assets/sprites/overlays/under-construction.png');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => { document.body.dataset.error = `Missing asset ${file.key}`; });
  }

  create() {
    try { this.verify(); } catch (e) { document.body.dataset.error = String(e); throw e; }
  }

  private verify() {
    const tiles: Tile[] = Array.from({ length: 96 }, (_, x) => ({ x, y: 0, type: TileType.Plains }));
    const map: MapData = { width: tiles.length, height: 1, tileSize: 100, tiles: [tiles] };
    const position = (x: number, y: number) => ({ x: 85 + (x % 10) * 145, y: 100 + Math.floor(x / 10) * 145 + y * 100 });
    const outline = (tx: number, ty: number) => {
      const { x, y } = position(tx, ty);
      return Array.from({ length: 6 }, (_, i) => ({ x: x + 66 * Math.cos(i * Math.PI / 3), y: y + 58 * Math.sin(i * Math.PI / 3) }));
    };
    const tileMap = { tileToWorld: position, getTileRect: (x: number, y: number) => ({ ...position(x, y), width: 132, height: 116 }), getTileOutlinePoints: outline } as unknown as TileMap;
    const baseline = this.children.length;
    const listenerBaseline = this.events.listenerCount(Phaser.Scenes.Events.UPDATE);
    const storedBuildings = new CityBuildings('city');
    const wonders = new WonderSystem();
    const renderer = new TileBuildingRenderer(this, tileMap, map, {} as ProductionSystem);
    renderer.setBrokenPredicate((x, y) => {
      const tile = map.tiles[y][x];
      return !!tile.buildingBroken || (!!tile.buildingId && storedBuildings.isBroken(tile.buildingId)) || (!!tile.wonderId && wonders.isWonderBroken(tile.wonderId));
    });
    const internals = renderer as any;
    const effects = internals.damageEffects;
    for (const kind of ['building', 'wonder'] as const) {
      const tile = tiles[0];
      const id = kind === 'building' ? 'granary' : ALL_WONDERS[0].id;
      if (kind === 'building') tile.buildingConstruction = { buildingId: id, cityId: 'city' };
      else tile.wonderConstruction = { wonderId: id, cityId: 'city' };
      renderer.refreshTile(0, 0);
      check(internals.signs.size === 1, `${kind}: shared construction sign visible`);
      check(internals.sprites.get('0,0').texture.key === `tile_${kind}_${id}`, `${kind}: normal artwork during construction`);
      map.tiles[0][0] = roundTrip(tile);
      renderer.rebuildAll();
      check(internals.signs.size === 1, `${kind}: construction restored from saved tile`);
      map.tiles[0][0] = tile;
      delete tile.buildingConstruction; delete tile.wonderConstruction;
      if (kind === 'building') { tile.buildingId = id; storedBuildings.addEntry(id, false); }
      else { tile.wonderId = id; wonders.restoreCompletedWonder({ wonderId: id, cityId: 'city', ownerId: 'owner', completedTurn: 1 }); }
      renderer.refreshTile(0, 0);
      check(internals.signs.size === 0 && effects.sites.size === 0, `${kind}: completion removes sign and keeps normal artwork`);
      if (kind === 'building') storedBuildings.setBroken(id, true); else wonders.setWonderBroken(id, true);
      renderer.refreshTile(0, 0);
      check(internals.sprites.get('0,0').texture.key.endsWith('-broken') && effects.sites.size === 1, `${kind}: break uses damaged artwork and starts effect`);
      if (kind === 'building') {
        const entries = roundTrip(storedBuildings.getAllEntries());
        storedBuildings.remove(id);
        for (const entry of entries) storedBuildings.addEntry(entry.buildingId, entry.broken);
      } else {
        const states = roundTrip(wonders.getCompletedWonders()); wonders.clearAll();
        states.forEach(state => wonders.restoreCompletedWonder(state));
      }
      renderer.rebuildAll();
      check(internals.sprites.get('0,0').texture.key.endsWith('-broken'), `${kind}: broken canonical state survives save restoration`);
      renderer.setVisibilityPredicate(() => false);
      check(effects.sites.size === 0 && internals.sprites.size === 0, `${kind}: hidden sprite and effect removed`);
      renderer.setVisibilityPredicate(() => true);
      check(effects.sites.size === 1, `${kind}: visibility restores effect`);
      if (kind === 'building') storedBuildings.setBroken(id, false); else wonders.setWonderBroken(id, false);
      renderer.refreshTile(0, 0);
      check(!internals.sprites.get('0,0').texture.key.endsWith('-broken') && !effects.graphics, `${kind}: repair restores sprite and destroys effect surface`);
      delete tile.buildingId; delete tile.wonderId; renderer.refreshTile(0, 0);
    }
    // Every definition must have a real dedicated texture, not a fallback.
    for (const b of buildings) {
      tiles[0].buildingId = b.id; tiles[0].buildingBroken = true; renderer.refreshTile(0, 0);
      check(internals.sprites.get('0,0')?.texture.key === `tile_building_${b.id}-broken`, `Damaged Building asset: ${b.id}`);
    }
    delete tiles[0].buildingId; delete tiles[0].buildingBroken;
    for (const w of ALL_WONDERS) {
      tiles[0].wonderId = w.id;
      wonders.restoreCompletedWonder({ wonderId: w.id, cityId: 'city', ownerId: 'owner', completedTurn: 1, broken: true });
      renderer.refreshTile(0, 0);
      check(internals.sprites.get('0,0')?.texture.key === `tile_wonder_${w.id}-broken`, `Damaged Wonder asset: ${w.id}`);
    }
    delete tiles[0].wonderId; renderer.refreshTile(0, 0);

    let era: Era = 'ancient';
    let cities = [new City({ id: 'city', name: 'Test', ownerId: 'owner', tileX: 2, tileY: 0 })];
    const cityManager = { getAllCities: () => cities, getBuildings: () => storedBuildings } as unknown as CityManager;
    const nations = { getNation: () => ({ id: 'owner' }) } as unknown as NationManager;
    const cityRenderer = new CityRenderer(this, tileMap, cityManager, nations, () => era);
    const cityEffects = (cityRenderer as any).damageEffects;
    const cityTexture = () => (cityRenderer.getCityContainer('city')!.list[0] as Phaser.GameObjects.Image).texture.key;
    const city = cities[0];
    for (const hp of [101, 100, 99, 100, 101]) {
      city.health = hp; cityRenderer.refreshCity(city);
      check(cityTexture() === getCitySpriteKey(era, hp <= CITY_BASE_HEALTH / 2), `City at ${hp} HP resolves inclusive 50% threshold`);
      check(cityEffects.sites.size === (hp <= 100 ? 1 : 0), `City at ${hp} HP has correct effect lifecycle`);
    }
    for (const nextEra of eras) {
      city.health = 70; era = nextEra; cityRenderer.refreshCity(city);
      check(cityTexture() === getCitySpriteKey(era, true), `Damaged city era transition: ${era}`);
      city.health = 101; cityRenderer.refreshCity(city);
      check(cityTexture() === getCitySpriteKey(era), `Healing restores current era: ${era}`);
    }
    city.health = 90;
    cities = [Object.assign(new City({ id: 'city', name: 'Restored', ownerId: 'owner', tileX: 2, tileY: 0 }), roundTrip(city))];
    cityRenderer.rebuildAll();
    check(cityTexture().endsWith('-broken') && cityEffects.sites.size === 1, 'City save restoration derives damage from health');
    cityRenderer.setVisibilityPredicate(() => false); cityRenderer.refreshAllVisibility();
    check(!cityRenderer.getCityContainer('city')!.visible && !cityEffects.graphics, 'City fog change immediately removes effects');
    cityRenderer.setVisibilityPredicate(() => true); cityRenderer.refreshAllVisibility();
    cityRenderer.removeCity('city');
    check(!cityEffects.graphics, 'City removal cleans effect surface');
    cityRenderer.shutdown();

    tiles.forEach(t => { t.buildingId = 'granary'; t.buildingBroken = true; });
    renderer.rebuildAll();
    const damagedCount = this.children.length;
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      tiles.forEach(t => { t.buildingBroken = false; }); renderer.rebuildAll();
      tiles.forEach(t => { t.buildingBroken = true; }); renderer.rebuildAll();
    }
    const rebuildMs = (performance.now() - start) / 200;
    check(this.children.length === damagedCount, '100 simultaneous break/repair cycles create no orphan objects');
    check(this.children.list.filter(o => o.name === 'structure-damage').length === 1, '96 damaged structures share one graphics surface');
    const gfx = effects.graphics;
    let smokeCalls = 0;
    const circle = gfx.fillCircle;
    gfx.fillCircle = function(...args: unknown[]) { smokeCalls++; return circle.apply(this, args); };
    this.cameras.main.worldView.setTo(0, 0, 1480, 980);
    effects.update(0, 100);
    check(smokeCalls > 0 && smokeCalls <= MAX_VISIBLE_DAMAGE_EFFECTS * 4, 'Smoke rendering is bounded with many damaged structures');
    renderer.shutdown();
    check(this.children.length === baseline, 'Shutdown releases all images, masks, signs and damage surfaces');
    check(this.events.listenerCount(Phaser.Scenes.Events.UPDATE) === listenerBaseline, 'All damage UPDATE listeners released');

    // Keep a small normal/construction/broken gallery visible for screenshot review.
    tiles.forEach(t => { delete t.buildingId; delete t.buildingBroken; });
    const samples = ['granary', 'monument', 'wind_turbine'];
    samples.forEach((id, row) => {
      tiles[row * 10].buildingId = id;
      tiles[row * 10 + 1].buildingConstruction = { buildingId: id, cityId: 'city' };
      tiles[row * 10 + 2].buildingId = id; tiles[row * 10 + 2].buildingBroken = true;
    });
    for (let row = 0; row < 6; row++) for (let col = 0; col < 10; col++) {
      const index = row * 10 + col;
      this.add.graphics().fillStyle(0x72895c).fillPoints(outline(index, 0), true);
    }
    const display = new TileBuildingRenderer(this, tileMap, map, {} as ProductionSystem);
    display.setBrokenPredicate(x => !!tiles[x].buildingBroken);
    ['Normal', 'Under construction', 'Broken'].forEach((label, col) => this.add.text(position(col, 0).x, 20, label, { fontSize: '15px' }).setOrigin(0.5));
    eras.forEach((e, i) => {
      const p = position(35 + i, 0);
      this.add.image(p.x, p.y, getCitySpriteKey(e, true)).setDisplaySize(118, 104).setDepth(15);
      this.add.text(p.x, p.y + 60, e, { fontSize: '12px' }).setOrigin(0.5);
    });
    void this.verifyPendingLoads(tileMap).then(() => {
      (window as any).visualChecks = checks;
    }).catch(error => { document.body.dataset.error = String(error); throw error; });
    (window as any).visualMetrics = { rebuildMs, damagedSites: 96, maxAnimatedSites: MAX_VISIBLE_DAMAGE_EFFECTS };
  }

  private async verifyPendingLoads(tileMap: TileMap) {
    const tile: Tile = { x: 0, y: 0, type: TileType.Plains };
    const map: MapData = { width: 1, height: 1, tileSize: 100, tiles: [[tile]] };
    const baseline = this.children.length;
    const renderer = new TileBuildingRenderer(this, tileMap, map, {} as ProductionSystem);
    renderer.setBrokenPredicate(() => tile.buildingBroken === true);
    // This legacy Building is intentionally not in the gallery's preload list.
    const complete = new Promise<void>(resolve => this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve()));
    tile.buildingConstruction = { cityId: 'city', buildingId: 'solar_plant' };
    renderer.refreshTile(0, 0);
    delete tile.buildingConstruction; tile.buildingId = 'solar_plant'; tile.buildingBroken = true;
    renderer.refreshTile(0, 0);
    tile.buildingBroken = false; renderer.refreshTile(0, 0);
    await complete;
    const internal = renderer as any;
    check(internal.sprites.get('0,0')?.texture.key === 'tile_building_solar_plant', 'Late texture responses resolve current repaired state');
    check(internal.signs.size === 0 && internal.damageEffects.sites.size === 0, 'Late loads cannot restore obsolete construction signs or smoke');
    renderer.shutdown();
    check(this.children.length === baseline, 'Asynchronously loaded structure cleans up all objects');

    const loading = new TileBuildingRenderer(this, tileMap, { ...map, tiles: [[{ x: 0, y: 0, type: TileType.Plains }]] }, {} as ProductionSystem);
    const errorListeners = this.load.listenerCount(Phaser.Loader.Events.FILE_LOAD_ERROR);
    const finished = new Promise<void>(resolve => this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve()));
    (loading as any).ensureTexture('pending_shutdown_texture', '/assets/sprites/buildings/granary.png');
    loading.shutdown();
    check(this.load.listenerCount('filecomplete-image-pending_shutdown_texture') === 0, 'Shutdown detaches pending texture completion callback');
    check(this.load.listenerCount(Phaser.Loader.Events.FILE_LOAD_ERROR) === errorListeners, 'Shutdown detaches pending texture failure callback');
    await finished;
    check(this.children.length === baseline, 'A load finishing after shutdown does not recreate map objects');
    this.textures.remove('pending_shutdown_texture');
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: 1480, height: 980, backgroundColor: '#182125', scene: Gallery, banner: false });
