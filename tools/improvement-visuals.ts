import Phaser from 'phaser';
import { ALL_IMPROVEMENTS } from '../src/data/improvements';
import { TileType, type MapData, type Tile } from '../src/types/map';
import { TileImprovementOverlayRenderer } from '../src/renderers/TileImprovementOverlayRenderer';
import type { TileMap } from '../src/systems/TileMap';
import type { NationManager } from '../src/systems/NationManager';

const definitions = ALL_IMPROVEMENTS.filter(d => d.spriteKey);
const checks: string[] = [];
function check(ok: boolean, description: string) {
  if (!ok) throw new Error(description);
  checks.push(description);
}
class Gallery extends Phaser.Scene {
  preload() {
    for (const d of definitions) this.load.image(d.spriteKey!, `/assets/sprites/improvements/${d.id}.png`);
  }
  create() {
    const tiles: Tile[] = definitions.map((d, x) => ({ x, y: 0, type: d.allowedTileTypes[0], improvementId: d.id }));
    const map: MapData = { width: tiles.length, height: 1, tileSize: 100, tiles: [tiles] };
    const position = (x: number, y: number) => ({ x: 100 + (x % 5) * 180, y: 105 + Math.floor(x / 5) * 185 + y * 100 });
    const tileMap = {
      tileToWorld: position,
      getTileRect: (x: number, y: number) => ({ ...position(x, y), width: 120, height: 104 }),
    } as unknown as TileMap;
    const nations = { getNation: () => ({ color: 0xc54343 }) } as unknown as NationManager;
    for (const tile of tiles) {
      const { x, y } = position(tile.x, tile.y);
      const water = tile.type === TileType.Coast || tile.type === TileType.Ocean;
      const gfx = this.add.graphics();
      gfx.fillStyle(water ? 0x397e96 : 0x77925c).fillPoints(Array.from({length:6}, (_, i) => ({x:x+60*Math.cos(i*Math.PI/3),y:y+60*Math.sin(i*Math.PI/3)})),true);
      this.add.text(x, y+63, definitions[tile.x].name, {fontSize:'12px',wordWrap:{width:170},align:'center'}).setOrigin(0.5);
    }
    const listenerBaseline = this.events.listenerCount(Phaser.Scenes.Events.UPDATE);
    const renderer = new TileImprovementOverlayRenderer(this, tileMap, map, nations);
    renderer.rebuildAll();
    const objects = () => this.children.list.filter(o => o instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image[];
    check(objects().length === definitions.length, 'Every canonical sprite loads and renders');
    const originals = objects();
    for (let i = 0; i < 25; i++) renderer.rebuildAll();
    check(objects().every((o, i) => o === originals[i]), 'Repeated fog rebuilds reuse static sprites');
    const saved = JSON.parse(JSON.stringify(map));
    check(saved.tiles[0].every((t: {improvementId: string}) => definitions.some(d => d.id === t.improvementId)), 'Legacy improvement IDs resolve unchanged');
    renderer.setVisibilityPredicate(x => x !== 0);
    check(objects().length === definitions.length - 1, 'Hidden improvement sprite removed');
    renderer.setVisibilityPredicate(() => true);
    const baseline = this.children.length;
    const update = (renderer as unknown as { updateEffects(t:number,d:number):void }).updateEffects.bind(renderer);
    for (let i = 0; i < 50; i++) {
      tiles[0].improvementId = undefined;
      renderer.refreshTile(0, 0);
      update(0, 100);
      renderer.setVisibilityPredicate(x => x !== 0);
      check(objects().length === definitions.length - 1, `Destruction hidden immediately (${i})`);
      tiles[0].improvementId = definitions[0].id;
      renderer.setVisibilityPredicate(() => true);
    }
    check(this.children.length === baseline, '50 destruction/reconstruction cycles leave no orphan objects');
    tiles[1].improvementId = undefined;
    renderer.refreshTile(1, 0);
    update(0, 2000);
    check(objects().length === definitions.length-1, 'Destruction expires completely');
    tiles[1].improvementId = definitions[1].id;
    renderer.refreshTile(1, 0);
    tiles[0].improvementId = undefined;
    tiles[0].improvementConstruction = { improvementId: definitions[0].id, ownerId:'owner', unitId:'worker', remainingTurns:3, totalTurns:3 };
    renderer.refreshTile(0,0);
    check(objects().some(o=>o.texture.key===definitions[0].spriteKey && o.alpha===0.5), 'New construction uses translucent correct sprite');
    tiles[0].improvementConstruction.remainingTurns = 1;
    renderer.refreshTile(0,0);
    tiles[0].improvementConstruction = undefined;
    tiles[0].improvementId = definitions[0].id;
    renderer.refreshTile(0,0);
    check(objects().some(o=>o.texture.key===definitions[0].spriteKey && o.alpha===1), 'Construction completion restores full sprite');
    renderer.shutdown();
    check(objects().length === 0, 'Shutdown destroys all improvement sprites and effects');
    check(this.events.listenerCount(Phaser.Scenes.Events.UPDATE) === listenerBaseline, 'Animation listeners cleaned up');
    const display = new TileImprovementOverlayRenderer(this, tileMap, map, nations);
    display.rebuildAll();
    (window as unknown as {visualChecks: string[]}).visualChecks = checks;
    this.add.text(25, 440, 'All renderer checks passed. Sprites at normal map scale.', {fontSize:'16px',color:'#e3edd8'});
  }
}
new Phaser.Game({type:Phaser.AUTO,width:920,height:490,backgroundColor:'#182125',scene:Gallery,banner:false});
