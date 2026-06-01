import type { ScenarioData } from '../types/scenario';

/**
 * Terrain swatch colors for the setup-screen scenario preview. Kept in sync with
 * the standalone editor's TILE_COLORS (public/editor.html). Visual only — this
 * is a rough, non-interactive layout preview, not the in-game renderer.
 */
const TILE_COLORS: Record<string, string> = {
  ocean: '#1a557d',
  coast: '#4f8da7',
  plains: '#83b865',
  forest: '#2f7440',
  mountain: '#777b7b',
  ice: '#c8e6e8',
  jungle: '#236f50',
  desert: '#cdb65e',
  beach: '#e4d6a0',
  meadow: '#9bcf74',
};

const FALLBACK_COLOR = TILE_COLORS.ocean;

/** Internal device pixels per tile; CSS scales the canvas down to fit its column. */
const CELL = 6;

/**
 * Draw a rough terrain preview of `scenario` onto `canvas`. Tiles are plotted on
 * a grid with a half-cell offset on odd rows to echo the hex layout. The canvas
 * keeps the map's aspect ratio via its intrinsic dimensions; CSS caps display
 * width (see the setup-screen styles).
 */
export function renderScenarioMinimap(canvas: HTMLCanvasElement, scenario: ScenarioData): void {
  const { width, height, tiles } = scenario.map;
  const rowOffset = CELL / 2;

  canvas.width = Math.max(1, width * CELL + rowOffset);
  canvas.height = Math.max(1, height * CELL);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = FALLBACK_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const tile of tiles) {
    if (tile.q < 0 || tile.q >= width || tile.r < 0 || tile.r >= height) continue;
    ctx.fillStyle = TILE_COLORS[tile.type] ?? FALLBACK_COLOR;
    const x = tile.q * CELL + (tile.r % 2 === 1 ? rowOffset : 0);
    const y = tile.r * CELL;
    ctx.fillRect(x, y, CELL, CELL);
  }
}
