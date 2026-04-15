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
      if (unit.tileX === tileX && unit.tileY === tileY) return unit;
    }
    return undefined;
  }

  moveUnit(unitId: string, tileX: number, tileY: number, movementCost = 0): boolean {
    const unit = this.units.get(unitId);
    if (unit === undefined) return false;

    unit.tileX = tileX;
    unit.tileY = tileY;
    unit.movementPoints = Math.max(0, unit.movementPoints - movementCost);

    this.notify({ unit, reason: 'moved' });
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
   * Skips units on ocean tiles.
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

      const tile = mapData.tiles[cfg.tileY]?.[cfg.tileX];
      if (!tile || tile.type === TileType.Ocean) continue;

      idx++;
      manager.addUnit(
        new Unit({
          id: `unit_${cfg.nationId}_start_${idx}`,
          name: unitType.name,
          ownerId: cfg.nationId,
          tileX: cfg.tileX,
          tileY: cfg.tileY,
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
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const offset of offsets) {
      const x = tileX + offset.dx;
      const y = tileY + offset.dy;
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
    if (tile.type === TileType.Ocean) return false;
    return manager.getUnitAt(tileX, tileY) === undefined;
  }
}
