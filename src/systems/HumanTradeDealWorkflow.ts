import type { City } from '../entities/City';
import type { PendingTradeDeal } from '../types/tradeDeal';
import type { Producible } from '../types/producible';
import type { CityManager } from './CityManager';
import type { ProductionSystem } from './ProductionSystem';
import type { CreateTradeDealInput, TradeDealSystem } from './TradeDealSystem';
import type { TradeConnectionSystem } from './TradeConnectionSystem';

export interface StartHumanTradeDealInput extends CreateTradeDealInput {
  /** Optional explicit endpoints for the future Trading UI. */
  readonly sellerCityId?: string;
  readonly buyerCityId?: string;
}

export type StartHumanTradeDealResult =
  | { ok: true; status: 'active'; dealId: string; routeId?: string }
  | { ok: true; status: 'pending'; pendingDealId: string; routeId: string }
  | { ok: false; reason: string };

export type HumanExportDestinationEvaluation =
  | { ok: true; sellerCityId?: string; buyerCityId: string }
  | { ok: false; reason: string };

export interface PendingTradeDealEvent {
  readonly pendingDeal: PendingTradeDeal;
  readonly outcome: 'activated' | 'failed' | 'cancelled';
  readonly reason?: string;
  readonly activeDealId?: string;
}

type PendingListener = (event: PendingTradeDealEvent) => void;

/**
 * Coordinates a human-requested deal with the existing route and active-deal
 * systems. Pending requests are intentionally not TradeDeals yet: they reserve
 * neither resources nor deal capacity, and their duration cannot count down.
 */
export class HumanTradeDealWorkflow {
  private readonly pendingDeals = new Map<string, PendingTradeDeal>();
  private readonly pendingListeners: PendingListener[] = [];
  private nextPendingDealNumber = 1;

  constructor(
    private readonly humanNationId: string,
    private readonly cityManager: CityManager,
    private readonly tradeConnectionSystem: TradeConnectionSystem,
    private readonly productionSystem: ProductionSystem,
    private readonly tradeDealSystem: TradeDealSystem,
    private readonly getCurrentTurn: () => number,
    private readonly log?: (message: string, nationIds: readonly string[]) => void,
  ) {
    tradeConnectionSystem.onConnectionActivated((connection) => {
      this.activatePendingDealsForRoute(connection.id);
    });
    tradeConnectionSystem.onConnectionCancelled((connection) => {
      this.cancelPendingDealsForRoute(connection.id, 'The establishing trade route was cancelled.');
    });
  }

  startExport(input: StartHumanTradeDealInput): StartHumanTradeDealResult {
    if (input.sellerNationId !== this.humanNationId) {
      return { ok: false, reason: 'Only exports initiated by the human player use automatic route creation.' };
    }

    const preliminary = this.tradeDealSystem.validateDeal(input, false);
    if (!preliminary.ok) return { ok: false, reason: preliminary.reason ?? 'Trade deal is invalid.' };
    const endpointValidation = this.validateExplicitEndpoints(input);
    if (!endpointValidation.ok) return endpointValidation;
    if (this.hasMatchingPendingDeal(input)) {
      return { ok: false, reason: 'That resource deal is already waiting for a trade route.' };
    }

    // Preserve every existing capacity rule: if the normal deal system accepts
    // this now, no new route or pending state is needed.
    const immediate = this.tradeDealSystem.createDeal(input);
    if (immediate.ok && immediate.deal) {
      const route = this.tradeConnectionSystem
        .getActiveConnectionsBetweenNations(input.sellerNationId, input.buyerNationId)[0];
      this.log?.(
        route
          ? `Existing trade route ${route.id} reused; trade deal ${immediate.deal.id} started.`
          : `Existing trade capacity reused; trade deal ${immediate.deal.id} started.`,
        [input.sellerNationId, input.buyerNationId],
      );
      return { ok: true, status: 'active', dealId: immediate.deal.id, routeId: route?.id };
    }
    if (immediate.reason !== 'No active trade route with available capacity.') {
      return { ok: false, reason: immediate.reason ?? 'Trade deal could not be started.' };
    }

    const existingBuildingRoute = this.findBuildingRoute(input);
    if (existingBuildingRoute) {
      const sellerCityId = existingBuildingRoute.nationAId === input.sellerNationId
        ? existingBuildingRoute.cityAId
        : existingBuildingRoute.cityBId;
      const buyerCityId = existingBuildingRoute.nationAId === input.buyerNationId
        ? existingBuildingRoute.cityAId
        : existingBuildingRoute.cityBId;
      return this.addPendingDeal(input, existingBuildingRoute.id, sellerCityId, buyerCityId);
    }

    const endpoints = this.resolveEndpoints(input);
    if (!endpoints.ok) return endpoints;
    const validation = this.tradeConnectionSystem.canCreateTradeConnection(
      endpoints.sellerCity.id,
      endpoints.buyerCity.id,
    );
    if (!validation.ok) return validation;

    const route = this.tradeConnectionSystem.createTradeConnectionDraft(
      endpoints.sellerCity.id,
      endpoints.buyerCity.id,
      this.getCurrentTurn(),
    );
    this.log?.(
      `Automatic trade route ${route.id} created for the intended ${input.resourceId} deal.`,
      [input.sellerNationId, input.buyerNationId],
    );

    if (route.status === 'active') {
      // The 0-turn route is already visible to validation at this point.
      const activated = this.tradeDealSystem.createDeal(input);
      if (!activated.ok || !activated.deal) {
        const reason = activated.reason ?? 'Trade deal failed revalidation after immediate route activation.';
        this.log?.(`Immediate trade deal failed after revalidation: ${reason}`, [input.sellerNationId, input.buyerNationId]);
        return { ok: false, reason };
      }
      this.log?.(
        `Automatic route ${route.id} activated immediately; trade deal ${activated.deal.id} started.`,
        [input.sellerNationId, input.buyerNationId],
      );
      return { ok: true, status: 'active', dealId: activated.deal.id, routeId: route.id };
    }

    const routeItem: Producible = {
      kind: 'tradeRoute',
      connectionId: route.id,
      fromCityId: route.cityAId,
      toCityId: route.cityBId,
      targetNationId: route.nationBId,
      displayName: `Trade Route to ${endpoints.buyerCity.name}`,
      establishmentTurns: this.tradeConnectionSystem.getEstablishmentTurns(),
    };
    this.productionSystem.enqueue(route.cityAId, routeItem);
    const queued = this.productionSystem.getQueue(route.cityAId).some((entry) =>
      entry.item.kind === 'tradeRoute' && entry.item.connectionId === route.id,
    );
    if (!queued) {
      this.tradeConnectionSystem.cancelConnection(route.id);
      return { ok: false, reason: 'The trade route could not be added to the origin city production queue.' };
    }
    return this.addPendingDeal(input, route.id, route.cityAId, route.cityBId);
  }

  getPendingDeals(): PendingTradeDeal[] {
    return Array.from(this.pendingDeals.values()).map((deal) => ({ ...deal }));
  }

  /**
   * Read-only preflight used by the Trading screen to avoid offering a known
   * impossible foreign city. startExport remains the final authority.
   */
  evaluateExportDestination(input: StartHumanTradeDealInput): HumanExportDestinationEvaluation {
    if (input.sellerNationId !== this.humanNationId) {
      return { ok: false, reason: 'Only exports initiated by the human player are supported.' };
    }
    if (!input.buyerCityId) return { ok: false, reason: 'Choose a destination city.' };
    const preliminary = this.tradeDealSystem.validateDeal(input, false);
    if (!preliminary.ok) return { ok: false, reason: preliminary.reason ?? 'Trade deal is invalid.' };
    const endpointValidation = this.validateExplicitEndpoints(input);
    if (!endpointValidation.ok) return endpointValidation;
    if (this.hasMatchingPendingDeal(input)) {
      return { ok: false, reason: 'That resource deal is already waiting for a trade route.' };
    }

    // Existing nation-level capacity can be reused by the established deal
    // model; no new origin capacity is needed in that case.
    if (this.tradeDealSystem.validateDeal(input).ok) {
      return { ok: true, buyerCityId: input.buyerCityId };
    }

    const building = this.findBuildingRoute(input);
    if (building) {
      const sellerCityId = building.nationAId === input.sellerNationId ? building.cityAId : building.cityBId;
      return { ok: true, sellerCityId, buyerCityId: input.buyerCityId };
    }

    const endpoints = this.resolveEndpoints(input);
    if (!endpoints.ok) return endpoints;
    const routeValidation = this.tradeConnectionSystem.canCreateTradeConnection(
      endpoints.sellerCity.id,
      endpoints.buyerCity.id,
    );
    if (!routeValidation.ok) return routeValidation;
    return { ok: true, sellerCityId: endpoints.sellerCity.id, buyerCityId: endpoints.buyerCity.id };
  }

  restorePendingDeals(deals: readonly PendingTradeDeal[] | undefined): void {
    this.pendingDeals.clear();
    let highestNumber = 0;
    for (const deal of deals ?? []) {
      if (!this.isRestorablePendingDeal(deal)) continue;
      this.pendingDeals.set(deal.id, { ...deal });
      const match = /^pending_trade_deal_(\d+)$/.exec(deal.id);
      if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
    }
    this.nextPendingDealNumber = highestNumber + 1;
  }

  onPendingDealResolved(listener: PendingListener): void {
    this.pendingListeners.push(listener);
  }

  cancelPendingDealsForRoute(routeId: string, reason: string): number {
    let cancelled = 0;
    for (const pending of Array.from(this.pendingDeals.values())) {
      if (pending.routeId !== routeId) continue;
      this.pendingDeals.delete(pending.id);
      this.emit({ pendingDeal: { ...pending }, outcome: 'cancelled', reason });
      this.log?.(`Pending trade deal ${pending.id} cancelled: ${reason}`, [pending.sellerNationId, pending.buyerNationId]);
      cancelled++;
    }
    return cancelled;
  }

  private activatePendingDealsForRoute(routeId: string): void {
    for (const pending of Array.from(this.pendingDeals.values())) {
      if (pending.routeId !== routeId) continue;
      this.pendingDeals.delete(pending.id);
      const input: CreateTradeDealInput = {
        sellerNationId: pending.sellerNationId,
        buyerNationId: pending.buyerNationId,
        resourceId: pending.resourceId,
        turns: pending.turns,
        goldPerTurn: pending.goldPerTurn,
      };
      const result = this.tradeDealSystem.createDeal(input);
      if (result.ok && result.deal) {
        this.emit({ pendingDeal: { ...pending }, outcome: 'activated', activeDealId: result.deal.id });
        this.log?.(
          `Pending trade deal ${pending.id} activated as ${result.deal.id} with its full ${pending.turns}-turn duration.`,
          [pending.sellerNationId, pending.buyerNationId],
        );
      } else {
        const reason = result.reason ?? 'Deal failed revalidation.';
        this.emit({ pendingDeal: { ...pending }, outcome: 'failed', reason });
        this.log?.(
          `Pending trade deal ${pending.id} failed after route establishment: ${reason}`,
          [pending.sellerNationId, pending.buyerNationId],
        );
      }
    }
  }

  private addPendingDeal(
    input: CreateTradeDealInput,
    routeId: string,
    sellerCityId: string,
    buyerCityId: string,
  ): StartHumanTradeDealResult {
    const pending: PendingTradeDeal = {
      id: `pending_trade_deal_${this.nextPendingDealNumber++}`,
      sellerNationId: input.sellerNationId,
      buyerNationId: input.buyerNationId,
      sellerCityId,
      buyerCityId,
      resourceId: input.resourceId,
      goldPerTurn: input.goldPerTurn,
      turns: input.turns,
      routeId,
      requestedTurn: this.getCurrentTurn(),
    };
    this.pendingDeals.set(pending.id, pending);
    this.log?.(
      `Trade deal ${pending.id} is waiting for route ${routeId} to finish establishing.`,
      [input.sellerNationId, input.buyerNationId],
    );
    return { ok: true, status: 'pending', pendingDealId: pending.id, routeId };
  }

  private findBuildingRoute(input: StartHumanTradeDealInput) {
    return this.tradeConnectionSystem.getAllConnections().find((route) =>
      route.status === 'building'
      && !Array.from(this.pendingDeals.values()).some((pending) => pending.routeId === route.id)
      && this.productionSystem.getQueue(route.cityAId).some((entry) =>
        entry.item.kind === 'tradeRoute' && entry.item.connectionId === route.id)
      && ((route.nationAId === input.sellerNationId && route.nationBId === input.buyerNationId)
        || (route.nationAId === input.buyerNationId && route.nationBId === input.sellerNationId))
      && (!input.sellerCityId || route.cityAId === input.sellerCityId || route.cityBId === input.sellerCityId)
      && (!input.buyerCityId || route.cityAId === input.buyerCityId || route.cityBId === input.buyerCityId),
    );
  }

  private validateExplicitEndpoints(input: StartHumanTradeDealInput): { ok: true } | { ok: false; reason: string } {
    const explicitSeller = input.sellerCityId ? this.cityManager.getCity(input.sellerCityId) : undefined;
    const explicitBuyer = input.buyerCityId ? this.cityManager.getCity(input.buyerCityId) : undefined;
    if (input.sellerCityId && (!explicitSeller || explicitSeller.ownerId !== input.sellerNationId)) {
      return { ok: false, reason: 'The selected origin city does not belong to the seller.' };
    }
    if (input.buyerCityId && (!explicitBuyer || explicitBuyer.ownerId !== input.buyerNationId)) {
      return { ok: false, reason: 'The selected destination city does not belong to the buyer.' };
    }
    return { ok: true };
  }

  private resolveEndpoints(input: StartHumanTradeDealInput):
    | { ok: true; sellerCity: City; buyerCity: City }
    | { ok: false; reason: string } {
    const explicitSeller = input.sellerCityId ? this.cityManager.getCity(input.sellerCityId) : undefined;
    const explicitBuyer = input.buyerCityId ? this.cityManager.getCity(input.buyerCityId) : undefined;
    if (input.sellerCityId && (!explicitSeller || explicitSeller.ownerId !== input.sellerNationId)) {
      return { ok: false, reason: 'The selected origin city does not belong to the seller.' };
    }
    if (input.buyerCityId && (!explicitBuyer || explicitBuyer.ownerId !== input.buyerNationId)) {
      return { ok: false, reason: 'The selected destination city does not belong to the buyer.' };
    }

    const sellerCities = explicitSeller ? [explicitSeller] : this.preferredCities(input.sellerNationId);
    const buyerCities = explicitBuyer ? [explicitBuyer] : this.preferredCities(input.buyerNationId);
    let lastReason = 'No compatible origin and destination cities have available trade capacity.';
    for (const sellerCity of sellerCities) {
      for (const buyerCity of buyerCities) {
        const result = this.tradeConnectionSystem.canCreateTradeConnection(sellerCity.id, buyerCity.id);
        if (result.ok) return { ok: true, sellerCity, buyerCity };
        lastReason = result.reason;
      }
    }
    return { ok: false, reason: lastReason };
  }

  private preferredCities(nationId: string): City[] {
    return [...this.cityManager.getCitiesByOwner(nationId)].sort((a, b) =>
      Number(b.isResidenceCapital) - Number(a.isResidenceCapital) || a.id.localeCompare(b.id),
    );
  }

  private hasMatchingPendingDeal(input: CreateTradeDealInput): boolean {
    return Array.from(this.pendingDeals.values()).some((deal) =>
      deal.sellerNationId === input.sellerNationId
      && deal.buyerNationId === input.buyerNationId
      && deal.resourceId === input.resourceId,
    );
  }

  private isRestorablePendingDeal(deal: PendingTradeDeal): boolean {
    return typeof deal.id === 'string' && deal.id.length > 0
      && typeof deal.routeId === 'string' && deal.routeId.length > 0
      && typeof deal.sellerCityId === 'string' && typeof deal.buyerCityId === 'string'
      && deal.sellerNationId === this.humanNationId
      && deal.sellerNationId !== deal.buyerNationId
      && typeof deal.resourceId === 'string' && deal.resourceId.length > 0
      && Number.isInteger(deal.turns) && deal.turns > 0
      && Number.isInteger(deal.goldPerTurn) && deal.goldPerTurn >= 0
      && Number.isInteger(deal.requestedTurn);
  }

  private emit(event: PendingTradeDealEvent): void {
    for (const listener of this.pendingListeners) listener(event);
  }
}
