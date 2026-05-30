/**
 * Alliance Council Proposals (Phase 2).
 *
 * After stay/leave decisions, each remaining member may submit one proposal.
 * Every other remaining member votes with veto power — a proposal passes only
 * if all of them approve.
 */
export type AllianceProposalType = 'inviteNation' | 'tradeEmbargo' | 'startWar';

export type ProposalVote = 'approve' | 'reject';

export type ProposalStatus = 'pending' | 'passed' | 'failed';

export interface AllianceCouncilProposal {
  id: string;
  allianceId: string;
  proposerNationId: string;
  type: AllianceProposalType;
  targetNationId: string;
  /** Vote per non-proposer member. */
  votes: Record<string, ProposalVote>;
  status: ProposalStatus;
}

/** Phases of a council, exposed so the human dialog can reflect progress. */
export type CouncilPhase = 'leaveStay' | 'proposalSubmission' | 'voting' | 'resolution' | 'complete';

/** A selectable proposal target shown to the human. */
export interface CouncilTargetOption {
  id: string;
  name: string;
}

/** Shared header shown across all council dialog steps. */
export interface CouncilHeaderView {
  allianceName: string;
  councilTurn: number;
  members: Array<{ name: string; isYou: boolean }>;
  phase: CouncilPhase;
}

/**
 * View pushed to the human council dialog. The council manager builds it with
 * data and callbacks; the UI only renders and forwards clicks.
 */
export type CouncilDialogView =
  | {
      phase: 'leaveStay';
      header: CouncilHeaderView;
      onRemain: () => void;
      onLeave: () => void;
    }
  | {
      phase: 'proposalSubmission';
      header: CouncilHeaderView;
      options: {
        inviteNation: CouncilTargetOption[];
        tradeEmbargo: CouncilTargetOption[];
        startWar: CouncilTargetOption[];
      };
      onSubmit: (type: AllianceProposalType, targetId: string) => void;
      onSkip: () => void;
    }
  | {
      phase: 'voting';
      header: CouncilHeaderView;
      proposerName: string;
      proposalType: AllianceProposalType;
      targetName: string;
      consequence: string;
      onApprove: () => void;
      onReject: () => void;
    }
  | {
      phase: 'resolution';
      header: CouncilHeaderView;
      summary: string[];
      onClose: () => void;
    };
