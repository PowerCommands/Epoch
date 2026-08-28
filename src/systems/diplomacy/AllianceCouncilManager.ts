import type { DiplomacyManager } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import type { AIMilitaryEvaluationSystem } from '../ai/AIMilitaryEvaluationSystem';
import type { DiplomaticEvaluationSystem } from './DiplomaticEvaluationSystem';
import type { AllianceManager } from './AllianceManager';
import { ALLIANCE_ACCEPT_HOSTILITY, ALLIANCE_ACCEPT_TRUST } from './AllianceManager';
import { ALLIANCE_COUNCIL_INTERVAL } from '../../data/alliances';
import type {
  AllianceCouncilProposal,
  AllianceProposalType,
  CouncilDialogView,
  CouncilHeaderView,
  CouncilPhase,
  CouncilTargetOption,
} from '../../types/allianceCouncil';

type MemberDecision = 'stay' | 'leave';

/**
 * External hooks the council needs but does not own: turn/round source, human
 * detection, autoplay gating, logging, the human decision popups, the trade
 * embargo execution, and a UI refresh signal. Keeps council logic free of UI
 * and trade/scheduling plumbing.
 */
export interface AllianceCouncilContext {
  getCurrentRound(): number;
  isHuman(nationId: string): boolean;
  isAutoplayActive(): boolean;
  log(nationIds: string[], message: string): void;
  /** Show/update the human council dialog for the current step. */
  openCouncilDialog(view: CouncilDialogView): void;
  /** Close the human council dialog. */
  closeCouncilDialog(): void;
  /** Ask a human invite target (not a council member) to accept or reject joining. */
  requestHumanInviteResponse(allianceName: string, proposerName: string, onAccept: () => void, onReject: () => void): void;
  /** Break trade relations/deals/routes between an alliance member and the embargo target. */
  embargoTrade(memberNationId: string, targetNationId: string): void;
  onChanged(): void;
}

/** A full council run, persisted across the human's async steps. */
interface CouncilSession {
  allianceId: string;
  allianceName: string;
  councilTurn: number;
  /** Members present when the council opened (for the dialog header). */
  allMembers: string[];
  /** The human member participating interactively, or null (AI-only / autoplay). */
  humanMemberId: string | null;
  phase: CouncilPhase;
  decisions: Map<string, MemberDecision>;
  /** Remaining members after stay/leave (the proposers and voters). */
  members: string[];
  proposals: AllianceCouncilProposal[];
  proposalCursor: number;
  voteProposalCursor: number;
  resultLines: string[];
  /** True once the human chose to remain (and thus keeps participating). */
  humanParticipated: boolean;
}

/**
 * Alliance Council (Phases 1–3): scheduling, leave/stay, and proposals.
 *
 * Every {@link ALLIANCE_COUNCIL_INTERVAL} rounds each alliance opens a council.
 * Members first choose stay/leave (leavers depart immediately with a penalty;
 * an alliance below two members dissolves). Each remaining member may then
 * submit one proposal — invite a nation, trade embargo, or coordinated war —
 * which all other members vote on with veto power; unanimous approval passes
 * and executes it immediately.
 *
 * AI members decide autonomously (proposing only with good reason, so most
 * councils stay quiet). A human participates through a dedicated dialog driven
 * via the context. Membership/dissolution live in {@link AllianceManager};
 * war/trade execution goes through the central diplomacy/trade systems.
 */
export class AllianceCouncilManager {
  /** The single council currently awaiting human input, if any. */
  private activeSession: CouncilSession | null = null;
  private proposalCounter = 0;
  /** Current holder of a nation's lost capital; unset keeps legacy behavior. */
  private getReclaimHolderId: (nationId: string) => string | undefined = () => undefined;

  constructor(
    private readonly allianceManager: AllianceManager,
    private readonly nationManager: NationManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly diplomaticEvaluationSystem: DiplomaticEvaluationSystem,
    private readonly haveMet: (a: string, b: string) => boolean,
    private readonly context: AllianceCouncilContext,
  ) {}

  setReclaimHolderProvider(provider: (nationId: string) => string | undefined): void {
    this.getReclaimHolderId = provider;
  }

  /** Open any alliance whose council round has arrived. Call once per round. */
  update(): void {
    const round = this.context.getCurrentRound();
    // Snapshot: processing may dissolve alliances mid-iteration.
    for (const alliance of [...this.allianceManager.getAllAlliances()]) {
      if (this.activeSession?.allianceId === alliance.id) continue; // awaiting human input
      if (round < alliance.nextCouncilTurn) continue;
      this.startCouncil(alliance.id);
    }
  }

  // ─── Phase: leaveStay ───────────────────────────────────────────────────────

  private startCouncil(allianceId: string): void {
    const alliance = this.allianceManager.getAllianceById(allianceId);
    if (!alliance) return;

    const round = this.context.getCurrentRound();
    // Advance the schedule now so the council does not re-fire while pending.
    this.allianceManager.setNextCouncilTurn(allianceId, round + ALLIANCE_COUNCIL_INTERVAL);
    const members = alliance.memberNationIds.slice();
    this.context.log(members.slice(), `Alliance Council opened for ${alliance.name}.`);

    const humanMemberId = !this.context.isAutoplayActive()
      ? (members.find((id) => this.context.isHuman(id)) ?? null)
      : null;

    const session: CouncilSession = {
      allianceId,
      allianceName: alliance.name,
      councilTurn: round,
      allMembers: members,
      humanMemberId,
      phase: 'leaveStay',
      decisions: new Map(),
      members: [],
      proposals: [],
      proposalCursor: 0,
      voteProposalCursor: 0,
      resultLines: [],
      humanParticipated: false,
    };

    // Collect AI stay/leave decisions immediately.
    for (const memberId of members) {
      if (memberId === humanMemberId) continue;
      session.decisions.set(memberId, this.decideAIMember(memberId, members));
    }

    if (humanMemberId !== null) {
      this.activeSession = session;
      this.context.openCouncilDialog({
        phase: 'leaveStay',
        header: this.buildHeader(session),
        onRemain: () => this.resolveStayLeave(true),
        onLeave: () => this.resolveStayLeave(false),
      });
      return;
    }

    this.runStayLeave(session);
  }

  private resolveStayLeave(stay: boolean): void {
    const session = this.activeSession;
    if (!session || session.humanMemberId === null) return;
    session.decisions.set(session.humanMemberId, stay ? 'stay' : 'leave');
    this.runStayLeave(session);
  }

  private runStayLeave(session: CouncilSession): void {
    const { allianceId, allianceName, allMembers } = session;
    const leavers = allMembers.filter((id) => session.decisions.get(id) === 'leave');
    const stayers = allMembers.filter((id) => session.decisions.get(id) !== 'leave');

    for (const leaver of leavers) {
      this.allianceManager.removeMember(allianceId, leaver);
      for (const stayer of stayers) {
        this.diplomacyManager.recordAllianceDeparture(leaver, stayer);
      }
      this.context.log([leaver, ...stayers], `${this.nationName(leaver)} left ${allianceName}.`);
      session.resultLines.push(`${this.nationName(leaver)} left the alliance.`);
    }
    for (const stayer of stayers) {
      this.context.log([stayer], `${this.nationName(stayer)} remained in ${allianceName}.`);
    }

    session.members = stayers;
    session.humanParticipated = session.humanMemberId !== null
      && session.decisions.get(session.humanMemberId) === 'stay';

    const remaining = this.allianceManager.getAllianceById(allianceId);
    const survives = remaining !== null && remaining.memberNationIds.length >= 2;
    if (!survives) {
      if (remaining) this.allianceManager.dissolve(allianceId);
      this.context.log(allMembers.slice(), `${allianceName} was dissolved after membership dropped below two nations.`);
      session.resultLines.push(`${allianceName} was dissolved.`);
      this.concludeCouncil(session);
      return;
    }

    session.phase = 'proposalSubmission';
    this.runProposalPhase(session);
  }

  // ─── Phase: proposalSubmission ──────────────────────────────────────────────

  private runProposalPhase(session: CouncilSession): void {
    while (session.proposalCursor < session.members.length) {
      const proposerId = session.members[session.proposalCursor];
      if (proposerId === session.humanMemberId && session.humanParticipated) {
        this.activeSession = session;
        this.context.openCouncilDialog({
          phase: 'proposalSubmission',
          header: this.buildHeader(session),
          options: this.getHumanProposalOptions(session, proposerId),
          onSubmit: (type, targetId) => this.resolveHumanProposal(type, targetId),
          onSkip: () => this.resolveHumanProposal(null, null),
        });
        return;
      }
      const proposal = this.buildAIProposal(proposerId, session);
      if (proposal) this.submitProposal(proposal, session);
      session.proposalCursor += 1;
    }

    session.phase = 'voting';
    this.runVotingPhase(session);
  }

  private resolveHumanProposal(type: AllianceProposalType | null, targetId: string | null): void {
    const session = this.activeSession;
    if (!session || session.humanMemberId === null) return;
    if (type !== null && targetId !== null && this.isValidTarget(session, session.humanMemberId, type, targetId)) {
      this.submitProposal(this.makeProposal(session.humanMemberId, session.allianceId, type, targetId), session);
    }
    session.proposalCursor += 1;
    this.runProposalPhase(session);
  }

  // ─── Phase: voting ──────────────────────────────────────────────────────────

  private runVotingPhase(session: CouncilSession): void {
    while (session.voteProposalCursor < session.proposals.length) {
      const proposal = session.proposals[session.voteProposalCursor];
      const voters = session.members.filter((id) => id !== proposal.proposerNationId);
      for (const voter of voters) {
        if (proposal.votes[voter] !== undefined) continue;
        if (voter === session.humanMemberId && session.humanParticipated) {
          this.activeSession = session;
          this.context.openCouncilDialog({
            phase: 'voting',
            header: this.buildHeader(session),
            proposerName: this.nationName(proposal.proposerNationId),
            proposalType: proposal.type,
            targetName: this.nationName(proposal.targetNationId),
            consequence: this.describeConsequence(proposal),
            onApprove: () => this.castHumanVote('approve'),
            onReject: () => this.castHumanVote('reject'),
          });
          return;
        }
        proposal.votes[voter] = this.aiVote(voter, proposal) ? 'approve' : 'reject';
      }
      this.resolveProposal(proposal, session);
      session.voteProposalCursor += 1;
    }

    this.concludeCouncil(session);
  }

  private castHumanVote(vote: 'approve' | 'reject'): void {
    const session = this.activeSession;
    if (!session || session.humanMemberId === null) return;
    const proposal = session.proposals[session.voteProposalCursor];
    if (!proposal) return;
    proposal.votes[session.humanMemberId] = vote;
    this.runVotingPhase(session);
  }

  // ─── Phase: resolution / complete ───────────────────────────────────────────

  private concludeCouncil(session: CouncilSession): void {
    session.phase = 'complete';
    this.context.log(session.allMembers.slice(), `${session.allianceName} Council concluded.`);

    // Only the human's own council owns the shared dialog / active-session slot;
    // AI-only councils run synchronously and must not disturb it.
    const isHumanSession = session.humanMemberId !== null;

    if (isHumanSession && session.humanParticipated && !this.context.isAutoplayActive()) {
      this.activeSession = session;
      this.context.openCouncilDialog({
        phase: 'resolution',
        header: this.buildHeader(session),
        summary: session.resultLines,
        onClose: () => {
          this.activeSession = null;
          this.context.closeCouncilDialog();
          this.context.onChanged();
        },
      });
      return;
    }

    if (isHumanSession) {
      // Human left (or autoplay) — make sure their dialog is dismissed.
      this.activeSession = null;
      this.context.closeCouncilDialog();
    }
    this.context.onChanged();
  }

  private submitProposal(proposal: AllianceCouncilProposal, session: CouncilSession): void {
    session.proposals.push(proposal);
    this.context.log(
      [proposal.proposerNationId, ...session.members.filter((id) => id !== proposal.proposerNationId)],
      this.describeSubmission(proposal),
    );
  }

  private resolveProposal(proposal: AllianceCouncilProposal, session: CouncilSession): void {
    const voters = session.members.filter((id) => id !== proposal.proposerNationId);
    const allApprove = voters.every((id) => proposal.votes[id] === 'approve');
    proposal.status = allApprove ? 'passed' : 'failed';
    const proposerName = this.nationName(proposal.proposerNationId);

    for (const voter of voters) {
      if (proposal.votes[voter] === 'approve') {
        this.diplomacyManager.recordProposalApproved(proposal.proposerNationId, voter);
        this.context.log([voter, proposal.proposerNationId], `${this.nationName(voter)} approved ${proposerName}'s proposal.`);
      } else {
        this.diplomacyManager.recordProposalRejected(proposal.proposerNationId, voter);
        this.context.log([voter, proposal.proposerNationId], `${this.nationName(voter)} rejected ${proposerName}'s proposal.`);
      }
    }

    if (allApprove) {
      this.context.log(session.members.slice(), `${proposerName}'s proposal passed in ${session.allianceName}.`);
      this.executeProposal(proposal, session);
    } else {
      this.context.log(session.members.slice(), `${proposerName}'s proposal failed in ${session.allianceName}.`);
      session.resultLines.push(`Failed: ${this.describeSummaryAction(proposal)}.`);
    }
  }

  private executeProposal(proposal: AllianceCouncilProposal, session: CouncilSession): void {
    const target = proposal.targetNationId;
    switch (proposal.type) {
      case 'startWar': {
        if (!this.isValidWarTarget(session, target)) return;
        for (const member of this.currentMembers(session.allianceId)) {
          // Central system: defensive activation still fires if the target has its own ally.
          this.diplomacyManager.declareWar(member, target);
        }
        this.context.log(session.members.slice(), `${session.allianceName} declared war on ${this.nationName(target)}.`);
        session.resultLines.push(`Declared war on ${this.nationName(target)}.`);
        break;
      }
      case 'tradeEmbargo': {
        if (!this.isValidEmbargoTarget(session, target)) return;
        for (const member of this.currentMembers(session.allianceId)) {
          this.context.embargoTrade(member, target);
        }
        this.context.log(session.members.slice(), `${session.allianceName} enacted a trade embargo against ${this.nationName(target)}.`);
        session.resultLines.push(`Enacted a trade embargo against ${this.nationName(target)}.`);
        break;
      }
      case 'inviteNation':
        this.executeInvite(proposal, session);
        break;
    }
    this.context.onChanged();
  }

  private executeInvite(proposal: AllianceCouncilProposal, session: CouncilSession): void {
    const allianceId = session.allianceId;
    const target = proposal.targetNationId;
    if (!this.isValidInviteTarget(session, proposal.proposerNationId, target)) return;
    const targetName = this.nationName(target);

    if (this.context.isHuman(target) && !this.context.isAutoplayActive()) {
      // Ask the human target; resolves independently of the council session.
      this.context.requestHumanInviteResponse(
        session.allianceName,
        this.nationName(proposal.proposerNationId),
        () => this.acceptInvite(allianceId, target),
        () => this.context.log([target, proposal.proposerNationId], `${targetName} declined the invitation to ${session.allianceName}.`),
      );
      session.resultLines.push(`Invitation sent to ${targetName}.`);
      return;
    }

    // AI target: accept on a clearly positive relationship with the proposer.
    const relation = this.diplomacyManager.getRelation(target, proposal.proposerNationId);
    if (relation.trust >= ALLIANCE_ACCEPT_TRUST && relation.hostility <= ALLIANCE_ACCEPT_HOSTILITY) {
      this.acceptInvite(allianceId, target);
      session.resultLines.push(`${targetName} joined the alliance.`);
    } else {
      this.context.log([target, proposal.proposerNationId], `${targetName} declined the invitation to ${session.allianceName}.`);
      session.resultLines.push(`${targetName} declined the invitation.`);
    }
  }

  private acceptInvite(allianceId: string, targetId: string): void {
    const alliance = this.allianceManager.getAllianceById(allianceId);
    if (!alliance) return;
    if (this.allianceManager.isInAlliance(targetId)) return;
    const existingMembers = alliance.memberNationIds.slice();
    this.allianceManager.addMember(allianceId, targetId);
    // Moderate relationship boost between the new member and existing members.
    for (const member of existingMembers) {
      this.diplomacyManager.recordAllianceFormed(targetId, member);
    }
    this.context.log([targetId, ...existingMembers], `${this.nationName(targetId)} joined ${alliance.name}.`);
    this.context.onChanged();
  }

  // ─── Human dialog helpers ───────────────────────────────────────────────────

  private buildHeader(session: CouncilSession): CouncilHeaderView {
    return {
      allianceName: session.allianceName,
      councilTurn: session.councilTurn,
      members: session.allMembers.map((id) => ({
        name: this.nationName(id),
        isYou: id === session.humanMemberId,
      })),
      phase: session.phase,
    };
  }

  private getHumanProposalOptions(session: CouncilSession, proposerId: string): {
    inviteNation: CouncilTargetOption[];
    tradeEmbargo: CouncilTargetOption[];
    startWar: CouncilTargetOption[];
  } {
    const toOptions = (type: AllianceProposalType): CouncilTargetOption[] =>
      this.nationManager.getAllNations()
        .filter((nation) => this.isValidTarget(session, proposerId, type, nation.id))
        .map((nation) => ({ id: nation.id, name: nation.name }));
    return {
      inviteNation: toOptions('inviteNation'),
      tradeEmbargo: toOptions('tradeEmbargo'),
      startWar: toOptions('startWar'),
    };
  }

  private isValidTarget(session: CouncilSession, proposerId: string, type: AllianceProposalType, targetId: string): boolean {
    switch (type) {
      case 'inviteNation': return this.isValidInviteTarget(session, proposerId, targetId);
      case 'tradeEmbargo': return this.isValidEmbargoTarget(session, targetId) && this.haveMet(proposerId, targetId);
      case 'startWar': return this.isValidWarTarget(session, targetId) && this.haveMet(proposerId, targetId);
    }
  }

  // ─── AI proposal generation ────────────────────────────────────────────────

  /**
   * Pick at most one proposal for an AI member, in priority order: a favorable
   * coordinated war, then a trade embargo on a disliked low-trade rival, then an
   * invite for a trusted friend. Even when a candidate exists, a low, signal-
   * weighted deterministic chance gates submission so most councils stay quiet.
   */
  private buildAIProposal(proposerId: string, session: CouncilSession): AllianceCouncilProposal | null {
    const candidate = this.findBestCandidate(proposerId, session);
    if (!candidate) return null;
    if (!this.aiWantsToPropose(proposerId, session, candidate)) return null;
    return candidate;
  }

  private findBestCandidate(proposerId: string, session: CouncilSession): AllianceCouncilProposal | null {
    const warTarget = this.findWarTarget(proposerId, session);
    if (warTarget) return this.makeProposal(proposerId, session.allianceId, 'startWar', warTarget);
    const embargoTarget = this.findEmbargoTarget(proposerId, session);
    if (embargoTarget) return this.makeProposal(proposerId, session.allianceId, 'tradeEmbargo', embargoTarget);
    const inviteTarget = this.findInviteTarget(proposerId, session);
    if (inviteTarget) return this.makeProposal(proposerId, session.allianceId, 'inviteNation', inviteTarget);
    return null;
  }

  /**
   * Deterministic, signal-weighted gate on whether the AI actually submits a
   * candidate. Low base chance, raised by hostility/fear toward the target (and
   * by the proposal type's natural appetite). Seeded by round/alliance/proposer
   * so it is reproducible across save/load.
   */
  private aiWantsToPropose(proposerId: string, session: CouncilSession, candidate: AllianceCouncilProposal): boolean {
    const targetId = candidate.targetNationId;
    const attitude = this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, targetId);
    const relation = this.diplomacyManager.getRelation(proposerId, targetId);
    let chance = 0.05; // low base — councils should usually stay quiet for AI members
    switch (candidate.type) {
      case 'startWar':
        chance += 0.1 + (attitude === 'hostile' ? 0.1 : 0);
        break;
      case 'tradeEmbargo':
        chance += 0.15 + (attitude === 'hostile' || attitude === 'afraid' ? 0.15 : 0) + relation.fear / 300;
        break;
      case 'inviteNation':
        chance += 0.1 + (attitude === 'friendly' ? 0.15 : 0);
        break;
    }
    return deterministicUnit(`${session.councilTurn}:${session.allianceId}:${proposerId}`) < chance;
  }

  private makeProposal(proposerId: string, allianceId: string, type: AllianceProposalType, targetId: string): AllianceCouncilProposal {
    this.proposalCounter += 1;
    return {
      id: `proposal_${allianceId}_${this.proposalCounter}`,
      allianceId,
      proposerNationId: proposerId,
      type,
      targetNationId: targetId,
      votes: {},
      status: 'pending',
    };
  }

  private findWarTarget(proposerId: string, session: CouncilSession): string | null {
    const allianceStrength = this.allianceStrength(session.members);
    const reclaimHolderId = this.getReclaimHolderId(proposerId);
    for (const nation of this.nationManager.getAllNations()) {
      const targetId = nation.id;
      if (reclaimHolderId !== undefined && targetId !== reclaimHolderId) continue;
      if (!this.isValidWarTarget(session, targetId)) continue;
      if (!this.haveMet(proposerId, targetId)) continue;
      if (this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, targetId) !== 'hostile') continue;
      const targetDefensivePower = this.militaryEvaluationSystem.getDefensiveWarPowerAgainst(proposerId, targetId);
      if (allianceStrength >= targetDefensivePower * 1.1) return targetId;
    }
    return null;
  }

  private findEmbargoTarget(proposerId: string, session: CouncilSession): string | null {
    for (const nation of this.nationManager.getAllNations()) {
      const targetId = nation.id;
      if (!this.isValidEmbargoTarget(session, targetId)) continue;
      if (!this.haveMet(proposerId, targetId)) continue;
      const attitude = this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, targetId);
      if (attitude !== 'hostile' && attitude !== 'afraid') continue;
      if (this.diplomacyManager.hasTradeRelations(proposerId, targetId)) continue; // proposer values that trade
      return targetId;
    }
    return null;
  }

  private findInviteTarget(proposerId: string, session: CouncilSession): string | null {
    for (const nation of this.nationManager.getAllNations()) {
      const targetId = nation.id;
      if (!this.isValidInviteTarget(session, proposerId, targetId)) continue;
      const relation = this.diplomacyManager.getRelation(proposerId, targetId);
      if (this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, targetId) === 'friendly' && relation.trust >= 60) {
        return targetId;
      }
    }
    return null;
  }

  // ─── Voting ─────────────────────────────────────────────────────────────────

  /** Deterministic AI vote (true = approve) honoring each proposal type's logic. */
  private aiVote(voterId: string, proposal: AllianceCouncilProposal): boolean {
    const targetId = proposal.targetNationId;
    const attitude = this.diplomaticEvaluationSystem.evaluateAttitude(voterId, targetId);
    switch (proposal.type) {
      case 'inviteNation': {
        if (this.diplomacyManager.getState(voterId, targetId) === 'WAR') return false;
        if (attitude === 'hostile') return false;
        if (this.diplomacyManager.getRelation(voterId, targetId).hostility >= 40) return false;
        return true;
      }
      case 'tradeEmbargo': {
        if (attitude === 'friendly') return false;
        if (this.diplomacyManager.hasTradeRelations(voterId, targetId)) return false; // valuable trade
        return true;
      }
      case 'startWar': {
        // An alliance-council war is an elective offensive commitment. A nation
        // with Reclaim Capital therefore vetoes every target except the current
        // holder. Defensive alliance obligations never pass through this path.
        const reclaimHolderId = this.getReclaimHolderId(voterId);
        if (reclaimHolderId !== undefined && reclaimHolderId !== targetId) return false;
        if (attitude === 'friendly') return false;
        if (this.countActiveWars(voterId) >= 2) return false;
        const voterPower = this.militaryEvaluationSystem.getMilitaryStrength(voterId).totalStrength;
        if (voterPower <= 0) return false;
        const targetDefensivePower = this.militaryEvaluationSystem.getDefensiveWarPowerAgainst(voterId, targetId);
        if (this.allianceStrength(this.currentMembers(proposal.allianceId)) < targetDefensivePower) return false;
        return true;
      }
    }
  }

  // ─── Target validation ──────────────────────────────────────────────────────

  private isValidWarTarget(session: CouncilSession, targetId: string): boolean {
    if (this.isMember(session.allianceId, targetId)) return false;
    if (!this.militaryEvaluationSystem.isNationActive(targetId)) return false;
    for (const member of this.currentMembers(session.allianceId)) {
      if (this.allianceManager.areAllied(member, targetId)) return false; // target allied with a member
      if (this.diplomacyManager.getState(member, targetId) === 'WAR') return false; // a member already at war — no duplicate war proposal
    }
    return true;
  }

  private isValidEmbargoTarget(session: CouncilSession, targetId: string): boolean {
    if (this.isMember(session.allianceId, targetId)) return false;
    return this.militaryEvaluationSystem.isNationActive(targetId);
  }

  private isValidInviteTarget(session: CouncilSession, proposerId: string, targetId: string): boolean {
    if (targetId === proposerId) return false;
    if (!this.militaryEvaluationSystem.isNationActive(targetId)) return false;
    if (this.allianceManager.isInAlliance(targetId)) return false;
    for (const member of this.currentMembers(session.allianceId)) {
      if (this.diplomacyManager.getState(member, targetId) === 'WAR') return false;
    }
    return this.haveMet(proposerId, targetId);
  }

  private isMember(allianceId: string, nationId: string): boolean {
    return this.currentMembers(allianceId).includes(nationId);
  }

  private currentMembers(allianceId: string): string[] {
    return this.allianceManager.getAllianceById(allianceId)?.memberNationIds.slice() ?? [];
  }

  private allianceStrength(members: string[]): number {
    return members.reduce((sum, id) => sum + this.militaryEvaluationSystem.getMilitaryStrength(id).totalStrength, 0);
  }

  private countActiveWars(nationId: string): number {
    let count = 0;
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') count += 1;
    }
    return count;
  }

  // ─── Descriptions ───────────────────────────────────────────────────────────

  private describeSubmission(proposal: AllianceCouncilProposal): string {
    const proposer = this.nationName(proposal.proposerNationId);
    const target = this.nationName(proposal.targetNationId);
    switch (proposal.type) {
      case 'inviteNation': {
        const allianceName = this.allianceManager.getAllianceById(proposal.allianceId)?.name ?? 'the alliance';
        return `${proposer} proposed inviting ${target} to ${allianceName}.`;
      }
      case 'tradeEmbargo': return `${proposer} proposed a trade embargo against ${target}.`;
      case 'startWar': return `${proposer} proposed a coordinated war against ${target}.`;
    }
  }

  /** Plain consequence shown to the human voter. */
  private describeConsequence(proposal: AllianceCouncilProposal): string {
    const target = this.nationName(proposal.targetNationId);
    switch (proposal.type) {
      case 'inviteNation': return `${target} would be invited to join the alliance.`;
      case 'tradeEmbargo': return `All members would cut trade with ${target}.`;
      case 'startWar': return `All members would declare war on ${target}.`;
    }
  }

  /** Short action phrase for the result summary. */
  private describeSummaryAction(proposal: AllianceCouncilProposal): string {
    const target = this.nationName(proposal.targetNationId);
    switch (proposal.type) {
      case 'inviteNation': return `invite ${target}`;
      case 'tradeEmbargo': return `trade embargo against ${target}`;
      case 'startWar': return `war against ${target}`;
    }
  }

  /**
   * Simple, deterministic AI leave/stay decision. Leans toward staying; leaves
   * only when relations with the other members are clearly poor. Considers
   * trust/affinity/hostility, the ally's military value, and whether the
   * alliance helps deter active enemies.
   */
  private decideAIMember(memberId: string, members: string[]): MemberDecision {
    let stayScore = 1; // mild bias toward keeping the alliance
    const selfPower = this.militaryEvaluationSystem.getMilitaryStrength(memberId).totalStrength;

    for (const otherId of members) {
      if (otherId === memberId) continue;
      const relation = this.diplomacyManager.getRelation(memberId, otherId);
      stayScore += (relation.trust - 50) / 10;
      stayScore += relation.affinity / 15;
      stayScore -= relation.hostility / 10;
      const allyPower = this.militaryEvaluationSystem.getMilitaryStrength(otherId).totalStrength;
      if (allyPower >= selfPower * 0.5) stayScore += 1; // militarily valuable partner
    }

    if (this.hasActiveEnemies(memberId)) stayScore += 1; // alliance helps deter enemies

    return stayScore >= 0 ? 'stay' : 'leave';
  }

  private hasActiveEnemies(nationId: string): boolean {
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') return true;
    }
    return false;
  }

  private nationName(nationId: string): string {
    return this.nationManager.getNation(nationId)?.name ?? nationId;
  }
}

/** Deterministic value in [0, 1) from a seed string (FNV-1a based). */
function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}
