import type { BuildingType } from './Building';

/** One stored building in a city, with its working/broken status. */
export interface CityBuildingEntry {
  readonly buildingId: string;
  broken: boolean;
}

/**
 * Per-stad-lagring av byggnader. Ren data utan Phaser-beroenden.
 *
 * A building may be present but `broken` (e.g. damaged by a Destroy Building
 * action). Broken buildings still physically exist — so they keep blocking
 * re-construction — but they provide no yields/effects. Effect consumers call
 * {@link getAll} (active buildings only); duplicate/placement checks call
 * {@link has} (physical existence, broken or not).
 */
export class CityBuildings {
  readonly cityId: string;
  // Insertion order is preserved by Map, which keeps serialization stable.
  private readonly buildings = new Map<string, CityBuildingEntry>();

  constructor(cityId: string, private readonly onChanged: () => void = () => {},
    private readonly protectedBuilding: (id: string) => boolean = () => false,
    private readonly onCompleted: () => void = () => {}) {
    this.cityId = cityId;
  }

  /** Add a working building (or revive a previously broken one). */
  add(buildingType: BuildingType): void {
    this.buildings.set(buildingType.id, { buildingId: buildingType.id, broken: false });
    this.onCompleted();
  }

  /** Restore a building with an explicit broken flag (used by save-load). */
  addEntry(buildingId: string, broken: boolean): void {
    this.buildings.set(buildingId, { buildingId, broken });
    this.onCompleted();
  }

  /** Remove a building entirely. Returns true if it was present. */
  remove(buildingId: string): boolean {
    if (this.isProtected(buildingId)) return false;
    const removed = this.buildings.delete(buildingId);
    if (removed) this.onChanged();
    return removed;
  }

  isProtected(buildingId: string): boolean {
    return this.protectedBuilding(buildingId);
  }

  /** True if the building physically exists, working OR broken. */
  has(buildingId: string): boolean {
    return this.buildings.has(buildingId);
  }

  /** True only if the building exists AND is currently working (not broken). */
  hasActive(buildingId: string): boolean {
    const entry = this.buildings.get(buildingId);
    return entry !== undefined && !entry.broken;
  }

  isBroken(buildingId: string): boolean {
    return this.buildings.get(buildingId)?.broken === true;
  }

  /**
   * Set the broken status of a building. Returns true if the building exists and
   * the status actually changed (so callers can detect a no-op).
   */
  setBroken(buildingId: string, broken: boolean): boolean {
    if (broken && this.isProtected(buildingId)) return false;
    const entry = this.buildings.get(buildingId);
    if (entry === undefined || entry.broken === broken) return false;
    entry.broken = broken;
    this.onChanged();
    return true;
  }

  /** Active (working) building ids only — the set that contributes effects. */
  getAll(): string[] {
    const result: string[] = [];
    for (const entry of this.buildings.values()) {
      if (!entry.broken) result.push(entry.buildingId);
    }
    return result;
  }

  /** Every stored building with its broken flag (for serialization / UI). */
  getAllEntries(): CityBuildingEntry[] {
    return [...this.buildings.values()].map((entry) => ({ ...entry }));
  }

  /** Ids of buildings that are currently broken (repair targets). */
  getBrokenBuildingIds(): string[] {
    const result: string[] = [];
    for (const entry of this.buildings.values()) {
      if (entry.broken) result.push(entry.buildingId);
    }
    return result;
  }
}
