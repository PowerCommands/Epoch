import type { Unit } from '../../entities/Unit';
import type { MapData } from '../../types/map';
import type { IGridSystem } from '../grid/IGridSystem';
import type { PathfindingSystem } from '../PathfindingSystem';
import type { UnitManager } from '../UnitManager';
import { isWaterTile } from '../UnitMovementRules';

/**
 * Overseas colonization route recovery.
 *
 * A naval colonization expedition can stall for a long time when its transport
 * reaches a water tile from which it can neither land (all adjacent land tiles
 * blocked/foreign) nor make further progress, or when it oscillates without ever
 * getting meaningfully closer to the objective. The existing single-turn "could
 * not advance" cancel does not catch these cases, so the expedition is treated as
 * active indefinitely.
 *
 * These helpers add a small, deterministic, multi-turn progress tracker plus a
 * local reroute that reuses the shared {@link PathfindingSystem} — never a second
 * pathfinding system. Recovery repositions the transport toward a nearby reachable
 * water tile to break the deadlock; the original colonization target is preserved.
 */

/** Consecutive stalled turns tolerated before a reroute is attempted. */
export const EXPEDITION_STALL_TURNS_BEFORE_REROUTE = 6;
/** Local search radius (in tiles) for a recovery waypoint around the transport. */
export const EXPEDITION_RECOVERY_SEARCH_RADIUS = 5;
/** Minimum tile-distance improvement toward the objective that counts as progress. */
const MIN_MEANINGFUL_PROGRESS = 1;
/** Cap on pathfinding probes per recovery attempt to keep the search local/cheap. */
const MAX_RECOVERY_PATH_ATTEMPTS = 16;

export interface ExpeditionProgress {
  /** Best (smallest) distance-to-objective observed so far. */
  bestDistance: number;
  /** Consecutive turns without meaningful progress toward the objective. */
  stallTurns: number;
}

/**
 * Pure stall accounting. An improvement of at least {@link MIN_MEANINGFUL_PROGRESS}
 * tiles over the best distance resets the counter; anything else increments it.
 * Temporary congestion (a single non-improving turn) therefore does not by itself
 * count as "stuck".
 */
export function updateExpeditionProgress(
  currentDistance: number,
  previous: { bestDistance?: number; stallTurns?: number },
): ExpeditionProgress {
  const prevBest = previous.bestDistance;
  if (prevBest === undefined || currentDistance <= prevBest - MIN_MEANINGFUL_PROGRESS) {
    return { bestDistance: currentDistance, stallTurns: 0 };
  }
  return {
    bestDistance: Math.min(prevBest, currentDistance),
    stallTurns: (previous.stallTurns ?? 0) + 1,
  };
}

/** True once the expedition has failed to progress for the configured threshold. */
export function isExpeditionStalled(progress: { stallTurns?: number }): boolean {
  return (progress.stallTurns ?? 0) >= EXPEDITION_STALL_TURNS_BEFORE_REROUTE;
}

export interface RecoveryWaypointParams {
  transport: Unit;
  targetX: number;
  targetY: number;
  mapData: MapData;
  gridSystem: IGridSystem;
  pathfindingSystem: PathfindingSystem;
  unitManager: UnitManager;
  /** Positions to avoid (e.g. a previous failed waypoint) so recovery does not loop. */
  exclude?: ReadonlyArray<{ x: number; y: number }>;
  searchRadius?: number;
}

/**
 * Pick a nearby, reachable water tile the transport can move to in order to break
 * a deadlock. Prefers tiles that bring the expedition closer to the objective, but
 * will accept a lateral reachable tile if none are closer — the primary purpose is
 * to escape the blockage. Returns undefined when no reachable alternative exists,
 * in which case the caller may retry later.
 */
export function selectExpeditionRecoveryWaypoint(
  params: RecoveryWaypointParams,
): { x: number; y: number } | undefined {
  const { transport, targetX, targetY, mapData, gridSystem, pathfindingSystem, unitManager } = params;
  const radius = params.searchRadius ?? EXPEDITION_RECOVERY_SEARCH_RADIUS;
  const from = { x: transport.tileX, y: transport.tileY };
  const target = { x: targetX, y: targetY };
  const currentDistance = gridSystem.getDistance(from, target);

  const excludeKeys = new Set<string>((params.exclude ?? []).map((coord) => `${coord.x},${coord.y}`));
  excludeKeys.add(`${from.x},${from.y}`);

  const candidates = gridSystem.getTilesInRange(from, radius, mapData, { includeCenter: false })
    .filter((tile) => isWaterTile(tile))
    .filter((tile) => !excludeKeys.has(`${tile.x},${tile.y}`))
    .filter((tile) => {
      const occupant = unitManager.getUnitAt(tile.x, tile.y);
      return occupant === null || occupant.id === transport.id;
    })
    .map((tile) => ({
      x: tile.x,
      y: tile.y,
      distanceToTarget: gridSystem.getDistance({ x: tile.x, y: tile.y }, target),
      distanceFromStart: gridSystem.getDistance({ x: tile.x, y: tile.y }, from),
    }))
    .sort((a, b) => {
      if (a.distanceToTarget !== b.distanceToTarget) return a.distanceToTarget - b.distanceToTarget;
      // Keep the detour local: prefer closer waypoints when equally good.
      if (a.distanceFromStart !== b.distanceFromStart) return a.distanceFromStart - b.distanceFromStart;
      return (a.y - b.y) || (a.x - b.x);
    });

  // Pass 1 favours real progress toward the objective; pass 2 accepts any reachable
  // different tile purely to break the deadlock.
  const ordered = [
    ...candidates.filter((candidate) => candidate.distanceToTarget < currentDistance),
    ...candidates.filter((candidate) => candidate.distanceToTarget >= currentDistance),
  ];

  let attempts = 0;
  for (const candidate of ordered) {
    if (attempts >= MAX_RECOVERY_PATH_ATTEMPTS) break;
    attempts += 1;
    const path = pathfindingSystem.findPath(transport, candidate.x, candidate.y, {
      respectMovementPoints: false,
    });
    if (path && path.length > 1) return { x: candidate.x, y: candidate.y };
  }
  return undefined;
}
