import type { CityManager } from './CityManager';
import type { IGridSystem } from './grid/IGridSystem';
import type { MapData, Tile } from '../types/map';

const SCORE_UNSEEN = 10;
const SCORE_ADJACENT_UNSEEN = 5;
const SCORE_FAR_FROM_CAPITAL = 2;
const FAR_FROM_CAPITAL_THRESHOLD = 5;
const SCORE_RECENT_PENALTY = -5;
const RECENT_TURNS_WINDOW = 3;
const SCORE_JUST_VISITED_PENALTY = -10;
const JUST_VISITED_TURNS_WINDOW = 1;

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export class ExplorationMemorySystem {
  private readonly seenTiles = new Map<string, Set<string>>();
  private readonly lastSeenTurn = new Map<string, Map<string, number>>();

  constructor(
    private readonly gridSystem: IGridSystem,
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
  ) {}

  markTileSeen(nationId: string, x: number, y: number, turn: number): void {
    const key = tileKey(x, y);
    this.getSeenSet(nationId).add(key);
    this.getLastSeenMap(nationId).set(key, turn);
  }

  markVisibleTiles(nationId: string, tiles: readonly Tile[], turn: number): void {
    for (const tile of tiles) this.markTileSeen(nationId, tile.x, tile.y, turn);
  }

  hasSeenTile(nationId: string, x: number, y: number): boolean {
    return this.seenTiles.get(nationId)?.has(tileKey(x, y)) ?? false;
  }

  getLastSeenTurn(nationId: string, x: number, y: number): number | undefined {
    return this.lastSeenTurn.get(nationId)?.get(tileKey(x, y));
  }

  getExplorationScore(nationId: string, tile: Tile, currentTurn: number): number {
    let score = 0;

    if (!this.hasSeenTile(nationId, tile.x, tile.y)) {
      score += SCORE_UNSEEN;
    } else {
      const lastSeen = this.getLastSeenTurn(nationId, tile.x, tile.y);
      if (lastSeen !== undefined) {
        const elapsed = currentTurn - lastSeen;
        if (elapsed < JUST_VISITED_TURNS_WINDOW) score += SCORE_JUST_VISITED_PENALTY;
        else if (elapsed < RECENT_TURNS_WINDOW) score += SCORE_RECENT_PENALTY;
      }
    }

    if (this.hasUnseenAdjacent(nationId, tile)) score += SCORE_ADJACENT_UNSEEN;
    if (this.getDistanceFromCapital(nationId, tile) > FAR_FROM_CAPITAL_THRESHOLD) {
      score += SCORE_FAR_FROM_CAPITAL;
    }

    return score;
  }

  getDistanceFromCapital(nationId: string, tile: Tile): number {
    const capital = this.cityManager.getCitiesByOwner(nationId).find((city) => city.isCapital)
      ?? this.cityManager.getCitiesByOwner(nationId)[0];
    if (!capital) return Infinity;
    return this.gridSystem.getDistance(
      { x: capital.tileX, y: capital.tileY },
      { x: tile.x, y: tile.y },
    );
  }

  private hasUnseenAdjacent(nationId: string, tile: Tile): boolean {
    for (const neighbor of this.gridSystem.getAdjacentCoords({ x: tile.x, y: tile.y })) {
      if (neighbor.x < 0 || neighbor.y < 0) continue;
      if (neighbor.x >= this.mapData.width || neighbor.y >= this.mapData.height) continue;
      if (!this.hasSeenTile(nationId, neighbor.x, neighbor.y)) return true;
    }
    return false;
  }

  private getSeenSet(nationId: string): Set<string> {
    let set = this.seenTiles.get(nationId);
    if (!set) {
      set = new Set<string>();
      this.seenTiles.set(nationId, set);
    }
    return set;
  }

  private getLastSeenMap(nationId: string): Map<string, number> {
    let map = this.lastSeenTurn.get(nationId);
    if (!map) {
      map = new Map<string, number>();
      this.lastSeenTurn.set(nationId, map);
    }
    return map;
  }
}
