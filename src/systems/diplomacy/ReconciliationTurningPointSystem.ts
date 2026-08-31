import type { DiplomacyManager, DiplomacyRelation } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';

/** First calendar year in which Reconciliation may be attempted. */
export const RECONCILIATION_TRIGGER_YEAR = 1800;
/** Failed attempts are retried on this exact round cadence. */
export const RECONCILIATION_RETRY_ROUNDS = 10;

const POOR_RELATION_SCORE_THRESHOLD = 50;

export interface SavedReconciliationTurningPointState {
  occurred: boolean;
  /** Null until 1800 is reached, and after the event has occurred. */
  nextAttemptRound: number | null;
}

export interface ReconciliationTurningPointContext {
  readonly nationManager: NationManager;
  readonly diplomacyManager: DiplomacyManager;
  readonly getGlobalYear: () => number;
  readonly getCurrentRound: () => number;
  readonly isNationLiving: (nationId: string) => boolean;
  /** True for either a jealous nation or the target of an active agenda. */
  readonly isCulturalJealousyParticipant: (nationId: string) => boolean;
  readonly getNationName: (nationId: string) => string;
  readonly log?: (message: string) => void;
  readonly recordHistory?: (firstNationId: string, secondNationId: string) => void;
}

/**
 * One-shot Diplomatic Turning Point: trigger -> choose a pair -> reset memory -> finish.
 * It deliberately owns no post-event agenda, modifier, cooldown, or protection.
 */
export class ReconciliationTurningPointSystem {
  private occurred = false;
  private nextAttemptRound: number | null = null;

  constructor(private readonly context: ReconciliationTurningPointContext) {}

  handleRoundStart(round = this.context.getCurrentRound()): void {
    if (this.occurred || this.context.getGlobalYear() < RECONCILIATION_TRIGGER_YEAR) return;
    if (this.nextAttemptRound !== null && round < this.nextAttemptRound) return;

    const pair = this.findCandidatePair();
    if (!pair) {
      this.nextAttemptRound = round + RECONCILIATION_RETRY_ROUNDS;
      this.context.log?.(
        `[TurningPoint:Reconciliation] No valid candidates. Next attempt in ${RECONCILIATION_RETRY_ROUNDS} turns.`,
      );
      return;
    }

    this.applyReconciliation(pair[0], pair[1]);
  }

  serialize(): SavedReconciliationTurningPointState {
    return {
      occurred: this.occurred,
      nextAttemptRound: this.nextAttemptRound,
    };
  }

  restore(saved: SavedReconciliationTurningPointState | undefined): void {
    this.occurred = saved?.occurred === true;
    this.nextAttemptRound = this.occurred
      ? null
      : Number.isInteger(saved?.nextAttemptRound) && (saved?.nextAttemptRound ?? -1) >= 0
        ? saved!.nextAttemptRound
        : null;
  }

  private findCandidatePair(): [string, string] | undefined {
    const candidates = this.context.nationManager.getAllNations()
      .filter((nation) => !nation.isHuman)
      .filter((nation) => this.context.isNationLiving(nation.id))
      .filter((nation) => !this.context.isCulturalJealousyParticipant(nation.id))
      .map((nation) => nation.id)
      .sort((a, b) => a.localeCompare(b));

    for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
        const firstId = candidates[firstIndex];
        const secondId = candidates[secondIndex];
        if (!firstId || !secondId) continue;
        if (this.context.diplomacyManager.getState(firstId, secondId) === 'WAR') continue;
        if (!isMeaningfullyPoorRelationship(this.context.diplomacyManager.getRelation(firstId, secondId))) continue;
        return [firstId, secondId];
      }
    }
    return undefined;
  }

  private applyReconciliation(firstId: string, secondId: string): void {
    const reset = this.context.diplomacyManager.applyAmicableRelationshipReset(firstId, secondId);

    // Mark complete before callbacks so re-entrant save/log activity cannot duplicate it.
    this.occurred = true;
    this.nextAttemptRound = null;
    const firstName = this.context.getNationName(firstId);
    const secondName = this.context.getNationName(secondId);
    this.context.log?.(
      `[TurningPoint:Reconciliation] ${firstName} and ${secondName} reconcile. `
      + `trust→0, fear→0, suspicion→0, hostility→0, affinity ${reset.previousAffinity}→${reset.affinity}.`,
    );
    this.context.recordHistory?.(firstId, secondId);
  }
}

/** A compact tension score keeps neutral defaults out while accepting clearly damaged relations. */
export function isMeaningfullyPoorRelationship(relation: DiplomacyRelation): boolean {
  const lostTrust = Math.max(0, 50 - relation.trust);
  const negativeAffinity = Math.max(0, -relation.affinity);
  return lostTrust + relation.hostility + relation.suspicion + negativeAffinity
    >= POOR_RELATION_SCORE_THRESHOLD;
}
