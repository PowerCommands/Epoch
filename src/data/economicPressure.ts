/**
 * Economic Pressure — canonical types and central calibration constants.
 *
 * Economic Pressure is a directional, bilateral diplomatic state (owned by
 * {@link DiplomacyManager}). The three measures escalate:
 *
 *   None → Tariffs → Boycott → Embargo
 *
 * Only the numbers/prerequisites live here so they can be balanced in one place.
 * The state and its effects are enforced by the systems that already own the
 * relevant economic calculations (trade and resource access).
 */

export type EconomicPressureType = 'tariffs' | 'boycott' | 'embargo';

export const ECONOMIC_PRESSURE_TYPES: readonly EconomicPressureType[] = ['tariffs', 'boycott', 'embargo'];

/** Shared age threshold for AI expiry and Human-related removal negotiation. */
export const ECONOMIC_PRESSURE_DURATION_TURNS = 25;

/** Back-compatible, explicitly named use of the shared duration for AI-only sanctions. */
export const ECONOMIC_PRESSURE_AI_AI_DURATION_TURNS = ECONOMIC_PRESSURE_DURATION_TURNS;

/** Fixed treasury transfer used by either direction of Human–AI removal negotiation. */
export const ECONOMIC_PRESSURE_REMOVAL_PRICE = 1000;

/** Escalation ordering. Higher = stronger pressure. */
export const ECONOMIC_PRESSURE_LEVEL: Record<EconomicPressureType, number> = {
  tariffs: 1,
  boycott: 2,
  embargo: 3,
};

/** Human-facing measure names used by diagnostics and the Audience UI. */
export const ECONOMIC_PRESSURE_LABEL: Record<EconomicPressureType, string> = {
  tariffs: 'Tariffs',
  boycott: 'Boycott',
  embargo: 'Embargo',
};

/**
 * Tariffs are deliberately symbolic in Epoch. Keeping this compatibility
 * constant at 1 makes that rule explicit for economic consumers and tests.
 */
export const TARIFF_TRADE_VALUE_MULTIPLIER = 1;

/** Active-state relationship modifiers; these never accumulate into memory. */
export interface EconomicPressureDiplomaticModifier {
  readonly hostility: number;
  readonly affinity: number;
}

export const ECONOMIC_PRESSURE_DIPLOMATIC_MODIFIER: Record<
  EconomicPressureType,
  EconomicPressureDiplomaticModifier
> = {
  tariffs: { hostility: 5, affinity: -4 },
  boycott: { hostility: 12, affinity: -10 },
  embargo: { hostility: 22, affinity: -18 },
};

/** A prerequisite unlock for a measure, resolved through canonical unlock systems. */
export interface EconomicPressurePrerequisite {
  readonly kind: 'technology' | 'culture';
  readonly id: string;
}

/**
 * Technology prerequisites per measure, escalating along the economic tech line
 * (all three already exist in src/data/technologies.ts). Unlock state is NOT
 * duplicated here — eligibility consults the canonical research/culture systems.
 */
export const ECONOMIC_PRESSURE_PREREQUISITES: Record<EconomicPressureType, EconomicPressurePrerequisite> = {
  tariffs: { kind: 'technology', id: 'currency' },
  boycott: { kind: 'technology', id: 'banking' },
  embargo: { kind: 'technology', id: 'economics' },
};

/** Returns true if `a` is at least as strong as `b`. */
export function economicPressureAtLeast(a: EconomicPressureType, b: EconomicPressureType): boolean {
  return ECONOMIC_PRESSURE_LEVEL[a] >= ECONOMIC_PRESSURE_LEVEL[b];
}

/** The stronger of two (possibly absent) measures. */
export function strongerEconomicPressure(
  a: EconomicPressureType | null,
  b: EconomicPressureType | null,
): EconomicPressureType | null {
  if (a === null) return b;
  if (b === null) return a;
  return ECONOMIC_PRESSURE_LEVEL[a] >= ECONOMIC_PRESSURE_LEVEL[b] ? a : b;
}
