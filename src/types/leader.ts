import type { AILeaderPersonality } from './aiLeaderPersonality';

export interface LeaderDefinition {
  id: string;
  name: string;
  nationId: string;
  title?: string;
  image: string;
  description?: string;
  aiPersonality?: AILeaderPersonality;
  culturePriorities?: string[];
}
