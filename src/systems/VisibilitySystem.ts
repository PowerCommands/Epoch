import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export enum VisibilityState {
  Unseen = 0,
  Explored = 1,
  Visible = 2,
}

export const CITY_VISION_RADIUS = 4;
export const UNIT_VISION_RADIUS = 3;

export interface VisibilitySource {
  tileX: number;
  tileY: number;
}

export class VisibilitySystem {
  private readonly states: VisibilityState[][];
  private readonly width: number;
  private readonly height: number;

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
    return this.states[y]?.[x] ?? VisibilityState.Unseen;
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
}
