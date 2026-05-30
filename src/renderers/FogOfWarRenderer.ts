import Phaser from 'phaser';
import { VisibilityState, CITY_VISION_RADIUS, UNIT_VISION_RADIUS } from '../systems/VisibilitySystem';
import type { VisibilitySystem } from '../systems/VisibilitySystem';
import type { TileMap } from '../systems/TileMap';
import type { MapData } from '../types/map';

// Depth: above terrain/resources/borders (≤6), below cities (15) and units (18).
const DEPTH = 7;

const ALPHA_UNSEEN = 0.99;
const ALPHA_EXPLORED = 0.5;

/**
 * Width of the soft fade zone at the vision boundary, in hex tiles.
 * Tiles within this many tiles of the nearest vision edge fade from full
 * fog to transparent, eliminating the sharp hexagonal visibility border.
 */
const FADE_TILES = 2.5;

/**
 * Number of discrete alpha levels used when batching tile draws.
 * Higher = smoother gradient but more draw calls. 20 is a good balance.
 */
const ALPHA_BATCH_LEVELS = 20;

interface VisionSource {
  tileX: number;
  tileY: number;
  radius: number;
}

/**
 * Renders fog of war with soft visibility edges.
 *
 * Unseen   → nearly-black fill (α 0.9)
 * Explored → dark overlay      (α 0.5)
 * Visible  → no overlay
 *
 * Tiles within FADE_TILES of the current vision boundary fade gradually from
 * their base alpha to 0, replacing sharp hexagonal edges with a smooth
 * transition zone. Only redrawn when explicitly told to via refresh().
 *
 * Purely visual — no gameplay logic.
 */
export class FogOfWarRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly visibilitySystem: VisibilitySystem,
  ) {
    this.gfx = scene.add.graphics().setDepth(DEPTH);
  }

  /**
   * Rebuild the fog overlay. Call whenever visibility changes.
   *
   * @param cities Human player cities (used as vision source positions)
   * @param units  Human player units  (used as vision source positions)
   */
  refresh(
    cities: ReadonlyArray<{ tileX: number; tileY: number }>,
    units:  ReadonlyArray<{ tileX: number; tileY: number }>,
  ): void {
    this.gfx.clear();

    const sources: VisionSource[] = [
      ...cities.map((c) => ({ tileX: c.tileX, tileY: c.tileY, radius: CITY_VISION_RADIUS })),
      ...units.map((u)  => ({ tileX: u.tileX, tileY: u.tileY, radius: UNIT_VISION_RADIUS })),
    ];

    // Group tiles by their quantized alpha level so each level can be
    // drawn in a single fillStyle batch, minimising state changes.
    const buckets = new Map<number, Array<{ x: number; y: number }>>();

    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const state = this.visibilitySystem.getState(x, y);
        if (state === VisibilityState.Visible) continue;

        const baseAlpha = state === VisibilityState.Unseen ? ALPHA_UNSEEN : ALPHA_EXPLORED;
        const alpha = softAlpha(x, y, baseAlpha, sources);
        if (alpha < 0.02) continue; // Skip nearly-transparent tiles for performance

        const key = Math.round(alpha * ALPHA_BATCH_LEVELS);
        let bucket = buckets.get(key);
        if (!bucket) { bucket = []; buckets.set(key, bucket); }
        bucket.push({ x, y });
      }
    }

    // Draw each alpha level as one batch (one fillStyle call per bucket).
    for (const [key, tiles] of buckets) {
      this.gfx.fillStyle(0x000000, key / ALPHA_BATCH_LEVELS);
      for (const { x, y } of tiles) {
        this.fillTile(x, y);
      }
    }
  }

  private fillTile(x: number, y: number): void {
    const points = this.tileMap.getTileOutlinePoints(x, y);
    if (!points.length) return;
    this.gfx.beginPath();
    this.gfx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) this.gfx.lineTo(points[i]!.x, points[i]!.y);
    this.gfx.closePath();
    this.gfx.fillPath();
  }

  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible);
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

/**
 * Hex distance between two tiles in axial (q, r) coordinates.
 * Uses the standard cube-coordinate max formula.
 */
function hexDist(ax: number, ay: number, bx: number, by: number): number {
  const dq = bx - ax;
  const dr = by - ay;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/**
 * Compute the fog alpha for a tile that is not currently Visible.
 *
 * Tiles right at the vision edge fade from `base` down to 0 over
 * FADE_TILES tiles, producing a smooth gradient. Tiles further away
 * keep the full `base` alpha.
 */
function softAlpha(
  tileX: number,
  tileY: number,
  base: number,
  sources: VisionSource[],
): number {
  if (sources.length === 0) return base;

  let minRemaining = Infinity;
  for (const s of sources) {
    const remaining = hexDist(tileX, tileY, s.tileX, s.tileY) - s.radius;
    if (remaining < minRemaining) minRemaining = remaining;
  }

  if (minRemaining <= 0)          return 0;    // inside vision (shouldn't normally occur)
  if (minRemaining >= FADE_TILES) return base;  // fully in fog
  return base * (minRemaining / FADE_TILES);    // smooth gradient zone
}
