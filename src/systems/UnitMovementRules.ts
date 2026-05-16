import { getTechnologyById, type Era } from '../data/technologies';
import type { Nation } from '../entities/Nation';
import type { Unit } from '../entities/Unit';
import { compareEras, getHighestEra } from './EraSystem';
import { TileType, type MapData, type Tile } from '../types/map';

export function canEmbark(unit: Unit, nation: Nation | undefined): boolean {
  if (unit.unitType.isNaval === true || nation === undefined) return false;
  return canNationEmbarkLandUnits(nation);
}

export function canNationEmbarkLandUnits(nation: Nation | undefined): boolean {
  if (nation === undefined) return false;
  return compareEras(getHighestEraForNation(nation), 'industrial') >= 0;
}

export function isEmbarked(unit: Unit, mapData: MapData): boolean {
  if (unit.unitType.isNaval === true) return false;
  const tile = mapData.tiles[unit.tileY]?.[unit.tileX];
  return tile !== undefined && isWaterTile(tile);
}

export function canUnitEnterTile(unit: Unit, tile: Tile, nation?: Nation): boolean {
  if (unit.unitType.canTraverseWater === true) return true;

  if (unit.unitType.isNaval === true) {
    return isWaterTile(tile);
  }

  if (isWaterTile(tile)) {
    return canEmbark(unit, nation);
  }

  return true;
}

export function canUnitEndMovementOnTile(unit: Unit, tile: Tile, nation?: Nation): boolean {
  if (!canUnitEnterTile(unit, tile, nation)) return false;
  if (unit.unitType.mustEndOnLand === true && isWaterTile(tile)) return false;
  return true;
}

export function isWaterTile(tile: Tile): boolean {
  return tile.type === TileType.Ocean || tile.type === TileType.Coast;
}

function getHighestEraForNation(nation: Nation) {
  return getHighestEra(
    nation.researchedTechIds
      .map((technologyId) => getTechnologyById(technologyId)?.era)
      .filter((era): era is Era => era !== undefined),
  );
}
