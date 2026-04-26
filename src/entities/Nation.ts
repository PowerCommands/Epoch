import { BASELINE_AI_STRATEGY_ID } from '../data/aiStrategies';

export interface NationConfig {
  id: string;
  name: string;
  color: number; // hex-färg, t.ex. 0xff4444
  secondaryColor?: number;
  isHuman?: boolean;
  aiStrategyId?: string;
  researchedTechIds?: string[];
  currentResearchTechId?: string;
  researchProgress?: number;
  unlockedCultureNodeIds?: string[];
  currentCultureNodeId?: string;
  cultureProgress?: number;
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
  researchedTechIds: string[];
  currentResearchTechId?: string;
  researchProgress: number;
  unlockedCultureNodeIds: string[];
  currentCultureNodeId?: string;
  cultureProgress: number;

  constructor(config: NationConfig) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.secondaryColor = config.secondaryColor ?? config.color;
    this.isHuman = config.isHuman ?? false;
    this.aiStrategyId = config.aiStrategyId ?? BASELINE_AI_STRATEGY_ID;
    this.researchedTechIds = [...(config.researchedTechIds ?? [])];
    this.currentResearchTechId = config.currentResearchTechId;
    this.researchProgress = config.researchProgress ?? 0;
    this.unlockedCultureNodeIds = [...(config.unlockedCultureNodeIds ?? [])];
    this.currentCultureNodeId = config.currentCultureNodeId;
    this.cultureProgress = config.cultureProgress ?? 0;
  }
}
