import type { UnitType } from '../../entities/UnitType';
import type { CovertPersonality } from '../../types/covertPersonality';
import { getEraIndex } from '../../data/eraTimeline';

/**
 * Lightweight covert-force evaluation — pure helpers that let the AI value and
 * desire covert units (spies, agents, rebels, partisans) according to its covert
 * personality and what its era can actually build. This is NOT mission logic: it
 * only shapes how desirable covert PRODUCTION is, as one more input to the
 * existing military production scoring.
 *
 * Privateers are deliberately NOT managed here — they are naval military units
 * already governed by doctrine/era scoring; personalities nudge them via
 * {@link getPrivateerPersonalityMultiplier} instead, avoiding double-counting.
 */

/** Land covert-category units this evaluator manages. */
export const COVERT_CANDIDATE_UNIT_IDS = ['spy', 'agent', 'rebels', 'partisans'] as const;

/** True for a land covert unit (spy/agent/rebels/partisans). Privateer is excluded. */
export function isManagedCovertUnit(unitType: UnitType): boolean {
  return unitType.category === 'covert';
}

/**
 * Desired number of covert units for a personality, gated to 0 when the nation
 * cannot yet build any. Derived from covertUsageBias so it stays data-driven:
 * honorable → ~0, merchant/paranoid → ~1, pragmatist → 2, fanatic/opportunist →
 * 3–4, schemer/pirate → ~4. Capped to avoid covert spam.
 */
export function getDesiredCovertCapability(personality: CovertPersonality, anyCovertBuildable: boolean): number {
  if (!anyCovertBuildable) return 0;
  const raw = Math.round(2 + personality.covertUsageBias * 3);
  return Math.max(0, Math.min(5, raw));
}

/**
 * Multiplier applied to a covert candidate's competing score, RELATIVE to the
 * best military score, so covert is "just another input" that loses unless the
 * personality genuinely wants it. >1 (schemer/opportunist/fanatic) can win;
 * <1 (honorable/merchant) almost never does. Returns 0 when there is no deficit,
 * so no covert candidate is proposed.
 */
export function getCovertDemandFactor(personality: CovertPersonality, hasDeficit: boolean): number {
  if (!hasDeficit) return 0;
  return Math.max(0.1, 0.9 + personality.covertUsageBias * 0.5);
}

/** Pirates strongly favour privateers; other personalities leave doctrine in charge. */
export function getPrivateerPersonalityMultiplier(personality: CovertPersonality): number {
  return personality.id === 'pirate' ? 1.5 : 1.0;
}

/**
 * Pick the most advanced buildable covert unit (later era first, then stronger),
 * e.g. Agent over Spy, Partisans over Rebels.
 */
export function pickPreferredCovertUnit(buildable: readonly UnitType[]): UnitType | undefined {
  if (buildable.length === 0) return undefined;
  return [...buildable].sort(
    (a, b) => getEraIndex(b.era) - getEraIndex(a.era) || b.baseStrength - a.baseStrength,
  )[0];
}

/**
 * Floor reference score so a covert unit can still be chosen when the best
 * military option scores very low (or none is buildable). Keeps covert demand
 * meaningful without letting it dominate a healthy military choice.
 */
export const COVERT_MIN_REFERENCE_SCORE = 5;
