import { getImprovementById, type TileImprovementDefinition } from '../data/improvements';
import { getNaturalResourceById, getNaturalResourceImprovementIdForTile } from '../data/naturalResources';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import { TileType, type MapData, type Tile, type TileImprovementConstruction } from '../types/map';
import type { TurnStartEvent } from '../types/events';
import {
  BUILD_REQUIRED_PROGRESS,
  computeUnitBuildProgress,
} from './BuilderSystem';
import type { CityManager } from './CityManager';
import type { PolicySystem } from './PolicySystem';
import type { UnitChangedEvent, UnitManager } from './UnitManager';
import type { DiplomacyManager } from './DiplomacyManager';

export interface ImprovementConstructionCompletedEvent {
  tile: Tile;
  construction: TileImprovementConstruction;
  improvement: TileImprovementDefinition;
  city?: City;
  unit: Unit;
}

export type ImprovementConstructionCancelReason =
  | 'unitRemoved'
  | 'invalidTile'
  | 'invalidUnit'
  | 'missingImprovement'
  | 'missingCity'
  | 'userInterrupt';

export interface ImprovementConstructionCancelledEvent {
  tile: Tile;
  construction: TileImprovementConstruction;
  reason: ImprovementConstructionCancelReason;
}

type CompletedListener = (event: ImprovementConstructionCompletedEvent) => void;
type CancelledListener = (event: ImprovementConstructionCancelledEvent) => void;

export class ImprovementConstructionSystem {
  private readonly completedListeners: CompletedListener[] = [];
  private readonly cancelledListeners: CancelledListener[] = [];
  private readonly constructionTileByUnitId = new Map<string, Tile>();

  constructor(
    private readonly mapData: MapData,
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly policySystem?: PolicySystem,
    private readonly diplomacyManager?: DiplomacyManager,
  ) {
    this.unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
    this.syncUnitsFromTiles();
  }

  handleTurnStart(event: TurnStartEvent): void {
    for (const tile of this.getConstructionTilesForOwner(event.nation.id)) {
      const construction = tile.improvementConstruction;
      if (construction === undefined) continue;

      const invalidReason = this.getInvalidReason(tile, construction);
      if (invalidReason !== null) {
        this.cancel(tile, construction, invalidReason);
        continue;
      }

      this.advanceConstruction(construction);
      const unit = this.unitManager.getUnit(construction.unitId);
      if (unit !== undefined) {
        this.unitManager.consumeAllMovement(unit.id);
        this.syncUnitProgress(unit, construction);
      }

      if (construction.remainingTurns <= 0) {
        this.complete(tile, construction);
      } else if (unit !== undefined) {
        this.unitManager.notifyActionChanged(unit.id);
      }
    }
  }

  isUnitBusy(unitId: string): boolean {
    return this.getConstructionForUnit(unitId) !== null;
  }

  getConstructionForUnit(unitId: string): { tile: Tile; construction: TileImprovementConstruction } | null {
    const tile = this.constructionTileByUnitId.get(unitId);
    if (tile === undefined) return null;
    const construction = tile.improvementConstruction;
    if (construction?.unitId === unitId) return { tile, construction };
    this.constructionTileByUnitId.delete(unitId);
    return null;
  }

  /**
   * Cancel any in-progress build owned by this unit. Used when the player
   * explicitly wakes/moves the worker — the build is forfeit and progress
   * resets, matching the "moving/waking cancels" rule.
   */
  cancelBuildForUnit(unitId: string, reason: ImprovementConstructionCancelReason = 'userInterrupt'): boolean {
    const active = this.getConstructionForUnit(unitId);
    if (active === null) return false;
    this.cancel(active.tile, active.construction, reason);
    return true;
  }

  onCompleted(listener: CompletedListener): void {
    this.completedListeners.push(listener);
  }

  onCancelled(listener: CancelledListener): void {
    this.cancelledListeners.push(listener);
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason === 'removed') {
      const active = this.getConstructionForUnit(event.unit.id);
      if (active !== null) this.cancel(active.tile, active.construction, 'unitRemoved');
      return;
    }
    if (event.unit.buildAction === undefined) {
      this.constructionTileByUnitId.delete(event.unit.id);
      return;
    }
    const tile = this.mapData.tiles[event.unit.buildAction.tileY]?.[event.unit.buildAction.tileX];
    if (tile?.improvementConstruction?.unitId === event.unit.id) {
      this.constructionTileByUnitId.set(event.unit.id, tile);
    }
  }

  private getConstructionTilesForOwner(ownerId: string): Tile[] {
    const tiles: Tile[] = [];
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.improvementConstruction?.ownerId === ownerId) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  private getInvalidReason(
    tile: Tile,
    construction: TileImprovementConstruction,
  ): ImprovementConstructionCancelReason | null {
    const unit = this.unitManager.getUnit(construction.unitId);
    if (unit === undefined) return 'invalidUnit';
    if (unit.tileX !== tile.x || unit.tileY !== tile.y || unit.ownerId !== construction.ownerId) return 'invalidUnit';
    if (tile.improvementId !== undefined) return 'invalidTile';
    if (getImprovementById(construction.improvementId) === undefined) return 'missingImprovement';
    if (construction.resourceOwnerNationId !== undefined) {
      if (!this.isValidSeaResourceClaim(tile, construction, unit)) return 'invalidTile';
      return null;
    }
    if (tile.ownerId !== construction.ownerId) {
      if (tile.ownerId === undefined
        || !this.diplomacyManager?.hasExploitationRights(construction.ownerId, tile.ownerId)
        || !this.isCanonicalResourceImprovement(tile, construction.improvementId)) return 'invalidTile';
      return null;
    }
    if (construction.cityId === undefined) return 'missingCity';
    const city = this.cityManager.getCity(construction.cityId);
    if (city === undefined || city.ownerId !== construction.ownerId) return 'missingCity';
    return null;
  }

  private cancel(
    tile: Tile,
    construction: TileImprovementConstruction,
    reason: ImprovementConstructionCancelReason,
  ): void {
    this.constructionTileByUnitId.delete(construction.unitId);
    tile.improvementConstruction = undefined;
    const unit = this.unitManager.getUnit(construction.unitId);
    if (unit !== undefined) {
      unit.clearBuildAction();
      this.unitManager.notifyActionChanged(unit.id);
    }
    for (const listener of this.cancelledListeners) {
      listener({ tile, construction, reason });
    }
  }

  private complete(tile: Tile, construction: TileImprovementConstruction): void {
    const improvement = getImprovementById(construction.improvementId);
    const city = construction.cityId !== undefined
      ? this.cityManager.getCity(construction.cityId)
      : undefined;
    const unit = this.unitManager.getUnit(construction.unitId);
    if (improvement === undefined) {
      this.cancel(tile, construction, 'missingImprovement');
      return;
    }
    if (construction.resourceOwnerNationId === undefined
      && city === undefined
      && tile.ownerId === construction.ownerId) {
      this.cancel(tile, construction, 'missingCity');
      return;
    }
    if (unit === undefined) {
      this.cancel(tile, construction, 'invalidUnit');
      return;
    }

    tile.improvementId = construction.improvementId;
    // Domestic improvements keep the legacy implicit ownership semantics, so
    // ordinary conquest/territory transfer behavior remains unchanged. Only a
    // genuinely separate economic owner needs persistent metadata.
    tile.improvementOwnerId = tile.ownerId !== construction.ownerId
      ? construction.ownerId
      : undefined;
    if (construction.resourceOwnerNationId !== undefined) {
      tile.resourceOwnerNationId = construction.resourceOwnerNationId;
    }
    this.constructionTileByUnitId.delete(construction.unitId);
    tile.improvementConstruction = undefined;
    unit.clearBuildAction();
    this.unitManager.notifyActionChanged(unit.id);
    for (const listener of this.completedListeners) {
      listener({ tile, construction, improvement, city, unit });
    }
  }

  private isValidSeaResourceClaim(
    tile: Tile,
    construction: TileImprovementConstruction,
    unit: Unit,
  ): boolean {
    if (construction.resourceOwnerNationId !== construction.ownerId) return false;
    if (unit.unitType.isNaval !== true || unit.unitType.canBuildImprovements !== true) return false;
    if (tile.type !== TileType.Coast && tile.type !== TileType.Ocean) return false;
    if (tile.resourceId === undefined) return false;

    const resource = getNaturalResourceById(tile.resourceId);
    if (resource === undefined) return false;

    const improvementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
    if (improvementId !== construction.improvementId) return false;
    return tile.ownerId === undefined
      || tile.ownerId === construction.ownerId
      || this.diplomacyManager?.hasExploitationRights(construction.ownerId, tile.ownerId) === true;
  }

  private isCanonicalResourceImprovement(tile: Tile, improvementId: string): boolean {
    if (tile.resourceId === undefined) return false;
    const resource = getNaturalResourceById(tile.resourceId);
    return resource !== undefined
      && getNaturalResourceImprovementIdForTile(resource, tile.type) === improvementId;
  }

  private syncUnitProgress(unit: Unit, construction: TileImprovementConstruction): void {
    const progress = computeUnitBuildProgress(
      construction.remainingTurns,
      construction.totalTurns,
    );
    if (unit.buildAction === undefined) {
      unit.setBuildingImprovement({
        improvementId: construction.improvementId,
        tileX: unit.tileX,
        tileY: unit.tileY,
        progress,
        requiredProgress: BUILD_REQUIRED_PROGRESS,
      });
      return;
    }
    unit.buildAction.progress = progress;
    unit.buildAction.requiredProgress = BUILD_REQUIRED_PROGRESS;
    unit.actionStatus = 'building';
  }

  private advanceConstruction(construction: TileImprovementConstruction): void {
    if (construction.totalTurns <= 0) {
      construction.remainingTurns = 0;
      return;
    }

    const percent = this.policySystem?.getPercentModifierTotal(
      construction.ownerId,
      'improvementBuildSpeedPercent',
    ) ?? 0;
    const multiplier = Math.max(0, 1 + (percent / 100));
    const turnProgress = Math.max(1, Math.floor(multiplier));
    construction.remainingTurns = Math.max(0, construction.remainingTurns - turnProgress);
  }

  /**
   * Bring unit.buildAction in line with the live tile state. Called once
   * after construction and again after save-load so units restored from
   * older saves (which only carry tile.improvementConstruction) end up
   * with a populated mirror for rendering.
   */
  syncUnitsFromTiles(): void {
    this.constructionTileByUnitId.clear();
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const construction = tile.improvementConstruction;
        if (construction === undefined) continue;
        this.constructionTileByUnitId.set(construction.unitId, tile);
        const unit = this.unitManager.getUnit(construction.unitId);
        if (unit === undefined) continue;
        this.syncUnitProgress(unit, construction);
      }
    }
  }
}
