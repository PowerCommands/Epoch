import { AEROSPACE_INDUSTRIES_ID, AEROSPACE_PARTS_ID } from '../../data/scienceVictory';
import type { ScienceVictoryProgress } from '../VictorySystem';
import type { AIProductionCandidate } from './AIProductionScoring';
import type { AIVictoryFocusObjective, AIVictoryFocusState } from '../../types/aiVictoryFocus';

export const SCIENCE_VICTORY_FOCUS_ACTIVATION_MILESTONES = 3;
export const SCIENCE_VICTORY_FOCUS_INVALIDATION_MILESTONES = 1;
export const SCIENCE_VICTORY_FOCUS_PRODUCTION_SCORE = 300;

export type AIVictoryFocusTransition = 'entered' | 'objectiveAdvanced' | 'exited' | 'unchanged';

export interface AIVictoryFocusEvaluation {
  readonly focus?: AIVictoryFocusState;
  readonly transition: AIVictoryFocusTransition;
  readonly reason?: 'scienceVictoryDisabled' | 'scienceVictoryAchieved' | 'pathInvalidated';
}

/**
 * Evaluate the active endgame focus from the canonical VictorySystem progress.
 * The lower exit threshold supplies hysteresis so a temporarily lost milestone
 * does not make the leader oscillate in and out of its endgame plan.
 */
export function evaluateAIVictoryFocus(
  current: AIVictoryFocusState | undefined,
  scienceVictoryEnabled: boolean,
  progress: ScienceVictoryProgress,
  currentTurn: number,
): AIVictoryFocusEvaluation {
  if (!scienceVictoryEnabled) {
    return current
      ? { transition: 'exited', reason: 'scienceVictoryDisabled' }
      : { transition: 'unchanged' };
  }

  if (progress.aerospaceParts >= progress.requiredAerospaceParts) {
    return current
      ? { transition: 'exited', reason: 'scienceVictoryAchieved' }
      : { transition: 'unchanged' };
  }

  const objective = getScienceVictoryFocusObjective(progress);
  if (current?.type === 'science') {
    if (progress.fulfilledMilestones <= SCIENCE_VICTORY_FOCUS_INVALIDATION_MILESTONES) {
      return { transition: 'exited', reason: 'pathInvalidated' };
    }
    const focus = { ...current, objective };
    return {
      focus,
      transition: current.objective === objective ? 'unchanged' : 'objectiveAdvanced',
    };
  }

  if (progress.fulfilledMilestones >= SCIENCE_VICTORY_FOCUS_ACTIVATION_MILESTONES) {
    return {
      focus: { type: 'science', objective, activatedTurn: currentTurn },
      transition: 'entered',
    };
  }

  return { transition: 'unchanged' };
}

function getScienceVictoryFocusObjective(progress: ScienceVictoryProgress): AIVictoryFocusObjective {
  return progress.hasAerospaceIndustries
    ? 'produceAerospaceParts'
    : 'foundAerospaceIndustries';
}

export interface VictoryFocusPriorityResult {
  readonly candidate: AIProductionCandidate;
  readonly strategicBonus: number;
}

/** Apply strategic importance without changing candidate eligibility or production rules. */
export function applyVictoryFocusProductionPriority(
  candidate: AIProductionCandidate,
  focus: AIVictoryFocusState | undefined,
  urgentOverride: boolean,
): VictoryFocusPriorityResult {
  if (!focus || urgentOverride || !isCurrentFocusObjective(candidate, focus.objective)) {
    return { candidate, strategicBonus: 0 };
  }

  const focusedScore = Math.max(candidate.baseScore, SCIENCE_VICTORY_FOCUS_PRODUCTION_SCORE);
  return {
    candidate: { ...candidate, baseScore: focusedScore },
    strategicBonus: focusedScore - candidate.baseScore,
  };
}

/**
 * Deterministic plan for actively executing a Science Victory once a nation is
 * in Science Victory Focus. Decides whether to found AeroSpace Industries or to
 * manufacture Aerospace Parts, using booleans derived from the canonical
 * requirement checks (passed in — never duplicated here). It never cancels an
 * in-progress build and yields to genuine emergencies.
 */
export type ScienceVictoryExecutionPlan =
  | { readonly kind: 'none' }
  | { readonly kind: 'foundAerospaceIndustries'; readonly cityId: string; readonly immediate: boolean }
  | { readonly kind: 'deferFounding'; readonly reason: string }
  | { readonly kind: 'produceAerospaceParts'; readonly cityIds: readonly string[]; readonly immediate: boolean };

export interface ScienceVictoryCorporationCity {
  readonly cityId: string;
  /** No current production — can be committed immediately, ahead of scoring. */
  readonly idle: boolean;
  /** Turns estimate for founding here; lower is preferred. */
  readonly turns: number;
}

export interface ScienceVictoryPartCity {
  readonly cityId: string;
  /** No current production — can begin a Part without reprioritizing a queue. */
  readonly idle: boolean;
  /** Turns estimate for manufacturing here; lower is preferred. */
  readonly turns: number;
}

export interface ScienceVictoryExecutionInput {
  readonly inScienceFocus: boolean;
  readonly hasAerospaceIndustries: boolean;
  /** Canonical corporationSystem.canFoundCorporation result for this nation. */
  readonly canFoundAerospaceIndustries: boolean;
  /** AeroSpace Industries already being produced or queued somewhere. */
  readonly aerospaceIndustriesInProduction: boolean;
  /** A genuine emergency is active (existential threat) — yield the queue jump. */
  readonly emergencyActive: boolean;
  readonly accumulatedParts: number;
  readonly inFlightParts: number;
  readonly requiredParts: number;
  /** Cities where canCityProduceCorporation(AeroSpace Industries) holds. */
  readonly corporationEligibleCities: readonly ScienceVictoryCorporationCity[];
  /** Cities where AerospacePartSystem.canCityProduce holds right now. */
  readonly partEligibleCities: readonly ScienceVictoryPartCity[];
}

export function planScienceVictoryProduction(
  input: ScienceVictoryExecutionInput,
): ScienceVictoryExecutionPlan {
  if (!input.inScienceFocus) return { kind: 'none' };
  if (input.accumulatedParts >= input.requiredParts) return { kind: 'none' };

  if (!input.hasAerospaceIndustries) {
    if (!input.canFoundAerospaceIndustries) return { kind: 'none' };
    if (input.aerospaceIndustriesInProduction) return { kind: 'none' }; // do not reshuffle
    const eligible = [...input.corporationEligibleCities]
      .sort((a, b) => a.turns - b.turns || a.cityId.localeCompare(b.cityId));
    if (eligible.length === 0) return { kind: 'none' };
    const idle = eligible.find((city) => city.idle);
    if (idle) return { kind: 'foundAerospaceIndustries', cityId: idle.cityId, immediate: true };
    if (input.emergencyActive) {
      return { kind: 'deferFounding', reason: 'all eligible cities busy while an emergency is active' };
    }
    return { kind: 'foundAerospaceIndustries', cityId: eligible[0].cityId, immediate: false };
  }

  const remaining = input.requiredParts - (input.accumulatedParts + input.inFlightParts);
  if (remaining <= 0) return { kind: 'none' };
  const idleCityIds = input.partEligibleCities
    .filter((city) => city.idle)
    .slice(0, remaining)
    .map((city) => city.cityId);
  if (idleCityIds.length > 0) {
    return { kind: 'produceAerospaceParts', cityIds: idleCityIds, immediate: true };
  }
  // A busy-city queue jump is a starvation escape hatch, not a way to stack a
  // fresh Part ahead of one that is already progressing elsewhere.
  if (input.inFlightParts > 0) return { kind: 'none' };
  const busy = input.partEligibleCities
    .filter((city) => !city.idle)
    .sort((a, b) => a.turns - b.turns || a.cityId.localeCompare(b.cityId))[0];
  if (!busy || input.emergencyActive) return { kind: 'none' };
  return { kind: 'produceAerospaceParts', cityIds: [busy.cityId], immediate: false };
}

function isCurrentFocusObjective(
  candidate: AIProductionCandidate,
  objective: AIVictoryFocusObjective,
): boolean {
  if (objective === 'foundAerospaceIndustries') {
    return candidate.item.kind === 'corporation'
      && candidate.item.corporationType.id === AEROSPACE_INDUSTRIES_ID;
  }
  return candidate.item.kind === 'manufacturedResource'
    && candidate.item.productionType.id === AEROSPACE_PARTS_ID;
}
