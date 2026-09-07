import Phaser from 'phaser';
import { TileType, type MapData, type Tile } from '../types/map';
import type { TileMap } from './TileMap';
import type { CityManager } from './CityManager';

const BUCKET_SIZE = 256;
const EDGE_NEIGHBORS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
const isWater = (tile: Tile | null): boolean => tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
const seedAt = (x: number, y: number): number => {
  // Avalanche the coordinate hash: adjacent tiles must not share wave phases.
  let hash = Math.imul(x + 37, 73856093) ^ Math.imul(y + 91, 19349663);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
};

/** Two shared drawing surfaces, no particles, tweens or simulation-state writes.
 * Spatial buckets contain tile coordinates, so terrain edits remain authoritative.
 * Detail fades away at overview scale; only currently visible tiles have activity.
 */
export class WorldAmbientRenderer {
  private readonly water: Phaser.GameObjects.Graphics;
  private readonly habitation: Phaser.GameObjects.Graphics;
  private readonly buckets = new Map<string, Tile[]>();
  private elapsed = 0;
  private lastDraw = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    mapData: MapData,
    private readonly cities: CityManager,
    private readonly canSee: (x: number, y: number) => boolean,
  ) {
    this.water = scene.add.graphics().setDepth(1).setName('ambient-water');
    this.habitation = scene.add.graphics().setDepth(16).setName('ambient-habitation');
    for (const row of mapData.tiles) for (const tile of row) {
      const p = tileMap.tileToWorld(tile.x, tile.y);
      const key = `${Math.floor(p.x / BUCKET_SIZE)},${Math.floor(p.y / BUCKET_SIZE)}`;
      let bucket = this.buckets.get(key);
      if (!bucket) this.buckets.set(key, bucket = []);
      bucket.push(tile);
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private update(_time: number, delta: number): void {
    this.elapsed += Math.min(delta, 100);
    if (this.elapsed - this.lastDraw < 40) return;
    this.lastDraw = this.elapsed;
    this.water.clear();
    this.habitation.clear();
    const camera = this.scene.cameras.main;
    const detail = Phaser.Math.Clamp((camera.zoom - 0.45) / 0.65, 0, 1);
    if (detail === 0) return;
    const view = camera.worldView;
    const radius = this.tileMap.getTileSize() / 2;
    const margin = radius * 2;
    const onScreen = (x: number, y: number): boolean => x >= view.left - margin && x <= view.right + margin
      && y >= view.top - margin && y <= view.bottom + margin;
    const t = this.elapsed / 1000;
    for (let by = Math.floor((view.top - margin) / BUCKET_SIZE); by <= Math.floor((view.bottom + margin) / BUCKET_SIZE); by++) {
      for (let bx = Math.floor((view.left - margin) / BUCKET_SIZE); bx <= Math.floor((view.right + margin) / BUCKET_SIZE); bx++) {
        for (const coord of this.buckets.get(`${bx},${by}`) ?? []) {
          const tile = this.tileMap.getTileAt(coord.x, coord.y);
          if (!isWater(tile) || !this.canSee(coord.x, coord.y)) continue;
          const p = this.tileMap.tileToWorld(coord.x, coord.y);
          if (!onScreen(p.x, p.y)) continue;
          const seed = seedAt(coord.x, coord.y);
          // Sparse, staggered wavelets travel only a fraction of a tile.
          if (seed < 0.42) {
            const phase = (t / (7 + seed * 5) + seed * 13) % 1;
            const alpha = Math.sin(phase * Math.PI) ** 2 * 0.24 * detail;
            const x = p.x + (seed - 0.5) * radius * 0.5 + phase * radius * 0.16;
            const y = p.y + (seedAt(coord.y, coord.x) - 0.5) * radius * 0.65 - phase * radius * 0.16;
            this.water.lineStyle(radius * 0.035, 0xb8dcd9, alpha);
            for (let line = 0; line < (seed < 0.15 ? 2 : 1); line++) {
              this.water.beginPath();
              for (let i = 0; i <= 10; i++) {
                const px = x + (i / 10 - 0.5) * radius * (0.65 - line * 0.2);
                const py = y + line * radius * 0.17 + Math.sin(i / 10 * Math.PI * 2 + seed * 6) * radius * 0.025;
                if (i === 0) this.water.moveTo(px, py); else this.water.lineTo(px, py);
              }
              this.water.strokePath();
            }
          }
          const outline = this.tileMap.getTileOutlinePoints(coord.x, coord.y);
          if (outline.length !== 6) continue;
          EDGE_NEIGHBORS.forEach(([dx, dy], edge) => {
            const neighbor = this.tileMap.getTileAt(coord.x + dx, coord.y + dy);
            if (!neighbor || isWater(neighbor)) return;
            const phase = (t / 8 + seed * 3 + edge * 0.11) % 1;
            const inset = 0.045 + (1 - phase) * 0.15;
            const a = outline[edge], b = outline[(edge + 1) % 6];
            this.water.lineStyle(radius * 0.045, 0xd4e5cd, Math.sin(phase * Math.PI) ** 2 * 0.27 * detail);
            this.water.lineBetween(
              a.x + (b.x - a.x) * 0.12 + (p.x - a.x) * inset,
              a.y + (b.y - a.y) * 0.12 + (p.y - a.y) * inset,
              b.x + (a.x - b.x) * 0.12 + (p.x - b.x) * inset,
              b.y + (a.y - b.y) * 0.12 + (p.y - b.y) * inset,
            );
          });
        }
      }
    }
    for (const city of this.cities.getAllCities()) {
      if (!this.canSee(city.tileX, city.tileY)) continue;
      const p = this.tileMap.tileToWorld(city.tileX, city.tileY);
      if (!onScreen(p.x, p.y)) continue;
      const seed = seedAt(city.tileX, city.tileY);
      // Hearth-sized wisps, kept below the banner and away from its crown.
      for (let i = 0; i < 4; i++) {
        const phase = (t / 5.5 + seed * 9 + i / 4) % 1;
        const x = p.x - radius * 0.3 + phase * radius * 0.18 + Math.sin(phase * 5 + seed * 6) * radius * 0.025;
        const y = p.y - radius * 0.12 - phase * radius * 0.57;
        this.habitation.fillStyle(0xd7d9cb, Math.sin(phase * Math.PI) ** 2 * 0.24 * detail);
        this.habitation.fillEllipse(x, y, radius * (0.075 + phase * 0.16), radius * (0.06 + phase * 0.12));
      }
    }
  }

  shutdown(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.water.destroy();
    this.habitation.destroy();
    this.buckets.clear();
  }
}
