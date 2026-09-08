import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { TradeDealSystem } from './TradeDealSystem';

export function historicalPopulation(cities: CityManager, nation: string): number {
  return cities.getCitiesByOwner(nation).reduce((sum, city) => sum + city.population, 0);
}
export function cancelHistoricalTrade(trade: TradeDealSystem, targets: readonly string[], resources?: readonly string[]): number {
  return trade.cancelDealsMatching(deal => deal.sellerNationId !== deal.buyerNationId && (resources
    ? resources.includes(deal.resourceId)
    : targets.includes(deal.sellerNationId) || targets.includes(deal.buyerNationId)), 'cancelled');
}
export function cancelHistoricalBorders(diplomacy: DiplomacyManager, nations: readonly string[], targets: readonly string[]): number {
  let count = 0;
  for (const a of nations) for (const b of nations) {
    if (a !== b && (targets.includes(a) || targets.includes(b)) && diplomacy.isOpenBorderGrantedFrom(a,b)) {
      diplomacy.toggleOpenBorders(a,b); count++;
    }
  }
  return count;
}
