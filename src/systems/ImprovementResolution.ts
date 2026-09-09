import { getImprovementById, getImprovementForTileType, type TileImprovementDefinition } from '../data/improvements';
import { getNaturalResourceById, getNaturalResourceImprovementIdForTile } from '../data/naturalResources';
import type { Tile } from '../types/map';

/** Resolve the result only. BuilderSystem applies reveal, tech, ownership and capability gates. */
export function getImprovementForTile(tile: Pick<Tile, 'type' | 'resourceId'>): TileImprovementDefinition | undefined {
  if (tile.resourceId !== undefined) {
    const resource = getNaturalResourceById(tile.resourceId);
    const id = resource && getNaturalResourceImprovementIdForTile(resource, tile.type);
    const improvement = id ? getImprovementById(id) : undefined;
    // A resource with no legal improvement must never be replaced by a terrain default.
    return improvement?.allowedTileTypes.includes(tile.type) ? improvement : undefined;
  }
  return getImprovementForTileType(tile.type);
}
