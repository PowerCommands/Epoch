export const WORLD_COUNCIL_CONSTRUCTION_TURNS = 20;
export const WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD = 5000;
export const WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS = 50;

/**
 * Diplomatic Score is earned from political outcomes at World Council / UN
 * meetings, not from passive per-turn contribution percentages. These are the
 * centralised, tunable award constants; the next full autorun calibrates them.
 *
 * - A nation that proposes a resolution which passes earns the largest reward.
 * - Nations that spend Influence to support a resolution that passes share a
 *   smaller pool, split by their Influence commitment (coalition building).
 * - Genuinely contributing gold to an emergency Defense Support resolution
 *   earns a small, bounded participation reward.
 *
 * Blocking an opposing proposal deliberately earns no direct score: denying a
 * rival its proposer reward is itself the reward.
 */
export const WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED = 600;
export const WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL = 300;
export const WORLD_COUNCIL_DIPLOMACY_SCORE_DEFENSE_DONATION_MAX = 40;

export type WorldCouncilOrganizationKind = 'worldCouncil' | 'un';

export interface WorldCouncilMember {
  readonly nationId: string;
  readonly goldContributed: number;
  readonly scienceContributionPercent: number;
  readonly cultureContributionPercent: number;
  readonly diplomacyScore: number;
  readonly diplomacyScoreSinceLastRegularMeeting: number;
  /** Score earned by proposing resolutions that passed. Primary victory source. */
  readonly diplomacyScoreFromProposals: number;
  /** Score earned by spending Influence to support resolutions that passed. */
  readonly diplomacyScoreFromSupport: number;
  /** Small participation reward from Defense Support gold donations. */
  readonly diplomacyScoreFromGold: number;
  /** Legacy passive-contribution buckets. No longer grow; kept for save compat. */
  readonly diplomacyScoreFromScience: number;
  readonly diplomacyScoreFromCulture: number;
  readonly diplomacyScoreFromOther: number;
}

export type WorldCouncilMeetingKind = 'regular' | 'emergency';
export type WorldCouncilEmergencyEventType = 'warDeclared';

export interface WorldCouncilEmergencyTrigger {
  readonly eventType: WorldCouncilEmergencyEventType;
  readonly aggressorNationId?: string;
  readonly targetNationId?: string;
}

export interface WorldCouncilContributionChoice {
  readonly nationId: string;
  readonly goldContributed: number;
  readonly scienceContributionPercent: number;
  readonly cultureContributionPercent: number;
}

export type WorldCouncilResolutionId =
  | 'defense_support'
  | 'global_free_trade_agreement'
  | 'shared_cartography'
  | 'protect_world_heritage'
  | 'condemn_aggressive_war'
  | 'international_sanctions'
  | 'international_embargo'
  | 'ceasefire_resolution'
  | 'nuclear_non_proliferation_treaty'
  | 'global_infrastructure_initiative'
  | 'un_peacekeeping_mission'
  | 'climate_accord'
  | 'international_development_fund';

export type WorldCouncilResolutionVotingType = 'none' | 'optionalParticipation' | 'influence' | 'special';

export interface WorldCouncilResolutionDefinition {
  readonly id: WorldCouncilResolutionId;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly votingType: WorldCouncilResolutionVotingType;
}

export interface WorldCouncilResolutionProposal {
  readonly slot: 'host' | 'random';
  readonly resolutionId: WorldCouncilResolutionId;
  readonly proposerNationId?: string;
  readonly targetNationId?: string;
  readonly secondaryTargetNationId?: string;
  readonly repealTargetEnactedResolutionId?: string;
  readonly repealTargetResolutionId?: WorldCouncilResolutionId;
  readonly participantNationIds?: string[];
  readonly donations?: WorldCouncilResolutionDonation[];
  readonly distributions?: WorldCouncilResolutionDistribution[];
  readonly totalGoldDonated?: number;
  readonly votes?: WorldCouncilResolutionVote[];
  readonly selectionDiagnostics?: WorldCouncilResolutionSelectionDiagnostics;
  readonly voteSummary?: WorldCouncilResolutionVoteSummary;
  readonly passed?: boolean;
  readonly resolved?: boolean;
  readonly outcomeText?: string;
}

export interface WorldCouncilResolutionDonation {
  readonly nationId: string;
  readonly gold: number;
  readonly diagnostics?: WorldCouncilDefenseSupportDonationDiagnostics;
}

export interface WorldCouncilResolutionDistribution {
  readonly nationId: string;
  readonly gold: number;
}

export interface WorldCouncilResolutionVote {
  readonly nationId: string;
  readonly support: boolean;
  readonly influence: number;
  readonly availableInfluence?: number;
  readonly remainingInfluence?: number;
  readonly supportScore?: number;
}

export interface WorldCouncilResolutionCandidateScore {
  readonly resolutionId: WorldCouncilResolutionId;
  readonly repealTargetEnactedResolutionId?: string;
  readonly baseScore: number;
  readonly recentPenalty: number;
  readonly repeatProposerPenalty: number;
  readonly diversityBonus: number;
  readonly finalScore: number;
  readonly reason: string;
}

export interface WorldCouncilResolutionSelectionDiagnostics {
  readonly selectedResolutionId: WorldCouncilResolutionId;
  readonly selectedRepealTargetEnactedResolutionId?: string;
  readonly candidates: WorldCouncilResolutionCandidateScore[];
}

export interface WorldCouncilResolutionVoteSummary {
  readonly supportInfluence: number;
  readonly opposeInfluence: number;
  readonly abstentions: number;
  readonly margin: number;
  readonly outcome: 'passed' | 'failed';
}

export interface WorldCouncilDefenseSupportDonationDiagnostics {
  readonly treasury: number;
  readonly goldPerTurn: number;
  readonly maximumDonation: number;
  readonly desiredDonation: number;
  readonly actualDonation: number;
  readonly score: number;
  readonly reason: string;
}

export interface WorldCouncilEnactedResolution {
  readonly id: string;
  readonly resolutionId: WorldCouncilResolutionId;
  readonly meetingId: number;
  readonly meetingKind?: WorldCouncilMeetingKind;
  readonly turn: number;
  readonly participantNationIds?: string[];
  readonly targetNationId?: string;
  readonly secondaryTargetNationId?: string;
  readonly active?: boolean;
  readonly repealed?: boolean;
  readonly expired?: boolean;
  readonly expirationTurn?: number;
  readonly repealTurn?: number;
  readonly repealMeetingId?: number;
}

export interface WorldCouncilMeeting {
  readonly id: number;
  readonly kind: WorldCouncilMeetingKind;
  readonly turn: number;
  readonly cityId: string;
  readonly hostNationId?: string;
  readonly emergencyTrigger?: WorldCouncilEmergencyTrigger;
  readonly proposals?: WorldCouncilResolutionProposal[];
}

export interface WorldCouncilPendingContributionNegotiation {
  readonly meetingId: number;
  readonly choices: WorldCouncilContributionChoice[];
  readonly awaitingHumanNationId?: string;
}

export interface WorldCouncilState {
  readonly organizationKind?: WorldCouncilOrganizationKind;
  readonly foundingCityId: string;
  readonly foundingNationId: string;
  readonly foundingTurn: number;
  readonly constructionStartedTurn: number;
  readonly constructionTurnsRemaining: number;
  readonly status: 'construction' | 'active';
  readonly memberNationIds: string[];
  readonly members: WorldCouncilMember[];
  readonly lastRegularMeetingTurn: number;
  readonly nextRegularMeetingTurn: number;
  readonly meetings: WorldCouncilMeeting[];
  readonly nextMeetingId: number;
  readonly enactedResolutions: WorldCouncilEnactedResolution[];
  readonly pendingContributionNegotiation?: WorldCouncilPendingContributionNegotiation;
}
