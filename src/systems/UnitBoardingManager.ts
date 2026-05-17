import type { Unit } from '../entities/Unit';
import { canCarryUnitType, hasCargoCapacity } from '../data/units';
import type { MapData, Tile } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';
import { canUnitEndMovementOnTile, isWaterTile } from './UnitMovementRules';

type BoardingLog = (message: string) => void;

export class UnitBoardingManager {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly nationManager: NationManager,
    private readonly log?: BoardingLog,
  ) {}

  canBoard(passenger: Unit, transport: Unit): boolean {
    return this.getBoardingFailureReason(passenger, transport) === undefined;
  }

  board(passenger: Unit, transport: Unit): boolean {
    const reason = this.getBoardingFailureReason(passenger, transport);
    if (reason !== undefined) {
      this.log?.(`${passenger.name} could not board ${transport.name}: ${reason}.`);
      return false;
    }
    const boarded = this.unitManager.boardUnit(passenger.id, transport.id);
    if (boarded) this.log?.(`${passenger.name} boarded ${transport.name}.`);
    return boarded;
  }

  canUnboard(passenger: Unit, targetX: number, targetY: number): boolean {
    return this.getUnboardingFailureReason(passenger, targetX, targetY) === undefined;
  }

  unboard(passenger: Unit, targetX: number, targetY: number): boolean {
    const reason = this.getUnboardingFailureReason(passenger, targetX, targetY);
    if (reason !== undefined) {
      this.log?.(`${passenger.name} could not unboard: ${reason}.`);
      return false;
    }
    const transport = this.getTransport(passenger);
    const unboarded = this.unitManager.unboardUnit(passenger.id, targetX, targetY);
    if (unboarded) this.log?.(`${passenger.name} unboarded${transport ? ` from ${transport.name}` : ''}.`);
    return unboarded;
  }

  getCargo(transport: Unit): Unit[] {
    return this.unitManager.getCargoUnitsForTransport(transport);
  }

  getTransport(passenger: Unit): Unit | undefined {
    return this.unitManager.getTransportForUnit(passenger);
  }

  hasAvailableCargoSpace(transport: Unit): boolean {
    return hasCargoCapacity(transport.unitType)
      && this.getCargo(transport).length < (transport.unitType.cargoCapacity ?? 0);
  }

  isCargo(unit: Unit): boolean {
    return unit.carriedByUnitId !== undefined || unit.transportId !== undefined;
  }

  getBoardingFailureReason(passenger: Unit, transport: Unit): string | undefined {
    if (passenger.ownerId !== transport.ownerId) return 'different owner';
    if (!hasCargoCapacity(transport.unitType)) return 'transport has no cargo capacity';
    if (!canCarryUnitType(transport.unitType, passenger.unitType)) return 'cargo category is not allowed';
    if (!this.hasAvailableCargoSpace(transport)) return 'cargo hold is full';
    if (this.isCargo(passenger)) return 'passenger is already cargo';
    if (this.isCargo(transport)) return 'transport is already cargo';
    if (passenger.unitType.residenceCapitalOnly === true || passenger.unitType.uniquePerNation === true) return 'special unit cannot board';
    if (!this.isValidBoardingPosition(passenger, transport)) return 'units are not in a valid boarding position';
    return undefined;
  }

  getUnboardingFailureReason(passenger: Unit, targetX: number, targetY: number): string | undefined {
    if (!this.isCargo(passenger)) return 'passenger is not cargo';
    const transport = this.getTransport(passenger);
    if (!transport) return 'transport is missing';
    const targetTile = this.getTile(targetX, targetY);
    if (!targetTile) return 'target tile is invalid';
    if (!this.gridSystem.isAdjacent({ x: transport.tileX, y: transport.tileY }, { x: targetX, y: targetY })) {
      return 'target tile is not adjacent to transport';
    }
    if (!canUnitEndMovementOnTile(passenger, targetTile, this.nationManager.getNation(passenger.ownerId))) {
      return 'passenger cannot end movement on target tile';
    }
    const occupant = this.unitManager.getUnitAt(targetX, targetY);
    if (occupant !== null && occupant.id !== passenger.id && passenger.unitType.ignoresUnitCollision !== true) {
      return occupant.ownerId === passenger.ownerId ? 'target tile is occupied' : 'target tile is enemy occupied';
    }
    return undefined;
  }

  private isValidBoardingPosition(passenger: Unit, transport: Unit): boolean {
    const passengerTile = this.getTile(passenger.tileX, passenger.tileY);
    const transportTile = this.getTile(transport.tileX, transport.tileY);
    if (!passengerTile || !transportTile) return false;
    if (!isWaterTile(transportTile)) return false;

    if (passenger.tileX === transport.tileX && passenger.tileY === transport.tileY) {
      return canUnitEndMovementOnTile(passenger, transportTile, this.nationManager.getNation(passenger.ownerId));
    }
    if (!this.gridSystem.isAdjacent(
      { x: passenger.tileX, y: passenger.tileY },
      { x: transport.tileX, y: transport.tileY },
    )) return false;

    return !isWaterTile(passengerTile);
  }

  private getTile(x: number, y: number): Tile | undefined {
    return this.mapData.tiles[y]?.[x];
  }
}
