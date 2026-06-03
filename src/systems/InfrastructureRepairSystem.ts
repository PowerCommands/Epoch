import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import type { MapData, Tile } from '../types/map';
import type { CityManager } from './CityManager';
import type { WonderSystem } from './WonderSystem';
import type { NationManager } from './NationManager';
import { getBuildingById } from '../data/buildings';
import { getWonderById } from '../data/wonders';

export type RepairLogger = (event: { nationId: string; message: string }) => void;

/** A broken structure a unit could repair on its current tile. */
interface RepairTarget {
  kind: 'building' | 'wonder';
  id: string;
  name: string;
  /** Owning city for buildings (undefined for nation/global wonders). */
  city?: City;
  /** Gold charged to repair = ceil(originalProductionCost * 0.5). */
  repairCost: number;
}

/** Repairs cost half of the structure's original production cost. */
export const REPAIR_COST_FRACTION = 0.5;

/**
 * InfrastructureRepairSystem — lets a Worker / Work Boat repair a broken building
 * or world wonder on the tile it stands on, restoring it to working status.
 *
 * Single responsibility: validate and apply infrastructure repair. Repair is the
 * inverse of {@link InfrastructureSabotageSystem}'s Destroy Building (which marks
 * structures broken). It resolves instantly like other Worker actions, charging
 * a one-off gold cost (half the original production cost) to the owning nation
 * and consuming the unit's movement. No new multi-turn construction system.
 */
export class InfrastructureRepairSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly wonderSystem: WonderSystem,
    private readonly nationManager: NationManager,
    private readonly log: RepairLogger,
  ) {}

  /**
   * True when `unit` may repair a broken own building/wonder on its current tile.
   * Availability does not depend on gold; affordability is checked on execution.
   * Worker/Work Boat land-vs-water reach is enforced implicitly by where the unit
   * can stand (a water structure's tile is only reachable by a Work Boat).
   */
  canRepair(unit: Unit): boolean {
    if (unit.unitType.canBuildImprovements !== true) return false;
    return this.getRepairTarget(unit) !== null;
  }

  /**
   * Repair the broken structure on the unit's current tile. Charges the repair
   * cost in gold to the unit's nation, clears the broken flag, and consumes the
   * unit's movement. Returns true on success; false (with a log) when there is no
   * target or the nation cannot afford the cost.
   */
  repair(unit: Unit): boolean {
    const target = this.getRepairTarget(unit);
    if (target === null) return false;

    const resources = this.nationManager.getResources(unit.ownerId);
    if (resources.gold < target.repairCost) {
      this.log({
        nationId: unit.ownerId,
        message: `Cannot repair ${target.name}: needs ${target.repairCost} gold.`,
      });
      return false;
    }

    resources.gold = Math.max(0, resources.gold - target.repairCost);
    if (target.kind === 'wonder') {
      this.wonderSystem.setWonderBroken(target.id, false);
    } else if (target.city) {
      this.cityManager.getBuildings(target.city.id).setBroken(target.id, false);
    }
    this.consumeUnitTurn(unit);

    const location = target.city ? ` in ${target.city.name}` : '';
    this.log({
      nationId: unit.ownerId,
      message: `${unit.unitType.name} repaired ${target.name}${location} for ${target.repairCost} gold.`,
    });
    return true;
  }

  /**
   * The broken own structure on the unit's tile, or null. A broken wonder owned
   * by the unit's nation takes precedence over a broken building.
   */
  private getRepairTarget(unit: Unit): RepairTarget | null {
    const tile = this.getUnitTile(unit);
    if (!tile) return null;

    if (
      tile.wonderId !== undefined
      && this.wonderSystem.isWonderBroken(tile.wonderId)
      && this.wonderSystem.getCompletedWonder(tile.wonderId)?.ownerId === unit.ownerId
    ) {
      const wonder = getWonderById(tile.wonderId);
      return {
        kind: 'wonder',
        id: tile.wonderId,
        name: wonder?.name ?? tile.wonderId,
        repairCost: this.repairCostFor(wonder?.productionCost ?? 0),
      };
    }

    if (tile.buildingId !== undefined) {
      const city = this.findCityOwningTile(tile);
      if (
        city
        && city.ownerId === unit.ownerId
        && this.cityManager.getBuildings(city.id).isBroken(tile.buildingId)
      ) {
        const building = getBuildingById(tile.buildingId);
        return {
          kind: 'building',
          id: tile.buildingId,
          name: building?.name ?? tile.buildingId,
          city,
          repairCost: this.repairCostFor(building?.productionCost ?? 0),
        };
      }
    }

    return null;
  }

  private repairCostFor(originalProductionCost: number): number {
    return Math.ceil(originalProductionCost * REPAIR_COST_FRACTION);
  }

  private consumeUnitTurn(unit: Unit): void {
    unit.movementPoints = 0;
    unit.queuedDestination = undefined;
  }

  private findCityOwningTile(tile: Tile): City | undefined {
    return this.cityManager.getAllCities().find((city) =>
      city.ownedTileCoords.some((coord) => coord.x === tile.x && coord.y === tile.y),
    );
  }

  private getUnitTile(unit: Unit): Tile | undefined {
    return this.mapData.tiles[unit.tileY]?.[unit.tileX];
  }
}
