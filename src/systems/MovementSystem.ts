import { Unit } from '../entities/Unit';
import { Tile, TileType } from '../types/map';
import { Selectable } from '../types/selection';
import { SelectionManager } from './SelectionManager';
import { TileMap } from './TileMap';
import { TurnManager } from './TurnManager';
import { UnitManager } from './UnitManager';
import { UnitRenderer } from './UnitRenderer';
import type { DiplomacyManager } from './DiplomacyManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { NationManager } from './NationManager';
import { canUnitEndMovementOnTile, canUnitEnterTile } from './UnitMovementRules';

/** Return movement cost for entering a tile. */
export function getTileMovementCost(tile: Tile): number {
  if (tile.type === TileType.Jungle) return 2;
  return 1;
}

const BOARDING_MOVEMENT_COST = 1;

export type MovementActionSource = 'human-ui' | 'system';

export interface MovementWarRequiredEvent {
  attackerId: string;
  targetNationId: string;
  unit: Unit;
  tileX: number;
  tileY: number;
  source: MovementActionSource;
}

interface MovementActionOptions {
  source?: MovementActionSource;
}

type MovementWarRequiredListener = (event: MovementWarRequiredEvent) => void;
type UnitMovementBlocker = (unit: Unit) => boolean;
type ProtectedLeaderTerritoryAccess = (unit: Unit, territoryOwnerId: string) => boolean;

/**
 * MovementSystem äger rörelsereglerna för enheter.
 *
 * Input kommer via SelectionManager, medan tillstånd muteras via UnitManager
 * och visuell position uppdateras via UnitRenderer.
 */
export class MovementSystem {
  private activeNationId: string;
  private readonly warRequiredListeners: MovementWarRequiredListener[] = [];

  constructor(
    private readonly tileMap: TileMap,
    private readonly unitManager: UnitManager,
    private readonly unitRenderer: UnitRenderer,
    turnManager: TurnManager,
    selectionManager: SelectionManager,
    private readonly gridSystem: IGridSystem,
    private readonly nationManager: NationManager,
    private readonly diplomacyManager?: DiplomacyManager,
    private readonly isUnitMovementBlocked: UnitMovementBlocker = () => false,
    private readonly canProtectedLeaderEnterTerritory: ProtectedLeaderTerritoryAccess = () => false,
  ) {
    this.activeNationId = turnManager.getCurrentNation().id;

    selectionManager.onSelectionTarget((target, currentSelection) => (
      this.handleSelectionTarget(target, currentSelection)
    ));

    turnManager.on('turnStart', (event) => {
      this.activeNationId = event.nation.id;
      this.unitManager.resetMovementForOwner(event.nation.id);
    });
  }

  canMoveUnitTo(unit: Unit, tileX: number, tileY: number): boolean {
    return this.canMoveUnitToInternal(unit, tileX, tileY, true);
  }

  onWarRequired(listener: MovementWarRequiredListener): void {
    this.warRequiredListeners.push(listener);
  }

  private canMoveUnitToInternal(unit: Unit, tileX: number, tileY: number, respectDiplomacy: boolean): boolean {
    if (unit.ownerId !== this.activeNationId) return false;
    if (this.isUnitMovementBlocked(unit)) return false;
    if (unit.movementPoints <= 0) return false;
    if (!this.gridSystem.isAdjacent(
      { x: unit.tileX, y: unit.tileY },
      { x: tileX, y: tileY },
    )) return false;

    const targetTile = this.tileMap.getTileAt(tileX, tileY);
    if (targetTile === null) return false;
    if (respectDiplomacy && this.getClosedBorderOwner(unit, targetTile) !== null) return false;

    const boardingTransport = this.getBoardingTransport(unit, tileX, tileY);
    if (boardingTransport !== undefined) {
      return unit.movementPoints >= BOARDING_MOVEMENT_COST;
    }

    if (!canUnitEndMovementOnTile(unit, targetTile, this.nationManager.getNation(unit.ownerId))) return false;

    const cost = getTileMovementCost(targetTile);
    if (unit.movementPoints < cost) return false;

    const occupyingUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (occupyingUnit !== null && occupyingUnit.id !== unit.id && unit.unitType.ignoresUnitCollision !== true) return false;

    return true;
  }

  private handleSelectionTarget(
    target: Selectable | null,
    currentSelection: Selectable | null,
  ): boolean {
    if (target === null || currentSelection?.kind !== 'unit') return false;

    const targetTile = this.getTileForSelectable(target);
    if (targetTile === null) return false;

    const unit = currentSelection.unit;
    if (!this.canMoveUnitToInternal(unit, targetTile.x, targetTile.y, false)) return false;
    const closedBorderOwner = this.getClosedBorderOwner(unit, targetTile);
    if (closedBorderOwner !== null) {
      this.notifyWarRequired(unit, closedBorderOwner, targetTile.x, targetTile.y, 'human-ui');
      return true;
    }

    const boardingTransport = this.getBoardingTransport(unit, targetTile.x, targetTile.y);
    if (boardingTransport !== undefined) {
      return this.unitManager.boardUnit(
        unit.id,
        boardingTransport.id,
        BOARDING_MOVEMENT_COST,
      );
    }

    const cost = getTileMovementCost(targetTile);
    const didMove = this.unitManager.moveUnit(
      unit.id,
      targetTile.x,
      targetTile.y,
      cost,
    );
    if (!didMove) return false;

    this.unitRenderer.refreshUnitPosition(unit.id);
    return true;
  }

  moveAlongPath(unit: Unit, path: Tile[], options: MovementActionOptions = {}): void {
    if (path.length === 0) return;
    const destination = path[path.length - 1];
    if (!canUnitEndMovementOnTile(unit, destination, this.nationManager.getNation(unit.ownerId))) return;

    for (const tile of path) {
      if (tile.x === unit.tileX && tile.y === unit.tileY) continue;
      const isDestination = tile === destination;
      if (!this.canMoveUnitStepToInternal(unit, tile.x, tile.y, false, !isDestination)) break;
      const closedBorderOwner = this.getClosedBorderOwner(unit, tile);
      if (closedBorderOwner !== null) {
        this.notifyWarRequired(unit, closedBorderOwner, tile.x, tile.y, options.source ?? 'system');
        break;
      }

      const cost = getTileMovementCost(tile);
      const didMove = this.unitManager.moveUnit(unit.id, tile.x, tile.y, cost);
      if (!didMove) break;

      this.unitRenderer.refreshUnitPosition(unit.id);
      if (unit.movementPoints <= 0) break;
    }
  }

  private canMoveUnitStepToInternal(
    unit: Unit,
    tileX: number,
    tileY: number,
    respectDiplomacy: boolean,
    allowTransitOnly: boolean,
  ): boolean {
    if (!allowTransitOnly) return this.canMoveUnitToInternal(unit, tileX, tileY, respectDiplomacy);
    if (unit.ownerId !== this.activeNationId) return false;
    if (this.isUnitMovementBlocked(unit)) return false;
    if (unit.movementPoints <= 0) return false;
    if (!this.gridSystem.isAdjacent({ x: unit.tileX, y: unit.tileY }, { x: tileX, y: tileY })) return false;

    const targetTile = this.tileMap.getTileAt(tileX, tileY);
    if (targetTile === null) return false;
    if (respectDiplomacy && this.getClosedBorderOwner(unit, targetTile) !== null) return false;
    if (!canUnitEnterTile(unit, targetTile, this.nationManager.getNation(unit.ownerId))) return false;

    const cost = getTileMovementCost(targetTile);
    if (unit.movementPoints < cost) return false;

    const occupyingUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (occupyingUnit !== null && occupyingUnit.id !== unit.id && unit.unitType.ignoresUnitCollision !== true) return false;

    return true;
  }

  private getTileForSelectable(selectable: Selectable): Tile | null {
    if (selectable.kind === 'tile') return selectable.tile;
    if (selectable.kind === 'city') {
      return this.tileMap.getTileAt(selectable.city.tileX, selectable.city.tileY);
    }
    return this.tileMap.getTileAt(selectable.unit.tileX, selectable.unit.tileY);
  }

  private getBoardingTransport(unit: Unit, tileX: number, tileY: number): Unit | undefined {
    if (unit.unitType.isNaval || unit.transportId !== undefined) return undefined;
    const occupyingUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (occupyingUnit === null) return undefined;
    if (!this.unitManager.canBoardUnit(unit, occupyingUnit)) return undefined;
    return occupyingUnit;
  }

  private getClosedBorderOwner(unit: Unit, tile: Tile): string | null {
    if (tile.ownerId === undefined || tile.ownerId === unit.ownerId) return null;
    if (this.diplomacyManager === undefined) return null;

    // canEnterTerritory already accounts for war state and directional
    // open-borders grants, so the legacy WAR / openBorders branches collapse
    // into a single check.
    if (this.diplomacyManager.canEnterTerritory(unit.ownerId, tile.ownerId)) return null;
    if (this.canProtectedLeaderEnterTerritory(unit, tile.ownerId)) return null;
    return tile.ownerId;
  }

  private notifyWarRequired(
    unit: Unit,
    targetNationId: string,
    tileX: number,
    tileY: number,
    source: MovementActionSource,
  ): void {
    for (const listener of this.warRequiredListeners) {
      listener({ attackerId: unit.ownerId, targetNationId, unit, tileX, tileY, source });
    }
  }
}
