import { DEFAULT_AI_LEADER_PERSONALITY } from '../types/aiLeaderPersonality';
import type { LeaderDefinition } from '../types/leader';
import type { AILeaderPersonality } from '../types/aiLeaderPersonality';
import type { AINationalAgenda } from '../types/aiNationalAgenda';
import type { AIMilitaryDoctrine } from '../types/aiMilitaryDoctrine';
import type { CovertPersonality } from '../types/covertPersonality';
import type { IdeologyDefinition } from '../types/ideology';
import type { AIStrategy } from '../types/aiStrategy';
import type { AIStrategyBehaviorWeights } from '../types/aiStrategyBehavior';
import type { AILeaderEraStrategy, LeaderEraStrategyProfile } from '../types/aiLeaderEraStrategy';
import type { WarDeclarationPhrases } from '../types/warDeclaration';

export type LeaderOverride = Partial<Omit<LeaderDefinition, 'id' | 'nationId' | 'isDefault' | 'aiPersonality' | 'maxPreferredCities'>> & {
  aiPersonality?: Partial<AILeaderPersonality>;
  /** null explicitly removes a built-in city cap; absent inherits it. */
  maxPreferredCities?: number | null;
};
export interface BehavioralProfiles {
  agendas: AINationalAgenda;
  doctrines: AIMilitaryDoctrine;
  covert: CovertPersonality;
  ideologies: IdeologyDefinition;
  strategies: AIStrategy;
  eraStrategies: AILeaderEraStrategy;
}
/** Sparse leader patches; shared profile entries are complete scenario-local definitions. */
export interface LeaderConfiguration {
  version: 1;
  leaders?: Record<string, LeaderOverride>;
  profiles?: { [K in keyof BehavioralProfiles]?: BehavioralProfiles[K][] };
  eraAssignments?: Record<string, LeaderEraStrategyProfile['strategiesByEra']>;
  behaviorWeights?: Record<string, AIStrategyBehaviorWeights>;
  warDeclarations?: Record<string, WarDeclarationPhrases>;
}
let active: LeaderConfiguration = { version: 1 };
export function setLeaderConfiguration(configuration?: LeaderConfiguration): void {
  active = configuration ? JSON.parse(JSON.stringify(configuration)) : { version: 1 };
}
export function getLeaderConfiguration(): LeaderConfiguration { return active; }
export function profileOverride<K extends keyof BehavioralProfiles>(kind: K, id: string | undefined): BehavioralProfiles[K] | undefined {
  return active.profiles?.[kind]?.find(profile => profile.id === id) as BehavioralProfiles[K] | undefined;
}
export function applyBehaviorOverride(leader: LeaderDefinition): LeaderDefinition {
  const patch = active.leaders?.[leader.id];
  if (!patch) return leader;
  return { ...leader, ...patch, id: leader.id, nationId: leader.nationId, isDefault: leader.isDefault,
    maxPreferredCities: patch.maxPreferredCities === null ? undefined : patch.maxPreferredCities ?? leader.maxPreferredCities,
    diplomacyFlavor: patch.diplomacyFlavor ? { ...leader.diplomacyFlavor, ...patch.diplomacyFlavor } : leader.diplomacyFlavor,
    aiPersonality: patch.aiPersonality ? { ...DEFAULT_AI_LEADER_PERSONALITY, ...leader.aiPersonality, ...patch.aiPersonality } as AILeaderPersonality : leader.aiPersonality };
}
