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
import type { UnitType } from '../entities/UnitType';

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
  /** The capable unit that performs the work (may be cargo). */
  builderUnitId?: string;
  /** Carrier that must remain over the site while its cargo unit builds. */
  transportUnitId?: string;
  claimsSeaResource?: boolean;
  reason?: string;
  remainingTurns?: number;
}

interface BuildImprovementOptions {
  consumeMovement?: boolean;
  requireMovement?: boolean;
}

interface CargoBuildContext {
  builder: Unit;
  transport: Unit;
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
    private readonly isResourceVisibleToNation: (nationId: string, resourceId: string) => boolean = () => true,
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
    if (improvement.requiredBuilderCapability !== undefined) return false;
    if (tile.resourceId !== undefined && !this.isResourceVisibleToNation(nationId, tile.resourceId)) return false;

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

    const builderUnit = preview.builderUnitId !== undefined
      ? this.unitManager.getUnit(preview.builderUnitId)
      : unit;
    const movementUnit = preview.transportUnitId !== undefined
      ? this.unitManager.getUnit(preview.transportUnitId)
      : unit;
    if (builderUnit === undefined || movementUnit === undefined) return null;

    const isForeign = tile.ownerId !== undefined && tile.ownerId !== builderUnit.ownerId;
    const usesTerritorialOwnership = preview.transportUnitId !== undefined
      && tile.ownerId === builderUnit.ownerId;
    const createsStandaloneSeaClaim = preview.claimsSeaResource === true && !usesTerritorialOwnership;
    const city = createsStandaloneSeaClaim || isForeign
      ? undefined
      : this.getFriendlyCityForOwnedTile(tile.x, tile.y, builderUnit.ownerId);
    if (!createsStandaloneSeaClaim && !isForeign && city === null) return null;

    const requiredTurns = preview.improvement.buildTurns ?? getImprovementBuildTurnsForEra(
      this.eraSystem?.getNationEra(builderUnit.ownerId) ?? 'ancient',
    );
    // Cargo archaeology inside domestic waters follows territorial ownership,
    // so later conquest transfers its Culture naturally. Existing Work Boat
    // sea-claim semantics remain untouched.
    const createsSeaResourceClaim = createsStandaloneSeaClaim;
    tile.improvementConstruction = {
      improvementId: preview.improvement.id,
      cityId: city?.id,
      unitId: builderUnit.id,
      transportUnitId: preview.transportUnitId,
      ownerId: builderUnit.ownerId,
      resourceOwnerNationId: createsSeaResourceClaim ? builderUnit.ownerId : undefined,
      remainingTurns: requiredTurns,
      totalTurns: requiredTurns,
    };
    this.indexConstructionUnits(tile);
    builderUnit.setBuildingImprovement({
      improvementId: preview.improvement.id,
      tileX: tile.x,
      tileY: tile.y,
      progress: 0,
      requiredProgress: BUILD_REQUIRED_PROGRESS,
    });
    if (options.consumeMovement ?? true) {
      this.unitManager.consumeAllMovement(movementUnit.id);
    }
    this.unitManager.notifyActionChanged(builderUnit.id);
    if (movementUnit.id !== builderUnit.id) this.unitManager.notifyActionChanged(movementUnit.id);

    return { unit: builderUnit, tile, improvement: preview.improvement, city: city ?? undefined, requiredTurns };
  }

  private evaluateBuild(
    unit: Unit,
    tile: Tile,
    options: BuildImprovementOptions = {},
  ): BuildImprovementPreview {
    const resourceImprovement = this.getResourceImprovement(tile);
    const cargoContext = resourceImprovement?.requiredCargoTransportUnitTypeId !== undefined
      ? this.getCargoBuildContext(unit, resourceImprovement)
      : undefined;
    const builderUnit = cargoContext?.builder ?? unit;
    const movementUnit = cargoContext?.transport ?? unit;
    if (!isImprovementBuilderUnitType(builderUnit.unitType)) return { canBuild: false, reason: 'Unit cannot improve tiles' };
    if (builderUnit.improvementCharges !== undefined && builderUnit.improvementCharges <= 0) {
      return { canBuild: false, reason: 'No improvement charges remaining' };
    }
    if (this.turnManager.getCurrentNation().id !== builderUnit.ownerId) return { canBuild: false, reason: 'Not this unit\'s turn' };
    const activeConstruction = this.getConstructionForUnit(builderUnit.id)
      ?? this.getConstructionForUnit(movementUnit.id);
    if (activeConstruction !== undefined) {
      return {
        canBuild: false,
        reason: 'Already building an improvement',
        remainingTurns: activeConstruction.remainingTurns,
      };
    }
    if (!this.isCurrentTile(builderUnit, tile) || !this.isCurrentTile(movementUnit, tile)) {
      return { canBuild: false, reason: 'Builder must be on this tile' };
    }
    if (tile.improvementId !== undefined) return { canBuild: false, reason: 'Tile already improved' };
    if (tile.improvementConstruction !== undefined) return { canBuild: false, reason: 'Improvement already under construction' };
    if (isBarbarianCamp(tile.buildingId)) return { canBuild: false, reason: 'Barbarian Camp blocks this tile' };
    if ((options.requireMovement ?? true) && movementUnit.movementPoints <= 0) return { canBuild: false, reason: 'Unit has no movement points' };
    if (this.cityManager.getCityAt(tile.x, tile.y) !== undefined) return { canBuild: false, reason: 'City tile cannot be improved' };
    if (!canUnitEnterTile(movementUnit, tile)) return { canBuild: false, reason: 'Invalid terrain for this unit' };
    if (tile.resourceId !== undefined && !this.isResourceVisibleToNation(builderUnit.ownerId, tile.resourceId)) {
      return { canBuild: false, reason: 'Resource is not known to this nation' };
    }

    if (resourceImprovement?.requiredCargoTransportUnitTypeId !== undefined && cargoContext === undefined) {
      return { canBuild: false, reason: 'Archaeologist must be cargo aboard a Transport Ship' };
    }

    if (movementUnit.unitType.isNaval === true) {
      return this.evaluateNavalResourceBuild(builderUnit, movementUnit, tile, cargoContext);
    }

    if (tile.ownerId !== builderUnit.ownerId) {
      if (tile.ownerId === undefined) return { canBuild: false, reason: 'Must be inside your territory' };
      if (!this.diplomacyManager?.hasExploitationRights(builderUnit.ownerId, tile.ownerId)) {
        return { canBuild: false, reason: 'Requires exploitation rights' };
      }
      if (tile.resourceId === undefined) {
        return { canBuild: false, reason: 'Foreign exploitation is limited to natural resources' };
      }
      const foreignImprovement = this.getResourceImprovement(tile);
      if (foreignImprovement === undefined) {
        return { canBuild: false, reason: 'No valid improvement for this natural resource' };
      }
      if (!canUnitConstructImprovement(builderUnit.unitType, foreignImprovement)) {
        return { canBuild: false, reason: 'Unit lacks the required improvement capability' };
      }
      const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(foreignImprovement.id);
      if (requiredTechnology !== undefined
        && !this.researchSystem?.isImprovementUnlocked(builderUnit.ownerId, foreignImprovement.id)) {
        return {
          canBuild: false,
          improvement: foreignImprovement,
          improvementId: foreignImprovement.id,
          reason: `Requires ${requiredTechnology.name}`,
        };
      }
      return this.buildablePreview(foreignImprovement, builderUnit, cargoContext);
    }
    if (this.getFriendlyCityForOwnedTile(tile.x, tile.y, builderUnit.ownerId) === null) {
      return { canBuild: false, reason: 'Tile must be owned by your territory' };
    }

    const improvement = this.resolveImprovementForTile(tile);
    if (improvement === undefined) return { canBuild: false, reason: 'No valid improvement for this terrain' };
    if (!canUnitConstructImprovement(builderUnit.unitType, improvement)) {
      return { canBuild: false, reason: 'Unit lacks the required improvement capability' };
    }
    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(builderUnit.ownerId, improvement.id)
    ) {
      return {
        canBuild: false,
        improvement,
        improvementId: improvement.id,
        reason: `Requires ${requiredTechnology.name}`,
      };
    }

    return this.buildablePreview(improvement, builderUnit, cargoContext);
  }

  private evaluateNavalResourceBuild(
    builderUnit: Unit,
    movementUnit: Unit,
    tile: Tile,
    cargoContext?: CargoBuildContext,
  ): BuildImprovementPreview {
    if (!this.isSeaTile(tile)) return { canBuild: false, reason: 'Naval builders can only improve sea resources' };
    if (tile.resourceId === undefined) return { canBuild: false, reason: 'Sea resource required' };
    if (tile.ownerId !== undefined && tile.ownerId !== builderUnit.ownerId
      && !this.diplomacyManager?.hasExploitationRights(builderUnit.ownerId, tile.ownerId)) {
      return { canBuild: false, reason: 'Requires exploitation rights' };
    }
    if (tile.resourceOwnerNationId !== undefined && tile.resourceOwnerNationId !== builderUnit.ownerId) {
      return { canBuild: false, reason: 'Resource is controlled by another nation' };
    }

    const improvement = this.getResourceImprovement(tile);
    if (improvement === undefined) return { canBuild: false, reason: 'No valid improvement for this sea resource' };
    if (!canUnitConstructImprovement(builderUnit.unitType, improvement)) {
      return { canBuild: false, reason: 'Unit lacks the required improvement capability' };
    }

    const requiredTechnology = this.researchSystem?.getRequiredTechnologyForImprovement(improvement.id);
    if (
      requiredTechnology !== undefined &&
      !this.researchSystem?.isImprovementUnlocked(builderUnit.ownerId, improvement.id)
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
      ...this.buildablePreview(improvement, builderUnit, cargoContext),
      claimsSeaResource: true,
    };
  }

  private getCargoBuildContext(unit: Unit, improvement: TileImprovementDefinition): CargoBuildContext | undefined {
    const requiredTransportId = improvement.requiredCargoTransportUnitTypeId;
    if (requiredTransportId === undefined) return undefined;

    const transport = unit.unitType.id === requiredTransportId
      ? unit
      : this.unitManager.getTransportForUnit(unit);
    if (transport?.unitType.id !== requiredTransportId || transport.ownerId !== unit.ownerId) return undefined;

    const cargo = this.unitManager.getCargoUnitsForTransport(transport)
      .filter((candidate) => (
        candidate.ownerId === transport.ownerId
        && canUnitConstructImprovement(candidate.unitType, improvement)
      ))
      .sort((a, b) => a.id.localeCompare(b.id));
    const builder = cargo[0];
    if (builder === undefined) return undefined;
    if (unit.id !== transport.id && unit.id !== builder.id) return undefined;
    return { builder, transport };
  }

  private buildablePreview(
    improvement: TileImprovementDefinition,
    builderUnit: Unit,
    cargoContext?: CargoBuildContext,
  ): BuildImprovementPreview {
    return {
      canBuild: true,
      improvement,
      improvementId: improvement.id,
      builderUnitId: builderUnit.id,
      transportUnitId: cargoContext?.transport.id,
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
        this.indexConstructionUnits(tile);
      }
    }
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason === 'removed') {
      this.constructionTileByUnitId.delete(event.unit.id);
      return;
    }
    const active = this.getConstructionForUnit(event.unit.id);
    if (active !== undefined) return;
    if (event.unit.buildAction === undefined) {
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
    if (construction?.unitId === unitId || construction?.transportUnitId === unitId) return construction;
    this.constructionTileByUnitId.delete(unitId);
    return undefined;
  }

  private indexConstructionUnits(tile: Tile): void {
    const construction = tile.improvementConstruction;
    if (construction === undefined) return;
    this.constructionTileByUnitId.set(construction.unitId, tile);
    if (construction.transportUnitId !== undefined) {
      this.constructionTileByUnitId.set(construction.transportUnitId, tile);
    }
  }
}

export function isImprovementBuilderUnitType(unitType: UnitType): boolean {
  return unitType.canBuildImprovements === true
    || (unitType.improvementCapabilities?.length ?? 0) > 0;
}

export function canUnitConstructImprovement(
  unitType: UnitType,
  improvement: TileImprovementDefinition,
): boolean {
  if (improvement.requiredBuilderCapability !== undefined) {
    return unitType.improvementCapabilities?.includes(improvement.requiredBuilderCapability) === true;
  }
  return unitType.canBuildImprovements === true;
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
