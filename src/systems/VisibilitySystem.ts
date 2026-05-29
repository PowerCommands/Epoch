import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export enum VisibilityState {
  Unseen = 0,
  Explored = 1,
  Visible = 2,
}

export const CITY_VISION_RADIUS = 4;
export const UNIT_VISION_RADIUS = 3;

/**
 * Radius around a discovered city that becomes permanent explored terrain.
 * Discovering a city reveals its surroundings as lasting intelligence.
 */
export const CITY_KNOWLEDGE_REVEAL_RADIUS = 3;

export interface VisibilitySource {
  tileX: number;
  tileY: number;
}

export interface KnownCityCandidate {
  id: string;
  tileX: number;
  tileY: number;
}

export class VisibilitySystem {
  private readonly states: VisibilityState[][];
  private readonly width: number;
  private readonly height: number;
  /**
   * When disabled (via the `fog off` cheat), every tile is reported as
   * Visible so the whole map renders. The underlying explored/visible state is
   * still tracked, so toggling fog back on restores the correct view.
   */
  private enabled = true;

  /**
   * Cities the human has discovered. A known city stays permanently visible on
   * the map (rendered even when its tile is only Explored), and survives owner
   * changes. Razing removes the city object but the revealed terrain remains.
   */
  private readonly knownCityIds = new Set<string>();

  constructor(
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.width = mapData.width;
    this.height = mapData.height;
    this.states = Array.from({ length: this.height }, () =>
      Array(this.width).fill(VisibilityState.Unseen),
    );
  }

  getState(x: number, y: number): VisibilityState {
    if (!this.enabled) return VisibilityState.Visible;
    return this.states[y]?.[x] ?? VisibilityState.Unseen;
  }

  /** Enable or disable fog of war (cheat). Disabled = whole map visible. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isVisible(x: number, y: number): boolean {
    return this.getState(x, y) === VisibilityState.Visible;
  }

  isExploredOrVisible(x: number, y: number): boolean {
    return this.getState(x, y) >= VisibilityState.Explored;
  }

  /** True only when the tile is fully visible (player has current vision). */
  isTileVisibleToHuman(x: number, y: number): boolean {
    return this.getState(x, y) === VisibilityState.Visible;
  }

  /** True when the tile has been explored or is currently visible. */
  isTileExploredByHuman(x: number, y: number): boolean {
    return this.getState(x, y) >= VisibilityState.Explored;
  }

  /**
   * True when game objects (cities, units, resources, improvements) may be
   * rendered on this tile. Only fully visible tiles render objects.
   */
  canRenderObjectAt(x: number, y: number): boolean {
    return this.getState(x, y) === VisibilityState.Visible;
  }

  /**
   * Recalculate visibility from human player cities and units.
   * Step 1: Reset all Visible → Explored (retain memory).
   * Step 2: Mark Visible from city and unit positions.
   */
  update(cities: VisibilitySource[], units: VisibilitySource[]): void {
    for (let y = 0; y < this.height; y++) {
      const row = this.states[y]!;
      for (let x = 0; x < this.width; x++) {
        if (row[x] === VisibilityState.Visible) {
          row[x] = VisibilityState.Explored;
        }
      }
    }

    for (const city of cities) {
      this.markVisible({ x: city.tileX, y: city.tileY }, CITY_VISION_RADIUS);
    }
    for (const unit of units) {
      this.markVisible({ x: unit.tileX, y: unit.tileY }, UNIT_VISION_RADIUS);
    }
  }

  private markVisible(center: { x: number; y: number }, radius: number): void {
    const tiles = this.gridSystem.getTilesInRange(center, radius, this.mapData, { includeCenter: true });
    for (const tile of tiles) {
      const row = this.states[tile.y];
      if (row) row[tile.x] = VisibilityState.Visible;
    }
  }

  /**
   * Record any city whose tile is currently visible as permanently known,
   * revealing its surroundings as permanent explored terrain. Reads the raw
   * visibility state (not the cheat-gated view) so `fog off` does not mark the
   * whole map as discovered. Call after {@link update}.
   */
  recordVisibleCities(cities: ReadonlyArray<KnownCityCandidate>): void {
    for (const city of cities) {
      if (this.states[city.tileY]?.[city.tileX] !== VisibilityState.Visible) continue;
      this.discoverCity(city);
    }
  }

  /**
   * Permanently register a city as discovered and reveal its surroundings.
   * This is the single shared "city discovery" path — used both when a unit
   * gains vision of a city and when maps are exchanged via diplomacy. Returns
   * true if the city was newly discovered, false if it was already known.
   */
  discoverCity(city: KnownCityCandidate): boolean {
    if (this.knownCityIds.has(city.id)) return false;
    this.knownCityIds.add(city.id);
    this.revealPermanently({ x: city.tileX, y: city.tileY }, CITY_KNOWLEDGE_REVEAL_RADIUS);
    return true;
  }

  /** True when the human has discovered this city at least once. */
  isKnownCity(cityId: string): boolean {
    return this.knownCityIds.has(cityId);
  }

  /**
   * Raise unseen tiles in range to Explored. Already-explored/visible tiles are
   * left untouched, and update() never downgrades Explored, so this reveal is
   * permanent.
   */
  private revealPermanently(center: { x: number; y: number }, radius: number): void {
    const tiles = this.gridSystem.getTilesInRange(center, radius, this.mapData, { includeCenter: true });
    for (const tile of tiles) {
      const row = this.states[tile.y];
      if (row && row[tile.x] === VisibilityState.Unseen) {
        row[tile.x] = VisibilityState.Explored;
      }
    }
  }

  /** Returns coordinates of all explored or visible tiles for save/load. */
  getExploredTileCoords(): Array<{ q: number; r: number }> {
    const result: Array<{ q: number; r: number }> = [];
    for (let y = 0; y < this.height; y++) {
      const row = this.states[y]!;
      for (let x = 0; x < this.width; x++) {
        if (row[x]! >= VisibilityState.Explored) {
          result.push({ q: x, r: y });
        }
      }
    }
    return result;
  }

  /**
   * Restore explored state from a saved list.
   * Caller must call update() afterwards to recalculate currently Visible tiles.
   */
  restoreExplored(coords: ReadonlyArray<{ q: number; r: number }>): void {
    for (let y = 0; y < this.height; y++) {
      this.states[y]!.fill(VisibilityState.Unseen);
    }
    for (const { q, r } of coords) {
      const row = this.states[r];
      if (row && q >= 0 && q < this.width) {
        row[q] = VisibilityState.Explored;
      }
    }
  }

  /** Ids of all permanently known cities, for save/load. */
  getKnownCityIds(): string[] {
    return Array.from(this.knownCityIds);
  }

  /** Restore permanently known cities from a saved list. */
  restoreKnownCities(cityIds: ReadonlyArray<string>): void {
    this.knownCityIds.clear();
    for (const cityId of cityIds) this.knownCityIds.add(cityId);
  }
}
