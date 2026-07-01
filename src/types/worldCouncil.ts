export const WORLD_COUNCIL_CONSTRUCTION_TURNS = 20;
export const WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD = 5000;
export const WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS = 50;

export interface WorldCouncilMember {
  readonly nationId: string;
  readonly goldContributed: number;
  readonly scienceContributionPercent: number;
  readonly cultureContributionPercent: number;
  readonly diplomacyScore: number;
  readonly diplomacyScoreSinceLastRegularMeeting: number;
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
  | 'global_free_trade_agreement'
  | 'shared_cartography'
  | 'protect_world_heritage'
  | 'condemn_aggressive_war';

export type WorldCouncilResolutionVotingType = 'none' | 'optionalParticipation' | 'influence';

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
  readonly participantNationIds?: string[];
  readonly votes?: WorldCouncilResolutionVote[];
  readonly passed?: boolean;
  readonly resolved?: boolean;
  readonly outcomeText?: string;
}

export interface WorldCouncilResolutionVote {
  readonly nationId: string;
  readonly support: boolean;
  readonly influence: number;
}

export interface WorldCouncilEnactedResolution {
  readonly id: string;
  readonly resolutionId: WorldCouncilResolutionId;
  readonly meetingId: number;
  readonly turn: number;
  readonly participantNationIds?: string[];
  readonly targetNationId?: string;
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
