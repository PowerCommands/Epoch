import { TileType } from '../types/map';

/**
 * One pass in an edge-overlay pipeline. Rendered by iterating every tile
 * of `ownerType` and stroking its six hex edges wherever the active-grid
 * neighbor is a `TileType` present in `neighborTypes`.
 *
 * Each pass owns its stroke stack so visually distinct transitions
 * (soft tree-line vs. harsh mountain ridge) can live in the same pipeline.
 */
export interface TerrainEdgePass {
  label: string;
  ownerType: TileType;
  neighborTypes: ReadonlySet<TileType>;
  lineWidth: number;
  color: number;
  alpha: number;
  strokes?: ReadonlyArray<{
    lineWidth: number;
    color: number;
    alpha: number;
  }>;
}

const LAND_TYPES: ReadonlySet<TileType> = new Set([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
  TileType.Ice,
  TileType.Jungle,
  TileType.Desert,
]);

/** Coast→land shoreline strokes. Painted from the coast side only. */
export const COAST_EDGE_PASSES: ReadonlyArray<TerrainEdgePass> = [
  {
    label: 'coast→land',
    ownerType: TileType.Coast,
    neighborTypes: LAND_TYPES,
    lineWidth: 4,
    color: 0xd8c57a,
    alpha: 0.86,
    strokes: [
      { lineWidth: 6, color: 0x2b6d83, alpha: 0.24 },
      { lineWidth: 3, color: 0xe9d98f, alpha: 0.82 },
      { lineWidth: 1, color: 0xf7edbc, alpha: 0.58 },
    ],
  },
];

/**
 * Land biome edge passes. Each transition is painted once from its "owning"
 * side so neighbor symmetry never causes double-strokes:
 *   Forest → Plains       — soft green tree-line.
 *   Mountain → other land — harsh dark ridge (skips Mountain↔Mountain,
 *     and leaves mountain↔water to COAST_EDGE_PASSES).
 */
export const BIOME_EDGE_PASSES: ReadonlyArray<TerrainEdgePass> = [
  {
    label: 'forest→plains',
    ownerType: TileType.Forest,
    neighborTypes: new Set([TileType.Plains]),
    lineWidth: 2,
    color: 0x214f2c,
    alpha: 0.78,
    strokes: [
      { lineWidth: 4, color: 0x173b24, alpha: 0.28 },
      { lineWidth: 2, color: 0x2e6d34, alpha: 0.68 },
      { lineWidth: 1, color: 0x5f9850, alpha: 0.34 },
    ],
  },
  {
    label: 'mountain→land',
    ownerType: TileType.Mountain,
    neighborTypes: new Set([
      TileType.Plains,
      TileType.Forest,
      TileType.Jungle,
      TileType.Desert,
      TileType.Ice,
    ]),
    lineWidth: 3,
    color: 0x3a3f43,
    alpha: 0.88,
    strokes: [
      { lineWidth: 5, color: 0x25292c, alpha: 0.32 },
      { lineWidth: 3, color: 0x3a3f43, alpha: 0.82 },
      { lineWidth: 1, color: 0xb9b59f, alpha: 0.38 },
    ],
  },
];
