import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';

export const DISCOVERY_RADIUS = 9;

type NationsMetListener = (nationA: string, nationB: string) => void;

/**
 * DiscoverySystem — tracks which nations have "met" each other.
 *
 * A nation is considered to have met another when any of its units is
 * within hex radius {@link DISCOVERY_RADIUS} of any city of the other nation.
 * Detection is symmetric: if A meets B, then B has also met A.
 *
 * Each nation always knows itself from game start.
 */
export class DiscoverySystem {
  private readonly met = new Map<string, Set<string>>();
  private readonly listeners: NationsMetListener[] = [];

  constructor(
    nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly unitManager: UnitManager,
    private readonly gridSystem: IGridSystem,
  ) {
    for (const nation of nationManager.getAllNations()) {
      const set = new Set<string>();
      set.add(nation.id);
      this.met.set(nation.id, set);
    }
  }

  hasMet(a: string, b: string): boolean {
    if (a === b) return true;
    return this.met.get(a)?.has(b) ?? false;
  }

  getMetNations(nationId: string): ReadonlySet<string> {
    return this.met.get(nationId) ?? new Set<string>([nationId]);
  }

  onNationsMet(cb: NationsMetListener): void {
    this.listeners.push(cb);
  }

  /**
   * Scan every unit against every foreign city and record any new encounters.
   * Safe to call repeatedly — already-met pairs are skipped without side effects.
   */
  scan(): void {
    const cities = this.cityManager.getAllCities();
    if (cities.length === 0) return;

    for (const unit of this.unitManager.getAllUnits()) {
      const ownerId = unit.ownerId;
      for (const city of cities) {
        const cityOwner = city.ownerId;
        if (cityOwner === ownerId) continue;
        if (this.hasMet(ownerId, cityOwner)) continue;

        const dist = this.gridSystem.getDistance(
          { x: unit.tileX, y: unit.tileY },
          { x: city.tileX, y: city.tileY },
        );
        if (dist <= DISCOVERY_RADIUS) {
          this.recordMet(ownerId, cityOwner);
        }
      }
    }
  }

  /**
   * Return every directional met-pair recorded so far. The returned
   * list contains each undirected pair once (a < b lexicographically).
   */
  getAllMetPairs(): Array<[string, string]> {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [a, set] of this.met) {
      for (const b of set) {
        if (a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(a < b ? [a, b] : [b, a]);
      }
    }
    return out;
  }

  /**
   * Silently record a met-pair without firing listeners. Used by
   * save-load restoration.
   */
  restoreMet(a: string, b: string): void {
    if (a === b) return;
    this.getOrCreate(a).add(b);
    this.getOrCreate(b).add(a);
  }

  private recordMet(a: string, b: string): void {
    const setA = this.getOrCreate(a);
    const setB = this.getOrCreate(b);
    if (setA.has(b) && setB.has(a)) return;
    setA.add(b);
    setB.add(a);
    for (const cb of this.listeners) cb(a, b);
  }

  private getOrCreate(nationId: string): Set<string> {
    let set = this.met.get(nationId);
    if (!set) {
      set = new Set<string>([nationId]);
      this.met.set(nationId, set);
    }
    return set;
  }
}
