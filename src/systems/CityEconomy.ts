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

export interface WorkedTileYieldBreakdown extends TileYield {
  coord: { x: number; y: number };
  science: number;
  culture: number;
  happiness: number;
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
  science: number;
  culture: number;
  happiness: number;
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
  const workableTiles = getOwnedTiles(city, mapData, gridSystem);
  const workedTiles = getStoredWorkedTiles(city, mapData, gridSystem);
  let food = BASE_CITY_FOOD;
  let production = 0;
  let gold = 0;
  let science = 0;
  let culture = 1;
  let happiness = 0;

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
    science += building?.modifiers.sciencePerTurn ?? 0;
    culture += building?.modifiers.culturePerTurn ?? 0;
    happiness += building?.modifiers.happinessPerTurn ?? 0;
  }

  // Population production bonus: +1 per pop
  production += city.population;

  for (const id of buildings.getAll()) {
    const building = getBuildingById(id);
    if (!building) continue;
    food = applyPercent(food, building.modifiers.foodPercent);
    production = applyPercent(production, building.modifiers.productionPercent);
    gold = applyPercent(gold, building.modifiers.goldPercent);
    science = applyPercent(science, building.modifiers.sciencePercent);
    culture = applyPercent(culture, building.modifiers.culturePercent);
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
    science,
    culture,
    happiness,
    foodConsumption,
    netFood: food - foodConsumption,
    foodToGrow: getFoodToGrow(city.population),
  };
}

function applyPercent(value: number, percent: number | undefined): number {
  if (percent === undefined) return value;
  return Math.floor(value * (1 + percent / 100));
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

export function getOwnedTiles(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): Tile[] {
  if (city.ownedTileCoords.length === 0) {
    return getWorkableTiles(city, mapData, gridSystem);
  }

  return city.ownedTileCoords
    .map(({ x, y }) => mapData.tiles[y]?.[x])
    .filter((tile): tile is Tile => tile !== undefined);
}

export function getStoredWorkedTiles(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): WorkedTileYield[] {
  if (city.workedTileCoords.length === 0) {
    return getWorkedTiles(city, mapData, gridSystem);
  }

  return city.workedTileCoords
    .map(({ x, y }) => mapData.tiles[y]?.[x])
    .filter((tile): tile is Tile => tile !== undefined)
    .map((tile) => {
      const terrainYield = getTerrainYield(tile.type);
      const improvementYield = getTileImprovementYield(tile);
      return {
        tile,
        food: terrainYield.food + improvementYield.food,
        production: terrainYield.production + improvementYield.production,
        gold: terrainYield.gold + improvementYield.gold,
      };
    });
}

export function getWorkedTileYieldBreakdown(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): WorkedTileYieldBreakdown[] {
  return getStoredWorkedTiles(city, mapData, gridSystem).map((worked) => ({
    coord: { x: worked.tile.x, y: worked.tile.y },
    food: worked.food,
    production: worked.production,
    gold: worked.gold,
    science: 0,
    culture: 0,
    happiness: 0,
  }));
}

export function getTileImprovementYield(tile: Tile): TileYield {
  if (!tile.improvementId) return ZERO_TILE_YIELD;
  return getImprovementById(tile.improvementId)?.yieldBonus ?? ZERO_TILE_YIELD;
}
