import type { Unit } from '../entities/Unit';
import type { GridCoord } from '../types/grid';
import type { MapData, Tile } from '../types/map';
import { MinHeap } from '../utils/MinHeap';
import { canUnitEnterTile, getTileMovementCost } from './MovementSystem';
import { UnitManager } from './UnitManager';
import type { IGridSystem } from './grid/IGridSystem';

interface FindPathOptions {
  respectMovementPoints?: boolean;
}

interface OpenEntry {
  key: number;
  f: number;
}

const GENERATION_MAX = 0xffffffff;

/**
 * Clean baseline for the next pathfinding rewrite:
 * - PathfindingSystem remains the single pathfinding service.
 * - Keep one clear A* core before adding more behavior.
 * - Multi-target pathfinding is explicit and should stay routed through this system.
 * - Per-turn cache should be simple, safe, and keyed by turn + board state.
 * - AI city approaches should eventually avoid repeated adjacent-tile searches.
 * - Path reuse should stay out until it can be integrated without target churn.
 */
export class PathfindingSystem {
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private gScore!: Float64Array;
  private fScore!: Float64Array;
  private cameFrom!: Int32Array;
  private generation!: Uint32Array;
  private currentGeneration = 0;
  private bufferSize = 0;

  constructor(
    private readonly mapData: MapData,
    private readonly unitManager: UnitManager,
    private readonly gridSystem: IGridSystem,
  ) {
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
    this.ensureBuffers();
  }

  findPath(
    unit: Unit,
    targetX: number,
    targetY: number,
    options: FindPathOptions = {},
  ): Tile[] | null {
    const respectMovementPoints = options.respectMovementPoints ?? true;
    const start = this.getTile(unit.tileX, unit.tileY);
    const target = this.getTile(targetX, targetY);
    if (!start || !target) return null;
    if (start.x === target.x && start.y === target.y) return [start];
    if (!this.canEnter(unit, target)) return null;

    this.ensureBuffers();
    const gen = this.nextGeneration();

    const width = this.mapWidth;
    const tiles = this.mapData.tiles;
    const gScore = this.gScore;
    const fScore = this.fScore;
    const cameFrom = this.cameFrom;
    const generation = this.generation;

    const startKey = start.y * width + start.x;
    const targetKey = target.y * width + target.x;
    const startF = this.gridSystem.getDistance(start, target);

    gScore[startKey] = 0;
    fScore[startKey] = startF;
    cameFrom[startKey] = -1;
    generation[startKey] = gen;

    const open = new MinHeap<OpenEntry>((a, b) => {
      if (a.f !== b.f) return a.f - b.f;
      return a.key - b.key;
    });
    open.push({ key: startKey, f: startF });

    while (open.size > 0) {
      const currentEntry = open.pop()!;
      const currentKey = currentEntry.key;
      if (currentEntry.f > fScore[currentKey]) continue;

      if (currentKey === targetKey) {
        return this.reconstructPath(currentKey);
      }

      const cx = currentKey % width;
      const cy = (currentKey / width) | 0;
      const current = tiles[cy][cx];
      const currentG = gScore[currentKey];

      for (const neighbor of this.gridSystem.getNeighbors(current, this.mapData)) {
        if (!this.canEnter(unit, neighbor)) continue;

        const neighborKey = neighbor.y * width + neighbor.x;
        const tentativeG = currentG + getTileMovementCost(neighbor);
        if (respectMovementPoints && tentativeG > unit.movementPoints) continue;
        const prevG = generation[neighborKey] === gen ? gScore[neighborKey] : Infinity;
        if (tentativeG >= prevG) continue;

        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentativeG;
        const neighborF = tentativeG + this.gridSystem.getDistance(neighbor, target);
        fScore[neighborKey] = neighborF;
        generation[neighborKey] = gen;
        open.push({ key: neighborKey, f: neighborF });
      }
    }

    return null;
  }

  findBestPathToAnyTarget(
    unit: Unit,
    targets: readonly GridCoord[],
    options: FindPathOptions = {},
  ): Tile[] | null {
    const respectMovementPoints = options.respectMovementPoints ?? true;
    const start = this.getTile(unit.tileX, unit.tileY);
    if (!start || targets.length === 0) return null;

    const width = this.mapWidth;
    const startKey = start.y * width + start.x;
    const targetKeys = this.getValidTargetKeys(unit, targets, startKey);
    if (targetKeys.length === 0) return null;
    if (targetKeys.includes(startKey)) return [start];

    this.ensureBuffers();
    const gen = this.nextGeneration();

    const tiles = this.mapData.tiles;
    const gScore = this.gScore;
    const fScore = this.fScore;
    const cameFrom = this.cameFrom;
    const generation = this.generation;
    const targetSet = new Set(targetKeys);

    gScore[startKey] = 0;
    fScore[startKey] = 0;
    cameFrom[startKey] = -1;
    generation[startKey] = gen;

    const open = new MinHeap<OpenEntry>((a, b) => {
      if (a.f !== b.f) return a.f - b.f;
      return a.key - b.key;
    });
    open.push({ key: startKey, f: 0 });

    while (open.size > 0) {
      const currentEntry = open.pop()!;
      const currentKey = currentEntry.key;
      if (currentEntry.f > fScore[currentKey]) continue;

      if (targetSet.has(currentKey)) {
        return this.reconstructPath(currentKey);
      }

      const cx = currentKey % width;
      const cy = (currentKey / width) | 0;
      const current = tiles[cy][cx];
      const currentG = gScore[currentKey];

      for (const neighbor of this.gridSystem.getNeighbors(current, this.mapData)) {
        if (!this.canEnter(unit, neighbor)) continue;

        const neighborKey = neighbor.y * width + neighbor.x;
        const tentativeG = currentG + getTileMovementCost(neighbor);
        if (respectMovementPoints && tentativeG > unit.movementPoints) continue;
        const prevG = generation[neighborKey] === gen ? gScore[neighborKey] : Infinity;
        if (tentativeG >= prevG) continue;

        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentativeG;
        fScore[neighborKey] = tentativeG;
        generation[neighborKey] = gen;
        open.push({ key: neighborKey, f: tentativeG });
      }
    }

    return null;
  }

  getReachableTiles(unit: Unit): Set<string> {
    const reachable = new Set<string>();
    const start = this.getTile(unit.tileX, unit.tileY);
    if (!start || unit.movementPoints <= 0) return reachable;

    const startKey = `${start.x},${start.y}`;
    const costs = new Map<string, number>([[startKey, 0]]);
    const frontier: Tile[] = [start];

    while (frontier.length > 0) {
      const current = frontier.shift()!;
      const currentKey = `${current.x},${current.y}`;
      const currentCost = costs.get(currentKey) ?? 0;

      for (const neighbor of this.gridSystem.getNeighbors(current, this.mapData)) {
        if (!this.canEnter(unit, neighbor)) continue;

        const nextCost = currentCost + getTileMovementCost(neighbor);
        if (nextCost > unit.movementPoints) continue;

        const neighborKey = `${neighbor.x},${neighbor.y}`;
        if (nextCost >= (costs.get(neighborKey) ?? Infinity)) continue;

        costs.set(neighborKey, nextCost);
        reachable.add(neighborKey);
        frontier.push(neighbor);
      }
    }

    return reachable;
  }

  private canEnter(unit: Unit, tile: Tile): boolean {
    if (!canUnitEnterTile(unit, tile)) return false;

    const occupant = this.unitManager.getUnitAt(tile.x, tile.y);
    if (occupant !== null && occupant.id !== unit.id) return false;

    return true;
  }

  private getValidTargetKeys(
    unit: Unit,
    targets: readonly GridCoord[],
    startKey: number,
  ): number[] {
    const keys: number[] = [];
    for (const targetCoord of targets) {
      const target = this.getTile(targetCoord.x, targetCoord.y);
      if (!target) continue;

      const key = target.y * this.mapWidth + target.x;
      if (key !== startKey && !this.canEnter(unit, target)) continue;
      if (!keys.includes(key)) keys.push(key);
    }

    keys.sort((a, b) => a - b);
    return keys;
  }

  private reconstructPath(endKey: number): Tile[] | null {
    const width = this.mapWidth;
    const tiles = this.mapData.tiles;
    const cameFrom = this.cameFrom;
    const path: Tile[] = [];
    let key = endKey;
    while (key !== -1) {
      const row = tiles[(key / width) | 0];
      const tile = row?.[key % width];
      if (!tile) return null;
      path.unshift(tile);
      key = cameFrom[key];
    }
    return path;
  }

  private ensureBuffers(): void {
    const size = this.mapWidth * this.mapHeight;
    if (size === this.bufferSize) return;
    this.gScore = new Float64Array(size);
    this.fScore = new Float64Array(size);
    this.cameFrom = new Int32Array(size);
    this.generation = new Uint32Array(size);
    this.bufferSize = size;
    this.currentGeneration = 0;
  }

  private nextGeneration(): number {
    if (this.currentGeneration === GENERATION_MAX) {
      this.generation.fill(0);
      this.currentGeneration = 1;
    } else {
      this.currentGeneration++;
    }
    return this.currentGeneration;
  }

  private getTile(tileX: number, tileY: number): Tile | null {
    return this.mapData.tiles[tileY]?.[tileX] ?? null;
  }
}
