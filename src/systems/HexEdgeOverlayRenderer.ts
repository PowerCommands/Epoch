import Phaser from 'phaser';
import type { MapData } from '../types/map';
import { TileType } from '../types/map';
import type { TerrainEdgePass } from '../data/terrainEdges';
import type { TileMap } from './TileMap';

/**
 * Axial hex edge directions. Index N matches edge N in
 * HexGridLayout.getTileOutlinePoints(): corner[N] → corner[(N+1) % 6].
 *
 * Pointy-top edges, clockwise from east:
 *   0 east         (q+1, r)
 *   1 south-east   (q,   r+1)
 *   2 south-west   (q-1, r+1)
 *   3 west         (q-1, r)
 *   4 north-west   (q,   r-1)
 *   5 north-east   (q+1, r-1)
 */
const HEX_EDGE_DIRECTIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

/**
 * Generic edge overlay renderer. Executes an ordered list of
 * `TerrainEdgePass` entries against the map: each pass walks every tile of
 * its `ownerType`, inspects the six axial hex neighbors, and strokes the
 * matching edges using the pass's own line style.
 *
 * One instance owns one Graphics object at a fixed depth. Coast and biome
 * overlays are two instances (different depths, different pass lists)
 * rather than two classes — the loop, geometry, and neighbor lookup are
 * identical and only the pass config differs.
 */
export class HexEdgeOverlayRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly passes: ReadonlyArray<TerrainEdgePass>;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    options: { depth: number; passes: ReadonlyArray<TerrainEdgePass> },
  ) {
    this.gfx = scene.add.graphics().setDepth(options.depth);
    this.passes = options.passes;
    this.render();
  }

  /** Redraw every configured edge pass across the whole map. */
  render(): void {
    this.gfx.clear();
    for (const pass of this.passes) {
      const strokes = pass.strokes ?? [pass];
      for (const stroke of strokes) {
        this.gfx.lineStyle(stroke.lineWidth, stroke.color, stroke.alpha);
        this.strokeEdgesForPass(pass);
      }
    }
  }

  private strokeEdgesForPass(pass: TerrainEdgePass): void {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.type !== pass.ownerType) continue;
        this.strokeMatchingEdges(tile.x, tile.y, pass.neighborTypes);
      }
    }
  }

  private strokeMatchingEdges(x: number, y: number, neighborTypes: ReadonlySet<TileType>): void {
    const outline = this.tileMap.getTileOutlinePoints(x, y);
    if (outline.length !== 6) return;

    HEX_EDGE_DIRECTIONS.forEach((delta, edgeIndex) => {
      const nType = this.getTileType(x + delta.x, y + delta.y);
      if (nType === null || !neighborTypes.has(nType)) return;
      const start = outline[edgeIndex];
      const end = outline[(edgeIndex + 1) % outline.length];
      this.gfx.lineBetween(start.x, start.y, end.x, end.y);
    });
  }

  private getTileType(x: number, y: number): TileType | null {
    const row = this.mapData.tiles[y];
    if (row === undefined) return null;
    const tile = row[x];
    if (tile === undefined) return null;
    return tile.type;
  }
}
