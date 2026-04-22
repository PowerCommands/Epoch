import { getBuildingById } from '../data/buildings';
import { getImprovementById } from '../data/improvements';
import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import { getWorkedTileYieldBreakdown } from './CityEconomy';
import type { CityTerritorySystem } from './CityTerritorySystem';
import type { IGridSystem } from './grid/IGridSystem';

export interface CityViewTileBreakdown {
  coord: { x: number; y: number };
  isOwned: boolean;
  isWorked: boolean;
  isClaimable: boolean;
  isNextExpansion: boolean;
  terrainType: string;
  improvementId?: string;
  improvementName?: string;
  buildingId?: string;
  buildingName?: string;
  buildingConstructionId?: string;
  buildingConstructionName?: string;
  yields: {
    food: number;
    production: number;
    gold: number;
    science: number;
    culture: number;
    happiness: number;
  };
  notes: string[];
}

export function getCityViewTileBreakdown(
  city: City,
  coord: { x: number; y: number },
  mapData: MapData,
  gridSystem: IGridSystem,
  cityTerritorySystem: CityTerritorySystem,
): CityViewTileBreakdown | null {
  const tile = mapData.tiles[coord.y]?.[coord.x];
  if (!tile) return null;

  const ownedSet = new Set(city.ownedTileCoords.map((entry) => `${entry.x},${entry.y}`));
  const workedSet = new Set(city.workedTileCoords.map((entry) => `${entry.x},${entry.y}`));
  const claimableSet = new Set(
    cityTerritorySystem.getClaimableTiles(city, mapData).map((entry) => `${entry.x},${entry.y}`),
  );
  const workedYieldMap = new Map<string, ReturnType<typeof getWorkedTileYieldBreakdown>[number]>(
    getWorkedTileYieldBreakdown(city, mapData, gridSystem)
      .map((entry) => [`${entry.coord.x},${entry.coord.y}`, entry] as const),
  );

  const key = `${coord.x},${coord.y}`;
  const isOwned = ownedSet.has(key);
  const isWorked = workedSet.has(key);
  const isClaimable = claimableSet.has(key);
  const isNextExpansion = city.nextExpansionTileCoord?.x === coord.x && city.nextExpansionTileCoord?.y === coord.y;

  if (!isOwned && !isWorked && !isClaimable && !isNextExpansion) return null;

  const yields = workedYieldMap.get(key) ?? {
    coord,
    food: 0,
    production: 0,
    gold: 0,
    science: 0,
    culture: 0,
    happiness: 0,
  };

  const notes: string[] = [];
  if (isOwned) notes.push('Owned by city');
  if (isWorked) notes.push('Currently worked');
  if (isClaimable) notes.push('Claimable now');
  if (isNextExpansion) notes.push('Planned next expansion');
  if (tile.buildingConstruction) notes.push('Building under construction');
  if (tile.buildingId) notes.push('Finished building');

  return {
    coord,
    isOwned,
    isWorked,
    isClaimable,
    isNextExpansion,
    terrainType: tile.type,
    improvementId: tile.improvementId,
    improvementName: tile.improvementId ? getImprovementById(tile.improvementId)?.name : undefined,
    buildingId: tile.buildingId,
    buildingName: tile.buildingId ? getBuildingById(tile.buildingId)?.name : undefined,
    buildingConstructionId: tile.buildingConstruction?.buildingId,
    buildingConstructionName: tile.buildingConstruction?.buildingId
      ? getBuildingById(tile.buildingConstruction.buildingId)?.name
      : undefined,
    yields: {
      food: yields.food,
      production: yields.production,
      gold: yields.gold,
      science: yields.science,
      culture: yields.culture,
      happiness: yields.happiness,
    },
    notes,
  };
}
