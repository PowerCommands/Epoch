import type { MilitaryComparison } from '../systems/ai/AIMilitaryEvaluationSystem';
import type { ThreatLevel } from '../systems/ai/AIMilitaryThreatEvaluationSystem';
import type { DiplomacyState } from '../systems/DiplomacyManager';
import type { DiplomaticAttitude } from '../systems/diplomacy/DiplomaticEvaluationSystem';

export type AIDiplomacyAction =
  | 'declareWar'
  | 'proposePeace'
  | 'openBorders'
  | 'cancelOpenBorders';

export type DiplomaticState = DiplomacyState;

export interface AIDiplomacyDecisionReason {
  readonly action: AIDiplomacyAction;
  readonly actorNationId: string;
  readonly targetNationId: string;

  readonly attitude: DiplomaticAttitude;
  readonly militaryComparison: MilitaryComparison;
  readonly threatLevel: ThreatLevel;

  readonly relationState: DiplomaticState;

  readonly trust: number;
  readonly fear: number;
  readonly hostility: number;
  readonly affinity: number;

  readonly reasonText: string;
}
