import type { DiplomaticProposal } from './DiplomaticProposal';

export type DiplomaticProposalListener = (proposal: DiplomaticProposal) => void;

/**
 * Stores diplomatic proposals and emits lifecycle events. It does NOT apply
 * any game effects — wiring in GameScene listens to `onAccepted` and routes
 * each proposal kind to the appropriate existing system.
 */
export class DiplomaticProposalSystem {
  private readonly proposals = new Map<string, DiplomaticProposal>();
  private nextProposalNumber = 1;
  private readonly createdListeners: DiplomaticProposalListener[] = [];
  private readonly acceptedListeners: DiplomaticProposalListener[] = [];
  private readonly rejectedListeners: DiplomaticProposalListener[] = [];
  private readonly expiredListeners: DiplomaticProposalListener[] = [];

  createProposal(input: Omit<DiplomaticProposal, 'id' | 'status'>): DiplomaticProposal {
    const proposal: DiplomaticProposal = {
      ...input,
      id: `proposal_${this.nextProposalNumber++}`,
      status: 'pending',
    };
    this.proposals.set(proposal.id, proposal);
    this.emit(this.createdListeners, proposal);
    return proposal;
  }

  getProposal(proposalId: string): DiplomaticProposal | undefined {
    return this.proposals.get(proposalId);
  }

  getProposalsForNation(nationId: string): DiplomaticProposal[] {
    return Array.from(this.proposals.values())
      .filter((proposal) => proposal.toNationId === nationId);
  }

  getPendingProposalsForNation(nationId: string): DiplomaticProposal[] {
    return this.getProposalsForNation(nationId).filter((proposal) => proposal.status === 'pending');
  }

  acceptProposal(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') return;
    proposal.status = 'accepted';
    this.emit(this.acceptedListeners, proposal);
  }

  rejectProposal(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') return;
    proposal.status = 'rejected';
    this.emit(this.rejectedListeners, proposal);
  }

  /**
   * Mark proposals whose expiration turn has passed as expired and emit the
   * matching event. Call once per turn boundary.
   */
  update(turn: number): void {
    for (const proposal of this.proposals.values()) {
      if (proposal.status !== 'pending') continue;
      if (turn < proposal.expiresTurn) continue;
      proposal.status = 'expired';
      this.emit(this.expiredListeners, proposal);
    }
  }

  onCreated(listener: DiplomaticProposalListener): void {
    this.createdListeners.push(listener);
  }

  onAccepted(listener: DiplomaticProposalListener): void {
    this.acceptedListeners.push(listener);
  }

  onRejected(listener: DiplomaticProposalListener): void {
    this.rejectedListeners.push(listener);
  }

  onExpired(listener: DiplomaticProposalListener): void {
    this.expiredListeners.push(listener);
  }

  private emit(listeners: DiplomaticProposalListener[], proposal: DiplomaticProposal): void {
    for (const listener of listeners) listener(proposal);
  }
}
