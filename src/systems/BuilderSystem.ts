import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { getImprovementById, getImprovementForTileType, type TileImprovementDefinition } from '../data/improvements';
import { getNaturalResourceById } from '../data/naturalResources';
import type { MapData, Tile } from '../types/map';
import { canUnitEnterTile } from './MovementSystem';
import type { CityManager } from './CityManager';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { EraSystem } from './EraSystem';
import type { Era } from '../data/technologies';

export interface BuildImprovementResult {
  unit: Unit;
  tile: Tile;
  improvement: TileImprovementDefinition;
  city: City;
  requiredTurns: number;
}

export interface BuildImprovementPreview {
  canBuild: boolean;
  improvement?: TileImprovementDefinition;
  reason?: string;
  remainingTurns?: number;
}

interface BuildImprovementOptions {
  consumeMovement?: boolean;
  requireMovement?: boolean;
}

export class BuilderSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly turnManager: TurnManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly researchSystem?: ResearchSystem,
    private readonly eraSystem?: EraSystem,
  ) {}

  canBuild(unit: Unit, tile: Tile): boolean {
    return this.getBuildPreview(unit, tile).canBuild;
  }

  getBuildPreview(unit: Unit, tile: Tile): BuildImprovementPreview {
    return this.evaluateBuild(unit, tile);
  }

  build(unit: Unit, tile: Tile, options: BuildImprovementOptions = {}): BuildImprovementResult | null {
    const preview = this.evaluateBuild(unit, tile, options);
    if (!preview.canBuild || preview.improvement === undefined) return null;

    const city = this.getFriendlyCityForWorkableTile(unit.ownerId, tile);
    if (city === undefined) return null;

    const requiredTurns = getImprovementBuildTurnsForEra(
      this.eraSystem?.getNationEra(unit.ownerId) ?? 'ancient',
    );
    tile.improvementConstruction = {
      improvementId: preview.improvement.id,
      cityId: city.id,
      unitId: unit.id,
      ownerId: unit.ownerId,
      remainingTurns: requiredTurns,
      totalTurns: requiredTurns,
    };
    unit.setBuildingImprovement({
      improvementId: preview.improvement.id,
      tileX: tile.x,
      tileY: tile.y,
      progress: 0,
      requiredProgress: BUILD_REQUIRED_PROGRESS,
    });
    if (options.consumeMovement ?? true) {
      this.unitManager.consumeAllMovement(unit.id);
    }
    this.unitManager.notifyActionChanged(unit.id);

    return { unit, tile, improvement: preview.improvement, city, requiredTurns };
  }

  private evaluateBuild(
    unit: Unit,
    tile: Tile,
    options: BuildImprovementOptions = {},
  ): BuildImprovementPreview {
    if (!unit.unitType.canBuildImprovements) return { canBuild: false, reason: 'Unit cannot build improvements' };
    if (unit.improvementCharges !== undefined && unit.improvementCharges <= 0) {
      return { canBuild: false, reason: 'Worker has no improvement charges remaining' };
    }
    if (this.turnManager.getCurrentNation().id !== unit.ownerId) return { canBuild: false, reason: 'Not this unit\'s turn' };
    const activeConstruction = this.getConstructionForUnit(unit.id);
    if (activeConstruction !== undefined) {
      return {
        canBuild: false,
        reason: 'Worker is already building an improvement',
        remainingTurns: activeConstruction.remainingTurns,
      };
    }
    if (!this.isCurrentTile(unit, tile)) return { canBuild: false, reason: 'Worker must stand on this tile' };
    if (tile.improvementId !== undefined) return { canBuild: false, reason: 'Tile already has an improvement' };
    if (tile.improvementConstruction !== undefined) return { canBuild: false, reason: 'Improvement already under construction' };
    if ((options.requireMovement ?? true) && unit.movementPoints <= 0) return { canBuild: false, reason: 'Worker has no movement remaining' };
    if (this.cityManager.getCityAt(tile.x, tile.y) !== undefined) return { canBuild: false, reason: 'Cannot improve a city tile' };
    if (!canUnitEnterTile(unit, tile)) return { canBuild: false, reason: 'Tile is not valid land for this unit' };
    if (tile.ownerId !== unit.ownerId) return { canBuild: false, reason: 'Tile is not owned by this nation' };
    if (this.getFriendlyCityForWorkableTile(unit.ownerId, tile) === undefined) {
      return { canBuild: false, reason: 'Tile is outside friendly city workable area' };
    }

    const improvement = this.resolveImprovementForTile(unit.ownerId, tile);
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

  private isCurrentTile(unit: Unit, tile: Tile): boolean {
    return unit.tileX === tile.x && unit.tileY === tile.y;
  }

  private resolveImprovementForTile(ownerId: string, tile: Tile): TileImprovementDefinition | undefined {
    const resourceImprovement = this.getResourceImprovement(ownerId, tile);
    return resourceImprovement ?? getImprovementForTileType(tile.type);
  }

  private getResourceImprovement(ownerId: string, tile: Tile): TileImprovementDefinition | undefined {
    if (tile.resourceId === undefined) return undefined;

    const resource = getNaturalResourceById(tile.resourceId);
    if (resource === undefined) return undefined;

    const improvementId = resource.improvementIdByTileType?.[tile.type] ?? resource.improvementId;
    if (improvementId === undefined) return undefined;

    const improvement = getImprovementById(improvementId);
    if (improvement === undefined) return undefined;
    if (!improvement.allowedTileTypes.includes(tile.type)) return undefined;
    if (!this.isImprovementUnlocked(ownerId, improvement.id)) return undefined;

    return improvement;
  }

  private isImprovementUnlocked(ownerId: string, improvementId: string): boolean {
    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvementId);
    return requiredTechnology === undefined || this.researchSystem?.isImprovementUnlocked(ownerId, improvementId) === true;
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

  private getConstructionForUnit(unitId: string): Tile['improvementConstruction'] | undefined {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.improvementConstruction?.unitId === unitId) {
          return tile.improvementConstruction;
        }
      }
    }
    return undefined;
  }
}

/**
 * Display-only scale used by unit.buildAction.progress. The canonical
 * remaining-turn state lives on tile.improvementConstruction; the unit
 * mirror exists so renderers can show a 0–100 percentage without
 * walking the map every frame.
 */
export const BUILD_REQUIRED_PROGRESS = 100;

export function computeUnitBuildProgress(
  remainingTurns: number,
  totalTurns: number,
): number {
  if (totalTurns <= 0) return BUILD_REQUIRED_PROGRESS;
  const completedTurns = Math.max(0, totalTurns - Math.max(0, remainingTurns));
  return Math.min(BUILD_REQUIRED_PROGRESS, (completedTurns / totalTurns) * BUILD_REQUIRED_PROGRESS);
}

export function getImprovementBuildTurnsForEra(era: Era): number {
  switch (era) {
    case 'ancient':
    case 'classical':
      return 3;
    case 'medieval':
    case 'renaissance':
      return 2;
    case 'industrial':
    case 'modern':
    case 'atomic':
    case 'information':
    case 'future':
      return 1;
  }
}
