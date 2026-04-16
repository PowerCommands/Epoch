import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import type { Producible } from '../types/producible';
import type { TurnStartEvent } from '../types/events';

/**
 * A single entry in a city's production queue.
 */
export interface QueueEntry {
  item: Producible;
  accumulated: number;
  blockedReason?: string;
}

/**
 * Read-only view of a queue entry with computed turns remaining.
 */
export interface QueueEntryView {
  item: Producible;
  progress: number;
  cost: number;
  turnsRemaining: number;
  blockedReason?: string;
}

/**
 * Legacy compat — maps to queue[0].
 */
export interface CityProduction {
  item: Producible;
  accumulated: number;
  blockedReason?: string;
}

export type ProductionCompletedListener = (cityId: string, item: Producible) => boolean | void;
export type ProductionChangedListener = (cityId: string) => void;

/**
 * ProductionSystem manages per-city build queues.
 *
 * Only queue[0] is active — progress advances for it on turnStart.
 * When queue[0] completes, it's removed and queue[1] becomes active.
 */
export class ProductionSystem {
  private readonly cityManager: CityManager;
  private readonly queues = new Map<string, QueueEntry[]>();
  private readonly completedListeners: ProductionCompletedListener[] = [];
  private readonly changedListeners: ProductionChangedListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(cityManager: CityManager, turnManager: TurnManager) {
    this.cityManager = cityManager;
    turnManager.on('turnStart', (e) => this.handleTurnStart(e));
  }

  /** Add item to end of queue. */
  enqueue(cityId: string, item: Producible): void {
    let queue = this.queues.get(cityId);
    if (!queue) {
      queue = [];
      this.queues.set(cityId, queue);
    }
    queue.push({ item, accumulated: 0 });
    this.notifyChanged(cityId);
  }

  /** Remove item at index. */
  removeFromQueue(cityId: string, index: number): void {
    const queue = this.queues.get(cityId);
    if (!queue || index < 0 || index >= queue.length) return;
    queue.splice(index, 1);
    if (queue.length === 0) {
      this.queues.delete(cityId);
    }
    this.notifyChanged(cityId);
  }

  /** Get full queue with turns remaining for display. */
  getQueue(cityId: string): QueueEntryView[] {
    const queue = this.queues.get(cityId);
    if (!queue || queue.length === 0) return [];

    const cityRes = this.cityManager.getResources(cityId);
    const ppt = Math.max(1, cityRes.productionPerTurn);

    return queue.map((entry, i) => {
      const cost = this.getCost(entry.item);
      const progress = entry.accumulated;
      const remaining = cost - (i === 0 ? progress : 0);
      const turnsRemaining = Math.max(1, Math.ceil(remaining / ppt));
      return {
        item: entry.item,
        progress: i === 0 ? progress : 0,
        cost,
        turnsRemaining,
        blockedReason: i === 0 ? entry.blockedReason : undefined,
      };
    });
  }

  /** Legacy: clears queue and enqueues single item. Used by AI. */
  setProduction(cityId: string, item: Producible): void {
    this.queues.set(cityId, [{ item, accumulated: 0 }]);
    this.notifyChanged(cityId);
  }

  /** Legacy: returns queue[0] as CityProduction or undefined. */
  getProduction(cityId: string): CityProduction | undefined {
    const queue = this.queues.get(cityId);
    if (!queue || queue.length === 0) return undefined;
    const entry = queue[0];
    return { item: entry.item, accumulated: entry.accumulated, blockedReason: entry.blockedReason };
  }

  /** Legacy: empties queue entirely. */
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
      const queue = this.queues.get(city.id);
      if (!queue || queue.length === 0) continue;

      const entry = queue[0];
      const cost = this.getCost(entry.item);

      if (entry.accumulated < cost) {
        const cityRes = this.cityManager.getResources(city.id);
        entry.accumulated = Math.min(cost, entry.accumulated + cityRes.productionPerTurn);
        entry.blockedReason = undefined;
      }

      if (entry.accumulated >= cost) {
        const completed = this.tryComplete(city.id, entry);
        if (completed) {
          queue.shift();
          if (queue.length === 0) {
            this.queues.delete(city.id);
          }
        }
      }

      this.notifyChanged(city.id);
    }
  }

  private tryComplete(cityId: string, entry: QueueEntry): boolean {
    let didBlock = false;
    for (const cb of this.completedListeners) {
      if (cb(cityId, entry.item) === false) didBlock = true;
    }

    if (didBlock) {
      entry.blockedReason = this.getBlockedReason(entry.item);
    } else {
      entry.blockedReason = undefined;
    }

    return !didBlock;
  }

  private getCost(item: Producible): number {
    switch (item.kind) {
      case 'unit':
        return item.unitType.productionCost;
      case 'building':
        return item.buildingType.productionCost;
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
