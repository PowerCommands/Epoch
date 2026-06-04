/**
 * Covert personality — a national-identity layer that sits ON TOP of agendas.
 * Agendas describe WHAT a nation wants; the covert personality describes HOW it
 * pursues those goals when covert warfare (spies, agents, rebels, partisans,
 * privateers) is on the table, and how it reacts to being targeted.
 *
 * Pure data, fully data-driven (no hardcoded nation checks). Consumed by the
 * covert-suspicion and AI-diplomacy systems via weighting, never hard rules.
 */

export type CovertPersonalityId =
  | 'pragmatist' // neutral default
  | 'honorable'
  | 'schemer'
  | 'opportunist'
  | 'paranoid'
  | 'fanatic'
  | 'merchant'
  | 'pirate';

export interface CovertPersonality {
  readonly id: CovertPersonalityId;
  readonly name: string;
  readonly description: string;

  /**
   * Propensity to INITIATE covert operations, roughly -1 (abhors) … +1 (favours).
   * A weighting input for covert mission desirability (and future covert AI).
   */
  readonly covertUsageBias: number;
  /** Multiplier on suspicion this nation GAINS as a victim (paranoid > honorable > merchant). */
  readonly suspicionSensitivity: number;
  /** Tolerance for diplomatic risk/blowback when acting covertly (0.5 cautious … 1.5 reckless). */
  readonly riskTolerance: number;
  /** Preference for proxy/covert pressure over open war (0 … 1). */
  readonly proxyWarPreference: number;
  /** Preference for spy/agent espionage specifically (0 … 1). Future covert-AI input. */
  readonly espionagePreference: number;

  /** How strongly this nation's suspicion converts into WAR willingness (1 = baseline). */
  readonly suspicionToWar: number;
  /** How strongly this nation's suspicion converts into TRADE reluctance (1 = baseline). */
  readonly suspicionToTrade: number;
}
