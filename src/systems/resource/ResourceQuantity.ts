// TODO: v2 - integrate into ResourceAccessSystem aggregation
// TODO: v3 - integrate into city economy (yield scaling)
// TODO: v4 - integrate into trade and happiness

import type { Tile } from '../../types/map';
import type { NaturalResourceDefinition } from '../../types/naturalResources';

export type NaturalResourceLookup = (id: string) => NaturalResourceDefinition | undefined;

/**
 * How many "copies" of a natural resource this tile yields.
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

  if (
    tile.improvementId !== undefined
    && resource.improvementId !== undefined
    && tile.improvementId === resource.improvementId
  ) {
    quantity += 1;
  }

  return quantity;
}
