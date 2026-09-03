import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export const RESOURCE_LENS_CONTEXT_RADIUS = 1;

/** Stable coordinate key shared by the resource-lens renderer and tests. */
export function resourceLensCoordKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Collect already-explored tiles to render without fog in the resource lens.
 *
 * A resource is eligible only when its own tile has previously been explored,
 * its reveal-technology gate is satisfied, and the tile has no completed
 * improvement. This keeps the lens focused on resources that are still
 * available to exploit. Immediate explored neighbours are included for map
 * context, but unseen terrain is never leaked.
 */
export function collectResourceLensRevealTiles(
  mapData: MapData,
  gridSystem: IGridSystem,
  isTileExplored: (x: number, y: number) => boolean,
  canRevealResource: (resourceId: string) => boolean,
): Set<string> {
  const revealed = new Set<string>();

  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (!tile.resourceId) continue;
      if (tile.improvementId) continue;
      if (!isTileExplored(tile.x, tile.y)) continue;
      if (!canRevealResource(tile.resourceId)) continue;

      for (const contextTile of gridSystem.getTilesInRange(
        { x: tile.x, y: tile.y },
        RESOURCE_LENS_CONTEXT_RADIUS,
        mapData,
        { includeCenter: true },
      )) {
        if (!isTileExplored(contextTile.x, contextTile.y)) continue;
        revealed.add(resourceLensCoordKey(contextTile.x, contextTile.y));
      }
    }
  }

  return revealed;
}
