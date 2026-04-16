import type { Unit } from '../entities/Unit';
import type { MapData, Tile } from '../types/map';
import { canUnitEnterTile, getTileMovementCost } from './MovementSystem';
import { UnitManager } from './UnitManager';

const ADJACENT_OFFSETS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

interface FindPathOptions {
  respectMovementPoints?: boolean;
}

export class PathfindingSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly unitManager: UnitManager,
  ) {}

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

    const startKey = this.key(start.x, start.y);
    const targetKey = this.key(target.x, target.y);
    const open = new Set<string>([startKey]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([
      [startKey, this.manhattan(start.x, start.y, target.x, target.y)],
    ]);

    while (open.size > 0) {
      const currentKey = this.lowestScore(open, fScore);
      if (currentKey === targetKey) {
        return this.reconstructPath(cameFrom, currentKey);
      }

      open.delete(currentKey);
      const current = this.tileFromKey(currentKey);
      if (!current) continue;

      for (const neighbor of this.getNeighbors(current.x, current.y)) {
        if (!this.canEnter(unit, neighbor)) continue;

        const neighborKey = this.key(neighbor.x, neighbor.y);
        const tentativeG = (gScore.get(currentKey) ?? Infinity) + getTileMovementCost(neighbor);
        if (respectMovementPoints && tentativeG > unit.movementPoints) continue;
        if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) continue;

        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        fScore.set(
          neighborKey,
          tentativeG + this.manhattan(neighbor.x, neighbor.y, target.x, target.y),
        );
        open.add(neighborKey);
      }
    }

    return null;
  }

  getReachableTiles(unit: Unit): Set<string> {
    const reachable = new Set<string>();
    const start = this.getTile(unit.tileX, unit.tileY);
    if (!start || unit.movementPoints <= 0) return reachable;

    const startKey = this.key(start.x, start.y);
    const costs = new Map<string, number>([[startKey, 0]]);
    const frontier: Tile[] = [start];

    while (frontier.length > 0) {
      const current = frontier.shift()!;
      const currentKey = this.key(current.x, current.y);
      const currentCost = costs.get(currentKey) ?? 0;

      for (const neighbor of this.getNeighbors(current.x, current.y)) {
        if (!this.canEnter(unit, neighbor)) continue;

        const nextCost = currentCost + getTileMovementCost(neighbor);
        if (nextCost > unit.movementPoints) continue;

        const neighborKey = this.key(neighbor.x, neighbor.y);
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
    if (occupant !== undefined && occupant.id !== unit.id) return false;

    return true;
  }

  private getNeighbors(tileX: number, tileY: number): Tile[] {
    const neighbors: Tile[] = [];
    for (const offset of ADJACENT_OFFSETS) {
      const tile = this.getTile(tileX + offset.dx, tileY + offset.dy);
      if (tile) neighbors.push(tile);
    }
    return neighbors;
  }

  private reconstructPath(cameFrom: Map<string, string>, currentKey: string): Tile[] | null {
    const path: Tile[] = [];
    let key: string | undefined = currentKey;

    while (key !== undefined) {
      const tile = this.tileFromKey(key);
      if (!tile) return null;
      path.unshift(tile);
      key = cameFrom.get(key);
    }

    return path;
  }

  private lowestScore(open: Set<string>, fScore: Map<string, number>): string {
    let bestKey = '';
    let bestScore = Infinity;

    for (const key of open) {
      const score = fScore.get(key) ?? Infinity;
      if (score < bestScore || (score === bestScore && key < bestKey)) {
        bestKey = key;
        bestScore = score;
      }
    }

    return bestKey;
  }

  private getTile(tileX: number, tileY: number): Tile | null {
    return this.mapData.tiles[tileY]?.[tileX] ?? null;
  }

  private tileFromKey(key: string): Tile | null {
    const [x, y] = key.split(',').map(Number);
    return this.getTile(x, y);
  }

  private key(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }

  private manhattan(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}
