export const DEFAULT_SHORT_TRADE_DEAL_DURATION = 25;
export const DEFAULT_LONG_TRADE_DEAL_DURATION = 50;

export interface HumanTradeDealDurations {
  short: number;
  long: number;
}

/** Resolve scenario/save values without ever rewriting an existing deal. */
export function resolveHumanTradeDealDurations(
  shortValue: unknown,
  longValue: unknown,
): HumanTradeDealDurations {
  const short = Number.isInteger(shortValue) && (shortValue as number) >= 1
    ? shortValue as number
    : DEFAULT_SHORT_TRADE_DEAL_DURATION;
  const long = Number.isInteger(longValue) && (longValue as number) >= 1
    ? longValue as number
    : DEFAULT_LONG_TRADE_DEAL_DURATION;
  return long > short
    ? { short, long }
    : { short: DEFAULT_SHORT_TRADE_DEAL_DURATION, long: DEFAULT_LONG_TRADE_DEAL_DURATION };
}

export interface TradeDeal {
  readonly id: string;
  readonly sellerNationId: string;
  readonly buyerNationId: string;
  readonly resourceId: string;
  readonly goldPerTurn: number;
  readonly startTurn: number;
  remainingTurns: number;
}

/** A requested human deal that has not started because its route is still building. */
export interface PendingTradeDeal {
  readonly id: string;
  readonly sellerNationId: string;
  readonly buyerNationId: string;
  readonly sellerCityId: string;
  readonly buyerCityId: string;
  readonly resourceId: string;
  readonly goldPerTurn: number;
  readonly turns: number;
  readonly routeId: string;
  readonly requestedTurn: number;
}

export type TradeDealEndReason = 'expired' | 'cancelled' | 'war' | 'buyer_cannot_pay' | 'nation_collapsed' | 'sanctions';

export interface TradeDealResult {
  ok: boolean;
  reason?: string;
  deal?: TradeDeal;
}
