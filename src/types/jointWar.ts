/**
 * Joint War Requests — a diplomatic ask for a third nation to start or join a
 * war against a target.
 *
 *  - 'request': proposer is NOT at war with the target. If accepted, both
 *    proposer and receiver declare war on the target (a coordinated new war).
 *  - 'join': proposer IS already at war with the target. If accepted, the
 *    receiver also declares war on the target (recruit into an existing war).
 */
export type JointWarKind = 'request' | 'join';

export interface JointWarValidationResult {
  ok: boolean;
  reason?: string;
}

/** A concrete joint-war proposal: who asks whom, against whom, and which kind. */
export interface JointWarProposal {
  proposerNationId: string;
  receiverNationId: string;
  targetNationId: string;
  kind: JointWarKind;
  /**
   * Whether the proposer sweetens the ask by granting the receiver exploitation
   * rights in the proposer's own territory (committed on acceptance). Set by AI
   * proposal-building only when it would meaningfully help persuade the receiver.
   */
  offerExploitationRights?: boolean;
  /** Linear AI retry sweetener. Zero/absent preserves the original offer. */
  offeredGold?: number;
  /** Consecutive prior rejections for this proposer/receiver/target situation. */
  rejectionCount?: number;
  /** Snapshot used by the orchestrator for reserve diagnostics. */
  proposerTreasury?: number;
  /** True when this retry must be skipped rather than reducing its fixed bid. */
  goldOfferBlockedByReserve?: boolean;
}

/** Persistent, situation-scoped AI Join War rejection memory. */
export interface SavedJointWarEscalation {
  proposerNationId: string;
  receiverNationId: string;
  targetNationId: string;
  rejectionCount: number;
}
