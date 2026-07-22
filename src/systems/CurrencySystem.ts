import { getNationDefinitionById } from '../data/nations';
import type { NationManager } from './NationManager';
import type { ResearchSystem } from './ResearchSystem';
import type { CityManager } from './CityManager';
import type { TradeDealSystem } from './TradeDealSystem';
import { getCityIntegrationProgress } from './CityIntegrationSystem';

export const CURRENCY_TECHNOLOGY_ID = 'currency';
export const CURRENCY_RANKING_UPDATE_INTERVAL = 20;

export type CurrencyStrength = 'Unranked' | 'Collapsing' | 'Weak' | 'Stable' | 'Strong' | 'Dominant';

export interface CurrencyEconomicMetrics {
  readonly gold: number;
  readonly income: number;
  readonly tradeRelations: number;
  readonly tradePartners: number;
  readonly corporations: number;
  readonly banks: number;
}

export interface CurrencyEconomicRanking {
  readonly gold: number;
  readonly income: number;
  readonly tradeRelations: number;
  readonly tradePartners: number;
  readonly corporations: number;
  readonly banks: number;
  readonly total: number;
}

export interface ActiveCurrencyState {
  readonly nationId: string;
  readonly nationName: string;
  readonly currencyName: string;
  readonly currencySymbol: string;
  readonly strength: CurrencyStrength;
  /** Latest ranked treasury snapshot; activation stores the current treasury. */
  readonly treasury: number;
  readonly metrics?: CurrencyEconomicMetrics;
  readonly ranking?: CurrencyEconomicRanking;
  readonly rankedAtRound?: number;
}

export interface CurrencyEconomicMetricProviders {
  readonly getGoldIncome: (nationId: string) => number;
  /** One partner id per active international deal; duplicates represent multiple relations. */
  readonly getActiveTradePartnerIds: (nationId: string) => readonly string[];
  readonly getCorporationCount: (nationId: string) => number;
  readonly getActiveBankCount: (nationId: string) => number;
}

export interface RelativeRankingInput {
  readonly nationId: string;
  readonly value: number;
}

type CurrencyChangedListener = () => void;
type CurrencyLogger = (message: string) => void;

const EMPTY_METRIC_PROVIDERS: CurrencyEconomicMetricProviders = {
  getGoldIncome: () => 0,
  getActiveTradePartnerIds: () => [],
  getCorporationCount: () => 0,
  getActiveBankCount: () => 0,
};

const STRENGTH_ORDER: Readonly<Record<CurrencyStrength, number>> = {
  Dominant: 5,
  Strong: 4,
  Stable: 3,
  Weak: 2,
  Collapsing: 1,
  Unranked: 0,
};

/**
 * Award relative ranking points with deterministic tie penalties.
 * Five unique values yield 5/4/3/2/1; a two-way best tie yields 4/4/3/2/1.
 */
export function rankRelativeValues(entries: readonly RelativeRankingInput[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.value - a.value || a.nationId.localeCompare(b.nationId));
  const result = new Map<string, number>();
  let nextNormalScore = sorted.length;
  let index = 0;
  while (index < sorted.length) {
    const value = sorted[index].value;
    let end = index + 1;
    while (end < sorted.length && sorted[end].value === value) end++;
    const tieSize = end - index;
    const awarded = Math.max(1, nextNormalScore - (tieSize - 1));
    for (let cursor = index; cursor < end; cursor++) {
      result.set(sorted[cursor].nationId, awarded);
    }
    nextNormalScore = Math.max(1, awarded - 1);
    index = end;
  }
  return result;
}

export function getNextCurrencyRankingUpdateRound(currentRound: number): number {
  const normalized = Math.max(0, Math.floor(currentRound));
  return (Math.floor(normalized / CURRENCY_RANKING_UPDATE_INTERVAL) + 1)
    * CURRENCY_RANKING_UPDATE_INTERVAL;
}

export function getActiveInternationalTradePartnerIds(
  nationId: string,
  tradeDealSystem: TradeDealSystem,
): string[] {
  return tradeDealSystem.getDealsForNation(nationId).map((deal) => (
    deal.sellerNationId === nationId ? deal.buyerNationId : deal.sellerNationId
  ));
}

export function countActiveBanksForNation(
  nationId: string,
  cityManager: CityManager,
  currentRound = 0,
): number {
  return cityManager.getCitiesByOwner(nationId)
    .filter((city) => (
      getCityIntegrationProgress(city, currentRound).state !== 'occupied'
      && cityManager.getBuildings(city.id).hasActive('bank')
    )).length;
}

/**
 * Cached national currency ranking. Full world-economic evaluation occurs only
 * at fixed rounds 20/40/60… (plus one explicit load initialization).
 */
export class CurrencySystem {
  private states = new Map<string, ActiveCurrencyState>();
  private readonly listeners: CurrencyChangedListener[] = [];
  private rankingUpdateCount = 0;
  private lastRankingUpdateRound: number | undefined;

  constructor(
    private readonly nationManager: NationManager,
    private readonly researchSystem: ResearchSystem,
    private readonly providers: CurrencyEconomicMetricProviders = EMPTY_METRIC_PROVIDERS,
    private readonly log?: CurrencyLogger,
  ) {
    // Identity activation is cheap and distinct from the six-category ranking.
    this.syncEligibility(0, false);
  }

  onChanged(listener: CurrencyChangedListener): void {
    this.listeners.push(listener);
  }

  isCurrencyActive(nationId: string): boolean {
    return this.states.has(nationId);
  }

  getCurrencyState(nationId: string): ActiveCurrencyState | undefined {
    return this.states.get(nationId);
  }

  getActiveCurrencies(): ActiveCurrencyState[] {
    return [...this.states.values()].sort(compareCurrencyStates);
  }

  getRankingUpdateCount(): number {
    return this.rankingUpdateCount;
  }

  getLastRankingUpdateRound(): number | undefined {
    return this.lastRankingUpdateRound;
  }

  /** Activate identity immediately after Currency research, without ranking. */
  activateCurrency(nationId: string, currentRound: number): boolean {
    if (!this.researchSystem.isResearched(nationId, CURRENCY_TECHNOLOGY_ID)) return false;
    if (this.states.has(nationId)) return false;
    const state = this.createUnrankedState(nationId);
    if (!state) return false;
    this.states.set(nationId, state);
    this.log?.(
      `[CurrencySystem] nation=${nationId} currency="${state.currencyName}" symbol="${state.currencySymbol}" status=Unranked reason=activated nextUpdateRound=${getNextCurrencyRankingUpdateRound(currentRound)}`,
    );
    this.notifyChanged();
    return true;
  }

  /** Fixed world-round schedule: no rolling "20 turns since last update" state. */
  handleRoundStart(round: number): boolean {
    this.syncEligibility(round, true);
    if (round <= 0 || round % CURRENCY_RANKING_UPDATE_INTERVAL !== 0) return false;
    return this.recalculateRanking(round, 'scheduled');
  }

  /** One permitted reconstruction calculation after all save systems restore. */
  initializeAfterLoad(round: number): boolean {
    this.syncEligibility(round, false);
    return this.recalculateRanking(round, 'load-initialization');
  }

  private syncEligibility(currentRound: number, logActivations: boolean): void {
    const eligibleIds = new Set(this.nationManager.getAllNations()
      .filter((nation) => this.researchSystem.isResearched(nation.id, CURRENCY_TECHNOLOGY_ID))
      .map((nation) => nation.id));
    let changed = false;
    for (const nationId of eligibleIds) {
      if (this.states.has(nationId)) continue;
      const state = this.createUnrankedState(nationId);
      if (!state) continue;
      this.states.set(nationId, state);
      changed = true;
      if (logActivations) {
        this.log?.(
          `[CurrencySystem] nation=${nationId} currency="${state.currencyName}" symbol="${state.currencySymbol}" status=Unranked reason=activated nextUpdateRound=${getNextCurrencyRankingUpdateRound(currentRound)}`,
        );
      }
    }
    for (const nationId of [...this.states.keys()]) {
      if (eligibleIds.has(nationId)) continue;
      this.states.delete(nationId);
      changed = true;
    }
    if (changed) this.notifyChanged();
  }

  private createUnrankedState(nationId: string): ActiveCurrencyState | undefined {
    const nation = this.nationManager.getNation(nationId);
    const definition = getNationDefinitionById(nationId);
    if (!nation || !definition) return undefined;
    return {
      nationId,
      nationName: nation.name,
      currencyName: definition.currencyName,
      currencySymbol: definition.currencySymbol,
      strength: 'Unranked',
      treasury: normalizeMetric(this.nationManager.getResources(nationId)?.gold ?? 0),
    };
  }

  private recalculateRanking(round: number, reason: 'scheduled' | 'load-initialization'): boolean {
    if (this.states.size === 0) return false;
    const previousDominant = this.getActiveCurrencies().find((state) => state.strength === 'Dominant');
    const metricsByNation = new Map<string, CurrencyEconomicMetrics>();
    for (const nationId of this.states.keys()) {
      const partnerIds = this.providers.getActiveTradePartnerIds(nationId)
        .filter((partnerId) => partnerId !== nationId);
      metricsByNation.set(nationId, {
        gold: normalizeMetric(this.nationManager.getResources(nationId)?.gold ?? 0),
        income: normalizeMetric(this.providers.getGoldIncome(nationId)),
        tradeRelations: partnerIds.length,
        tradePartners: new Set(partnerIds).size,
        corporations: normalizeCount(this.providers.getCorporationCount(nationId)),
        banks: normalizeCount(this.providers.getActiveBankCount(nationId)),
      });
    }

    const categoryPoints = {
      gold: rankMetric(metricsByNation, 'gold'),
      income: rankMetric(metricsByNation, 'income'),
      tradeRelations: rankMetric(metricsByNation, 'tradeRelations'),
      tradePartners: rankMetric(metricsByNation, 'tradePartners'),
      corporations: rankMetric(metricsByNation, 'corporations'),
      banks: rankMetric(metricsByNation, 'banks'),
    };
    const rankings = new Map<string, CurrencyEconomicRanking>();
    for (const nationId of this.states.keys()) {
      const ranking = {
        gold: categoryPoints.gold.get(nationId)!,
        income: categoryPoints.income.get(nationId)!,
        tradeRelations: categoryPoints.tradeRelations.get(nationId)!,
        tradePartners: categoryPoints.tradePartners.get(nationId)!,
        corporations: categoryPoints.corporations.get(nationId)!,
        banks: categoryPoints.banks.get(nationId)!,
      };
      rankings.set(nationId, { ...ranking, total: Object.values(ranking).reduce((sum, value) => sum + value, 0) });
    }

    const finalOrder = [...this.states.keys()].sort((a, b) => compareFinalRanking(a, b, rankings));
    const strengths = assignRelativeStrengths(finalOrder);
    const next = new Map<string, ActiveCurrencyState>();
    for (const nationId of finalOrder) {
      const previous = this.states.get(nationId)!;
      const metrics = metricsByNation.get(nationId)!;
      next.set(nationId, {
        ...previous,
        strength: strengths.get(nationId)!,
        treasury: metrics.gold,
        metrics,
        ranking: rankings.get(nationId),
        rankedAtRound: round,
      });
    }
    this.states = next;
    this.rankingUpdateCount++;
    this.lastRankingUpdateRound = round;
    this.logRankingUpdate(round, reason);

    const nextDominant = this.getActiveCurrencies().find((state) => state.strength === 'Dominant');
    if (nextDominant && previousDominant?.nationId !== nextDominant.nationId) {
      const from = previousDominant
        ? `${previousDominant.currencyName} (${previousDominant.currencySymbol})`
        : 'None';
      this.log?.(`[CurrencySystem] Currency dominance changed: ${from} → ${nextDominant.currencyName} (${nextDominant.currencySymbol})`);
    }
    this.notifyChanged();
    return true;
  }

  private logRankingUpdate(round: number, reason: string): void {
    if (!this.log) return;
    this.log(`[Currency Ranking Update — turn ${round}] reason=${reason} eligible=${this.states.size}`);
    for (const state of this.getActiveCurrencies()) {
      const metrics = state.metrics!;
      const points = state.ranking!;
      this.log(
        `[CurrencyRanking] nation=${state.nationId} currency="${state.currencyName}" symbol="${state.currencySymbol}" `
        + `gold=${metrics.gold}:${points.gold} income=${metrics.income}:${points.income} `
        + `tradeRelations=${metrics.tradeRelations}:${points.tradeRelations} tradePartners=${metrics.tradePartners}:${points.tradePartners} `
        + `corporations=${metrics.corporations}:${points.corporations} banks=${metrics.banks}:${points.banks} `
        + `total=${points.total} status=${state.strength}`,
      );
    }
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) listener();
  }
}

function rankMetric(
  metrics: ReadonlyMap<string, CurrencyEconomicMetrics>,
  key: keyof CurrencyEconomicMetrics,
): Map<string, number> {
  return rankRelativeValues([...metrics].map(([nationId, values]) => ({ nationId, value: values[key] })));
}

function compareFinalRanking(
  a: string,
  b: string,
  rankings: ReadonlyMap<string, CurrencyEconomicRanking>,
): number {
  const left = rankings.get(a)!;
  const right = rankings.get(b)!;
  return right.total - left.total
    || right.income - left.income
    || right.tradePartners - left.tradePartners
    || right.gold - left.gold
    || a.localeCompare(b);
}

function assignRelativeStrengths(finalOrder: readonly string[]): Map<string, CurrencyStrength> {
  const result = new Map<string, CurrencyStrength>();
  if (finalOrder.length === 0) return result;
  result.set(finalOrder[0], 'Dominant');
  const remainingCount = finalOrder.length - 1;
  for (let index = 1; index < finalOrder.length; index++) {
    const remainingPosition = index / remainingCount;
    let strength: CurrencyStrength;
    if (remainingPosition <= 0.25) strength = 'Strong';
    else if (remainingPosition <= 0.65) strength = 'Stable';
    else if (remainingPosition < 1) strength = 'Weak';
    else strength = 'Collapsing';
    result.set(finalOrder[index], strength);
  }
  return result;
}

function compareCurrencyStates(a: ActiveCurrencyState, b: ActiveCurrencyState): number {
  return STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength]
    || (b.ranking?.total ?? 0) - (a.ranking?.total ?? 0)
    || a.nationId.localeCompare(b.nationId);
}

function normalizeMetric(value: number): number {
  return Number.isFinite(value) ? Math.floor(value) : 0;
}

function normalizeCount(value: number): number {
  return Math.max(0, normalizeMetric(value));
}
