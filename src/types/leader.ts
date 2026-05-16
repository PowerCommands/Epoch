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
}
