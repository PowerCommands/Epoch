import type { EconomicPressureType } from '../../data/economicPressure';

/**
 * Canonical autorun/debug logging for Economic Pressure diplomatic events
 * (Tariffs, Boycotts, Embargoes).
 *
 * These lines are observability only — they never change gameplay. Each actual
 * state transition emits exactly one `[DIPLOMACY][Initiator -> Target] Action`
 * line, kept short so long autorun logs stay easy to grep.
 */

const IMPOSE_ACTION: Record<EconomicPressureType, string> = {
  tariffs: 'Tariff imposed',
  boycott: 'Boycott initiated',
  embargo: 'Embargo imposed',
};

const LIFT_ACTION: Record<EconomicPressureType, string> = {
  tariffs: 'Tariff lifted',
  boycott: 'Boycott lifted',
  embargo: 'Embargo lifted',
};

/** Emit a single canonical diplomacy line. */
export function logDiplomacyEconomicAction(
  initiatorName: string,
  targetName: string,
  action: string,
): void {
  console.log(`[DIPLOMACY][${initiatorName} -> ${targetName}] ${action}`);
}

/**
 * Log an imposed measure. `detail` is an optional concise suffix already
 * computed at the call site (e.g. cancelled-agreement counts) — never scanned
 * for solely to log.
 */
export function logEconomicPressureImposed(
  initiatorName: string,
  targetName: string,
  type: EconomicPressureType,
  detail?: string,
): void {
  const action = detail ? `${IMPOSE_ACTION[type]}, ${detail}` : IMPOSE_ACTION[type];
  logDiplomacyEconomicAction(initiatorName, targetName, action);
}

/** Log an automatic retaliatory tariff (a separate state change). */
export function logRetaliatoryTariffImposed(
  initiatorName: string,
  targetName: string,
): void {
  logDiplomacyEconomicAction(initiatorName, targetName, 'Retaliatory tariff imposed');
}

/** Log a lifted measure. */
export function logEconomicPressureLifted(
  initiatorName: string,
  targetName: string,
  type: EconomicPressureType,
): void {
  logDiplomacyEconomicAction(initiatorName, targetName, LIFT_ACTION[type]);
}
