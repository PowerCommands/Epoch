import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { Producible } from '../types/producible';
import type { TurnStartEvent } from '../types/events';

/**
 * Aktiv produktion i en stad: vad som byggs och hur mycket som ackumulerats.
 */
export interface CityProduction {
  item: Producible;
  accumulated: number;
  blockedReason?: string;
}

export type ProductionCompletedListener = (cityId: string, item: Producible) => boolean | void;
export type ProductionChangedListener = (cityId: string) => void;

/**
 * ProductionSystem hanterar produktion per stad.
 *
 * Varje stad kan producera en sak åt gången (en byggnad).
 * Produktion ackumuleras varje turnStart för den aktiva nationens städer.
 * När produktionskostnaden nåtts emittas en completion-event.
 */
export class ProductionSystem {
  private readonly cityManager: CityManager;
  private readonly queues = new Map<string, CityProduction>();
  private readonly completedListeners: ProductionCompletedListener[] = [];
  private readonly changedListeners: ProductionChangedListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(cityManager: CityManager, turnManager: TurnManager) {
    this.cityManager = cityManager;
    turnManager.on('turnStart', (e) => this.handleTurnStart(e));
  }

  setProduction(cityId: string, item: Producible): void {
    this.queues.set(cityId, { item, accumulated: 0 });
    this.notifyChanged(cityId);
  }

  getProduction(cityId: string): CityProduction | undefined {
    return this.queues.get(cityId);
  }

  clearProduction(cityId: string): void {
    this.queues.delete(cityId);
    this.notifyChanged(cityId);
  }

  onCompleted(listener: ProductionCompletedListener): void {
    this.completedListeners.push(listener);
  }

  onChanged(listener: ProductionChangedListener): void {
    this.changedListeners.push(listener);
  }

  private handleTurnStart(e: TurnStartEvent): void {
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }

    const cities = this.cityManager.getCitiesByOwner(e.nation.id);
    for (const city of cities) {
      const prod = this.queues.get(city.id);
      if (!prod) continue;

      const cost = this.getCost(prod.item);
      if (prod.accumulated < cost) {
        const cityRes = this.cityManager.getResources(city.id);
        prod.accumulated = Math.min(cost, prod.accumulated + cityRes.productionPerTurn);
        prod.blockedReason = undefined;
      }

      if (prod.accumulated >= cost && this.tryComplete(city.id, prod.item)) {
        this.queues.delete(city.id);
      }

      this.notifyChanged(city.id);
    }
  }

  private tryComplete(cityId: string, item: Producible): boolean {
    let didBlock = false;
    for (const cb of this.completedListeners) {
      if (cb(cityId, item) === false) didBlock = true;
    }

    const prod = this.queues.get(cityId);
    if (prod) {
      prod.blockedReason = didBlock ? this.getBlockedReason(item) : undefined;
    }

    return !didBlock;
  }

  private getCost(item: Producible): number {
    switch (item.kind) {
      case 'unit': {
        return item.unitType.productionCost;
      }
      case 'building': {
        return item.buildingType.productionCost;
      }
    }
  }

  private getBlockedReason(item: Producible): string | undefined {
    switch (item.kind) {
      case 'unit':
        return 'Production blocked: no space for unit';
      case 'building':
        return undefined;
    }
  }

  private notifyChanged(cityId: string): void {
    for (const cb of this.changedListeners) cb(cityId);
  }
}
