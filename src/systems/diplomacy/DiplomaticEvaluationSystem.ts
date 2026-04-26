import type { DiplomacyManager } from '../DiplomacyManager';

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

export class DiplomaticEvaluationSystem {
  constructor(private readonly diplomacyManager: DiplomacyManager) {}

  /**
   * Classify how `viewerNationId` feels about `targetNationId` based on the
   * stored relation. Order matters: fear dominates, then hostility, then
   * warmth — anything else is neutral.
   */
  evaluateAttitude(viewerNationId: string, targetNationId: string): DiplomaticAttitude {
    if (viewerNationId === targetNationId) return 'neutral';

    const relation = this.diplomacyManager.getRelation(viewerNationId, targetNationId);

    if (relation.fear >= HIGH_FEAR_THRESHOLD) return 'afraid';
    if (
      relation.hostility >= HIGH_HOSTILITY_THRESHOLD ||
      relation.trust <= LOW_TRUST_THRESHOLD
    ) {
      return 'hostile';
    }
    if (
      relation.trust >= HIGH_TRUST_THRESHOLD &&
      relation.affinity >= HIGH_AFFINITY_THRESHOLD
    ) {
      return 'friendly';
    }
    return 'neutral';
  }
}
