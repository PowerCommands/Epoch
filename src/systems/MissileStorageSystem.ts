import { MISSILE_LAUNCH_PAD_CAPACITY, MISSILE_LAUNCH_PAD_ID } from '../data/strategicWeapons';
import type { Unit } from '../entities/Unit';
import type { MapData } from '../types/map';
import type { UnitManager } from './UnitManager';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';

export interface MissileLaunchPad {
  x: number; y: number; ownerId: string; cityId: string;
  operational: boolean; capacity: number;
}
export const requiresMissilePad = (id: string): boolean => id === 'icbm' || id === 'nuclear_missile';

/** Storage is an assignment on the actual missile, so damage, upkeep and saves share one inventory. */
export class MissileStorageSystem {
  constructor(private readonly units: UnitManager, private readonly cities: CityManager,
    private readonly map: MapData, private nations?: NationManager) {
    units.onUnitChanged(({ unit, reason }) => {
      if (reason === 'removed' || unit.missileLaunchPad || unit.carriedByUnitId || !requiresMissilePad(unit.unitType.id)) return;
      const pad = this.getPadAt(unit.tileX, unit.tileY);
      if (pad?.ownerId === unit.ownerId && this.getStoredMissiles(pad.x, pad.y).length <= pad.capacity) units.assignMissileToPad(unit, pad);
    });
  }

  setNationManager(nations: NationManager): void { this.nations = nations; }

  getPads(ownerId?: string): MissileLaunchPad[] {
    const result: MissileLaunchPad[] = [];
    for (const city of this.cities.getAllCities()) {
      if (ownerId && city.ownerId !== ownerId) continue;
      const buildings = this.cities.getBuildings(city.id);
      const physical = city.ownedTileCoords.flatMap(({ x, y }) => {
        const tile = this.map.tiles[y]?.[x];
        return tile?.buildingId === MISSILE_LAUNCH_PAD_ID && tile.ownerId === city.ownerId
          ? [{ x, y, ownerId: city.ownerId, cityId: city.id,
            operational: !tile.buildingBroken, capacity: MISSILE_LAUNCH_PAD_CAPACITY }] : [];
      });
      result.push(...physical);
      // Legacy saves had city-only silos. Keep that site's identity and all ordnance;
      // new construction always goes through normal tile placement.
      const assignedAtCenter = buildings.has(MISSILE_LAUNCH_PAD_ID) && physical.length > 0
        && !physical.some(p => p.x === city.tileX && p.y === city.tileY)
        && this.units.getUnitsByOwner(city.ownerId).some(u => u.missileLaunchPad?.x === city.tileX && u.missileLaunchPad.y === city.tileY);
      if (buildings.has(MISSILE_LAUNCH_PAD_ID) && (!physical.length || (assignedAtCenter && !physical.some(p => p.x === city.tileX && p.y === city.tileY)))) result.push({
        x: city.tileX, y: city.tileY, ownerId: city.ownerId, cityId: city.id,
        operational: buildings.hasActive(MISSILE_LAUNCH_PAD_ID), capacity: MISSILE_LAUNCH_PAD_CAPACITY,
      });
    }
    return result.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  getPadAt(x: number, y: number): MissileLaunchPad | undefined { return this.getPads().find(p => p.x === x && p.y === y); }

  getStoredMissiles(x: number, y: number): Unit[] {
    return this.units.getAllUnits().filter(u => requiresMissilePad(u.unitType.id) && !u.carriedByUnitId
      && (u.missileLaunchPad ? u.missileLaunchPad.x === x && u.missileLaunchPad.y === y : u.tileX === x && u.tileY === y));
  }

  findAvailablePad(ownerId: string): MissileLaunchPad | undefined {
    return this.getPads(ownerId).find(p => p.operational && this.getStoredMissiles(p.x, p.y).length < p.capacity);
  }

  productionBlockReason(ownerId: string): string | undefined {
    return this.findAvailablePad(ownerId) ? undefined : 'Requires a working Missile Launch Pad with a free missile slot (capacity 4)';
  }

  storeMissile(unit: Unit, destination: { x: number; y: number }): boolean {
    const pad = this.getPadAt(destination.x, destination.y);
    if (!pad?.operational || pad.ownerId !== unit.ownerId || !requiresMissilePad(unit.unitType.id)
      || this.units.getUnit(unit.id) !== unit || !unit.isAlive() || unit.carriedByUnitId) return false;
    const stored = this.getStoredMissiles(pad.x, pad.y);
    if ((!stored.includes(unit) && stored.length >= pad.capacity) || (!unit.missileLaunchPad && stored.length > pad.capacity)) return false;
    this.units.assignMissileToPad(unit, pad);
    return true;
  }

  getArmFailure(unit: Unit): string | undefined {
    if (unit.unitType.id !== 'icbm' || unit.nuclearArmed || !unit.isAlive() || this.units.getUnit(unit.id) !== unit) return 'Select a conventional ICBM';
    const pad = this.getPadAt(unit.tileX, unit.tileY);
    if (!pad?.operational || pad.ownerId !== unit.ownerId || !this.getStoredMissiles(pad.x, pad.y).includes(unit)) return 'Requires a working Missile Launch Pad';
    if ((this.nations?.getNation(unit.ownerId)?.nuclearWarheads ?? 0) < 1) return 'Produce a Nuclear Warhead first';
    return undefined;
  }

  armMissile(unit: Unit): boolean {
    if (this.getArmFailure(unit)) return false;
    this.nations!.getNation(unit.ownerId)!.nuclearWarheads--;
    unit.nuclearArmed = true;
    this.units.notifyActionChanged(unit.id);
    return true;
  }

  /** Adopt old unassigned missiles at their original site, even if a legacy silo was over capacity. */
  reconcile(): void {
    // Persist old city-only sites on their original tile before new physical
    // pads are built. Existing tile fields carry both identity and damage.
    for (const city of this.cities.getAllCities()) {
      const buildings = this.cities.getBuildings(city.id);
      if (!buildings.has(MISSILE_LAUNCH_PAD_ID)) continue;
      const physical = city.ownedTileCoords.some(({ x, y }) => this.map.tiles[y]?.[x]?.buildingId === MISSILE_LAUNCH_PAD_ID);
      const tile = this.map.tiles[city.tileY]?.[city.tileX];
      if (!physical && tile && !tile.buildingId) {
        tile.buildingId = MISSILE_LAUNCH_PAD_ID;
        tile.buildingBroken = buildings.isBroken(MISSILE_LAUNCH_PAD_ID);
      }
    }
    for (const pad of this.getPads()) for (const unit of this.getStoredMissiles(pad.x, pad.y)) {
      if (unit.ownerId === pad.ownerId && !unit.missileLaunchPad) this.units.assignMissileToPad(unit, pad);
    }
  }
}
