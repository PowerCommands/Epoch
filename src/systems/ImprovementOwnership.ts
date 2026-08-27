import type { Tile } from '../types/map';

/**
 * Resolve completed-improvement ownership without requiring old maps/saves to
 * carry the new field. Legacy sea-resource claims take precedence over the
 * territorial owner because they already represented separate economic control.
 */
export function getImprovementOwnerId(tile: Tile): string | undefined {
  if (tile.improvementId === undefined) return undefined;
  return tile.improvementOwnerId ?? tile.resourceOwnerNationId ?? tile.ownerId;
}
