import { getImprovementById, type TileImprovementDefinition } from '../data/improvements';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';
import type { MapData, Tile, TileImprovementConstruction } from '../types/map';
import type { TurnStartEvent } from '../types/events';
import type { CityManager } from './CityManager';
import type { UnitChangedEvent, UnitManager } from './UnitManager';

export interface ImprovementConstructionCompletedEvent {
  tile: Tile;
  construction: TileImprovementConstruction;
  improvement: TileImprovementDefinition;
  city: City;
  unit: Unit;
}

export interface ImprovementConstructionCancelledEvent {
  tile: Tile;
  construction: TileImprovementConstruction;
  reason: 'unitRemoved' | 'invalidTile' | 'invalidUnit' | 'missingImprovement' | 'missingCity';
}

type CompletedListener = (event: ImprovementConstructionCompletedEvent) => void;
type CancelledListener = (event: ImprovementConstructionCancelledEvent) => void;

export class ImprovementConstructionSystem {
  private readonly completedListeners: CompletedListener[] = [];
  private readonly cancelledListeners: CancelledListener[] = [];

  constructor(
    private readonly mapData: MapData,
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
  ) {
    this.unitManager.onUnitChanged((event) => this.handleUnitChanged(event));
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

      construction.remainingTurns = Math.max(0, construction.remainingTurns - 1);
      const unit = this.unitManager.getUnit(construction.unitId);
      if (unit !== undefined) {
        this.unitManager.consumeAllMovement(unit.id);
      }

      if (construction.remainingTurns <= 0) {
        this.complete(tile, construction);
      }
    }
  }

  isUnitBusy(unitId: string): boolean {
    return this.getConstructionForUnit(unitId) !== null;
  }

  getConstructionForUnit(unitId: string): { tile: Tile; construction: TileImprovementConstruction } | null {
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        const construction = tile.improvementConstruction;
        if (construction?.unitId === unitId) {
          return { tile, construction };
        }
      }
    }
    return null;
  }

  onCompleted(listener: CompletedListener): void {
    this.completedListeners.push(listener);
  }

  onCancelled(listener: CancelledListener): void {
    this.cancelledListeners.push(listener);
  }

  private handleUnitChanged(event: UnitChangedEvent): void {
    if (event.reason !== 'removed') return;
    const active = this.getConstructionForUnit(event.unit.id);
    if (active === null) return;
    this.cancel(active.tile, active.construction, 'unitRemoved');
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
  ): ImprovementConstructionCancelledEvent['reason'] | null {
    const unit = this.unitManager.getUnit(construction.unitId);
    if (unit === undefined) return 'invalidUnit';
    if (unit.tileX !== tile.x || unit.tileY !== tile.y || unit.ownerId !== construction.ownerId) return 'invalidUnit';
    if (tile.ownerId !== construction.ownerId || tile.improvementId !== undefined) return 'invalidTile';
    if (getImprovementById(construction.improvementId) === undefined) return 'missingImprovement';
    const city = this.cityManager.getCity(construction.cityId);
    if (city === undefined || city.ownerId !== construction.ownerId) return 'missingCity';
    return null;
  }

  private cancel(
    tile: Tile,
    construction: TileImprovementConstruction,
    reason: ImprovementConstructionCancelledEvent['reason'],
  ): void {
    tile.improvementConstruction = undefined;
    for (const listener of this.cancelledListeners) {
      listener({ tile, construction, reason });
    }
  }

  private complete(tile: Tile, construction: TileImprovementConstruction): void {
    const improvement = getImprovementById(construction.improvementId);
    const city = this.cityManager.getCity(construction.cityId);
    const unit = this.unitManager.getUnit(construction.unitId);
    if (improvement === undefined) {
      this.cancel(tile, construction, 'missingImprovement');
      return;
    }
    if (city === undefined) {
      this.cancel(tile, construction, 'missingCity');
      return;
    }
    if (unit === undefined) {
      this.cancel(tile, construction, 'invalidUnit');
      return;
    }

    tile.improvementId = construction.improvementId;
    tile.improvementConstruction = undefined;
    for (const listener of this.completedListeners) {
      listener({ tile, construction, improvement, city, unit });
    }
  }
}
