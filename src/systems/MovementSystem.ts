import { Unit } from '../entities/Unit';
import { Tile, TileType } from '../types/map';
import { Selectable } from '../types/selection';
import { SelectionManager } from './SelectionManager';
import { TileMap } from './TileMap';
import { TurnManager } from './TurnManager';
import { UnitManager } from './UnitManager';
import { UnitRenderer } from './UnitRenderer';

/** Return movement cost for entering a tile. */
export function getTileMovementCost(tile: Tile): number {
  if (tile.type === TileType.Jungle) return 2;
  return 1;
}

/**
 * MovementSystem äger rörelsereglerna för enheter.
 *
 * Input kommer via SelectionManager, medan tillstånd muteras via UnitManager
 * och visuell position uppdateras via UnitRenderer.
 */
export class MovementSystem {
  private activeNationId: string;

  constructor(
    private readonly tileMap: TileMap,
    private readonly unitManager: UnitManager,
    private readonly unitRenderer: UnitRenderer,
    turnManager: TurnManager,
    selectionManager: SelectionManager,
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
    if (unit.ownerId !== this.activeNationId) return false;
    if (unit.movementPoints <= 0) return false;
    if (!this.isAdjacent(unit.tileX, unit.tileY, tileX, tileY)) return false;

    const targetTile = this.tileMap.getTileAt(tileX, tileY);
    if (targetTile === null) return false;
    if (targetTile.type === TileType.Ocean) return false;

    const cost = getTileMovementCost(targetTile);
    if (unit.movementPoints < cost) return false;

    const occupyingUnit = this.unitManager.getUnitAt(tileX, tileY);
    if (occupyingUnit !== undefined && occupyingUnit.id !== unit.id) return false;

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
    if (!this.canMoveUnitTo(unit, targetTile.x, targetTile.y)) return false;

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

  private getTileForSelectable(selectable: Selectable): Tile | null {
    if (selectable.kind === 'tile') return selectable.tile;
    if (selectable.kind === 'city') {
      return this.tileMap.getTileAt(selectable.city.tileX, selectable.city.tileY);
    }
    return this.tileMap.getTileAt(selectable.unit.tileX, selectable.unit.tileY);
  }

  private isAdjacent(fromX: number, fromY: number, toX: number, toY: number): boolean {
    return Math.abs(fromX - toX) + Math.abs(fromY - toY) === 1;
  }
}
