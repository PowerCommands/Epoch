export const AI_SPACE_RACE_FACTORY_BASE_SCORE = 60;
export const AI_SPACE_RACE_FIRST_FACTORY_BONUS = 200;

export interface AISpaceRaceFactoryPriorityContext {
  readonly scienceVictoryEnabled: boolean;
  readonly spaceRaceGloballyUnlocked: boolean;
  readonly hasFlight: boolean;
  readonly hasAluminum: boolean;
  readonly activeFactoryCount: number;
  readonly queuedFactoryCount: number;
}

export interface AISpaceRaceFactoryPriority {
  readonly applies: boolean;
  readonly baseScore: number;
  readonly scienceVictoryBonus: number;
  readonly resultingScore: number;
}

/**
 * Public space-race reaction based only on the global corporation unlock and
 * the evaluating nation's own prerequisites. Rival part totals deliberately
 * do not participate in this decision.
 */
export function getAISpaceRaceFactoryPriority(
  context: AISpaceRaceFactoryPriorityContext,
): AISpaceRaceFactoryPriority {
  const applies = context.scienceVictoryEnabled
    && context.spaceRaceGloballyUnlocked
    && context.hasFlight
    && context.hasAluminum
    && context.activeFactoryCount === 0
    && context.queuedFactoryCount === 0;
  const scienceVictoryBonus = applies ? AI_SPACE_RACE_FIRST_FACTORY_BONUS : 0;
  return {
    applies,
    baseScore: AI_SPACE_RACE_FACTORY_BASE_SCORE,
    scienceVictoryBonus,
    resultingScore: AI_SPACE_RACE_FACTORY_BASE_SCORE + scienceVictoryBonus,
  };
}
