/**
 * Lightweight offensive operation layer for land war AI.
 *
 * Per nation, per round: identifies a primary target city, decides whether
 * enough land force is staged nearby to commit to a push, and provides a
 * movement-scoring helper used in unit decision-making.
 *
 * All state is recomputed each round (no cross-round persistence).
 * Results are cached so repeated per-unit calls within the same round are free.
 *
 * Boundaries: only affects land units on land tiles. Naval and embarked units
 * are excluded by the isLandTacticsEligible() guard in the caller.
 */

import type { Unit } from '../../entities/Unit';
import type { City } from '../../entities/City';
import type { GridCoord } from '../../types/grid';
import type { AIMovementCandidate } from './AIMovementScoring';
import { getMilitaryRole } from './MilitaryRoleBehavior';
import { CITY_BASE_HEALTH } from '../../data/cities';
import { RECLAIM_TARGET_BONUS } from './reclaimCapital';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DistanceFn = (a: GridCoord, b: GridCoord) => number;

export interface OffensiveOperation {
  readonly nationId: string;
  readonly targetCityId: string;
  readonly targetPos: GridCoord;
  readonly targetName: string;
  /** True when enough units are near the target to commit to a push. */
  readonly committed: boolean;
  /** Number of own land combat units within OFFENSIVE_STAGING_RADIUS of the target. */
  readonly unitsNearTarget: number;
  readonly round: number;
}

export interface OperationParams {
  readonly nationId: string;
  readonly round: number;
  readonly warEnemyNationIds: readonly string[];
  readonly allCities: readonly City[];
  readonly ownAnchor: GridCoord;
  readonly ownLandCombatUnits: readonly Unit[];
  readonly aggression: number;
  readonly distanceFn: DistanceFn;
  /**
   * The nation's own lost original capital, when it has an active Reclaim
   * Capital objective. Receives a large target bonus so a reclamation war stays
   * focused on the capital instead of drifting into unrelated conquest.
   */
  readonly reclaimTargetCityId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius around the target within which own units count as staged. */
export const OFFENSIVE_STAGING_RADIUS = 5;

const MAX_TARGET_DISTANCE = 18; // rough land-reachability proxy

const TARGET_DIST_PENALTY = 3;
const TARGET_HEALTH_BONUS = 30;  // prefer weakly-defended cities
const TARGET_CAPITAL_BONUS = 20; // bonus for enemy first city (capital proxy)

const PUSH_MELEE_BONUS = 20;     // committed melee advance bonus
const PUSH_RANGED_BONUS = 12;    // committed ranged advance bonus
const PUSH_OTHER_BONUS = 10;     // committed other role advance bonus
const ISOLATION_CITY_PENALTY = -25; // lone unit charging a city without support

// ─── Commit threshold ─────────────────────────────────────────────────────────

function requiredCommitCount(aggression: number): number {
  if (aggression >= 1.5) return 1; // warmonger: commit immediately
  if (aggression >= 1.0) return 2; // normal: wait for a partner
  return 3;                        // cautious: wait for a small force
}

// ─── Target selection ─────────────────────────────────────────────────────────

function scoreCityAsTarget(
  city: City,
  ownAnchor: GridCoord,
  isFirstEnemyCity: boolean,
  distanceFn: DistanceFn,
  reclaimTargetCityId: string | undefined,
): number {
  const dist = distanceFn(ownAnchor, { x: city.tileX, y: city.tileY });
  // The lost capital is exempt from the reachability cut-off: recovering it is
  // the strategic objective even when it is far away.
  const isReclaimTarget = city.id === reclaimTargetCityId;
  if (dist > MAX_TARGET_DISTANCE && !isReclaimTarget) return -Infinity;
  const healthRatio = city.health / CITY_BASE_HEALTH;
  let score = 100;
  score -= dist * TARGET_DIST_PENALTY;
  score += (1 - healthRatio) * TARGET_HEALTH_BONUS;
  if (isFirstEnemyCity) score += TARGET_CAPITAL_BONUS;
  if (isReclaimTarget) score += RECLAIM_TARGET_BONUS;
  return score;
}

function selectTarget(params: OperationParams): City | null {
  const { warEnemyNationIds, allCities, ownAnchor, distanceFn, reclaimTargetCityId } = params;
  const enemySet = new Set(warEnemyNationIds);
  const firstCityIdPerEnemy = new Map<string, string>();

  for (const city of allCities) {
    if (!enemySet.has(city.ownerId)) continue;
    if (!firstCityIdPerEnemy.has(city.ownerId)) {
      firstCityIdPerEnemy.set(city.ownerId, city.id);
    }
  }

  let bestCity: City | null = null;
  let bestScore = -Infinity;
  for (const city of allCities) {
    if (!enemySet.has(city.ownerId)) continue;
    const isFirst = firstCityIdPerEnemy.get(city.ownerId) === city.id;
    const score = scoreCityAsTarget(city, ownAnchor, isFirst, distanceFn, reclaimTargetCityId);
    if (score > bestScore) {
      bestScore = score;
      bestCity = city;
    }
  }
  return bestCity;
}

// ─── OffensiveOperationSystem ─────────────────────────────────────────────────

export class OffensiveOperationSystem {
  private readonly cache = new Map<string, OffensiveOperation | null>();
  private cacheRound = -1;

  /**
   * Returns the offensive operation for the given nation this round.
   * Cached after the first call per (nation, round) pair.
   */
  getOperation(params: OperationParams): OffensiveOperation | null {
    if (params.round !== this.cacheRound) {
      this.cache.clear();
      this.cacheRound = params.round;
    }
    if (this.cache.has(params.nationId)) {
      return this.cache.get(params.nationId) ?? null;
    }
    const op = this.compute(params);
    this.cache.set(params.nationId, op);
    return op;
  }

  private compute(params: OperationParams): OffensiveOperation | null {
    const { nationId, round, ownLandCombatUnits, aggression, distanceFn } = params;
    if (params.warEnemyNationIds.length === 0) return null;

    const target = selectTarget(params);
    if (!target) return null;

    const targetPos = { x: target.tileX, y: target.tileY };
    const unitsNearTarget = ownLandCombatUnits.filter(
      (u) => distanceFn({ x: u.tileX, y: u.tileY }, targetPos) <= OFFENSIVE_STAGING_RADIUS,
    ).length;

    return {
      nationId,
      targetCityId: target.id,
      targetPos,
      targetName: target.name,
      committed: unitsNearTarget >= requiredCommitCount(aggression),
      unitsNearTarget,
      round,
    };
  }
}

// ─── Movement scoring ─────────────────────────────────────────────────────────

/**
 * Additive movement score modifier for committed offensive operations.
 *
 * Applies an isolation penalty when a lone unit tries to charge an enemy city,
 * and a push bonus when a committed operation targets the destination city.
 *
 * @param localSupportCount number of friendly land combat units within
 *   FRIENDLY_SUPPORT_DISTANCE tiles of the moving unit's current position
 */
export function scoreOffensivePosition(
  unit: Unit,
  candidate: AIMovementCandidate,
  op: OffensiveOperation,
  localSupportCount: number,
): number {
  // Isolated unit: penalise charging any enemy city.
  if (localSupportCount < 2 && candidate.kind === 'enemyCity') {
    return ISOLATION_CITY_PENALTY;
  }

  if (!op.committed) return 0;

  // Only boost movement that heads directly toward the selected primary target.
  const targetingPrimary = candidate.kind === 'enemyCity'
    && candidate.destination.x === op.targetPos.x
    && candidate.destination.y === op.targetPos.y;
  if (!targetingPrimary) return 0;

  const role = getMilitaryRole(unit);
  if (role === 'melee') return PUSH_MELEE_BONUS;
  if (role === 'ranged') return PUSH_RANGED_BONUS;
  return PUSH_OTHER_BONUS;
}
