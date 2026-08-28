import { BASELINE_AI_STRATEGY_ID } from '../data/aiStrategies';
import { BALANCED_AGENDA_ID } from '../data/aiNationalAgendas';
import type { AIGoal } from '../types/ai/AIGoal';
import type { AINationalAgendaId } from '../types/aiNationalAgenda';
import type { CovertPersonalityId } from '../types/covertPersonality';
import { DEFAULT_COVERT_PERSONALITY_ID } from '../data/covertPersonalities';
import type { OverseasSettlementTarget } from '../types/ai/OverseasSettlementTarget';

export interface NationConfig {
  id: string;
  name: string;
  color: number; // hex-färg, t.ex. 0xff4444
  secondaryColor?: number;
  isHuman?: boolean;
  aiStrategyId?: string;
  aiStrategyStartedTurn?: number;
  previousAiStrategyId?: string;
  aiNationalAgendaId?: AINationalAgendaId;
  covertPersonalityId?: CovertPersonalityId;
  researchedTechIds?: string[];
  currentResearchTechId?: string;
  researchProgress?: number;
  unlockedCultureNodeIds?: string[];
  currentCultureNodeId?: string;
  cultureProgress?: number;
  settlersProduced?: number;
}

/**
 * Nation representerar en spelbar (eller AI-styrd) nation i spelet.
 *
 * Avsiktligt fri från Phaser-beroenden — ren data som kan serialiseras,
 * testas och i framtiden skickas över nätverket.
 */
export class Nation {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly secondaryColor: number;
  isHuman: boolean;
  aiStrategyId: string;
  aiStrategyStartedTurn: number;
  previousAiStrategyId?: string;
  aiPrimaryStrategyId?: string;
  aiSecondaryStrategyId?: string;
  aiNationalAgendaId: AINationalAgendaId;
  /** Covert-warfare identity layer (how the nation pursues goals covertly). */
  covertPersonalityId: CovertPersonalityId;
  researchedTechIds: string[];
  currentResearchTechId?: string;
  researchProgress: number;
  unlockedCultureNodeIds: string[];
  currentCultureNodeId?: string;
  cultureProgress: number;
  /** Historical Settlers completed through city production. */
  settlersProduced: number;
  aiGoals?: AIGoal[];
  knownIslandTargets?: OverseasSettlementTarget[];
  handledOverseasRegionNames?: string[];

  constructor(config: NationConfig) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.secondaryColor = config.secondaryColor ?? config.color;
    this.isHuman = config.isHuman ?? false;
    this.aiStrategyId = config.aiStrategyId ?? BASELINE_AI_STRATEGY_ID;
    this.aiStrategyStartedTurn = config.aiStrategyStartedTurn ?? 0;
    this.previousAiStrategyId = config.previousAiStrategyId;
    this.aiNationalAgendaId = config.aiNationalAgendaId ?? BALANCED_AGENDA_ID;
    this.covertPersonalityId = config.covertPersonalityId ?? DEFAULT_COVERT_PERSONALITY_ID;
    this.researchedTechIds = [...(config.researchedTechIds ?? [])];
    this.currentResearchTechId = config.currentResearchTechId;
    this.researchProgress = config.researchProgress ?? 0;
    this.unlockedCultureNodeIds = [...(config.unlockedCultureNodeIds ?? [])];
    this.currentCultureNodeId = config.currentCultureNodeId;
    this.cultureProgress = config.cultureProgress ?? 0;
    this.settlersProduced = Math.max(0, Math.floor(config.settlersProduced ?? 0));
  }
}
