/** Legacy hardcoded route-establishment value, retained as the scenario fallback. */
export const DEFAULT_TRADE_ROUTE_ESTABLISHMENT_TURNS = 80;

export function resolveTradeRouteEstablishmentTurns(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_TRADE_ROUTE_ESTABLISHMENT_TURNS;
}

export type TradeConnectionStatus = 'building' | 'active';

export interface TradeConnection {
  id: string;
  nationAId: string;
  cityAId: string;
  nationBId: string;
  cityBId: string;
  status: TradeConnectionStatus;
  /** Capacity consumed at each endpoint city. Always 1 for now. */
  capacity: number;
  createdRound: number;
}
