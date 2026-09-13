import { DOCK } from '../data/buildings';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { TileType, type MapData, type Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export const DOCK_PRODUCTION_REQUIREMENT = 'Requires a completed, functioning Dock in this city';

/** Naval infrastructure is independent of urban-development requirements. */
export function findFunctioningDock(city: City, buildings: CityBuildings | undefined, map: MapData): Tile | undefined {
  if (!buildings?.hasActive(DOCK.id)) return undefined;
  return city.ownedTileCoords.map(c => map.tiles[c.y]?.[c.x])
    .filter((tile): tile is Tile => !!tile && tile.ownerId === city.ownerId
      && tile.type === TileType.Coast && tile.buildingId === DOCK.id && !tile.buildingBroken)
    .sort((a,b) => a.y-b.y || a.x-b.x)[0];
}

/** Reuses the caller's normal spawn validation; axial distance then row/column
 * resolves ties independently of territory insertion order. Never starts at the city. */
export function findDockSpawnTile(
  dock: {x:number; y:number}, map: MapData, grid: IGridSystem,
  isValidPlacement: (tile: Tile) => boolean,
): Tile | null {
  const origin = map.tiles[dock.y]?.[dock.x];
  if (origin && isValidPlacement(origin)) return origin;
  return map.tiles.flat().filter(isValidPlacement)
    .sort((a,b) => grid.getDistance(dock,a)-grid.getDistance(dock,b) || a.y-b.y || a.x-b.x)[0] ?? null;
}
