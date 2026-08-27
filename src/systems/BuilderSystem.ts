import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { getImprovementById, getImprovementForTileType, type TileImprovementDefinition } from '../data/improvements';
import { getNaturalResourceById, getNaturalResourceImprovementIdForTile } from '../data/naturalResources';
import { isBarbarianCamp } from '../data/buildings';
import { TileType, type MapData, type Tile } from '../types/map';
import { canUnitEnterTile } from './UnitMovementRules';
import type { CityManager } from './CityManager';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';
import type { UnitChangedEvent } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { ResearchSystem } from './ResearchSystem';
import type { EraSystem } from './EraSystem';
import type { Era } from '../data/technologies';
import type { DiplomacyManager } from './DiplomacyManager';

export interface BuildImprovementResult {
  unit: Unit;
  tile: Tile;
  improvement: TileImprovementDefinition;
  city?: City;
  requiredTurns: number;
}

export interface BuildImprovementPreview {
  canBuild: boolean;
  improvement?: TileImprovementDefinition;
  improvementId?: string;
  claimsSeaResource?: boolean;
  reason?: string;
  remainingTurns?: number;
}

interface BuildImprovementOptions {
  consumeMovement?: boolean;
  requireMovement?: boolean;
}

export class BuilderSystem {
  private readonly constructionTileByUnitId = new Map<string, Tile>();

  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly turnManager: TurnManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly researchSystem?: ResearchSystem,
    private readonly eraSystem?: EraSystem,
    private readonly diplomacyManager?: DiplomacyManager,
  ) {
    this.unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
    this.rebuildConstructionIndex();
  }

  canBuild(unit: Unit, tile: Tile): boolean {
    return this.getBuildPreview(unit, tile).canBuild;
  }

  canUnitBuildOnCurrentTile(unit: Unit): boolean {
    return this.getCurrentTileBuildPreview(unit).canBuild;
  }

  /**
   * Position-independent buildability query for AI target selection: would
   * `nationId` be able to build a valid, tech-unlocked land improvement on this
   * owned tile if a Worker were standing on it? Mirrors the land branch of
   * {@link evaluateBuild} but skips the unit-bound gates (standing on the tile,
   * movement points, charges, whose turn it is). Sea tiles always return false —
   * those stay the Work Boat's responsibility.
   */
  canNationImproveLandTile(nationId: string, tile: Tile): boolean {
    if (this.isSeaTile(tile)) return false;
    if (tile.improvementId !== undefined || tile.improvementConstruction !== undefined) return false;
    if (isBarbarianCamp(tile.buildingId)) return false; // camp locks its tile
    if (this.cityManager.getCityAt(tile.x, tile.y) !== undefined) return false;
    const isForeign = tile.ownerId !== undefined && tile.ownerId !== nationId;
    if (isForeign) {
      if (!this.diplomacyManager?.hasExploitationRights(nationId, tile.ownerId!)) return false;
      if (tile.resourceId === undefined) return false;
    } else {
      if (tile.ownerId !== nationId) return false;
      if (this.getFriendlyCityForOwnedTile(tile.x, tile.y, nationId) === null) return false;
    }

    const improvement = isForeign ? this.getResourceImprovement(tile) : this.resolveImprovementForTile(tile);
    if (improvement === undefined) return false;

    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(nationId, improvement.id)
    ) {
      return false;
    }
    return true;
  }

  getCurrentTileBuildPreview(unit: Unit): BuildImprovementPreview {
    const tile = this.mapData.tiles[unit.tileY]?.[unit.tileX];
    if (tile === undefined) return { canBuild: false, reason: 'Invalid tile' };
    return this.evaluateBuild(unit, tile);
  }

  getBuildPreview(unit: Unit, tile: Tile): BuildImprovementPreview {
    return this.evaluateBuild(unit, tile);
  }

  build(unit: Unit, tile: Tile, options: BuildImprovementOptions = {}): BuildImprovementResult | null {
    const preview = this.evaluateBuild(unit, tile, options);
    if (!preview.canBuild || preview.improvement === undefined) return null;

    const isForeign = tile.ownerId !== undefined && tile.ownerId !== unit.ownerId;
    const city = preview.claimsSeaResource === true || isForeign
      ? undefined
      : this.getFriendlyCityForOwnedTile(tile.x, tile.y, unit.ownerId);
    if (preview.claimsSeaResource !== true && !isForeign && city === null) return null;

    const requiredTurns = getImprovementBuildTurnsForEra(
      this.eraSystem?.getNationEra(unit.ownerId) ?? 'ancient',
    );
    tile.improvementConstruction = {
      improvementId: preview.improvement.id,
      cityId: city?.id,
      unitId: unit.id,
      ownerId: unit.ownerId,
      resourceOwnerNationId: preview.claimsSeaResource === true ? unit.ownerId : undefined,
      remainingTurns: requiredTurns,
      totalTurns: requiredTurns,
    };
    this.constructionTileByUnitId.set(unit.id, tile);
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

    return { unit, tile, improvement: preview.improvement, city: city ?? undefined, requiredTurns };
  }

  private evaluateBuild(
    unit: Unit,
    tile: Tile,
    options: BuildImprovementOptions = {},
  ): BuildImprovementPreview {
    if (!unit.unitType.canBuildImprovements) return { canBuild: false, reason: 'Unit cannot improve tiles' };
    if (unit.improvementCharges !== undefined && unit.improvementCharges <= 0) {
      return { canBuild: false, reason: 'No improvement charges remaining' };
    }
    if (this.turnManager.getCurrentNation().id !== unit.ownerId) return { canBuild: false, reason: 'Not this unit\'s turn' };
    const activeConstruction = this.getConstructionForUnit(unit.id);
    if (activeConstruction !== undefined) {
      return {
        canBuild: false,
        reason: 'Already building an improvement',
        remainingTurns: activeConstruction.remainingTurns,
      };
    }
    if (!this.isCurrentTile(unit, tile)) return { canBuild: false, reason: 'Worker must stand on this tile' };
    if (tile.improvementId !== undefined) return { canBuild: false, reason: 'Tile already improved' };
    if (tile.improvementConstruction !== undefined) return { canBuild: false, reason: 'Improvement already under construction' };
    if (isBarbarianCamp(tile.buildingId)) return { canBuild: false, reason: 'Barbarian Camp blocks this tile' };
    if ((options.requireMovement ?? true) && unit.movementPoints <= 0) return { canBuild: false, reason: 'Unit has no movement points' };
    if (this.cityManager.getCityAt(tile.x, tile.y) !== undefined) return { canBuild: false, reason: 'City tile cannot be improved' };
    if (!canUnitEnterTile(unit, tile)) return { canBuild: false, reason: 'Invalid terrain for this unit' };

    if (unit.unitType.isNaval === true) {
      return this.evaluateNavalResourceBuild(unit, tile);
    }

    if (tile.ownerId !== unit.ownerId) {
      if (tile.ownerId === undefined) return { canBuild: false, reason: 'Must be inside your territory' };
      if (!this.diplomacyManager?.hasExploitationRights(unit.ownerId, tile.ownerId)) {
        return { canBuild: false, reason: 'Requires exploitation rights' };
      }
      if (tile.resourceId === undefined) {
        return { canBuild: false, reason: 'Foreign exploitation is limited to natural resources' };
      }
      const foreignImprovement = this.getResourceImprovement(tile);
      if (foreignImprovement === undefined) {
        return { canBuild: false, reason: 'No valid improvement for this natural resource' };
      }
      const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(foreignImprovement.id);
      if (requiredTechnology !== undefined
        && !this.researchSystem?.isImprovementUnlocked(unit.ownerId, foreignImprovement.id)) {
        return {
          canBuild: false,
          improvement: foreignImprovement,
          improvementId: foreignImprovement.id,
          reason: `Requires ${requiredTechnology.name}`,
        };
      }
      return { canBuild: true, improvement: foreignImprovement, improvementId: foreignImprovement.id };
    }
    if (this.getFriendlyCityForOwnedTile(tile.x, tile.y, unit.ownerId) === null) {
      return { canBuild: false, reason: 'Tile must be owned by your territory' };
    }

    const improvement = this.resolveImprovementForTile(tile);
    if (improvement === undefined) return { canBuild: false, reason: 'No valid improvement for this terrain' };
    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(unit.ownerId, improvement.id)
    ) {
      return {
        canBuild: false,
        improvement,
        improvementId: improvement.id,
        reason: `Requires ${requiredTechnology.name}`,
      };
    }

    return { canBuild: true, improvement, improvementId: improvement.id };
  }

  private evaluateNavalResourceBuild(unit: Unit, tile: Tile): BuildImprovementPreview {
    if (!this.isSeaTile(tile)) return { canBuild: false, reason: 'Naval builders can only improve sea resources' };
    if (tile.resourceId === undefined) return { canBuild: false, reason: 'Sea resource required' };
    if (tile.ownerId !== undefined && tile.ownerId !== unit.ownerId
      && !this.diplomacyManager?.hasExploitationRights(unit.ownerId, tile.ownerId)) {
      return { canBuild: false, reason: 'Requires exploitation rights' };
    }
    if (tile.resourceOwnerNationId !== undefined && tile.resourceOwnerNationId !== unit.ownerId) {
      return { canBuild: false, reason: 'Resource is controlled by another nation' };
    }

    const improvement = this.getResourceImprovement(tile);
    if (improvement === undefined) return { canBuild: false, reason: 'No valid improvement for this sea resource' };

    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(unit.ownerId, improvement.id)
    ) {
      return {
        canBuild: false,
        improvement,
        improvementId: improvement.id,
        claimsSeaResource: true,
        reason: `Requires ${requiredTechnology.name}`,
      };
    }

    return {
      canBuild: true,
      improvement,
      improvementId: improvement.id,
      claimsSeaResource: true,
    };
  }

  private isCurrentTile(unit: Unit, tile: Tile): boolean {
    return unit.tileX === tile.x && unit.tileY === tile.y;
  }

  private resolveImprovementForTile(tile: Tile): TileImprovementDefinition | undefined {
    const resourceImprovement = this.getResourceImprovement(tile);
    return resourceImprovement ?? getImprovementForTileType(tile.type);
  }

  private getResourceImprovement(tile: Tile): TileImprovementDefinition | undefined {
    if (tile.resourceId === undefined) return undefined;

    const resource = getNaturalResourceById(tile.resourceId);
    if (resource === undefined) return undefined;

    const improvementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
    if (improvementId === undefined) return undefined;

    const improvement = getImprovementById(improvementId);
    if (improvement === undefined) return undefined;
    if (!improvement.allowedTileTypes.includes(tile.type)) return undefined;

    return improvement;
  }

  private isSeaTile(tile: Tile): boolean {
    return tile.type === TileType.Coast || tile.type === TileType.Ocean;
  }

  private getFriendlyCityForOwnedTile(tileX: number, tileY: number, playerId: string): City | null {
    const cities = this.cityManager.getCitiesByOwner(playerId);
    for (const city of cities) {
      const isOwned = city.ownedTileCoords.some((tileCoord) => (
        tileCoord.x === tileX && tileCoord.y === tileY
      ));
      if (isOwned) {
        return city;
      }
    }
    return null;
  }

  rebuildConstructionIndex(): void {
    this.constructionTileByUnitId.clear();
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const unitId = tile.improvementConstruction?.unitId;
        if (unitId !== undefined) this.constructionTileByUnitId.set(unitId, tile);
      }
    }
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason === 'removed' || event.unit.buildAction === undefined) {
      this.constructionTileByUnitId.delete(event.unit.id);
      return;
    }
    const tile = this.mapData.tiles[event.unit.buildAction.tileY]?.[event.unit.buildAction.tileX];
    if (tile?.improvementConstruction?.unitId === event.unit.id) {
      this.constructionTileByUnitId.set(event.unit.id, tile);
    } else {
      this.constructionTileByUnitId.delete(event.unit.id);
    }
  }

  private getConstructionForUnit(unitId: string): Tile['improvementConstruction'] | undefined {
    const tile = this.constructionTileByUnitId.get(unitId);
    if (tile === undefined) return undefined;
    const construction = tile.improvementConstruction;
    if (construction?.unitId === unitId) return construction;
    this.constructionTileByUnitId.delete(unitId);
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
