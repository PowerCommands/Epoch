/** River geography: reciprocal links through the six edges of an axial hex.
 * Terrain, ownership, yields and movement rules are deliberately independent.
 * Bits run clockwise: E, SE, SW, W, NW, NE. Missing/zero means no river.
 */
export const RIVER_DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
export interface RiverCoord { q: number; r: number }
export interface RiverGrid {
  width: number;
  height: number;
  get(q: number, r: number): number | undefined;
  set(q: number, r: number, mask: number): void;
}
export const riverMask = (value: unknown): number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 63 ? Number(value) : 0;
export const hasRiver = (tile: { riverConnections?: number }): boolean => riverMask(tile.riverConnections) !== 0;
const inside = (grid: RiverGrid, q: number, r: number): boolean => q >= 0 && r >= 0 && q < grid.width && r < grid.height;

export function riverNeighbors(q: number, r: number, mask: number): RiverCoord[] {
  return RIVER_DIRECTIONS.flatMap(([dq, dr], edge) => (riverMask(mask) & (1 << edge)) ? [{ q: q + dq, r: r + dr }] : []);
}

export function connectRiver(grid: RiverGrid, a: RiverCoord, b: RiverCoord): boolean {
  if (!inside(grid, a.q, a.r) || !inside(grid, b.q, b.r)) return false;
  const edge = RIVER_DIRECTIONS.findIndex(([dq, dr]) => b.q - a.q === dq && b.r - a.r === dr);
  if (edge < 0) return false;
  grid.set(a.q, a.r, riverMask(grid.get(a.q, a.r)) | (1 << edge));
  grid.set(b.q, b.r, riverMask(grid.get(b.q, b.r)) | (1 << ((edge + 3) % 6)));
  return true;
}

export function eraseRiver(grid: RiverGrid, q: number, r: number): void {
  if (!inside(grid, q, r)) return;
  grid.set(q, r, 0);
  RIVER_DIRECTIONS.forEach(([dq, dr], edge) => {
    if (inside(grid, q + dq, r + dr)) {
      grid.set(q + dq, r + dr, riverMask(grid.get(q + dq, r + dr)) & ~(1 << ((edge + 3) % 6)));
    }
  });
}

/** Reject malformed, out-of-bounds and one-sided links; never invent branches. */
export function normalizeRivers(grid: RiverGrid): void {
  for (let r = 0; r < grid.height; r++) for (let q = 0; q < grid.width; q++) {
    let mask = riverMask(grid.get(q, r));
    RIVER_DIRECTIONS.forEach(([dq, dr], edge) => {
      if (!inside(grid, q + dq, r + dr) || !(riverMask(grid.get(q + dq, r + dr)) & (1 << ((edge + 3) % 6)))) {
        mask &= ~(1 << edge);
      }
    });
    if (grid.get(q, r) !== (mask || undefined)) grid.set(q, r, mask);
  }
}

/** Fill skipped pointer samples with contiguous hexes, including both ends. */
export function riverLine(a: RiverCoord, b: RiverCoord): RiverCoord[] {
  const distance = Math.max(Math.abs(b.q - a.q), Math.abs(b.r - a.r), Math.abs(b.q + b.r - a.q - a.r));
  if (!distance) return [{ ...a }];
  const result: RiverCoord[] = [];
  for (let i = 0; i <= distance; i++) {
    const q = a.q + (b.q - a.q) * i / distance + 1e-6;
    const r = a.r + (b.r - a.r) * i / distance + 1e-6;
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    if (Math.abs(rq - q) > Math.abs(rr - r) && Math.abs(rq - q) > Math.abs(rs - s)) rq = -rr - rs;
    else if (Math.abs(rr - r) > Math.abs(rs - s)) rr = -rq - rs;
    result.push({ q: rq, r: rr });
  }
  return result;
}

export interface RiverPoint { x: number; y: number }
export const RIVER_STROKES = [
  { color: 0x426e62, width: 0.22, alpha: 0.7, bank: true },
  { color: 0x246583, width: 0.14, alpha: 1, bank: false },
  { color: 0x80bac6, width: 0.045, alpha: 0.7, bank: false },
] as const;

/** Shared sampled curves for Phaser and Canvas. Edge tangents match exactly
 * between tiles, including bends. Junction branches meet at one round hub.
 */
export function riverPaths(mask: number, center: RiverPoint, radius: number): RiverPoint[][] {
  const ends = RIVER_DIRECTIONS.flatMap((_, edge) => {
    if (!(riverMask(mask) & (1 << edge))) return [];
    const angle = edge * Math.PI / 3;
    return [{ x: center.x + Math.cos(angle) * radius * Math.sqrt(3) / 2,
      y: center.y + Math.sin(angle) * radius * Math.sqrt(3) / 2 }];
  });
  if (ends.length === 2) {
    return [Array.from({ length: 13 }, (_, i) => {
      const t = i / 12, u = 1 - t;
      return { x: u * u * ends[0].x + 2 * u * t * center.x + t * t * ends[1].x,
        y: u * u * ends[0].y + 2 * u * t * center.y + t * t * ends[1].y };
    })];
  }
  return ends.map(end => [center, end]);
}
