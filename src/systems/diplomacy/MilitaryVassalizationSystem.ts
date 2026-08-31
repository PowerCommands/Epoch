import type { DiplomacyManager } from '../DiplomacyManager';

/** Single authoritative signal for the initial AI succession rule. */
export const STRONG_ANTAGONIST_HOSTILITY_THRESHOLD = 70;

export type MilitaryVassalizationReason = 'capitulation' | 'capitalCapture';

export interface MilitaryVassalizationInput {
  readonly victorNationId: string;
  readonly defeatedNationId: string;
  readonly reason: MilitaryVassalizationReason;
  readonly capturedCapital?: { readonly cityId: string; readonly cityName: string };
}

export interface InheritedVassalDecisionRequest {
  readonly victorNationId: string;
  readonly defeatedHostNationId: string;
  readonly inheritedVassalNationId: string;
}

export interface MilitaryVassalizationEvent extends MilitaryVassalizationInput {
  readonly inheritedVassalIds: readonly string[];
}

export interface VassalSuccessionResolvedEvent extends InheritedVassalDecisionRequest {
  readonly decision: 'keep' | 'liberate';
  readonly decisionSource: 'humanChoice' | 'strongAntagonism' | 'notStronglyAntagonistic';
  readonly hostility: number;
}

export interface CapitalReturnedEvent {
  readonly victorNationId: string;
  readonly defeatedNationId: string;
  readonly cityId: string;
  readonly cityName: string;
}

export interface MilitaryVassalizationContext {
  readonly isHumanNation: (nationId: string) => boolean;
  readonly endWar: (nationAId: string, nationBId: string) => void;
  readonly separateAlliance?: (nationAId: string, nationBId: string) => void;
  readonly restoreCapital?: (cityId: string, defeatedNationId: string) => boolean;
  readonly requestHumanDecision?: (
    request: InheritedVassalDecisionRequest,
    resolve: (decision: 'keep' | 'liberate') => void,
  ) => void;
}

interface PendingSuccession extends InheritedVassalDecisionRequest {
  readonly hostility: number;
}

/**
 * Common military-defeat transition used by formal capitulation and capital
 * capture. It resolves a defeated host's direct vassals before committing the
 * new direct relationship, so nested vassalage can never be produced.
 */
export class MilitaryVassalizationSystem {
  private readonly vassalizedListeners: Array<(event: MilitaryVassalizationEvent) => void> = [];
  private readonly successionListeners: Array<(event: VassalSuccessionResolvedEvent) => void> = [];
  private readonly capitalReturnedListeners: Array<(event: CapitalReturnedEvent) => void> = [];
  private readonly completedListeners: Array<(event: MilitaryVassalizationEvent) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly context: MilitaryVassalizationContext,
  ) {}

  canVassalize(victorNationId: string, defeatedNationId: string): boolean {
    return victorNationId !== defeatedNationId && !this.diplomacyManager.isVassal(victorNationId);
  }

  vassalize(input: MilitaryVassalizationInput): boolean {
    if (!this.canVassalize(input.victorNationId, input.defeatedNationId)) return false;

    const inheritedVassalIds = this.diplomacyManager.getVassals(input.defeatedNationId);
    const succession: PendingSuccession[] = inheritedVassalIds.map((inheritedVassalNationId) => ({
      victorNationId: input.victorNationId,
      defeatedHostNationId: input.defeatedNationId,
      inheritedVassalNationId,
      // Snapshot before compulsory-war peace changes diplomatic memory.
      hostility: this.diplomacyManager
        .getRelation(input.victorNationId, inheritedVassalNationId).hostility,
    }));

    // Remove every old direct contract first. No relationship reset occurs yet:
    // each inherited nation is awaiting an explicit keep/liberate resolution.
    for (const inherited of succession) {
      this.diplomacyManager.terminateVassalage(
        input.defeatedNationId,
        inherited.inheritedVassalNationId,
      );
      this.context.endWar(input.victorNationId, inherited.inheritedVassalNationId);
    }

    // Defensive cleanup for a defeated nation that still had an older host.
    const oldHostId = this.diplomacyManager.getVassalHost(input.defeatedNationId);
    if (oldHostId) this.diplomacyManager.terminateVassalage(oldHostId, input.defeatedNationId);

    this.context.endWar(input.victorNationId, input.defeatedNationId);
    this.context.separateAlliance?.(input.victorNationId, input.defeatedNationId);
    if (!this.diplomacyManager.establishVassal(input.defeatedNationId, input.victorNationId)) return false;

    const event: MilitaryVassalizationEvent = { ...input, inheritedVassalIds };
    for (const listener of this.vassalizedListeners) listener(event);

    this.resolveSuccessionQueue(succession, 0, () => {
      this.finishCapitalReturn(input);
      for (const listener of this.completedListeners) listener(event);
    });
    return true;
  }

  onVassalized(listener: (event: MilitaryVassalizationEvent) => void): void {
    this.vassalizedListeners.push(listener);
  }

  onSuccessionResolved(listener: (event: VassalSuccessionResolvedEvent) => void): void {
    this.successionListeners.push(listener);
  }

  onCapitalReturned(listener: (event: CapitalReturnedEvent) => void): void {
    this.capitalReturnedListeners.push(listener);
  }

  /** Fires only after all succession choices and any capital return are resolved. */
  onCompleted(listener: (event: MilitaryVassalizationEvent) => void): void {
    this.completedListeners.push(listener);
  }

  private resolveSuccessionQueue(
    queue: readonly PendingSuccession[],
    index: number,
    done: () => void,
  ): void {
    const pending = queue[index];
    if (!pending) {
      done();
      return;
    }

    const resolve = (
      decision: 'keep' | 'liberate',
      decisionSource: VassalSuccessionResolvedEvent['decisionSource'],
    ): void => {
      this.applySuccessionDecision(pending, decision, decisionSource);
      this.resolveSuccessionQueue(queue, index + 1, done);
    };

    if (this.context.isHumanNation(pending.victorNationId)) {
      this.context.requestHumanDecision?.(pending, (decision) => resolve(decision, 'humanChoice'));
      return;
    }

    const keep = pending.hostility >= STRONG_ANTAGONIST_HOSTILITY_THRESHOLD;
    resolve(keep ? 'keep' : 'liberate', keep ? 'strongAntagonism' : 'notStronglyAntagonistic');
  }

  private applySuccessionDecision(
    pending: PendingSuccession,
    decision: 'keep' | 'liberate',
    decisionSource: VassalSuccessionResolvedEvent['decisionSource'],
  ): void {
    if (decision === 'keep') {
      this.context.separateAlliance?.(pending.victorNationId, pending.inheritedVassalNationId);
      this.diplomacyManager.establishVassal(
        pending.inheritedVassalNationId,
        pending.victorNationId,
      );
    } else {
      // Genuine liberation resets relations with the defeated former host, not
      // with the victor that caused the liberation.
      this.diplomacyManager.applyAmicableRelationshipReset(
        pending.inheritedVassalNationId,
        pending.defeatedHostNationId,
      );
    }
    const event: VassalSuccessionResolvedEvent = { ...pending, decision, decisionSource };
    for (const listener of this.successionListeners) listener(event);
  }

  private finishCapitalReturn(input: MilitaryVassalizationInput): void {
    if (!input.capturedCapital) return;
    if (!this.context.restoreCapital?.(input.capturedCapital.cityId, input.defeatedNationId)) return;
    const event: CapitalReturnedEvent = {
      victorNationId: input.victorNationId,
      defeatedNationId: input.defeatedNationId,
      cityId: input.capturedCapital.cityId,
      cityName: input.capturedCapital.cityName,
    };
    for (const listener of this.capitalReturnedListeners) listener(event);
  }
}
