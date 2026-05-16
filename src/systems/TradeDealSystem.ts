import type { TradeDeal, TradeDealEndReason, TradeDealResult } from '../types/tradeDeal';
import type { DiplomacyManager } from './DiplomacyManager';

export interface CreateTradeDealInput {
  readonly sellerNationId: string;
  readonly buyerNationId: string;
  readonly resourceId: string;
  readonly turns: number;
  readonly goldPerTurn: number;
}

export interface TradeDealEvent {
  readonly deal: TradeDeal;
  readonly reason?: TradeDealEndReason;
}

export interface TradeDealSystemGoldAccess {
  getGold(nationId: string): number;
  addGold(nationId: string, amount: number): void;
}

export type TradeDealCanExportResource = (sellerNationId: string, resourceId: string) => boolean;

type TradeDealListener = (event: TradeDealEvent) => void;

export class TradeDealSystem {
  private readonly deals = new Map<string, TradeDeal>();
  private nextDealNumber = 1;
  private canExportResource: TradeDealCanExportResource = () => false;

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly getCurrentTurn: () => number,
    private readonly goldAccess: TradeDealSystemGoldAccess,
    private readonly nationExists: (nationId: string) => boolean = () => true,
  ) {}

  setCanExportResource(canExport: TradeDealCanExportResource): void {
    this.canExportResource = canExport;
  }

  createDeal(input: CreateTradeDealInput): TradeDealResult {
    const validation = this.validateDeal(input);
    if (!validation.ok) return validation;

    const deal: TradeDeal = {
      id: `trade_deal_${this.nextDealNumber++}`,
      sellerNationId: input.sellerNationId,
      buyerNationId: input.buyerNationId,
      resourceId: input.resourceId,
      goldPerTurn: input.goldPerTurn,
      startTurn: this.getCurrentTurn(),
      remainingTurns: input.turns,
    };
    this.deals.set(deal.id, deal);
    this.emit(this.createdListeners, { deal: this.copyDeal(deal) });
    this.emit(this.changedListeners, { deal: this.copyDeal(deal) });
    return { ok: true, deal: this.copyDeal(deal) };
  }

  advanceTurnForNation(nationId: string): void {
    for (const deal of Array.from(this.deals.values())) {
      if (deal.buyerNationId !== nationId) continue;

      if (this.goldAccess.getGold(deal.buyerNationId) < deal.goldPerTurn) {
        this.cancelDeal(deal.id, 'buyer_cannot_pay');
        continue;
      }

      this.goldAccess.addGold(deal.buyerNationId, -deal.goldPerTurn);
      this.goldAccess.addGold(deal.sellerNationId, deal.goldPerTurn);
      deal.remainingTurns -= 1;

      if (deal.remainingTurns <= 0) {
        this.expireDeal(deal);
      }
    }
  }

  cancelDealsBetween(nationAId: string, nationBId: string, reason: TradeDealEndReason): void {
    for (const deal of Array.from(this.deals.values())) {
      if (!this.isDealBetween(deal, nationAId, nationBId)) continue;
      this.deals.delete(deal.id);
      this.emitCancelled(deal, reason);
    }
  }

  cancelDealsForNation(nationId: string, reason: TradeDealEndReason): number {
    let cancelled = 0;
    for (const deal of Array.from(this.deals.values())) {
      if (deal.sellerNationId !== nationId && deal.buyerNationId !== nationId) continue;
      this.deals.delete(deal.id);
      this.emitCancelled(deal, reason);
      cancelled++;
    }
    return cancelled;
  }

  getAllDeals(): readonly TradeDeal[] {
    return Array.from(this.deals.values()).map((deal) => this.copyDeal(deal));
  }

  getDealsForNation(nationId: string): TradeDeal[] {
    return Array.from(this.deals.values())
      .filter((deal) => deal.sellerNationId === nationId || deal.buyerNationId === nationId)
      .map((deal) => this.copyDeal(deal));
  }

  getGoldPerTurnDeltaForNation(nationId: string): number {
    return Array.from(this.deals.values()).reduce((sum, deal) => {
      if (deal.sellerNationId === nationId) return sum + deal.goldPerTurn;
      if (deal.buyerNationId === nationId) return sum - deal.goldPerTurn;
      return sum;
    }, 0);
  }

  getDealsBetween(nationAId: string, nationBId: string): TradeDeal[] {
    return Array.from(this.deals.values())
      .filter((deal) => this.isDealBetween(deal, nationAId, nationBId))
      .map((deal) => this.copyDeal(deal));
  }

  restoreDeals(deals: readonly TradeDeal[] | undefined): void {
    this.deals.clear();
    let highestNumericSuffix = 0;
    for (const deal of deals ?? []) {
      if (!this.isRestorableDeal(deal)) continue;
      this.deals.set(deal.id, this.copyDeal(deal));
      const match = /^trade_deal_(\d+)$/.exec(deal.id);
      if (match) highestNumericSuffix = Math.max(highestNumericSuffix, Number(match[1]));
    }
    this.nextDealNumber = highestNumericSuffix + 1;
  }

  onDealCreated(listener: TradeDealListener): void {
    this.createdListeners.push(listener);
  }

  onDealExpired(listener: TradeDealListener): void {
    this.expiredListeners.push(listener);
  }

  onDealCancelled(listener: TradeDealListener): void {
    this.cancelledListeners.push(listener);
  }

  onChanged(listener: TradeDealListener): void {
    this.changedListeners.push(listener);
  }

  private readonly createdListeners: TradeDealListener[] = [];
  private readonly expiredListeners: TradeDealListener[] = [];
  private readonly cancelledListeners: TradeDealListener[] = [];
  private readonly changedListeners: TradeDealListener[] = [];

  private validateDeal(input: CreateTradeDealInput): TradeDealResult {
    if (input.sellerNationId === input.buyerNationId) {
      return { ok: false, reason: 'Seller and buyer must be different nations.' };
    }
    if (!this.nationExists(input.sellerNationId)) return { ok: false, reason: 'Seller nation does not exist.' };
    if (!this.nationExists(input.buyerNationId)) return { ok: false, reason: 'Buyer nation does not exist.' };
    if (!Number.isInteger(input.turns) || input.turns <= 0) {
      return { ok: false, reason: 'Trade deal turns must be greater than 0.' };
    }
    if (!Number.isInteger(input.goldPerTurn) || input.goldPerTurn < 0) {
      return { ok: false, reason: 'Trade deal gold per turn must be 0 or greater.' };
    }
    if (this.diplomacyManager.getState(input.sellerNationId, input.buyerNationId) === 'WAR') {
      return { ok: false, reason: 'Cannot create a trade deal while nations are at war.' };
    }
    if (!this.diplomacyManager.hasTradeRelations(input.sellerNationId, input.buyerNationId)) {
      return { ok: false, reason: 'Active Trade Relations are required.' };
    }
    if (!this.canExportResource(input.sellerNationId, input.resourceId)) {
      return { ok: false, reason: 'Seller does not currently have access to that resource.' };
    }
    const alreadyImportingFromSeller = Array.from(this.deals.values()).some((deal) =>
      deal.sellerNationId === input.sellerNationId &&
      deal.buyerNationId === input.buyerNationId &&
      deal.resourceId === input.resourceId
    );
    if (alreadyImportingFromSeller) {
      return { ok: false, reason: 'Buyer is already importing that resource from this seller.' };
    }
    return { ok: true };
  }

  private cancelDeal(dealId: string, reason: TradeDealEndReason): void {
    const deal = this.deals.get(dealId);
    if (!deal) return;
    this.deals.delete(dealId);
    this.emitCancelled(deal, reason);
  }

  private expireDeal(deal: TradeDeal): void {
    this.deals.delete(deal.id);
    const event = { deal: this.copyDeal(deal), reason: 'expired' as const };
    this.emit(this.expiredListeners, event);
    this.emit(this.changedListeners, event);
  }

  private emitCancelled(deal: TradeDeal, reason: TradeDealEndReason): void {
    const event = { deal: this.copyDeal(deal), reason };
    this.emit(this.cancelledListeners, event);
    this.emit(this.changedListeners, event);
  }

  private isDealBetween(deal: TradeDeal, nationAId: string, nationBId: string): boolean {
    return (
      (deal.sellerNationId === nationAId && deal.buyerNationId === nationBId) ||
      (deal.sellerNationId === nationBId && deal.buyerNationId === nationAId)
    );
  }

  private copyDeal(deal: TradeDeal): TradeDeal {
    return { ...deal };
  }

  private isRestorableDeal(deal: TradeDeal): boolean {
    return (
      deal.sellerNationId !== deal.buyerNationId &&
      deal.id.length > 0 &&
      deal.resourceId.length > 0 &&
      Number.isInteger(deal.startTurn) &&
      Number.isInteger(deal.remainingTurns) &&
      deal.remainingTurns > 0 &&
      Number.isInteger(deal.goldPerTurn) &&
      deal.goldPerTurn >= 0
    );
  }

  private emit(listeners: TradeDealListener[], event: TradeDealEvent): void {
    for (const listener of listeners) listener(event);
  }
}
