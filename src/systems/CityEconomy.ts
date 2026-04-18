import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { getImprovementById } from '../data/improvements';
import { getTerrainYield, type TileYield } from '../data/terrainYields';
import type { MapData, Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export const BASE_CITY_FOOD = 2;

export interface WorkedTileYield extends TileYield {
  tile: Tile;
}

const ZERO_TILE_YIELD: TileYield = { food: 0, production: 0, gold: 0 };

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
  return 10 + population * 8;
}

export function calculateCityEconomy(
  city: City,
  mapData: MapData,
  buildings: CityBuildings,
  gridSystem: IGridSystem,
): CityEconomySummary {
  const workableTiles = getWorkableTiles(city, mapData, gridSystem);
  const workedTiles = getWorkedTiles(city, mapData, gridSystem);
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

  // Population production bonus: +1 per pop
  production += city.population;

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

export function getWorkableTiles(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): Tile[] {
  return gridSystem.getWorkableCityTiles(city, mapData);
}

export function getWorkedTiles(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): WorkedTileYield[] {
  return getWorkableTiles(city, mapData, gridSystem)
    .map((tile) => ({ tile, ...getTerrainYield(tile.type) }))
    .sort((a, b) => {
      if (a.food !== b.food) return b.food - a.food;
      if (a.production !== b.production) return b.production - a.production;
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.tile.y !== b.tile.y) return a.tile.y - b.tile.y;
      return a.tile.x - b.tile.x;
    })
    .slice(0, city.population)
    .map((worked) => {
      const improvementYield = getTileImprovementYield(worked.tile);
      return {
        ...worked,
        food: worked.food + improvementYield.food,
        production: worked.production + improvementYield.production,
        gold: worked.gold + improvementYield.gold,
      };
    });
}

export function getTileImprovementYield(tile: Tile): TileYield {
  if (!tile.improvementId) return ZERO_TILE_YIELD;
  return getImprovementById(tile.improvementId)?.yieldBonus ?? ZERO_TILE_YIELD;
}
