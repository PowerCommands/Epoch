import type { KnownResourceOpportunity } from './AIExplorationSystem';
import { MEANINGFUL_RESOURCE_DEMAND_SCORE } from './resourceExplorationNeed';

/**
 * How a nation can act on a demanded strategic resource, given only what it
 * legitimately knows. This is the small, deterministic decision layer that turns
 * Strategic Resource Demand into an action using existing game systems — it never
 * queries hidden map data and never itself moves a unit, founds a city, or
 * creates a trade deal. The caller executes the chosen path through the existing
 * Worker, Settler and trade systems.
 */
export type ResourceAcquisitionPath =
  | 'domestic-improve'
  | 'foreign-trade'
  | 'neutral-land-expand'
  | 'neutral-overseas'
  | 'none';

export interface ResourceAcquisitionDemand {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly score: number;
}

export interface ResourceAcquisitionContext {
  /** Resource tiles this nation legitimately knows (own territory + revealed, seen). */
  readonly opportunities: readonly KnownResourceOpportunity[];
  /** True when an own-territory resource tile still lacks its canonical improvement and can be improved now. */
  readonly canImproveDomesticTile: (x: number, y: number) => boolean;
  /** True when the neutral land tile is reachable through ordinary land movement from the nation. */
  readonly isReachableByLand: (x: number, y: number) => boolean;
  /** Known nations (already met) that can currently export the resource. */
  readonly getKnownSuppliers: (resourceId: string) => readonly string[];
}

export interface ResourceAcquisitionPlan {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly demandScore: number;
  readonly path: ResourceAcquisitionPath;
  readonly tile?: { readonly x: number; readonly y: number };
  readonly supplierNationId?: string;
}

/** A demand is worth acting on at the same threshold that drives exploration. */
export function isSignificantDemand(score: number): boolean {
  return score >= MEANINGFUL_RESOURCE_DEMAND_SCORE;
}

/**
 * Classify one demanded resource into an acquisition path. Priority is
 * deterministic and cost-ordered (cheapest / most practical first):
 *
 *   1. Improve an unimproved source already inside own territory.
 *   2. Buy from a known foreign supplier through the existing trade system.
 *   3. Expand toward a known neutral source reachable by land.
 *   4. Remember a neutral overseas source (handled by a later prompt).
 *   5. No known source — fall back to exploration / Economic Development.
 */
export function classifyResourceAcquisition(
  demand: ResourceAcquisitionDemand,
  context: ResourceAcquisitionContext,
): ResourceAcquisitionPlan {
  const base = { resourceId: demand.resourceId, resourceName: demand.resourceName, demandScore: demand.score };
  const relevant = context.opportunities.filter((o) => o.resourceId === demand.resourceId);

  // 1. Own unimproved, improvable source.
  const domestic = relevant.find((o) => o.ownedBySelf && context.canImproveDomesticTile(o.x, o.y));
  if (domestic) {
    return { ...base, path: 'domestic-improve', tile: { x: domestic.x, y: domestic.y } };
  }

  // 2. Known foreign supplier (contact + tradable — no need to have seen the tile).
  const suppliers = context.getKnownSuppliers(demand.resourceId);
  if (suppliers.length > 0) {
    return { ...base, path: 'foreign-trade', supplierNationId: suppliers[0] };
  }

  // 3. Neutral source reachable by ordinary land expansion.
  const neutralLand = relevant.find((o) => o.neutral && !o.isWater && context.isReachableByLand(o.x, o.y));
  if (neutralLand) {
    return { ...base, path: 'neutral-land-expand', tile: { x: neutralLand.x, y: neutralLand.y } };
  }

  // 4. Neutral overseas source — kept known for the expedition prompt.
  const neutralOverseas = relevant.find((o) => o.neutral && (o.isWater || !context.isReachableByLand(o.x, o.y)));
  if (neutralOverseas) {
    return { ...base, path: 'neutral-overseas', tile: { x: neutralOverseas.x, y: neutralOverseas.y } };
  }

  // 5. Nothing actionable is known.
  return { ...base, path: 'none' };
}
