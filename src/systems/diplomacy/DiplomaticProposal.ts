export type DiplomaticProposalKind =
  | 'open_borders'
  | 'embassy'
  | 'resource_trade'
  | 'gold_trade'
  | 'peace';

export type DiplomaticProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired';

export interface DiplomaticProposalBase {
  readonly id: string;
  readonly fromNationId: string;
  readonly toNationId: string;
  readonly createdTurn: number;
  readonly expiresTurn: number;
  status: DiplomaticProposalStatus;
}

export interface DiplomaticOpenBordersPayload {
  readonly kind: 'open_borders';
}

export interface DiplomaticEmbassyPayload {
  readonly kind: 'embassy';
}

export interface DiplomaticPeacePayload {
  readonly kind: 'peace';
}

/**
 * fromNation supplies `resourceId` to toNation for `turns` turns.
 * toNation pays `goldPerTurn` to fromNation each turn.
 *
 * When `sellerNationId`/`buyerNationId` are provided they override the
 * fromNationId/toNationId defaults. Used when the proposer is the buyer
 * (AI requesting to buy from the human player) so the proposal still
 * routes to the human as `toNationId` while the actual deal seller/buyer
 * are correctly recorded.
 */
export interface DiplomaticResourceTradePayload {
  readonly kind: 'resource_trade';
  readonly resourceId: string;
  readonly turns: number;
  readonly goldPerTurn: number;
  /** If set, overrides fromNationId as the deal seller. */
  readonly sellerNationId?: string;
  /** If set, overrides toNationId as the deal buyer. */
  readonly buyerNationId?: string;
}

/**
 * fromNation transfers `goldAmount` to toNation as a one-time payment.
 */
export interface DiplomaticGoldTradePayload {
  readonly kind: 'gold_trade';
  readonly goldAmount: number;
}

export type DiplomaticProposalPayload =
  | DiplomaticOpenBordersPayload
  | DiplomaticEmbassyPayload
  | DiplomaticPeacePayload
  | DiplomaticResourceTradePayload
  | DiplomaticGoldTradePayload;

export type DiplomaticProposal = DiplomaticProposalBase & {
  readonly kind: DiplomaticProposalKind;
  readonly payload: DiplomaticProposalPayload;
};
