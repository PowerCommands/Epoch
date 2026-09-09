import { getImprovementById } from '../data/improvements';
import type { Tile, MapData } from '../types/map';
import type { City } from '../entities/City';
import { getImprovementOwnerId } from './ImprovementOwnership';

export function getValidImprovement(tile: Tile) {
  const definition = tile.improvementId ? getImprovementById(tile.improvementId) : undefined;
  if (definition?.populationCapacity && (tile.buildingId || tile.resourceId)) return undefined;
  return definition?.allowedTileTypes.includes(tile.type) ? definition : undefined;
}

/** Completed, valid domestic installations support the city owning the tile. */
export function getCityRenewableCapacity(city: City, map: MapData): number {
  let total = 0;
  const seen = new Set<string>();
  for (const coord of city.ownedTileCoords) {
    const key = `${coord.x},${coord.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = map.tiles[coord.y]?.[coord.x];
    if (!tile || tile.ownerId !== city.ownerId || getImprovementOwnerId(tile) !== city.ownerId) continue;
    total += getValidImprovement(tile)?.populationCapacity ?? 0;
  }
  return total;
}

/** Maintenance follows the canonical economic owner, regardless of worked tiles. */
export function getNationImprovementMaintenance(map: MapData, nationId: string): number {
  let total = 0;
  for (const row of map.tiles) for (const tile of row) {
    if (getImprovementOwnerId(tile) === nationId) total += getValidImprovement(tile)?.maintenance ?? 0;
  }
  return total;
}
