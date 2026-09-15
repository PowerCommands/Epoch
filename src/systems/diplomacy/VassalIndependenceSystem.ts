import type { DiplomacyManager } from '../DiplomacyManager';

export const VASSAL_INDEPENDENCE_COST = 200_000;

export interface IndependenceEligibility {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hostNationId?: string;
}

export interface IndependencePurchasedEvent {
  readonly vassalNationId: string;
  readonly hostNationId: string;
  readonly goldTransferred: number;
  /** Affinity before the amicable reset applied on independence. */
  readonly previousAffinity: number;
  /** Affinity after the amicable reset (hostility and other negatives zeroed). */
  readonly affinity: number;
}

export interface VassalIndependenceEconomy {
  getGold(nationId: string): number;
  transferGold(fromNationId: string, toNationId: string, amount: number): boolean;
}

/** Shared authoritative purchase path for human and AI vassals. */
export class VassalIndependenceSystem {
  private readonly purchasedListeners: Array<(event: IndependencePurchasedEvent) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly economy: VassalIndependenceEconomy,
  ) {}

  canBuyIndependence(vassalNationId: string): IndependenceEligibility {
    const hostNationId = this.diplomacyManager.getVassalHost(vassalNationId);
    if (!hostNationId) return { ok: false, reason: 'This nation is not a vassal state.' };
    const gold = this.economy.getGold(vassalNationId);
    if (gold < VASSAL_INDEPENDENCE_COST) {
      return {
        ok: false,
        hostNationId,
        reason: `Requires ${VASSAL_INDEPENDENCE_COST.toLocaleString('en-US')} Gold.`,
      };
    }
    return { ok: true, hostNationId };
  }

  buyIndependence(vassalNationId: string): IndependencePurchasedEvent | null {
    const eligibility = this.canBuyIndependence(vassalNationId);
    const hostNationId = eligibility.hostNationId;
    if (!eligibility.ok || !hostNationId) return null;
    if (!this.economy.transferGold(vassalNationId, hostNationId, VASSAL_INDEPENDENCE_COST)) return null;
    if (!this.diplomacyManager.terminateVassalage(hostNationId, vassalNationId)) {
      // The relationship changed between validation and commit: undo the transfer.
      this.economy.transferGold(hostNationId, vassalNationId, VASSAL_INDEPENDENCE_COST);
      return null;
    }
    // Reconcile relations, then establish the directional purchased settlement.
    const reset = this.diplomacyManager.applyAmicableRelationshipReset(
      hostNationId,
      vassalNationId,
      { stampPeaceTreaty: false },
    );
    this.diplomacyManager.recognizePurchasedIndependence(vassalNationId, hostNationId);
    const event = {
      vassalNationId,
      hostNationId,
      goldTransferred: VASSAL_INDEPENDENCE_COST,
      previousAffinity: reset.previousAffinity,
      affinity: reset.affinity,
    };
    for (const listener of this.purchasedListeners) listener(event);
    return event;
  }

  onPurchased(listener: (event: IndependencePurchasedEvent) => void): void {
    this.purchasedListeners.push(listener);
  }
}
