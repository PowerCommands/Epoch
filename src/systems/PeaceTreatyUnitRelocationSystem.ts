import type { Unit } from '../entities/Unit';
import type { MapData, Tile } from '../types/map';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';
import { canUnitEndMovementOnTile } from './UnitMovementRules';

/** Withdraw stranded units when peace closes the territory they occupy. */
export class PeaceTreatyUnitRelocationSystem {
  constructor(
    private readonly units: UnitManager,
    private readonly nations: NationManager,
    private readonly diplomacy: DiplomacyManager,
    private readonly map: MapData,
    private readonly grid: IGridSystem,
    private readonly canEnterPeacefully: (unit: Unit, tile: Tile) => boolean,
  ) {}

  handleWarEnded(a: string, b: string): void {
    for (const unit of [...this.units.getUnitsByOwner(a), ...this.units.getUnitsByOwner(b)]) {
      const tile = this.map.tiles[unit.tileY]?.[unit.tileX];
      if (tile?.ownerId !== (unit.ownerId === a ? b : a)) continue;
      this.relocate(unit, tile);
    }
  }

  /** Also repairs old saves and retries if no free destination existed at peace. */
  recoverStrandedUnits(round: number): void {
    for (const unit of this.units.getAllUnits()) {
      const tile = this.map.tiles[unit.tileY]?.[unit.tileX];
      if (!tile?.ownerId || tile.ownerId === unit.ownerId) continue;
      if (this.diplomacy.getState(unit.ownerId, tile.ownerId) === 'WAR') continue;
      if (!this.diplomacy.isPeaceTreatyActive(unit.ownerId, tile.ownerId, round)) continue;
      this.relocate(unit, tile);
    }
  }

  private relocate(unit: Unit, origin: Tile): void {
    if (unit.carriedByUnitId !== undefined || unit.unitType.aircraftRole) return;
    // Reuse movement's exceptions for covert units, ships, peacekeepers, etc.
    if (this.canEnterPeacefully(unit, origin)) return;
    const destination = this.findDestination(unit, origin);
    if (!destination) return;
    unit.queuedDestination = undefined;
    unit.automation = undefined;
    // Administrative withdrawal costs no movement and keeps the unit's state.
    this.units.moveUnit(unit.id, destination.x, destination.y);
  }

  private findDestination(unit: Unit, origin: Tile): Tile | undefined {
    const pending = [origin];
    const visited = new Set([`${origin.x},${origin.y}`]);
    const nation = this.nations.getNation(unit.ownerId);
    for (let i = 0; i < pending.length; i++) {
      for (const tile of this.grid.getNeighbors(pending[i], this.map)) {
        const key = `${tile.x},${tile.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        pending.push(tile);
        if (!canUnitEndMovementOnTile(unit, tile, nation)) continue;
        if (this.units.getUnitAt(tile.x, tile.y) !== null) continue;
        if (tile.ownerId && this.diplomacy.getState(unit.ownerId, tile.ownerId) === 'WAR') continue;
        if (!this.canEnterPeacefully(unit, tile)) continue;
        return tile;
      }
    }
    return undefined;
  }
}
