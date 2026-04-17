import { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import { WARRIOR, getUnitTypeById } from '../data/units';
import { MapData, TileType } from '../types/map';
import type { ScenarioUnit } from '../types/scenario';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';

export type UnitChangedReason = 'created' | 'moved' | 'movementReset' | 'damaged' | 'removed';

export interface UnitChangedEvent {
  unit: Unit;
  reason: UnitChangedReason;
}

type UnitChangedListener = (event: UnitChangedEvent) => void;

const PRODUCED_UNIT_ID_PREFIX = 'unit_produced';

const UNIT_NAMES_BY_NATION_ID: Record<string, string> = {
  nation_england: 'Royal Guard',
  nation_france: 'Garde Royale',
  nation_hre: 'Reichsgarde',
  nation_sweden: 'Livgardet',
  nation_ottoman: 'Janissary',
  nation_spain: 'Tercio',
};

/**
 * UnitManager är "single source of truth" för alla enheter.
 * Ingen Phaser-koppling; validering av regler ligger i MovementSystem.
 */
export class UnitManager {
  private readonly units = new Map<string, Unit>();
  private readonly listeners: UnitChangedListener[] = [];
  private nextProducedUnitId = 1;

  addUnit(unit: Unit): void {
    this.units.set(unit.id, unit);
  }

  createUnit(config: {
    type: UnitType;
    ownerId: string;
    tileX: number;
    tileY: number;
    movementPoints?: number;
  }): Unit {
    const unit = new Unit({
      id: this.createProducedUnitId(config.type.id, config.ownerId),
      name: config.type.name,
      ownerId: config.ownerId,
      tileX: config.tileX,
      tileY: config.tileY,
      unitType: config.type,
      movementPoints: config.movementPoints,
    });

    this.units.set(unit.id, unit);
    this.notify({ unit, reason: 'created' });
    return unit;
  }

  removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    this.units.delete(unitId);
    this.notify({ unit, reason: 'removed' });
  }

  getUnit(id: string): Unit | undefined {
    return this.units.get(id);
  }

  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  getUnitsByOwner(ownerId: string): Unit[] {
    return this.getAllUnits().filter((unit) => unit.ownerId === ownerId);
  }

  getUnitAt(tileX: number, tileY: number): Unit | undefined {
    for (const unit of this.units.values()) {
      if (unit.transportId !== undefined) continue;
      if (unit.tileX === tileX && unit.tileY === tileY) return unit;
    }
    return undefined;
  }

  getUnitsAt(tileX: number, tileY: number): Unit[] {
    const units = Array.from(this.units.values())
      .filter((unit) => unit.tileX === tileX && unit.tileY === tileY);
    return [
      ...units.filter((unit) => unit.transportId === undefined),
      ...units.filter((unit) => unit.transportId !== undefined),
    ];
  }

  getTransportForUnit(unit: Unit): Unit | undefined {
    if (unit.transportId === undefined) return undefined;
    return this.units.get(unit.transportId);
  }

  getCargoForTransport(transport: Unit): Unit | undefined {
    for (const unit of this.units.values()) {
      if (unit.transportId === transport.id) return unit;
    }
    return undefined;
  }

  canBoardUnit(unit: Unit, transport: Unit): boolean {
    if (unit.ownerId !== transport.ownerId) return false;
    if (unit.unitType.isNaval || !transport.unitType.isNaval) return false;
    if (unit.transportId !== undefined || transport.transportId !== undefined) return false;
    return this.getCargoForTransport(transport) === undefined;
  }

  boardUnit(unitId: string, transportId: string, movementCost = 1): boolean {
    const unit = this.units.get(unitId);
    const transport = this.units.get(transportId);
    if (unit === undefined || transport === undefined) return false;
    if (!this.canBoardUnit(unit, transport)) return false;

    unit.transportId = transport.id;
    unit.tileX = transport.tileX;
    unit.tileY = transport.tileY;
    unit.movementPoints = Math.max(0, unit.movementPoints - movementCost);

    this.notify({ unit, reason: 'moved' });
    return true;
  }

  moveUnit(unitId: string, tileX: number, tileY: number, movementCost = 0): boolean {
    const unit = this.units.get(unitId);
    if (unit === undefined) return false;

    unit.transportId = undefined;
    unit.tileX = tileX;
    unit.tileY = tileY;
    unit.movementPoints = Math.max(0, unit.movementPoints - movementCost);

    this.notify({ unit, reason: 'moved' });

    const cargo = this.getCargoForTransport(unit);
    if (cargo !== undefined) {
      cargo.tileX = tileX;
      cargo.tileY = tileY;
      this.notify({ unit: cargo, reason: 'moved' });
    }

    return true;
  }

  resetMovementForOwner(ownerId: string): void {
    for (const unit of this.units.values()) {
      if (unit.ownerId !== ownerId) continue;
      unit.resetMovement();
      this.notify({ unit, reason: 'movementReset' });
    }
  }

  notifyDamaged(unit: Unit): void {
    this.notify({ unit, reason: 'damaged' });
  }

  onUnitChanged(listener: UnitChangedListener): void {
    this.listeners.push(listener);
  }

  /**
   * Skapa en UnitManager med en startenhet per nation.
   */
  static createDefault(
    nationManager: NationManager,
    cityManager: CityManager,
    mapData: MapData,
  ): UnitManager {
    const manager = new UnitManager();

    for (const nation of nationManager.getAllNations()) {
      const capital = cityManager.getCitiesByOwner(nation.id)[0];
      if (capital === undefined) continue;

      const position =
        UnitManager.findAdjacentLandPosition(mapData, manager, capital.tileX, capital.tileY) ??
        UnitManager.findOwnedLandPosition(mapData, manager, nation.id) ??
        UnitManager.findAnyLandPosition(mapData, manager);

      if (position === null) continue;

      manager.addUnit(
        new Unit({
          id: `unit_${nation.id}_start`,
          name: UNIT_NAMES_BY_NATION_ID[nation.id] ?? `${nation.name} Guard`,
          ownerId: nation.id,
          tileX: position.x,
          tileY: position.y,
          unitType: WARRIOR,
        }),
      );
    }

    return manager;
  }

  /**
   * Create a UnitManager from scenario data.
   * Maps unitTypeId string → UnitType object from data/units.ts.
   * Skips land units on water tiles and naval units on land tiles.
   */
  static loadFromScenario(units: ScenarioUnit[], mapData: MapData): UnitManager {
    const manager = new UnitManager();
    let idx = 0;

    for (const cfg of units) {
      const unitType = getUnitTypeById(cfg.unitTypeId);
      if (!unitType) {
        console.warn(`[UnitManager] Unknown unitTypeId: ${cfg.unitTypeId}`);
        continue;
      }

      const tile = mapData.tiles[cfg.r]?.[cfg.q];
      if (!tile) continue;
      if (unitType.isNaval) {
        if (tile.type !== TileType.Ocean && tile.type !== TileType.Coast) continue;
      } else if (tile.type === TileType.Ocean || tile.type === TileType.Coast) {
        continue;
      }

      idx++;
      manager.addUnit(
        new Unit({
          id: `unit_${cfg.nationId}_start_${idx}`,
          name: unitType.name,
          ownerId: cfg.nationId,
          tileX: cfg.q,
          tileY: cfg.r,
          unitType,
        }),
      );
    }

    return manager;
  }

  private notify(event: UnitChangedEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private createProducedUnitId(unitTypeId: string, ownerId: string): string {
    const id = `${PRODUCED_UNIT_ID_PREFIX}_${ownerId}_${unitTypeId}_${this.nextProducedUnitId}`;
    this.nextProducedUnitId += 1;
    return id;
  }

  private static findAdjacentLandPosition(
    mapData: MapData,
    manager: UnitManager,
    tileX: number,
    tileY: number,
  ): { x: number; y: number } | null {
    const offsets = [
      { dq: 1, dr: 0 },
      { dq: 1, dr: -1 },
      { dq: 0, dr: -1 },
      { dq: -1, dr: 0 },
      { dq: -1, dr: 1 },
      { dq: 0, dr: 1 },
    ];

    for (const offset of offsets) {
      const x = tileX + offset.dq;
      const y = tileY + offset.dr;
      if (UnitManager.canPlaceAt(mapData, manager, x, y)) return { x, y };
    }

    return null;
  }

  private static findOwnedLandPosition(
    mapData: MapData,
    manager: UnitManager,
    ownerId: string,
  ): { x: number; y: number } | null {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId !== ownerId) continue;
        if (UnitManager.canPlaceAt(mapData, manager, tile.x, tile.y)) {
          return { x: tile.x, y: tile.y };
        }
      }
    }
    return null;
  }

  private static findAnyLandPosition(
    mapData: MapData,
    manager: UnitManager,
  ): { x: number; y: number } | null {
    for (const row of mapData.tiles) {
      for (const tile of row) {
        if (UnitManager.canPlaceAt(mapData, manager, tile.x, tile.y)) {
          return { x: tile.x, y: tile.y };
        }
      }
    }
    return null;
  }

  private static canPlaceAt(
    mapData: MapData,
    manager: UnitManager,
    tileX: number,
    tileY: number,
  ): boolean {
    const tile = mapData.tiles[tileY]?.[tileX];
    if (tile === undefined) return false;
    if (tile.type === TileType.Ocean || tile.type === TileType.Coast) return false;
    return manager.getUnitAt(tileX, tileY) === undefined;
  }
}
