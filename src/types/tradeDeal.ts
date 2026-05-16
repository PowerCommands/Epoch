export interface TradeDeal {
  readonly id: string;
  readonly sellerNationId: string;
  readonly buyerNationId: string;
  readonly resourceId: string;
  readonly goldPerTurn: number;
  readonly startTurn: number;
  remainingTurns: number;
}

export type TradeDealEndReason = 'expired' | 'cancelled' | 'war' | 'buyer_cannot_pay' | 'nation_collapsed';

export interface TradeDealResult {
  ok: boolean;
  reason?: string;
  deal?: TradeDeal;
}
