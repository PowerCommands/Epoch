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
}
