import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';

const OVERLAY_ALPHA = 0.35;
const OVERLAY_DEPTH = 5;

/**
 * TerritoryRenderer ritar en semi-transparent färgad overlay ovanpå
 * varje tile som ägs av en nation.
 *
 * Overlayen ligger ovanpå terrängen (depth 0) men under hover/selection-
 * highlights. Just nu ritar vi hela overlayen i ett svep; när erövring
 * införs kan vi optimera till att bara rita om ändrade tiles.
 */
export class TerritoryRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    nationManager: NationManager,
    mapData: MapData,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.nationManager = nationManager;
    this.mapData = mapData;
    this.gfx = scene.add.graphics().setDepth(OVERLAY_DEPTH);
  }

  /** Rita om hela territory-overlayen. */
  render(): void {
    this.gfx.clear();

    const tileSize = this.tileMap.getTileSize();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined) continue;

        const nation = this.nationManager.getNation(tile.ownerId);
        if (nation === undefined) continue;

        const px = tile.x * tileSize;
        const py = tile.y * tileSize;

        this.gfx.fillStyle(nation.color, OVERLAY_ALPHA);
        this.gfx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }
}
