import type { AINationalAgendaId } from './aiNationalAgenda';
import type { AILeaderPersonality } from './aiLeaderPersonality';
import type { MilitaryComparison } from '../systems/ai/AIMilitaryEvaluationSystem';
import type { ThreatLevel } from '../systems/ai/AIMilitaryThreatEvaluationSystem';

export type WarDeclarationReason = 'conquest' | 'hostility' | 'threat' | 'ideological' | 'ambition';

export type WarDeclarationPhrases = Readonly<Record<WarDeclarationReason, readonly [string, string]>>;

/** Snapshot of information already present when the AI commits to war. */
export interface WarDeclarationReasonContext {
  readonly militaryComparison: MilitaryComparison;
  readonly threatLevel: ThreatLevel;
  readonly trust: number;
  readonly fear: number;
  readonly hostility: number;
  readonly affinity: number;
  readonly suspicion: number;
  readonly ideologyCompatibility: number;
  readonly personality: AILeaderPersonality;
  readonly nationalAgendaId?: AINationalAgendaId;
}
