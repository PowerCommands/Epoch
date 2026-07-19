/**
 * Multilateral Aggression Memory — observer-side relation deltas.
 *
 * When a nation wages war and conquers third parties, nations that *witness*
 * it (rather than suffer it) should gradually come to see the aggressor as a
 * geopolitical threat. These constants are the entire calibration surface for
 * that reaction; the deltas live here so they are data-driven and reviewable
 * in one place rather than scattered through event handlers.
 *
 * Design constraints (see autorun-output/geopolitical-runaway-analysis.md):
 *   - This reacts to *observable military aggression only*. Wealth, tech,
 *     population, wonders and victory progress are deliberately NOT inputs.
 *   - A single limited war must not make an aggressor the enemy of the world.
 *   - A serial conqueror must accumulate into something downstream systems
 *     (attitude classification, joint war, council target pressure) can read.
 *
 * Calibration reference — the thresholds these values must interact with:
 *   DiplomaticEvaluationSystem: fear >= 50 -> 'afraid'; hostility >= 50 or
 *     trust <= 20 -> 'hostile'; trust >= 70 && affinity >= 10 -> 'friendly'.
 *   AllianceManager: accepts at trust >= 60 && hostility <= 10.
 *   JointWarSystem.shouldAccept: score += hostility/18 + fear/30 (threshold 3).
 *   WorldCouncilResolutionSystem.getTargetPressure: hostility*8 + suspicion*5 - trust*4.
 *
 * Intended progression against a default relation (trust 50, fear 0, hostility 0):
 *   war declaration alone ......... noticeable, nowhere near hostile
 *   war + 1-2 captured cities ..... clear concern, still neutral
 *   captured capital .............. significant
 *   one nation eliminated ......... aggressor reads as a serious threat
 *   two nations eliminated ........ substantial fear and hostility
 */

export type AggressionEventType =
  | 'war_declaration'
  | 'city_capture'
  | 'capital_capture'
  | 'nation_elimination';

/**
 * Relation delta applied to an *observer's* relation with the aggressor.
 * Negative trust, positive fear/hostility. The direct victim is handled by the
 * existing bilateral deltas in DiplomaticMemorySystem and never uses these.
 */
export interface ObserverAggressionDelta {
  readonly trust: number;
  readonly fear: number;
  readonly hostility: number;
}

/**
 * Per-event observer reactions.
 *
 * `capital_capture` is a *complete replacement* for `city_capture`, not an
 * addition to it: the capture pipeline emits exactly one event per captured
 * city, choosing the capital variant when `city.isCapital` is set. This is how
 * double-counting is avoided while still clearly distinguishing the two.
 */
export const OBSERVER_AGGRESSION_DELTAS: Readonly<Record<AggressionEventType, ObserverAggressionDelta>> = {
  // "This nation is willing to use military force." Deliberately small — one
  // war declaration must never approach the hostile/afraid thresholds.
  war_declaration: { trust: -4, fear: 2, hostility: 3 },

  // "This war is becoming territorial expansion." Accumulates per city.
  city_capture: { trust: -3, fear: 3, hostility: 4 },

  // "This nation is dismantling another major power." Replaces city_capture
  // for the same event; roughly 2.5x its weight.
  capital_capture: { trust: -8, fear: 7, hostility: 10 },

  // "This nation has destroyed an entire civilization." The largest single
  // reaction, and on its own enough to push a previously warm relation out of
  // friendly territory.
  nation_elimination: { trust: -18, fear: 12, hostility: 20 },
};

/**
 * Decay cadence. Every N rounds, one accumulated point of observer-derived
 * fear and hostility is released and one point of trust is restored.
 *
 * At 4 rounds/point, a single elimination's +20 hostility takes ~80 rounds to
 * fade and a full two-nation conquest campaign takes several hundred — slow
 * enough that destroying a civilization is not forgotten in a handful of turns,
 * fast enough that a nation which stops conquering can rehabilitate over eras.
 *
 * Decay is strictly bounded by what this system contributed (see the ledger in
 * DiplomaticMemorySystem): it can never erode fear/hostility that came from
 * the observer's own wars.
 */
export const AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS = 4;
export const AGGRESSION_MEMORY_DECAY_STEP = 1;

/** Log prefix so autorun analysis can isolate these events with one grep. */
export const AGGRESSION_MEMORY_LOG_PREFIX = '[AggressionMemory]';
