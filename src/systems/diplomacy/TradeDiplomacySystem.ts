import type { DiplomacyManager, DiplomaticMemoryValues } from '../DiplomacyManager';
import type { TradeConnection } from '../../types/tradeConnection';
import type { TradeDeal } from '../../types/tradeDeal';

export const TRADE_TRUST_CAP = 25;
export const TRADE_AFFINITY_CAP = 25;

const ROUTE_ACTIVATION_TRUST = 3;
const ROUTE_PERIODIC_TRUST = 1;
const DEAL_PERIODIC_AFFINITY = 1;
const WAR_TRADE_TRUST_PENALTY = -8;
const WAR_TRADE_HOSTILITY_PENALTY = 8;

export interface TradeHistoryEntry {
  tradeTrustBonus: number;
  tradeAffinityBonus: number;
}

export interface SavedTradeHistoryEntry extends TradeHistoryEntry {
  nationA: string;
  nationB: string;
}

/**
 * Tracks how much trust and affinity have been accumulated from trade routes
 * and deals, and applies incremental diplomatic memory effects.
 *
 * Caps at TRADE_TRUST_CAP / TRADE_AFFINITY_CAP to prevent infinite stacking.
 * War resets the accumulators so peace + trade can rebuild relations.
 */
export class TradeDiplomacySystem {
  private readonly history = new Map<string, TradeHistoryEntry>();

  constructor(private readonly diplomacyManager: DiplomacyManager) {}

  /** Call when a resource trade proposal is accepted by the target. +1 affinity. */
  onTradeProposalAccepted(fromNationId: string, toNationId: string): void {
    this.applyDelta(fromNationId, toNationId, { affinity: 1 });
  }

  /** Call when a TradeConnection transitions to 'active'. */
  onTradeRouteActivated(nationAId: string, nationBId: string): void {
    const entry = this.getOrCreate(nationAId, nationBId);
    const room = Math.max(0, TRADE_TRUST_CAP - entry.tradeTrustBonus);
    const actual = Math.min(ROUTE_ACTIVATION_TRUST, room);
    if (actual <= 0) return;
    entry.tradeTrustBonus += actual;
    this.applyDelta(nationAId, nationBId, { trust: actual });
  }

  /** Call on roundStart. Applies periodic trust/affinity increments every 10 rounds. */
  onRoundEnd(round: number, connections: TradeConnection[], deals: readonly TradeDeal[]): void {
    if (round % 10 !== 0) return;

    // Per-active-connection trust increment
    for (const conn of connections) {
      if (conn.status !== 'active') continue;
      const entry = this.getOrCreate(conn.nationAId, conn.nationBId);
      const room = Math.max(0, TRADE_TRUST_CAP - entry.tradeTrustBonus);
      const actual = Math.min(ROUTE_PERIODIC_TRUST, room);
      if (actual <= 0) continue;
      entry.tradeTrustBonus += actual;
      this.applyDelta(conn.nationAId, conn.nationBId, { trust: actual });
    }

    // Per-active-deal affinity increment (one increment per nation pair per round cycle)
    const processedPairs = new Set<string>();
    for (const deal of deals) {
      const key = this.pairKey(deal.sellerNationId, deal.buyerNationId);
      if (processedPairs.has(key)) continue;
      processedPairs.add(key);
      const entry = this.getOrCreate(deal.sellerNationId, deal.buyerNationId);
      const room = Math.max(0, TRADE_AFFINITY_CAP - entry.tradeAffinityBonus);
      const actual = Math.min(DEAL_PERIODIC_AFFINITY, room);
      if (actual <= 0) continue;
      entry.tradeAffinityBonus += actual;
      this.applyDelta(deal.sellerNationId, deal.buyerNationId, { affinity: actual });
    }
  }

  /**
   * Call when war is declared between two nations that had active trade.
   * Applies trust/hostility penalty and resets trade accumulators so
   * post-war trade can rebuild from scratch.
   */
  onWarWithTrade(aggressorId: string, targetId: string): void {
    const key = this.pairKey(aggressorId, targetId);
    const entry = this.history.get(key);
    if (!entry || (entry.tradeTrustBonus === 0 && entry.tradeAffinityBonus === 0)) return;

    // Reset accumulators so post-peace trade can rebuild
    this.history.set(key, { tradeTrustBonus: 0, tradeAffinityBonus: 0 });

    this.applyDelta(aggressorId, targetId, {
      trust: WAR_TRADE_TRUST_PENALTY,
      hostility: WAR_TRADE_HOSTILITY_PENALTY,
    });
  }

  getTradeHistory(nationAId: string, nationBId: string): TradeHistoryEntry {
    return { ...(this.history.get(this.pairKey(nationAId, nationBId)) ?? { tradeTrustBonus: 0, tradeAffinityBonus: 0 }) };
  }

  getAllEntries(): SavedTradeHistoryEntry[] {
    const result: SavedTradeHistoryEntry[] = [];
    for (const [key, entry] of this.history.entries()) {
      if (entry.tradeTrustBonus === 0 && entry.tradeAffinityBonus === 0) continue;
      const [nationA, nationB] = key.split('|');
      if (!nationA || !nationB) continue;
      result.push({ nationA, nationB, ...entry });
    }
    return result;
  }

  restoreEntries(entries: readonly SavedTradeHistoryEntry[]): void {
    this.history.clear();
    for (const e of entries) {
      this.history.set(this.pairKey(e.nationA, e.nationB), {
        tradeTrustBonus: e.tradeTrustBonus,
        tradeAffinityBonus: e.tradeAffinityBonus,
      });
    }
  }

  private getOrCreate(a: string, b: string): TradeHistoryEntry {
    const key = this.pairKey(a, b);
    let entry = this.history.get(key);
    if (!entry) {
      entry = { tradeTrustBonus: 0, tradeAffinityBonus: 0 };
      this.history.set(key, entry);
    }
    return entry;
  }

  private applyDelta(a: string, b: string, delta: Partial<DiplomaticMemoryValues>): void {
    const relation = this.diplomacyManager.getRelation(a, b);
    this.diplomacyManager.setMemoryValues(a, b, {
      trust: clamp((relation.trust) + (delta.trust ?? 0)),
      fear: clamp((relation.fear) + (delta.fear ?? 0)),
      hostility: clamp((relation.hostility) + (delta.hostility ?? 0)),
      affinity: clamp((relation.affinity) + (delta.affinity ?? 0)),
    });
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
