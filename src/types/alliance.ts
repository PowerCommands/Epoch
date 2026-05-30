/**
 * Alliance Core v1 — a formal diplomatic agreement between exactly two nations.
 *
 * This first version only models the agreement itself (creation, storage,
 * display, accept/decline). No military war-joining, bonuses, or multi-member
 * support yet — those are intentionally deferred to later steps.
 */
export interface Alliance {
  id: string;
  name: string;
  /** Exactly two members in v1. */
  memberNationIds: string[];
  founderNationId: string;
  createdTurn: number;
  /** Round on which this alliance next convenes its Alliance Council. */
  nextCouncilTurn: number;
}

/** Result of validating whether an alliance proposal is allowed. */
export interface AllianceValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * External facts the alliance rules need but do not own. Lets the
 * AllianceManager keep every alliance rule in one place without depending
 * directly on the diplomacy/discovery systems.
 */
export interface AllianceProposalContext {
  haveMet(a: string, b: string): boolean;
  isAtWar(a: string, b: string): boolean;
  hasOpenBorders(a: string, b: string): boolean;
  hasEmbassy(a: string, b: string): boolean;
  hasTradeRelations(a: string, b: string): boolean;
}
