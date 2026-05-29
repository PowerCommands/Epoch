export const TRADE_ROUTE_PRODUCTION_COST = 80;

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
  /** Reserved for future production queue integration. */
  remainingProduction?: number;
}
