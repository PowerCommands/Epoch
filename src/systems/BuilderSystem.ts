import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { getImprovementForTileType, type TileImprovementDefinition } from '../data/improvements';
import type { MapData, Tile } from '../types/map';
import { canUnitEnterTile } from './MovementSystem';
import type { CityManager } from './CityManager';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { ResearchSystem } from './ResearchSystem';

export interface BuildImprovementResult {
  unit: Unit;
  tile: Tile;
  improvement: TileImprovementDefinition;
  city: City;
}

export interface BuildImprovementPreview {
  canBuild: boolean;
  improvement?: TileImprovementDefinition;
  reason?: string;
}

export class BuilderSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly turnManager: TurnManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly researchSystem?: ResearchSystem,
  ) {}

  canBuild(unit: Unit, tile: Tile): boolean {
    return this.getBuildPreview(unit, tile).canBuild;
  }

  getBuildPreview(unit: Unit, tile: Tile): BuildImprovementPreview {
    return this.evaluateBuild(unit, tile);
  }

  build(unit: Unit, tile: Tile): BuildImprovementResult | null {
    const preview = this.evaluateBuild(unit, tile);
    if (!preview.canBuild || preview.improvement === undefined) return null;

    const city = this.getFriendlyCityForWorkableTile(unit.ownerId, tile);
    if (city === undefined) return null;

    tile.improvementId = preview.improvement.id;
    this.unitManager.consumeAllMovement(unit.id);

    return { unit, tile, improvement: preview.improvement, city };
  }

  private evaluateBuild(
    unit: Unit,
    tile: Tile,
  ): BuildImprovementPreview {
    if (!unit.unitType.canBuildImprovements) return { canBuild: false, reason: 'Unit cannot build improvements' };
    if (this.turnManager.getCurrentNation().id !== unit.ownerId) return { canBuild: false, reason: 'Not this unit\'s turn' };
    if (!this.isCurrentOrAdjacent(unit, tile)) return { canBuild: false, reason: 'Tile is not adjacent to the Builder' };
    if (tile.improvementId !== undefined) return { canBuild: false, reason: 'Tile already has an improvement' };
    if (unit.movementPoints <= 0) return { canBuild: false, reason: 'Builder has no movement remaining' };
    if (this.cityManager.getCityAt(tile.x, tile.y) !== undefined) return { canBuild: false, reason: 'Cannot improve a city tile' };
    if (!canUnitEnterTile(unit, tile)) return { canBuild: false, reason: 'Tile is not valid land for this unit' };
    if (this.getFriendlyCityForWorkableTile(unit.ownerId, tile) === undefined) {
      return { canBuild: false, reason: 'Tile is outside friendly city workable area' };
    }

    const improvement = getImprovementForTileType(tile.type);
    if (improvement === undefined) return { canBuild: false, reason: 'No improvement for this terrain' };
    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(unit.ownerId, improvement.id)
    ) {
      return {
        canBuild: false,
        improvement,
        reason: `Requires ${requiredTechnology.name}`,
      };
    }

    return { canBuild: true, improvement };
  }

  private isCurrentOrAdjacent(unit: Unit, tile: Tile): boolean {
    if (unit.tileX === tile.x && unit.tileY === tile.y) return true;
    return this.gridSystem.isAdjacent(
      { x: unit.tileX, y: unit.tileY },
      { x: tile.x, y: tile.y },
    );
  }

  private getFriendlyCityForWorkableTile(ownerId: string, tile: Tile): City | undefined {
    const cities = this.cityManager.getCitiesByOwner(ownerId);
    for (const city of cities) {
      const workableTiles = this.gridSystem.getWorkableCityTiles(city, this.mapData);
      if (workableTiles.some((workable) => workable.x === tile.x && workable.y === tile.y)) {
        return city;
      }
    }
    return undefined;
  }
}
