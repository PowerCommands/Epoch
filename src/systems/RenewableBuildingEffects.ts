import { getBuildingById, isRenewableBuilding } from '../data/buildings';
import type { Tile, MapData } from '../types/map';
import type { City } from '../entities/City';

function getActiveRenewable(tile: Tile) {
  const definition = tile.buildingId && isRenewableBuilding(tile.buildingId) ? getBuildingById(tile.buildingId) : undefined;
  if (tile.buildingBroken || tile.resourceId || tile.improvementId) return undefined;
  return definition?.allowedTerrains?.includes(tile.type) ? definition : undefined;
}

/** Count physical installations, including multiple buildings of the same type. */
export function getCityRenewableCapacity(city: City, map: MapData): number {
  let total = 0;
  const seen = new Set<string>();
  for (const coord of city.ownedTileCoords) {
    const key = `${coord.x},${coord.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = map.tiles[coord.y]?.[coord.x];
    if (!tile || tile.ownerId !== city.ownerId) continue;
    total += getActiveRenewable(tile)?.modifiers.populationCapacity ?? 0;
  }
  return total;
}

/** Fixed upkeep remains outside the Happiness Gold multiplier, even on unworked tiles. */
export function getNationRenewableMaintenance(map: MapData, nationId: string): number {
  let total = 0;
  for (const row of map.tiles) for (const tile of row) {
    if (tile.ownerId === nationId) total += getActiveRenewable(tile)?.maintenance ?? 0;
  }
  return total;
}
