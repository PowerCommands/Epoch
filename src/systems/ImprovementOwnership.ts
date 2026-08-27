import type { MapData, Tile } from '../types/map';

/**
 * Resolve completed-improvement ownership without requiring old maps/saves to
 * carry the new field. Legacy sea-resource claims take precedence over the
 * territorial owner because they already represented separate economic control.
 */
export function getImprovementOwnerId(tile: Tile): string | undefined {
  if (tile.improvementId === undefined) return undefined;
  return tile.improvementOwnerId ?? tile.resourceOwnerNationId ?? tile.ownerId;
}

/**
 * Foreign Resource Exploitation *Holdings*: completed improvements economically
 * owned by `improvementOwnerNationId` that physically sit on territory owned by
 * `territorialOwnerNationId`. This is the map-authoritative view of surviving
 * post-war holdings — there is no separate persistent list. Domestic improvements
 * (owner === territory owner) are never holdings, so a same-nation query is empty.
 */
export function getForeignExploitationHoldings(
  mapData: MapData,
  territorialOwnerNationId: string,
  improvementOwnerNationId: string,
): Tile[] {
  if (territorialOwnerNationId === improvementOwnerNationId) return [];
  const holdings: Tile[] = [];
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.ownerId !== territorialOwnerNationId) continue;
      if (tile.improvementId === undefined) continue;
      if (getImprovementOwnerId(tile) !== improvementOwnerNationId) continue;
      holdings.push(tile);
    }
  }
  return holdings;
}

/** Count of {@link getForeignExploitationHoldings}; cheap enough for UI/valuation. */
export function countForeignExploitationHoldings(
  mapData: MapData,
  territorialOwnerNationId: string,
  improvementOwnerNationId: string,
): number {
  return getForeignExploitationHoldings(mapData, territorialOwnerNationId, improvementOwnerNationId).length;
}

/**
 * Dismantle every foreign exploitation holding owned by `improvementOwnerNationId`
 * inside `territorialOwnerNationId`'s territory. The improvement is destroyed, not
 * transferred: the natural resource stays, but improvement + economic ownership
 * (including legacy sea-claim metadata) are cleared exactly as normal destruction
 * does. Returns the number of holdings removed.
 */
export function removeForeignExploitationHoldings(
  mapData: MapData,
  territorialOwnerNationId: string,
  improvementOwnerNationId: string,
): number {
  const holdings = getForeignExploitationHoldings(mapData, territorialOwnerNationId, improvementOwnerNationId);
  for (const tile of holdings) {
    tile.improvementId = undefined;
    tile.improvementOwnerId = undefined;
    // Legacy sea claims are tied to their improvement and must not survive it.
    tile.resourceOwnerNationId = undefined;
  }
  return holdings.length;
}
