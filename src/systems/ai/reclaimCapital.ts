/**
 * Reclaim Capital — pure derivation and evaluation for the persistent strategic
 * objective a nation adopts after losing its original capital.
 *
 * This module owns the single source of truth (an objective is *derived* from
 * canonical city state, never stored) and every tunable weight the objective
 * contributes to existing AI systems. It has no Phaser, game-system, or I/O
 * dependencies so it stays deterministic and unit-testable.
 *
 * Design: a nation has an active Reclaim Capital objective iff one of its
 * original capitals is currently owned by someone else. The target is that
 * city; the current holder is whoever owns it now. Because this is derived,
 * persistence across save/load, holder changes, and completion are automatic.
 */

/** Minimal city shape this module reasons over (subset of the City entity). */
export interface ReclaimCityView {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly originNationId: string;
  readonly isOriginalCapital: boolean;
}

export interface ReclaimCapitalObjective {
  /** The original owner pursuing recovery of its capital. */
  readonly nationId: string;
  readonly targetCityId: string;
  readonly targetCityName: string;
  /** Whoever currently owns the lost capital. Updated implicitly on re-derive. */
  readonly currentHolderId: string;
}

export type ReclaimOpportunity = 'none' | 'low' | 'medium' | 'high';

/**
 * Derive the active Reclaim Capital objective for `nationId`, or null when the
 * nation still holds all of its original capitals. If more than one original
 * capital is lost, the first by scan order is chosen deterministically — the
 * common case is exactly one.
 */
export function deriveReclaimObjective(
  nationId: string,
  cities: readonly ReclaimCityView[],
): ReclaimCapitalObjective | null {
  const lost = cities.find((city) => (
    city.isOriginalCapital
    && city.originNationId === nationId
    && city.ownerId !== nationId
  ));
  if (!lost) return null;
  return {
    nationId,
    targetCityId: lost.id,
    targetCityName: lost.name,
    currentHolderId: lost.ownerId,
  };
}

// ─── Opportunity assessment ─────────────────────────────────────────────────

export interface ReclaimOpportunityInput {
  readonly ownMilitaryStrength: number;
  readonly holderMilitaryStrength: number;
  /** Wars the holder is fighting against nations *other* than the recovering one. */
  readonly holderOtherWarCount: number;
  /** Met third nations already hostile to / at war with the holder (potential partners). */
  readonly availablePartnerCount: number;
  /** Whether the recovering nation's economy is currently sustainable (non-negative). */
  readonly economyHealthy: boolean;
  /** Whether peace/war cooldowns currently permit declaring a new war on the holder. */
  readonly warPermittedByCooldown: boolean;
}

export interface ReclaimOpportunityResult {
  readonly level: ReclaimOpportunity;
  readonly score: number;
  readonly factors: Readonly<Record<string, number>>;
}

/**
 * Strength ratio below which the recovering nation is so overmatched it should
 * wait regardless of any other favourable signal — strategic patience.
 */
export const OVERMATCHED_RATIO = 0.6;
const PARITY_RATIO = 0.9;
const SUPERIORITY_RATIO = 1.25;

const HIGH_SCORE_THRESHOLD = 0.7;
const MEDIUM_SCORE_THRESHOLD = 0.35;

/**
 * Deterministic 0..~1 opportunity score mapped to a coarse level. Several
 * independent, individually tunable weighted factors — no single opaque formula.
 * An overwhelmingly weaker nation is always `low` (wait); `high` additionally
 * requires that a war could actually be started now (cooldown permitting).
 */
export function assessReclaimOpportunity(input: ReclaimOpportunityInput): ReclaimOpportunityResult {
  const ratio = input.ownMilitaryStrength / (input.holderMilitaryStrength + 1);

  const militaryFactor = ratio >= SUPERIORITY_RATIO ? 0.5 : ratio >= PARITY_RATIO ? 0.25 : 0;
  const distractionFactor = Math.min(input.holderOtherWarCount, 2) >= 2
    ? 0.4
    : input.holderOtherWarCount >= 1 ? 0.25 : 0;
  const partnerFactor = Math.min(input.availablePartnerCount, 2) * 0.15;
  const economyFactor = input.economyHealthy ? 0.05 : -0.15;

  const factors = {
    military: militaryFactor,
    holderDistracted: distractionFactor,
    partners: partnerFactor,
    economy: economyFactor,
  };
  const score = militaryFactor + distractionFactor + partnerFactor + economyFactor;

  // Overwhelming disadvantage overrides everything else: survive and rebuild.
  if (ratio < OVERMATCHED_RATIO) {
    return { level: 'low', score, factors };
  }

  let level: ReclaimOpportunity = score >= HIGH_SCORE_THRESHOLD
    ? 'high'
    : score >= MEDIUM_SCORE_THRESHOLD ? 'medium' : 'low';

  // "High" means "attempt now"; if a war cannot legally start yet, cap at medium.
  if (level === 'high' && !input.warPermittedByCooldown) {
    level = 'medium';
  }

  return { level, score, factors };
}

// ─── War-declaration modifier ───────────────────────────────────────────────

export interface ReclaimWarModifier {
  /** Additive delta to the AI war score toward this opponent. */
  readonly warScoreDelta: number;
  /** True when a rebuilt nation should commit to the reclamation war even if
   *  its base personality would not — still subject to the existing safety gates. */
  readonly treatAsWarDesire: boolean;
  /** True when the opponent is unrelated to the objective and a war of choice
   *  against it should be avoided while recovery is needed. */
  readonly suppressUnrelated: boolean;
}

export const NO_RECLAIM_WAR_MODIFIER: ReclaimWarModifier = {
  warScoreDelta: 0,
  treatAsWarDesire: false,
  suppressUnrelated: false,
};

/** War-score bonus toward the holder when an attempt is clearly warranted. */
export const RECLAIM_WAR_DESIRE_BONUS = 1.0;
/** Smaller nudge toward the holder when the opportunity is only moderate. */
export const RECLAIM_WAR_INTEREST_BONUS = 0.3;

/**
 * War modifier for a nation with an active objective toward one opponent.
 * Toward the holder it scales with opportunity; toward everyone else it flags
 * the war as an unrelated distraction to avoid while recovering.
 */
export function reclaimWarModifier(
  objective: ReclaimCapitalObjective | null,
  opportunity: ReclaimOpportunity,
  opponentId: string,
): ReclaimWarModifier {
  if (!objective) return NO_RECLAIM_WAR_MODIFIER;

  if (opponentId === objective.currentHolderId) {
    if (opportunity === 'high') {
      return { warScoreDelta: RECLAIM_WAR_DESIRE_BONUS, treatAsWarDesire: true, suppressUnrelated: false };
    }
    if (opportunity === 'medium') {
      return { warScoreDelta: RECLAIM_WAR_INTEREST_BONUS, treatAsWarDesire: false, suppressUnrelated: false };
    }
    // Low opportunity toward the holder: patience — no bonus, ordinary gates apply.
    return NO_RECLAIM_WAR_MODIFIER;
  }

  // Unrelated opponent while the objective is active: discourage wars of choice.
  return { warScoreDelta: 0, treatAsWarDesire: false, suppressUnrelated: true };
}

// ─── Military-target and diplomacy weights ──────────────────────────────────

/**
 * Target-score bonus a nation's own lost capital receives in land-war target
 * selection. Large enough to dominate ordinary distance/health scoring so the
 * reclamation war stays focused on the capital rather than drifting into
 * unrelated conquest.
 */
export const RECLAIM_TARGET_BONUS = 200;

/**
 * Joint-War acceptance bonus when the war would help the receiver recover its
 * own capital (the target is the receiver's capital holder). A modifier on top
 * of the existing relation/affinity/military scoring — never an override.
 */
export const RECLAIM_JOINT_WAR_BONUS = 4;
