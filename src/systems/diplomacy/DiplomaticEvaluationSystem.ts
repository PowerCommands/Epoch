import type { DiplomacyManager } from '../DiplomacyManager';
import { getLeaderIdeologyByNationId } from '../../data/leaders';
import {
  describeIdeologyCompatibility,
  getIdeologyCompatibility,
} from '../../data/ideologyCompatibility';
import { suspicionSuppressesFriendly, suspicionAmplifiesHostile } from './suspicionEffects';
import type { CovertPersonality } from '../../types/covertPersonality';
import { getCovertPersonalityById } from '../../data/covertPersonalities';

/**
 * Coarse attitude label derived from memory values. Read-only — no decisions
 * happen here, only classification. AIDiplomacySystem turns these labels
 * into concrete actions.
 */
export type DiplomaticAttitude = 'neutral' | 'friendly' | 'hostile' | 'afraid';

// Thresholds picked to be reachable from realistic event sequences:
// e.g. one declared war + one captured city pushes hostility past 50,
// while sustained peace with multiple open-borders grants nudges trust
// past 70. Tune as more memory events are added.
export const HIGH_FEAR_THRESHOLD = 50;
export const HIGH_HOSTILITY_THRESHOLD = 50;
export const LOW_TRUST_THRESHOLD = 20;
export const HIGH_TRUST_THRESHOLD = 70;
export const HIGH_AFFINITY_THRESHOLD = 10;

export interface DiplomaticEvaluationResult {
  readonly attitude: DiplomaticAttitude;
  readonly trust: number;
  readonly fear: number;
  readonly hostility: number;
  readonly affinity: number;
  readonly ideologyCompatibility: number;
  readonly ideologyCompatibilityLabel: string;
  readonly sourceIdeologyName: string;
  readonly targetIdeologyName: string;
}

export class DiplomaticEvaluationSystem {
  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    /** Viewer's covert personality scales how strongly suspicion colours attitude. */
    private readonly getPersonality: (nationId: string) => CovertPersonality =
      () => getCovertPersonalityById(undefined),
  ) {}

  /**
   * Return the full passive evaluation for a directed relation. This includes
   * static leader ideology compatibility for diagnostics/future consumers, but
   * does not create diplomacy actions by itself.
   */
  evaluateRelation(viewerNationId: string, targetNationId: string): DiplomaticEvaluationResult {
    const relation = this.diplomacyManager.getRelation(viewerNationId, targetNationId);
    const pressure = this.diplomacyManager.getEconomicPressureDiplomaticModifier(viewerNationId, targetNationId);
    const sourceIdeology = getLeaderIdeologyByNationId(viewerNationId);
    const targetIdeology = getLeaderIdeologyByNationId(targetNationId);
    const ideologyCompatibility = getIdeologyCompatibility(sourceIdeology.id, targetIdeology.id);
    const ideologyCompatibilityLabel = describeIdeologyCompatibility(ideologyCompatibility);
    const memoryAttitude = this.evaluateMemoryAttitude(viewerNationId, targetNationId);
    const effectiveRelation = {
      ...relation,
      hostility: Math.min(100, relation.hostility + pressure.hostility),
      affinity: Math.max(-100, relation.affinity + pressure.affinity),
    };
    const attitude = applyIdeologyAttitudeNudge(memoryAttitude, effectiveRelation, ideologyCompatibility);

    return {
      attitude,
      trust: relation.trust,
      fear: relation.fear,
      hostility: effectiveRelation.hostility,
      affinity: effectiveRelation.affinity,
      ideologyCompatibility,
      ideologyCompatibilityLabel,
      sourceIdeologyName: sourceIdeology.name,
      targetIdeologyName: targetIdeology.name,
    };
  }

  /**
   * Classify how `viewerNationId` feels about `targetNationId` based on the
   * stored relation. Order matters: fear dominates, then hostility, then
   * warmth — anything else is neutral.
   *
   * Keep this memory-only for existing AI diplomacy callers. Use
   * evaluateRelation() when ideology-aware passive evaluation is needed.
   */
  evaluateAttitude(viewerNationId: string, targetNationId: string): DiplomaticAttitude {
    return this.evaluateMemoryAttitude(viewerNationId, targetNationId);
  }

  private evaluateMemoryAttitude(viewerNationId: string, targetNationId: string): DiplomaticAttitude {
    if (viewerNationId === targetNationId) return 'neutral';

    const relation = this.diplomacyManager.getRelation(viewerNationId, targetNationId);
    const pressure = this.diplomacyManager.getEconomicPressureDiplomaticModifier(viewerNationId, targetNationId);
    const hostility = Math.min(100, relation.hostility + pressure.hostility);
    const affinity = Math.max(-100, relation.affinity + pressure.affinity);
    // The viewer's covert personality scales how strongly suspicion colours its
    // attitude (a paranoid nation turns hostile on far less suspicion).
    const effectiveSuspicion = relation.suspicion * this.getPersonality(viewerNationId).suspicionToWar;

    if (relation.fear >= HIGH_FEAR_THRESHOLD) return 'afraid';
    if (
      hostility >= HIGH_HOSTILITY_THRESHOLD ||
      relation.trust <= LOW_TRUST_THRESHOLD ||
      // Suspicion amplifies pre-existing hostility into a hostile attitude (it
      // never flips attitude on its own — real hostility must already exist).
      suspicionAmplifiesHostile(effectiveSuspicion, hostility)
    ) {
      return 'hostile';
    }
    if (
      relation.trust >= HIGH_TRUST_THRESHOLD &&
      affinity >= HIGH_AFFINITY_THRESHOLD &&
      // A suspicious nation stays guarded (neutral) instead of friendly unless
      // trust is very high.
      !suspicionSuppressesFriendly(effectiveSuspicion, relation.trust)
    ) {
      return 'friendly';
    }
    return 'neutral';
  }
}

function applyIdeologyAttitudeNudge(
  attitude: DiplomaticAttitude,
  relation: {
    readonly trust: number;
    readonly fear: number;
    readonly hostility: number;
    readonly suspicion: number;
  },
  ideologyCompatibility: number,
): DiplomaticAttitude {
  if (attitude !== 'neutral') return attitude;

  if (ideologyCompatibility <= -30 && relation.hostility >= 25) {
    return 'hostile';
  }
  if (
    ideologyCompatibility >= 25 &&
    relation.trust >= 55 &&
    relation.hostility <= 20 &&
    relation.fear <= 30 &&
    // High suspicion keeps the relation guarded even when ideology aligns.
    !suspicionSuppressesFriendly(relation.suspicion, relation.trust)
  ) {
    return 'friendly';
  }
  return attitude;
}
