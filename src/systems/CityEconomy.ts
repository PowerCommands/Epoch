import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { getTerrainYield, type TileYield } from '../data/terrainYields';
import type { MapData, Tile } from '../types/map';

export const BASE_CITY_FOOD = 2;

export interface WorkedTileYield extends TileYield {
  tile: Tile;
}

export interface CityEconomySummary {
  baseFood: number;
  workedTiles: WorkedTileYield[];
  maxWorkableTiles: number;
  workedTileCount: number;
  food: number;
  production: number;
  gold: number;
  foodConsumption: number;
  netFood: number;
  foodToGrow: number;
}

export function getFoodToGrow(population: number): number {
  return 15 + population * 10;
}

export function calculateCityEconomy(
  city: City,
  mapData: MapData,
  buildings: CityBuildings,
): CityEconomySummary {
  const workableTiles = getWorkableTiles(city, mapData);
  const workedTiles = getWorkedTiles(city, mapData);
  let food = BASE_CITY_FOOD;
  let production = 0;
  let gold = 0;

  for (const worked of workedTiles) {
    food += worked.food;
    production += worked.production;
    gold += worked.gold;
  }

  for (const id of buildings.getAll()) {
    const building = getBuildingById(id);
    food += building?.modifiers.foodPerTurn ?? 0;
    production += building?.modifiers.productionPerTurn ?? 0;
    gold += building?.modifiers.goldPerTurn ?? 0;
  }

  const foodConsumption = city.population * 2;

  return {
    baseFood: BASE_CITY_FOOD,
    workedTiles,
    maxWorkableTiles: workableTiles.length,
    workedTileCount: workedTiles.length,
    food,
    production,
    gold,
    foodConsumption,
    netFood: food - foodConsumption,
    foodToGrow: getFoodToGrow(city.population),
  };
}

export function getWorkableTiles(city: City, mapData: MapData): Tile[] {
  const tiles: Tile[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = city.tileX + dx;
      const y = city.tileY + dy;
      const tile = mapData.tiles[y]?.[x];
      if (tile) tiles.push(tile);
    }
  }

  return tiles;
}

export function getWorkedTiles(city: City, mapData: MapData): WorkedTileYield[] {
  return getWorkableTiles(city, mapData)
    .map((tile) => ({ tile, ...getTerrainYield(tile.type) }))
    .sort((a, b) => {
      if (a.food !== b.food) return b.food - a.food;
      if (a.production !== b.production) return b.production - a.production;
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.tile.y !== b.tile.y) return a.tile.y - b.tile.y;
      return a.tile.x - b.tile.x;
    })
    .slice(0, city.population);
}
