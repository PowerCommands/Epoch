import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

const BORDER_DEPTH = 6;
const NORMAL_BORDER_WIDTH = 5;
const CITY_VIEW_BORDER_WIDTH = 6;

interface Point {
  x: number;
  y: number;
}

interface ActiveSegment {
  ownerId: string;
  shared: boolean;
  center: Point;
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

  // Directed tile-edge key → segment currently painted on borderGfx
  private readonly activeSegments = new Map<number, ActiveSegment>();

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
    const dirty = new Set<number>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ownerId = this.mapData.tiles[y][x].ownerId;
        const current = ownerId === undefined ? -1 : this.getOrAssignNationIndex(ownerId);
        const key = y * w + x;
        if (this.ownerSnapshot[key] === current) continue;
        this.ownerSnapshot[key] = current;
        dirty.add(key);
        // Both sides can change when a tile is claimed, transferred or released.
        for (const neighbor of this.gridSystem.getAdjacentCoords({ x, y })) {
          if (neighbor.x >= 0 && neighbor.y >= 0 && neighbor.x < w && neighbor.y < h) {
            dirty.add(neighbor.y * w + neighbor.x);
          }
        }
      }
    }
    for (const key of dirty) this.recomputeEdgesAround(key % w, Math.floor(key / w));
  }

  private recomputeEdgesAround(x: number, y: number): void {
    const outline = this.tileMap.getTileOutlinePoints(x, y);
    if (outline.length !== 6) return;
    const w = this.mapData.width;
    const h = this.mapData.height;
    const ownerId = this.mapData.tiles[y][x].ownerId;
    const center = {
      x: outline.reduce((sum, point) => sum + point.x, 0) / 6,
      y: outline.reduce((sum, point) => sum + point.y, 0) / 6,
    };
    for (const neighbor of this.gridSystem.getAdjacentCoords({ x, y })) {
      const delta = `${neighbor.x - x},${neighbor.y - y}`;
      const edgeIndex = HEX_EDGE_INDEX_BY_DELTA.get(delta);
      if (edgeIndex === undefined) throw new Error(`TerritoryRenderer received non-hex neighbor delta ${delta}`);
      // Integer topology keys avoid precision collisions from packed world coordinates.
      const key = (y * w + x) * 6 + edgeIndex;
      const inBounds = neighbor.x >= 0 && neighbor.y >= 0 && neighbor.x < w && neighbor.y < h;
      const neighborOwner = inBounds ? this.mapData.tiles[neighbor.y][neighbor.x].ownerId : undefined;
      if (ownerId === undefined || ownerId === neighborOwner) {
        this.activeSegments.delete(key);
        continue;
      }
      const a = outline[edgeIndex];
      const b = outline[(edgeIndex + 1) % 6];
      this.activeSegments.set(key, {
        ownerId, shared: neighborOwner !== undefined, center,
        tileX: x, tileY: y, ax: a.x, ay: a.y, bx: b.x, by: b.y,
      });
    }
  }

  private repaintFromActiveSegments(): void {
    this.borderGfx.clear();
    // Opaque round caps seal the joins without darker overlap patches.
    const radius = this.getBorderWidth() / 2;
    for (const segment of this.activeSegments.values()) {
      if (this.visibilityPredicate && !this.visibilityPredicate(segment.tileX, segment.tileY)) continue;
      const nationColor = this.nationManager.getNation(segment.ownerId)?.color ?? 0x111111;
      if (segment.shared) {
        // Each nation fills only its own half of the border. Inset endpoints
        // toward the hex center to form sealed miter joins without crossing
        // into the neighboring nation's tile at corners.
        const midX = (segment.ax + segment.bx) / 2;
        const midY = (segment.ay + segment.by) / 2;
        const apothem = Math.hypot(midX - segment.center.x, midY - segment.center.y);
        const inset = radius / apothem;
        this.borderGfx.fillStyle(nationColor, 1);
        this.borderGfx.beginPath();
        this.borderGfx.moveTo(segment.ax, segment.ay);
        this.borderGfx.lineTo(segment.bx, segment.by);
        this.borderGfx.lineTo(
          segment.bx + (segment.center.x - segment.bx) * inset,
          segment.by + (segment.center.y - segment.by) * inset,
        );
        this.borderGfx.lineTo(
          segment.ax + (segment.center.x - segment.ax) * inset,
          segment.ay + (segment.center.y - segment.ay) * inset,
        );
        this.borderGfx.closePath();
        this.borderGfx.fillPath();
        continue;
      }
      this.borderGfx.lineStyle(this.getBorderWidth(), nationColor, 1);
      this.borderGfx.lineBetween(segment.ax, segment.ay, segment.bx, segment.by);
      this.borderGfx.fillStyle(nationColor, 1);
      this.borderGfx.fillCircle(segment.ax, segment.ay, radius);
      this.borderGfx.fillCircle(segment.bx, segment.by, radius);
    }
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

  private getBorderWidth(): number {
    return this.mode === 'cityView' ? CITY_VIEW_BORDER_WIDTH : NORMAL_BORDER_WIDTH;
  }
}
