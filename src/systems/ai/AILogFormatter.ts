import type { HappinessSystem } from '../HappinessSystem';
import type { NationManager } from '../NationManager';
import type { TurnManager } from '../TurnManager';
import type { EraSystem } from '../EraSystem';
import type { TimeSystem } from '../TimeSystem';

export type AILogFormatter = (nationId: string, message: string) => string;

interface AILogFormatterDeps {
  readonly nationManager: NationManager;
  readonly turnManager: TurnManager;
  readonly eraSystem: EraSystem;
  readonly happinessSystem: HappinessSystem;
  readonly timeSystem: TimeSystem;
}

export function createAILogFormatter(deps: AILogFormatterDeps): AILogFormatter {
  return function formatLog(nationId: string, message: string): string {
    const nation = deps.nationManager.getNation(nationId);
    const nationName = nation?.name ?? nationId;
    const era = deps.eraSystem.getNationEra(nationId);
    const gold = nation ? deps.nationManager.getResources(nationId).gold : 0;
    const happiness = deps.happinessSystem.getNetHappiness(nationId);
    const year = deps.timeSystem.getYearLabelForTurn(deps.turnManager.getCurrentRound(), era);
    return `[${year}] ${nationName} (era: ${era}, gold: ${gold}, happiness: ${happiness}) ${message}`;
  };
}
