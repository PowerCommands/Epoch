/** One directional political settlement; its expiry also drives the temporary AI layer. */
export interface IndependenceSettlement {
  readonly nationId: string;
  readonly formerMasterId: string;
  readonly startedTurn: number;
  readonly expiresTurn: number;
}
