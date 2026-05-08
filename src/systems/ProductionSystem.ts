import { CityManager } from './CityManager';
import { TurnManager } from './TurnManager';
import { HappinessSystem } from './HappinessSystem';
import type { Producible } from '../types/producible';
import type { TurnStartEvent } from '../types/events';
import { getGameSpeedById, scaleGameSpeedCost, type GameSpeedDefinition } from '../data/gameSpeeds';
import type { PolicySystem } from './PolicySystem';

/**
 * A single entry in a city's production queue.
 */
export interface ProductionPlacement {
  tileX: number;
  tileY: number;
}

export interface QueueEntry {
  item: Producible;
  accumulated: number;
  blockedReason?: string;
  placement?: ProductionPlacement;
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
  placement?: ProductionPlacement;
}

/**
 * Legacy compat — maps to queue[0].
 */
export interface CityProduction {
  item: Producible;
  accumulated: number;
  blockedReason?: string;
  placement?: ProductionPlacement;
}

export type ProductionCompletedListener = (cityId: string, item: Producible, entry: QueueEntry) => boolean | void;
export type ProductionChangedListener = (cityId: string) => void;
export type ProductionRemovedListener = (cityId: string, entry: QueueEntry) => void;

export type CompleteCurrentProductionResult =
  | { kind: 'completed'; item: Producible }
  | { kind: 'blocked'; item: Producible; reason: string }
  | { kind: 'empty' };

export type CompleteQueueEntryResult =
  | { ok: true; item: Producible }
  | { ok: false; reason: string };

const BUY_COST_PER_TURN = 100;

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
  private readonly removedListeners: ProductionRemovedListener[] = [];
  private hasSkippedInitialTurnStart = false;

  constructor(
    cityManager: CityManager,
    turnManager: TurnManager,
    private readonly happinessSystem: HappinessSystem,
    private readonly gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private readonly policySystem?: PolicySystem,
  ) {
    this.cityManager = cityManager;
    turnManager.on('turnStart', (e) => this.handleTurnStart(e));
  }

  /** Add item to end of queue. */
  enqueue(cityId: string, item: Producible, options: { placement?: ProductionPlacement } = {}): void {
    let queue = this.queues.get(cityId);
    if (!queue) {
      queue = [];
      this.queues.set(cityId, queue);
    }
    queue.push({
      item,
      accumulated: 0,
      placement: options.placement ? { ...options.placement } : undefined,
    });
    this.notifyChanged(cityId);
  }

  /** Add item to the front of the queue, making it the active production. */
  enqueueFront(cityId: string, item: Producible, options: { placement?: ProductionPlacement } = {}): void {
    let queue = this.queues.get(cityId);
    if (!queue) {
      queue = [];
      this.queues.set(cityId, queue);
    }
    queue.unshift({
      item,
      accumulated: 0,
      placement: options.placement ? { ...options.placement } : undefined,
    });
    this.notifyChanged(cityId);
  }

  /** Remove item at index. */
  removeFromQueue(cityId: string, index: number): void {
    const queue = this.queues.get(cityId);
    if (!queue || index < 0 || index >= queue.length) return;
    const [removed] = queue.splice(index, 1);
    if (queue.length === 0) {
      this.queues.delete(cityId);
    }
    this.notifyRemoved(cityId, removed);
    this.notifyChanged(cityId);
  }

  /** Get full queue with turns remaining for display. */
  getQueue(cityId: string): QueueEntryView[] {
    const queue = this.queues.get(cityId);
    if (!queue || queue.length === 0) return [];

    return queue.map((entry, i) => {
      const ppt = Math.max(1, this.getEffectiveProductionPerTurn(cityId, entry.item));
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
        placement: entry.placement ? { ...entry.placement } : undefined,
      };
    });
  }

  /** Legacy: clears queue and enqueues single item. Used by AI. */
  setProduction(cityId: string, item: Producible, options: { placement?: ProductionPlacement } = {}): void {
    const existing = this.queues.get(cityId) ?? [];
    for (const entry of existing) this.notifyRemoved(cityId, entry);
    this.queues.set(cityId, [{
      item,
      accumulated: 0,
      placement: options.placement ? { ...options.placement } : undefined,
    }]);
    this.notifyChanged(cityId);
  }

  /** Legacy: returns queue[0] as CityProduction or undefined. */
  getProduction(cityId: string): CityProduction | undefined {
    const queue = this.queues.get(cityId);
    if (!queue || queue.length === 0) return undefined;
    const entry = queue[0];
    return {
      item: entry.item,
      accumulated: entry.accumulated,
      blockedReason: entry.blockedReason,
      placement: entry.placement ? { ...entry.placement } : undefined,
    };
  }

  /** Legacy: empties queue entirely. */
  clearProduction(cityId: string): void {
    const existing = this.queues.get(cityId) ?? [];
    for (const entry of existing) this.notifyRemoved(cityId, entry);
    this.queues.delete(cityId);
    this.notifyChanged(cityId);
  }

  /** Force-complete queue[0] immediately, firing completion listeners. */
  completeCurrentProduction(cityId: string): CompleteCurrentProductionResult {
    const queue = this.queues.get(cityId);
    if (!queue || queue.length === 0) return { kind: 'empty' };

    const entry = queue[0];
    entry.accumulated = this.getCost(entry.item);

    const completed = this.tryComplete(cityId, entry);
    if (completed) {
      queue.shift();
      if (queue.length === 0) {
        this.queues.delete(cityId);
      }
      this.notifyChanged(cityId);
      return { kind: 'completed', item: entry.item };
    }

    const reason = entry.blockedReason ?? this.getBlockedReason(entry.item) ?? 'Production blocked';
    this.notifyChanged(cityId);
    return { kind: 'blocked', item: entry.item, reason };
  }

  /**
   * Cost in gold to buy the queue entry at `index`.
   * Scales with turnsRemaining so buying far-back entries or high-cost
   * items is proportionally more expensive. Returns null if the entry
   * doesn't exist.
   */
  getBuyCost(cityId: string, index: number): number | null {
    const entries = this.getQueue(cityId);
    if (index < 0 || index >= entries.length) return null;
    return entries[index].turnsRemaining * BUY_COST_PER_TURN;
  }

  /**
   * Force-complete a specific queue entry via the normal completion
   * pipeline. Used by the buy flow so building/unit/wonder completion
   * goes through the same onCompleted listeners as turn-based production.
   *
   * The entry is removed only if completion succeeds. If a listener
   * blocks completion (e.g. no placement tile for a unit), the queue
   * is left intact so callers can refund and retry.
   */
  completeQueueEntry(cityId: string, index: number): CompleteQueueEntryResult {
    const queue = this.queues.get(cityId);
    if (!queue || index < 0 || index >= queue.length) {
      return { ok: false, reason: 'Queue entry not found' };
    }
    const entry = queue[index];
    const completed = this.tryComplete(cityId, entry);
    if (!completed) {
      const reason = entry.blockedReason ?? this.getBlockedReason(entry.item) ?? 'Production blocked';
      if (index !== 0) entry.blockedReason = undefined;
      this.notifyChanged(cityId);
      return { ok: false, reason };
    }
    queue.splice(index, 1);
    if (queue.length === 0) {
      this.queues.delete(cityId);
    }
    this.notifyChanged(cityId);
    return { ok: true, item: entry.item };
  }

  /**
   * Clear every queue. Used by save-load restoration before applying
   * saved queues.
   */
  clearAllQueues(): void {
    for (const [cityId, queue] of this.queues.entries()) {
      for (const entry of queue) this.notifyRemoved(cityId, entry);
    }
    this.queues.clear();
  }

  /**
   * Restore a city's queue without firing listeners. Used by save-load
   * restoration. Caller is responsible for UI refresh.
   */
  restoreQueue(cityId: string, entries: QueueEntry[]): void {
    if (entries.length === 0) {
      this.queues.delete(cityId);
      return;
    }
    this.queues.set(cityId, entries.map((entry) => ({
      item: entry.item,
      accumulated: entry.accumulated,
      blockedReason: entry.blockedReason,
      placement: entry.placement ? { ...entry.placement } : undefined,
    })));
  }

  /**
   * Force the "initial turnStart has been skipped" latch to true.
   * Used by save-load restoration so the first turnStart after load
   * actually advances production (the first post-load turnStart is a
   * real turn, not the synthetic startup one).
   */
  markInitialTurnStartSkipped(): void {
    this.hasSkippedInitialTurnStart = true;
  }

  onCompleted(listener: ProductionCompletedListener): void {
    this.completedListeners.push(listener);
  }

  onChanged(listener: ProductionChangedListener): void {
    this.changedListeners.push(listener);
  }

  onRemoved(listener: ProductionRemovedListener): void {
    this.removedListeners.push(listener);
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
        entry.accumulated = Math.min(
          cost,
          entry.accumulated + this.getEffectiveProductionPerTurn(city.id, entry.item),
        );
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
      if (cb(cityId, entry.item, entry) === false) didBlock = true;
    }

    if (didBlock) {
      entry.blockedReason = this.getBlockedReason(entry);
    } else {
      entry.blockedReason = undefined;
    }

    return !didBlock;
  }

  getCost(item: Producible): number {
    return scaleGameSpeedCost(this.getBaseCost(item), this.gameSpeed);
  }

  private getBaseCost(item: Producible): number {
    switch (item.kind) {
      case 'unit':
        return item.unitType.productionCost;
      case 'building':
        return item.buildingType.productionCost;
      case 'wonder':
        return item.wonderType.productionCost;
    }
  }

  private getBlockedReason(entryOrItem: QueueEntry | Producible): string | undefined {
    const item = 'item' in entryOrItem ? entryOrItem.item : entryOrItem;
    switch (item.kind) {
      case 'unit':
        return 'Production blocked: no space for unit';
      case 'building':
        return undefined;
      case 'wonder':
        if ('item' in entryOrItem && !entryOrItem.placement) return 'Wonder placement missing';
        return 'Wonder already completed';
    }
  }

  /**
   * Remove every queued entry that produces the given wonder. Called by
   * the wonder pipeline when a wonder is completed so other cities'
   * queues are deterministically cleared.
   */
  removeWonderFromAllQueues(wonderId: string): void {
    for (const [cityId, queue] of [...this.queues.entries()]) {
      const removed = queue.filter((entry) => entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId);
      const next = queue.filter((entry) => !(entry.item.kind === 'wonder' && entry.item.wonderType.id === wonderId));
      if (next.length === queue.length) continue;
      if (next.length === 0) {
        this.queues.delete(cityId);
      } else {
        this.queues.set(cityId, next);
      }
      for (const entry of removed) this.notifyRemoved(cityId, entry);
      this.notifyChanged(cityId);
    }
  }

  private getEffectiveProductionPerTurn(cityId: string, item?: Producible): number {
    const city = this.cityManager.getCity(cityId);
    if (!city) return 0;

    const cityRes = this.cityManager.getResources(cityId);
    const modifier = this.happinessSystem.getProductionModifier(city.ownerId);
    const baseProduction = Math.floor(cityRes.productionPerTurn * modifier);
    if (!item) return baseProduction;

    return applyPercent(baseProduction, this.getPolicyProductionPercent(city.ownerId, item));
  }

  private getPolicyProductionPercent(nationId: string, item: Producible): number {
    if (item.kind === 'wonder') {
      return this.policySystem?.getPercentModifierTotal(nationId, 'wonderProductionPercent') ?? 0;
    }
    if (
      item.kind === 'unit' &&
      item.unitType.isNaval !== true &&
      item.unitType.category !== 'air'
    ) {
      return this.policySystem?.getPercentModifierTotal(nationId, 'landUnitProductionPercent') ?? 0;
    }
    return 0;
  }

  private notifyChanged(cityId: string): void {
    for (const cb of this.changedListeners) cb(cityId);
  }

  private notifyRemoved(cityId: string, entry: QueueEntry): void {
    for (const cb of this.removedListeners) cb(cityId, entry);
  }
}

function applyPercent(value: number, percent: number): number {
  const multiplier = Math.max(0, 1 + (percent / 100));
  return Math.round(value * multiplier);
}
