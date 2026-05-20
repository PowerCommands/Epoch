/**
 * Lightweight tactical heuristics for land combat AI.
 *
 * All functions are pure: they receive pre-computed values from AISystem
 * rather than querying game state directly. This keeps them cheap,
 * testable, and decoupled from the orchestration layer.
 *
 * Boundary: only applied to land units on non-water tiles.
 * See isLandTacticsEligible() for the guard used by callers.
 */

import type { Unit } from '../../entities/Unit';
import type { MapData } from '../../types/map';
import { TileType } from '../../types/map';
import type { AICombatContext } from './AICombatScoring';
import type { AIMovementCandidate } from './AIMovementScoring';
import { getMilitaryRole } from './MilitaryRoleBehavior';

// ─── Land unit guard ──────────────────────────────────────────────────────────

/**
 * True for non-naval units standing on a land tile.
 * Tactical heuristics should only run when this returns true.
 */
export function isLandTacticsEligible(unit: Unit, mapData: MapData): boolean {
  if (unit.unitType.isNaval) return false;
  const tile = mapData.tiles[unit.tileY]?.[unit.tileX];
  return tile !== undefined
    && tile.type !== TileType.Ocean
    && tile.type !== TileType.Coast;
}

// ─── Combat: focus fire ───────────────────────────────────────────────────────

const FOCUS_DAMAGED_HEAVY = 15;   // target below 50 % HP — finishing blow opportunity
const FOCUS_DAMAGED_LIGHT = 8;    // target below 70 % HP — softened target
const FOCUS_THREATENS_VULNERABLE = 10; // target is near a friendly ranged/siege unit
const FOCUS_ISOLATED = 8;         // target has no nearby allied support

/**
 * Bonus for concentrating fire on priority targets.
 *
 * @param hasVulnerableFriendlyNearTarget true if any friendly ranged/siege unit
 *   is within FRIENDLY_SUPPORT_DISTANCE tiles of the target position
 * @param enemyAlliesNearTarget count of enemy units within FRIENDLY_SUPPORT_DISTANCE
 *   tiles of the target position
 */
export function scoreFocusFireTarget(
  context: AICombatContext,
  hasVulnerableFriendlyNearTarget: boolean,
  enemyAlliesNearTarget: number,
): number {
  if (!context.isTargetUnit) return 0;

  let bonus = 0;
  if (context.targetHealthRatio < 0.5) bonus += FOCUS_DAMAGED_HEAVY;
  else if (context.targetHealthRatio < 0.7) bonus += FOCUS_DAMAGED_LIGHT;
  if (hasVulnerableFriendlyNearTarget) bonus += FOCUS_THREATENS_VULNERABLE;
  if (enemyAlliesNearTarget === 0) bonus += FOCUS_ISOLATED;
  return bonus;
}

// ─── Combat: attack risk (suicide prevention) ─────────────────────────────────

const RISK_LETHAL = -40;    // estimated retaliation would kill the attacker
const RISK_CRITICAL = -25;  // would leave attacker near death
const RISK_HIGH = -10;      // significant survival risk

/**
 * Penalty for melee attacks where estimated retaliation would kill or critically
 * wound the attacker. Returns 0 for ranged attacks (no retaliation), city
 * attacks, and attacks against pure-ranged defenders (baseStrength = 0).
 *
 * The penalty is a score modifier, not a hard block — very high-value targets
 * can still override it.
 */
export function estimateAttackRisk(context: AICombatContext): number {
  if (context.distance > 1) return 0;   // ranged attack: no retaliation
  if (context.isTargetCity) return 0;   // cities don't melee-retaliate
  if (!context.isTargetUnit) return 0;

  const target = context.target as Unit;
  const targetStr = target.unitType.baseStrength;
  if (targetStr <= 0) return 0;         // defender is ranged-only; cannot retaliate

  const attackerStr = context.attacker.unitType.baseStrength;
  if (attackerStr <= 0) return 0;

  // Rough retaliation estimate: proportional to effective strength ratio.
  // The 0.4 factor is calibrated so equal-strength units at full health estimate
  // ~40 % mutual damage, matching typical Civ-style outcomes.
  const estimatedRetaliation = Math.min(
    1,
    (targetStr * context.targetHealthRatio)
    / (attackerStr * Math.max(0.1, context.attackerHealthRatio))
    * 0.4,
  );

  const survivingHP = context.attackerHealthRatio - estimatedRetaliation;
  if (survivingHP < 0.10) return RISK_LETHAL;
  if (survivingHP < 0.20) return RISK_CRITICAL;
  if (survivingHP < 0.30) return RISK_HIGH;
  return 0;
}

// ─── Movement: retreat behavior ───────────────────────────────────────────────

/** Ranged units consider retreating below this HP fraction. */
export const RANGED_RETREAT_HP = 0.55;
/** Melee units consider retreating below this HP fraction. */
export const MELEE_RETREAT_HP = 0.35;

const RETREAT_TO_SAFETY = 20;  // destination near own city
const RETREAT_TO_SUPPORT = 10; // destination near a friendly military unit
const RETREAT_FROM_DANGER = 15; // destination near an enemy unit (penalty)
const RETREAT_FROM_ADVANCE = 20; // destination is an enemy offensive target (penalty)

/**
 * Score modifier for damaged units seeking safer positions.
 * Returns 0 when the unit is healthy enough not to retreat.
 * Urgency scales continuously so retreat preference grows with damage.
 *
 * @param hasFriendlySupportAtDestination true if a friendly land military unit
 *   is within FRIENDLY_SUPPORT_DISTANCE tiles of the candidate destination
 */
export function scoreRetreatPosition(
  unit: Unit,
  candidate: AIMovementCandidate,
  hasFriendlySupportAtDestination: boolean,
): number {
  const healthRatio = unit.health / unit.unitType.baseHealth;
  const role = getMilitaryRole(unit);
  const threshold = role === 'ranged' ? RANGED_RETREAT_HP : MELEE_RETREAT_HP;
  if (healthRatio >= threshold) return 0;

  // urgency: 0 at threshold, 1 at 0 HP
  const urgency = (threshold - healthRatio) / threshold;

  let bonus = 0;
  if (candidate.isNearOwnCity) bonus += RETREAT_TO_SAFETY * urgency;
  if (hasFriendlySupportAtDestination) bonus += RETREAT_TO_SUPPORT * urgency;
  if (candidate.isNearEnemyUnit) bonus -= RETREAT_FROM_DANGER * urgency;
  if (candidate.kind === 'enemyCity' || candidate.kind === 'enemyUnit') {
    bonus -= RETREAT_FROM_ADVANCE * urgency;
  }
  return bonus;
}
