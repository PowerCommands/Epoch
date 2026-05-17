import type { EraSystem } from './EraSystem';
import type { EventLogSystem } from './EventLogSystem';
import type { HappinessSystem } from './HappinessSystem';
import type { NationManager } from './NationManager';
import type { TurnManager } from './TurnManager';

export interface LogParams {
  /** Nation that owns the event — drives full nation-status prefix. */
  nationId?: string;
  /** Visibility filter nations. Defaults to [nationId] or [] if nationId absent. */
  nationIds?: string[];
  category: string;
  message: string;
}

interface LogManagerDeps {
  readonly turnManager: TurnManager;
  readonly nationManager: NationManager;
  readonly eraSystem: EraSystem;
  readonly happinessSystem: HappinessSystem;
  readonly eventLog: EventLogSystem;
}

/**
 * LogManager — single authority for formatting gameplay event log entries.
 *
 * Nation-specific format:
 *   [r40] [2530 BC] England (era: ancient, gold: 130, happiness: 11) message
 *
 * Global format:
 *   [r40] message
 *
 * Callers supply only the raw message and optional nationId/nationIds.
 * Round, year, nation status, and delimiters are added here.
 */
export class LogManager {
  constructor(private readonly deps: LogManagerDeps) {}

  info(params: LogParams): void {
    const round = this.deps.turnManager.getCurrentRound();
    const year = this.deps.turnManager.getGlobalYearLabel();
    let text: string;
    let nationIds: string[];

    if (params.nationId) {
      const nation = this.deps.nationManager.getNation(params.nationId);
      const nationName = nation?.name ?? params.nationId;
      const era = this.deps.eraSystem.getNationEra(params.nationId);
      const gold = nation ? Math.floor(this.deps.nationManager.getResources(params.nationId).gold) : 0;
      const happiness = this.deps.happinessSystem.getNetHappiness(params.nationId);
      text = `[r${round}] [${year}] ${nationName} (era: ${era}, gold: ${gold}, happiness: ${happiness}) ${params.message}`;
      nationIds = params.nationIds ?? [params.nationId];
    } else {
      text = `[r${round}] ${params.message}`;
      nationIds = params.nationIds ?? [];
    }

    this.deps.eventLog.log(text, nationIds, round);
  }
}
