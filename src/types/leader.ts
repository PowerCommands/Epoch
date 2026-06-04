import type { AILeaderPersonality } from './aiLeaderPersonality';
import type { AINationalAgendaId } from './aiNationalAgenda';
import type { IdeologyId } from './ideology';

export interface LeaderDefinition {
  id: string;
  name: string;
  nationId: string;
  title?: string;
  image: string;
  description?: string;
  readonly ideologyId?: IdeologyId;
  aiPersonality?: AILeaderPersonality;
  aiNationalAgendaId?: AINationalAgendaId;
  aiMilitaryDoctrineId?: string;
  culturePriorities?: string[];
  /**
   * Maximum number of cities this leader will voluntarily aim for. Caps
   * AI settler production and expansion (see AISystem / AIOverseasExpansionSystem).
   * Cities gained by conquest, treaty, gift, or events are unaffected. Absent =
   * no leader-specific cap (strategy desiredCityCount applies as usual). A value
   * of 1 produces the "one-city challenge" behaviour (e.g. Mad Jack).
   */
  maxPreferredCities?: number;
}
