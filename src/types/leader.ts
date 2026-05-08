import type { AILeaderPersonality } from './aiLeaderPersonality';
import type { AINationalAgendaId } from './aiNationalAgenda';

export interface LeaderDefinition {
  id: string;
  name: string;
  nationId: string;
  title?: string;
  image: string;
  description?: string;
  aiPersonality?: AILeaderPersonality;
  aiNationalAgendaId?: AINationalAgendaId;
  culturePriorities?: string[];
}
