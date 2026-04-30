// TODO: v4 - consider applying requiredTechId to yield visibility
// TODO: v5 - unify yield calculation with ResourceQuantityService

import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { getImprovementById } from '../data/improvements';
import { getNaturalResourceById } from '../data/naturalResources';
import { getTerrainYield, type TileYield } from '../data/terrainYields';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
import type { MapData, Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import { getTileResourceQuantity } from './resource/ResourceQuantity';

export const BASE_CITY_FOOD = 2;

export interface WorkedTileYield extends TileYield {
  tile: Tile;
  science: number;
  culture: number;
  happiness: number;
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

export function getFoodConsumption(population: number): number {
  return population * 2;
}

export function getPositiveFoodSurplus(foodProduced: number, foodConsumed: number): number {
  return Math.max(0, foodProduced - foodConsumed);
}

export function calculateCityEconomy(
  city: City,
  mapData: MapData,
  buildings: CityBuildings,
  gridSystem: IGridSystem,
  modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
): CityEconomySummary {
  const workableTiles = getOwnedTiles(city, mapData, gridSystem);
  const workedTiles = getStoredWorkedTiles(city, mapData, gridSystem);
  let food = BASE_CITY_FOOD;
  let production = 0;
  let gold = city.population;
  let science = 0;
  let culture = 1;
  let happiness = 0;

  for (const worked of workedTiles) {
    food += worked.food;
    production += worked.production;
    gold += worked.gold;
    science += worked.science;
    culture += worked.culture;
    happiness += worked.happiness;
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

  food += modifiers.foodPerTurn ?? 0;
  production += modifiers.productionPerTurn ?? 0;
  gold += modifiers.goldPerTurn ?? 0;
  science += modifiers.sciencePerTurn ?? 0;
  culture += modifiers.culturePerTurn ?? 0;
  happiness += modifiers.happinessPerTurn ?? 0;

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

  food = applyPercent(food, modifiers.foodPercent);
  production = applyPercent(production, modifiers.productionPercent);
  gold = applyPercent(gold, modifiers.goldPercent);
  science = applyPercent(science, modifiers.sciencePercent);
  culture = applyPercent(culture, modifiers.culturePercent);

  const foodConsumption = getFoodConsumption(city.population);

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
    .map((tile) => ({ tile, ...getTileYield(tile) }))
    .sort((a, b) => {
      if (a.food !== b.food) return b.food - a.food;
      if (a.production !== b.production) return b.production - a.production;
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.science !== b.science) return b.science - a.science;
      if (a.culture !== b.culture) return b.culture - a.culture;
      if (a.tile.y !== b.tile.y) return a.tile.y - b.tile.y;
      return a.tile.x - b.tile.x;
    })
    .slice(0, city.population);
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
    .map((tile) => ({ tile, ...getTileYield(tile) }));
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
    science: worked.science,
    culture: worked.culture,
    happiness: worked.happiness,
  }));
}

export function getTileYield(tile: Tile): Omit<WorkedTileYield, 'tile'> {
  const terrainYield = getTerrainYield(tile.type);
  const improvementYield = getTileImprovementYield(tile);
  const resourceYield = getTileNaturalResourceYield(tile);
  return {
    food: terrainYield.food + improvementYield.food + resourceYield.food,
    production: terrainYield.production + improvementYield.production + resourceYield.production,
    gold: terrainYield.gold + improvementYield.gold + resourceYield.gold,
    science: resourceYield.science,
    culture: resourceYield.culture,
    happiness: resourceYield.happiness,
  };
}

export function getTileImprovementYield(tile: Tile): TileYield {
  if (!tile.improvementId) return ZERO_TILE_YIELD;
  return getImprovementById(tile.improvementId)?.yieldBonus ?? ZERO_TILE_YIELD;
}

export function getTileNaturalResourceYield(tile: Tile): Omit<WorkedTileYield, 'tile'> {
  const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
  if (!resource) {
    return {
      ...ZERO_TILE_YIELD,
      science: 0,
      culture: 0,
      happiness: 0,
    };
  }

  const quantity = getTileResourceQuantity(tile, getNaturalResourceById);
  const bonus = resource.yieldBonus;
  return {
    food: bonus.food * quantity,
    production: bonus.production * quantity,
    gold: bonus.gold * quantity,
    science: bonus.science * quantity,
    culture: bonus.culture * quantity,
    happiness: bonus.happiness,
  };
}
