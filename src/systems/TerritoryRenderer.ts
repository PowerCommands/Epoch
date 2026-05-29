import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

const BORDER_DEPTH = 6;
const NORMAL_BORDER_ALPHA = 0.84;
const NORMAL_BORDER_WIDTH = 5;
const CITY_VIEW_BORDER_ALPHA = 0.96;
const CITY_VIEW_BORDER_WIDTH = 6;

interface Point {
  x: number;
  y: number;
}

interface ActiveSegment {
  ownerId: string;
  /** Tile that "owns" this border segment (used for fog-of-war culling). */
  tileX: number;
  tileY: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

const HEX_EDGE_INDEX_BY_DELTA = new Map<string, number>([
  ['1,0', 0],
  ['0,1', 1],
  ['-1,1', 2],
  ['-1,0', 3],
  ['0,-1', 4],
  ['1,-1', 5],
]);

/**
 * TerritoryRenderer draws nation-colored borders around owned territory.
 *
 * Borders are drawn on exposed edges where a neighbor lacks the same
 * ownerId, leaving terrain fully visible without owned-tile tinting.
 *
 * Rendering is debounced: multiple invalidate() calls within the same scene
 * tick coalesce into a single flush at POST_UPDATE. Each flush does an O(W·H)
 * integer compare against ownerSnapshot and only recomputes edges for tiles
 * whose ownership actually changed.
 */
export class TerritoryRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly borderGfx: Phaser.GameObjects.Graphics;
  private mode: 'normal' | 'cityView' = 'normal';

  // ─── Debounce state ───────────────────────────────────────────────────────

  private flushScheduled = false;
  private fullRebuildPending = true;  // forces a full rebuild on first flush

  // ─── Dirty-tracking ───────────────────────────────────────────────────────

  // Per-tile nation index snapshot. -1 = unowned. Index into nationIndexToId.
  private readonly ownerSnapshot: Int32Array;
  private readonly nationIdToIndex = new Map<string, number>();
  private readonly nationIndexToId: string[] = [];

  // ─── Live drawn state ─────────────────────────────────────────────────────

  // edgeKey → segment currently painted on borderGfx
  private readonly activeSegments = new Map<number, ActiveSegment>();

  // ─── Edge key config ──────────────────────────────────────────────────────

  // 0.1 px granularity — sufficient for hex outline coordinates.
  private static readonly POINT_RES = 10;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    nationManager: NationManager,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.nationManager = nationManager;
    this.mapData = mapData;
    this.borderGfx = scene.add.graphics().setDepth(BORDER_DEPTH);
    this.ownerSnapshot = new Int32Array(mapData.width * mapData.height).fill(-1);
  }

  private visibilityPredicate: ((tileX: number, tileY: number) => boolean) | null = null;

  /** Set a predicate that gates which territory segments are painted. */
  setVisibilityPredicate(predicate: (tileX: number, tileY: number) => boolean): void {
    this.visibilityPredicate = predicate;
  }

  /**
   * Request a redraw before the next paint. Multiple calls within the same
   * scene tick coalesce into one flush. This is the primary entry point for
   * all callers.
   */
  invalidate(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.scene.events.once(Phaser.Scenes.Events.POST_UPDATE, this.handleFlush, this);
  }

  setMode(mode: 'normal' | 'cityView'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.invalidate();
  }

  /**
   * @deprecated Use invalidate() instead. Kept for API compatibility.
   */
  render(): void {
    this.invalidate();
  }

  shutdown(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.handleFlush, this);
    this.borderGfx.destroy();
  }

  // ─── Flush pipeline ───────────────────────────────────────────────────────

  private handleFlush = (): void => {
    this.flushScheduled = false;
    this.flush();
  };

  private flush(): void {
    if (this.fullRebuildPending) {
      this.rebuildAllSegments();
      this.fullRebuildPending = false;
    } else {
      this.rebuildDirtyTiles();
    }
    this.repaintFromActiveSegments();
  }

  private rebuildAllSegments(): void {
    this.activeSegments.clear();
    const w = this.mapData.width;
    const h = this.mapData.height;
    for (let y = 0; y < h; y++) {
      const row = this.mapData.tiles[y];
      for (let x = 0; x < w; x++) {
        const tile = row[x];
        const ownerIdx = tile.ownerId === undefined ? -1 : this.getOrAssignNationIndex(tile.ownerId);
        this.ownerSnapshot[y * w + x] = ownerIdx;
        this.recomputeEdgesAround(x, y);
      }
    }
  }

  private rebuildDirtyTiles(): void {
    const w = this.mapData.width;
    const h = this.mapData.height;
    for (let y = 0; y < h; y++) {
      const row = this.mapData.tiles[y];
      for (let x = 0; x < w; x++) {
        const tile = row[x];
        const currentOwnerIdx = tile.ownerId === undefined ? -1 : this.getOrAssignNationIndex(tile.ownerId);
        const tileKey = y * w + x;
        if (this.ownerSnapshot[tileKey] === currentOwnerIdx) continue;
        this.ownerSnapshot[tileKey] = currentOwnerIdx;
        this.recomputeEdgesAround(x, y);
      }
    }
  }

  /**
   * Recomputes the 6 border segments touching tile (x, y) and updates
   * activeSegments accordingly. Called for every tile during a full rebuild,
   * and only for changed tiles during incremental updates.
   */
  private recomputeEdgesAround(x: number, y: number): void {
    const outline = this.tileMap.getTileOutlinePoints(x, y);
    if (outline.length !== 6) return;

    const w = this.mapData.width;
    const h = this.mapData.height;
    const tileOwnerId = this.mapData.tiles[y]?.[x]?.ownerId;
    const tileKey = y * w + x;

    const adjacent = this.gridSystem.getAdjacentCoords({ x, y });
    for (const neighbor of adjacent) {
      const edgePoints = this.getHexEdgePoints(outline, x, y, neighbor);
      const key = this.edgeKey(edgePoints[0], edgePoints[1]);

      const inBounds = neighbor.x >= 0 && neighbor.y >= 0 && neighbor.x < w && neighbor.y < h;
      const neighborOwnerId = inBounds ? this.mapData.tiles[neighbor.y][neighbor.x].ownerId : undefined;
      const neighborKey = neighbor.y * w + neighbor.x;

      const segmentOwnerId = this.resolveEdgeOwner(
        tileOwnerId, tileKey,
        neighborOwnerId, neighborKey,
        !inBounds,
      );

      if (segmentOwnerId !== undefined) {
        const ownerIsTile = segmentOwnerId === tileOwnerId;
        this.activeSegments.set(key, {
          ownerId: segmentOwnerId,
          tileX: ownerIsTile ? x : neighbor.x,
          tileY: ownerIsTile ? y : neighbor.y,
          ax: edgePoints[0].x,
          ay: edgePoints[0].y,
          bx: edgePoints[1].x,
          by: edgePoints[1].y,
        });
      } else {
        this.activeSegments.delete(key);
      }
    }
  }

  private repaintFromActiveSegments(): void {
    this.borderGfx.clear();
    for (const segment of this.activeSegments.values()) {
      if (this.visibilityPredicate && !this.visibilityPredicate(segment.tileX, segment.tileY)) continue;
      const nationColor = this.nationManager.getNation(segment.ownerId)?.color ?? 0x111111;
      this.borderGfx.lineStyle(this.getBorderWidth(), nationColor, this.getBorderAlpha());
      this.borderGfx.lineBetween(segment.ax, segment.ay, segment.bx, segment.by);
    }
  }

  // ─── Edge ownership resolution ────────────────────────────────────────────

  /**
   * Returns the ownerId of the nation whose color this edge should be drawn
   * in, or undefined if no border should be drawn here.
   *
   * Tie-breaking rule: when two adjacent tiles are owned by different nations,
   * the tile with the lower row-major tileKey (y * width + x) owns the edge.
   * This matches the first-write-wins outcome of the original row-major
   * iteration, keeping the color of foreign-vs-foreign borders stable.
   */
  private resolveEdgeOwner(
    aOwner: string | undefined,
    aKey: number,
    bOwner: string | undefined,
    bKey: number,
    bOutOfBounds: boolean,
  ): string | undefined {
    if (bOutOfBounds) return aOwner;           // map boundary: draw with A if owned
    if (aOwner === undefined && bOwner === undefined) return undefined;
    if (aOwner === bOwner) return undefined;   // same nation: interior edge, no border
    if (aOwner === undefined) return bOwner;   // only B owned
    if (bOwner === undefined) return aOwner;   // only A owned
    // Both owned by different nations: lower tileKey wins, matching row-major order
    return aKey < bKey ? aOwner : bOwner;
  }

  // ─── Geometry ─────────────────────────────────────────────────────────────

  /**
   * Returns a numeric key uniquely identifying the undirected edge between
   * points a and b. Normalizes endpoint order so edgeKey(a,b) === edgeKey(b,a).
   *
   * Safety bound: stays under Number.MAX_SAFE_INTEGER for outline coordinates
   * up to ~419 000 pixels per axis with POINT_RES = 10.
   */
  private edgeKey(a: Point, b: Point): number {
    const ax = Math.round(a.x * TerritoryRenderer.POINT_RES) | 0;
    const ay = Math.round(a.y * TerritoryRenderer.POINT_RES) | 0;
    const bx = Math.round(b.x * TerritoryRenderer.POINT_RES) | 0;
    const by = Math.round(b.y * TerritoryRenderer.POINT_RES) | 0;
    const aId = ax * 0x400000 + ay;
    const bId = bx * 0x400000 + by;
    const lo = aId < bId ? aId : bId;
    const hi = aId < bId ? bId : aId;
    return lo * 0x100000000 + hi;
  }

  private getHexEdgePoints(outline: Point[], x: number, y: number, neighbor: Point): [Point, Point] {
    if (outline.length !== 6) {
      throw new Error(`TerritoryRenderer expected hex outline with 6 points, got ${outline.length}`);
    }

    const deltaKey = `${neighbor.x - x},${neighbor.y - y}`;
    const edgeIndex = HEX_EDGE_INDEX_BY_DELTA.get(deltaKey);
    if (edgeIndex === undefined) {
      throw new Error(`TerritoryRenderer received non-hex neighbor delta ${deltaKey}`);
    }

    return [outline[edgeIndex], outline[(edgeIndex + 1) % outline.length]];
  }

  // ─── Nation index intern table ────────────────────────────────────────────

  private getOrAssignNationIndex(nationId: string): number {
    let idx = this.nationIdToIndex.get(nationId);
    if (idx === undefined) {
      idx = this.nationIndexToId.length;
      this.nationIndexToId.push(nationId);
      this.nationIdToIndex.set(nationId, idx);
    }
    return idx;
  }

  // ─── Styling ──────────────────────────────────────────────────────────────

  private getBorderAlpha(): number {
    return this.mode === 'cityView' ? CITY_VIEW_BORDER_ALPHA : NORMAL_BORDER_ALPHA;
  }

  private getBorderWidth(): number {
    return this.mode === 'cityView' ? CITY_VIEW_BORDER_WIDTH : NORMAL_BORDER_WIDTH;
  }
}
