import type { Tile } from '../../types/map';
import type { NaturalResourceDefinition } from '../../types/naturalResources';
import { getNaturalResourceImprovementIdForTile } from '../../data/naturalResources';

export type NaturalResourceLookup = (id: string) => NaturalResourceDefinition | undefined;

/**
 * How much natural resource quantity this tile contributes.
 *
 * Base = 1 if the tile has a known resource. Add +1 when the tile carries
 * the resource's matching improvement (e.g. Pasture on a Horses tile).
 *
 * Returns 0 when the tile has no resource or the resource id is unknown.
 * Pure: no game state is read or mutated outside of `tile` and `lookup`.
 */
export function getTileResourceQuantity(
  tile: Tile,
  lookup: NaturalResourceLookup,
): number {
  if (!tile.resourceId) return 0;

  const resource = lookup(tile.resourceId);
  if (!resource) return 0;

  let quantity = 1;

  if (isTileImprovedForResource(tile, resource)) {
    quantity += 1;
  }

  return quantity;
}

export function isTileImprovedForResource(
  tile: Tile,
  resource: NaturalResourceDefinition,
): boolean {
  const improvementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
  return improvementId !== undefined && tile.improvementId === improvementId;
}
