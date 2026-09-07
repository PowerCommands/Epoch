import type { BuildingType } from '../entities/Building';
import type { TileType } from '../types/map';

export function formatTerrainName(terrain: TileType): string {
  return terrain
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Player-facing terrain requirement derived from building data. */
export function getBuildingTerrainRequirement(building: BuildingType): string | undefined {
  if (!building.allowedTerrains || building.allowedTerrains.length === 0) return undefined;
  return `Requires: ${building.allowedTerrains.map(formatTerrainName).join(' or ')}`;
}
