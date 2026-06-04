/**
 * suspicionEffects — pure helpers that turn the `suspicion` relation value into
 * concrete diplomatic friction. Centralised so AIDiplomacySystem, AISystem, and
 * DiplomaticEvaluationSystem all apply consistent, testable rules.
 *
 * Design intent (Prompt 2): suspicion makes nations more cautious, more easily
 * offended, and less cooperative — WITHOUT, on its own, causing war or making
 * anyone hostile by default. It is a tension amplifier layered on top of the
 * existing trust/fear/hostility/affinity logic. All inputs default to 0, so
 * missing/old data behaves exactly as before.
 */

// Banded thresholds (see prompt). 0–20 is effectively "no meaningful effect".
const SUSPICION_MODERATE = 21; // 21–50
const SUSPICION_STRONG = 51; // 51–75
const SUSPICION_REFUSE = 76; // 76–100

/**
 * Penalty applied to open-borders willingness (subtracted from the trust/bias
 * gating). Larger than the embassy/trade effect — open borders is the most
 * trust-sensitive grant.
 */
export function getSuspicionOpenBordersPenalty(suspicion: number): number {
  if (suspicion >= SUSPICION_REFUSE) return -60;
  if (suspicion >= SUSPICION_STRONG) return -25;
  if (suspicion >= SUSPICION_MODERATE) return -10;
  return 0;
}

/**
 * At very high suspicion a nation almost always refuses to GRANT open borders,
 * unless overwhelming friendly modifiers exist (here: an alliance-grade bond of
 * very high trust + affinity). Existing grants/alliances are untouched — this
 * only gates new grants.
 */
export function suspicionBlocksOpenBorders(
  suspicion: number,
  friendly: { trust: number; affinity: number },
): boolean {
  if (suspicion < SUSPICION_REFUSE) return false;
  const overwhelminglyFriendly = friendly.trust >= 80 && friendly.affinity >= 20;
  return !overwhelminglyFriendly;
}

/**
 * Additive war-score bonus (same 0–1 scale as AIDiplomacySystem's warScore).
 * Only ever amplifies an already-formed intent to fight — the war branch's
 * safety gates (not weaker, not high-threat, cooldowns) still apply, so this
 * never starts a war on its own.
 */
export function getSuspicionWarScoreBonus(suspicion: number): number {
  if (suspicion >= 80) return 0.35;
  if (suspicion >= 60) return 0.2;
  if (suspicion >= 30) return 0.1;
  return 0;
}

/**
 * High suspicion blocks a "friendly" attitude unless trust is very high — a
 * suspicious nation stays guarded even when warmth would otherwise apply.
 */
export function suspicionSuppressesFriendly(suspicion: number, trust: number): boolean {
  return suspicion >= SUSPICION_STRONG && trust < 85;
}

/**
 * Suspicion amplifies existing hostility into a hostile attitude. Requires real
 * pre-existing hostility — suspicion alone never flips attitude to hostile.
 */
export function suspicionAmplifiesHostile(suspicion: number, hostility: number): boolean {
  return suspicion >= 60 && hostility >= 25;
}

export interface SuspicionGateResult {
  /** Whether the agreement is still allowed despite suspicion. */
  readonly allow: boolean;
  /** Short reason for logging when suspicion changed the outcome (else undefined). */
  readonly reason?: string;
}

/**
 * Embassy willingness. Suspicion matters less than for open borders: only high
 * suspicion blocks a NEW embassy, and strong trust still gets one through.
 */
export function evaluateEmbassyUnderSuspicion(suspicion: number, trust: number): SuspicionGateResult {
  if (suspicion < 70) return { allow: true };
  if (trust >= 70) {
    return { allow: true, reason: `embassy allowed despite suspicion ${Math.round(suspicion)} due to strong trust` };
  }
  return { allow: false, reason: `suspicion ${Math.round(suspicion)} blocked new embassy` };
}

/**
 * Trade willingness. Never makes trade impossible: economic lean (tradeWeight)
 * or mutual trust still overcomes low/moderate suspicion, and even high
 * suspicion yields to strong economic incentive or strong trust. Returns a
 * reason whenever suspicion is the deciding factor (allowed-despite or blocked).
 */
export function evaluateTradeUnderSuspicion(
  suspicion: number,
  trust: number,
  tradeWeight: number,
): SuspicionGateResult {
  if (suspicion <= 30) return { allow: true };
  const economic = tradeWeight > 1.0;
  const strongEconomic = tradeWeight >= 1.25;
  const sus = Math.round(suspicion);

  if (suspicion <= 60) {
    if (trust >= 40 || economic) {
      return { allow: true, reason: `trade accepted despite suspicion ${sus} due to ${economic ? 'economic agenda' : 'mutual trust'}` };
    }
    return { allow: false, reason: `suspicion ${sus} reduced trade willingness` };
  }

  // High suspicion (61–100): only strong economic benefit or strong trust wins.
  if (trust >= 60 || strongEconomic) {
    return { allow: true, reason: `trade accepted despite suspicion ${sus} due to ${strongEconomic ? 'strong economic benefit' : 'strong trust'}` };
  }
  return { allow: false, reason: `suspicion ${sus} reduced trade willingness` };
}
