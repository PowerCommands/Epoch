import { AIBehaviorProfile, DEFAULT_AI_PROFILE } from '../types/ai';

export interface NationConfig {
  id: string;
  name: string;
  color: number; // hex-färg, t.ex. 0xff4444
  isHuman?: boolean;
  aiProfile?: AIBehaviorProfile;
  researchedTechIds?: string[];
  currentResearchTechId?: string;
  researchProgress?: number;
  unlockedPolicyIds?: string[];
  currentPolicyId?: string;
  policyProgress?: number;
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
  isHuman: boolean;
  aiProfile: AIBehaviorProfile;
  researchedTechIds: string[];
  currentResearchTechId?: string;
  researchProgress: number;
  unlockedPolicyIds: string[];
  currentPolicyId?: string;
  policyProgress: number;

  constructor(config: NationConfig) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.isHuman = config.isHuman ?? false;
    this.aiProfile = { ...(config.aiProfile ?? DEFAULT_AI_PROFILE) };
    this.researchedTechIds = [...(config.researchedTechIds ?? [])];
    this.currentResearchTechId = config.currentResearchTechId;
    this.researchProgress = config.researchProgress ?? 0;
    this.unlockedPolicyIds = [...(config.unlockedPolicyIds ?? [])];
    this.currentPolicyId = config.currentPolicyId;
    this.policyProgress = config.policyProgress ?? 0;
  }
}
