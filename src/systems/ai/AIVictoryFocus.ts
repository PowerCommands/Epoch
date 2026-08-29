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
