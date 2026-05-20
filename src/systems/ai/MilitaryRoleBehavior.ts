import type { Unit } from '../../entities/Unit';
import type { AICombatContext } from './AICombatScoring';
import type { AIMovementCandidate } from './AIMovementScoring';
import { getMilitaryUnitRole, type MilitaryUnitRole } from '../../utils/unitRoleUtils';

// ─── Role detection ───────────────────────────────────────────────────────────

export function getMilitaryRole(unit: Unit): MilitaryUnitRole {
  return getMilitaryUnitRole(unit.unitType);
}

// ─── Combat target modifiers ──────────────────────────────────────────────────

// Ranged unit shooting from safe range: reward staying at distance.
const RANGED_SAFE_RANGE_BONUS = 12;
// Ranged unit forced adjacent: penalise (still attacks if no better option).
const RANGED_ADJACENT_PENALTY = -18;
// Melee unit engaging a threat near a friendly city: encourage blocking.
const MELEE_CITY_DEFENSE_BONUS = 12;

/**
 * Additive modifier applied on top of scoreCombatTarget().
 * Returns 0 for roles this layer does not handle (mounted, siege, naval, etc.).
 */
export function scoreRoleBasedTarget(unit: Unit, context: AICombatContext): number {
  const role = getMilitaryRole(unit);
  let bonus = 0;

  if (role === 'ranged') {
    const unitRange = unit.unitType.range ?? 1;
    if (unitRange > 1) {
      bonus += context.distance > 1 ? RANGED_SAFE_RANGE_BONUS : RANGED_ADJACENT_PENALTY;
    }
  }

  if (role === 'melee' && context.isNearOwnCity) {
    bonus += MELEE_CITY_DEFENSE_BONUS;
  }

  return bonus;
}

// ─── Position modifiers ───────────────────────────────────────────────────────

// Melee blocking near a friendly city under threat.
const MELEE_CITY_BLOCKER_BONUS = 15;
// Ranged fire-support: near own city, not exposed to adjacent enemy.
const RANGED_FIRE_SUPPORT_BONUS = 12;
// Ranged moving into a tile adjacent to enemy without city cover: penalise.
const RANGED_EXPOSED_PENALTY = -20;

export interface RolePositionContext {
  /** True when the nation is at war (use isAtWarWithAnyone). */
  readonly threatActive: boolean;
}

/**
 * Additive modifier applied on top of scoreMovementCandidate().
 * Returns 0 for roles this layer does not handle.
 */
export function scoreRoleBasedPosition(
  unit: Unit,
  candidate: AIMovementCandidate,
  ctx: RolePositionContext,
): number {
  const role = getMilitaryRole(unit);

  if (role === 'melee' && ctx.threatActive && candidate.isNearOwnCity) {
    return MELEE_CITY_BLOCKER_BONUS;
  }

  if (role === 'ranged') {
    if (ctx.threatActive && candidate.isNearOwnCity && !candidate.isNearEnemyUnit) {
      return RANGED_FIRE_SUPPORT_BONUS;
    }
    if (candidate.isNearEnemyUnit && !candidate.isNearOwnCity) {
      return RANGED_EXPOSED_PENALTY;
    }
  }

  return 0;
}

// ─── Danger check ─────────────────────────────────────────────────────────────

/** True when the destination tile is adjacent to at least one known enemy unit. */
export function isTileDangerousForRanged(candidate: AIMovementCandidate): boolean {
  return candidate.isNearEnemyUnit;
}
