import type Phaser from 'phaser';
import type { MapData } from '../types/map';
import type { TileMap } from './TileMap';
import { TerrainBaker } from './rendering/TerrainBaker';
import { riverPaths, RIVER_STROKES } from './geography/Rivers';

/** Static geography, baked above coast seams and below resources and borders. */
export class RiverRenderer {
  private textures: Phaser.GameObjects.RenderTexture[] = [];
  constructor(private scene: Phaser.Scene, private tileMap: TileMap, private map: MapData) {
    this.rebuild();
  }
  rebuild(): void {
    this.shutdown();
    const tiles = this.map.tiles.flatMap(row => row.filter(tile => tile.riverConnections));
    if (!tiles.length) return;
    const radius = this.tileMap.getTileSize() / 2;
    const centers = tiles.map(tile => this.tileMap.tileToWorld(tile.x, tile.y));
    // Do not allocate full-world textures for a handful of rivers. Keep the
    // bake confined to occupied geography, with enough padding for round caps.
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const center of centers) {
      left = Math.min(left, Math.floor(center.x - radius));
      top = Math.min(top, Math.floor(center.y - radius));
      right = Math.max(right, Math.ceil(center.x + radius));
      bottom = Math.max(bottom, Math.ceil(center.y + radius));
    }
    this.textures = TerrainBaker.bake(this.scene, right - left, bottom - top, 3.5, g => {
      g.translateCanvas(-left, -top);
      for (const stroke of RIVER_STROKES) {
        for (const tile of tiles) {
          const water = tile.type === 'coast' || tile.type === 'ocean';
          if (!tile.riverConnections || (stroke.bank && water)) continue;
          const paths = riverPaths(tile.riverConnections, this.tileMap.tileToWorld(tile.x, tile.y), radius, water);
          const width = radius * stroke.width;
          g.lineStyle(width, stroke.color, stroke.alpha);
          g.fillStyle(stroke.color, stroke.alpha);
          for (const path of paths) {
            g.beginPath();
            g.moveTo(path[0].x, path[0].y);
            for (const point of path.slice(1)) g.lineTo(point.x, point.y);
            g.strokePath();
            // Shared edges join without overlapping translucent round caps.
            // Only inland sources and junction hubs need an explicit cap.
            if (path.length === 2 && !water) g.fillCircle(path[0].x, path[0].y, width / 2);
          }
        }
      }
    });
    for (const texture of this.textures) texture.setPosition(texture.x + left, texture.y + top);
  }
  shutdown(): void {
    for (const texture of this.textures) texture.destroy();
    this.textures = [];
  }
}
