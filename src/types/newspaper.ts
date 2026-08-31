import type { HistoricalEvent, HistoricalEventType } from './historicalTimeline';

export type NewspaperEventType = Exclude<HistoricalEventType,
  | 'leaderInsult'
  | 'reconciliation'
  | 'worldCouncilActive'
  | 'worldCouncilMeeting'
>;

export interface NewspaperArticleContext {
  event: HistoricalEvent;
  nationNames: string[];
  leaderNames: string[];
  cityName?: string;
  wonderName?: string;
  eraName?: string;
  corporationName?: string;
  resolutionName?: string;
  governmentName?: string;
  discoveryName?: string;
}

export interface NewspaperEventDefinition {
  priority: number;
  imagePath: string;
  buildHeadline: (context: NewspaperArticleContext) => string;
  buildBody: (context: NewspaperArticleContext) => string;
  comments: readonly string[];
}

export interface NewspaperArticle {
  historicalEventId?: number;
  eventType?: HistoricalEventType;
  headline: string;
  body: string;
  comment: string;
  involvedNationIds: string[];
  involvedNationNames: string[];
  involvedLeaderNames: string[];
  imagePath?: string;
  isInsult?: boolean;
  isFiller?: boolean;
}

export type NewspaperIssueType = 'regular' | 'victory';
export type NewspaperVictoryType = 'domination' | 'science' | 'cultural' | 'diplomatic';

export interface NewspaperVictoryDetails {
  nationId: string;
  nationName: string;
  leaderName?: string;
  victoryType: NewspaperVictoryType;
  victoryTypeLabel: string;
}

/** Serializable published snapshot. This is both the runtime and save model. */
export interface NewspaperIssue {
  id: string;
  issueNumber: number;
  issueType: NewspaperIssueType;
  issueRound: number;
  coverageStartRound: number;
  coverageEndRound: number;
  worldYear: number;
  dateLabel: string;
  mainArticle: NewspaperArticle;
  secondaryArticles: [NewspaperArticle, NewspaperArticle, NewspaperArticle];
  victory?: NewspaperVictoryDetails;
}

/** Ephemeral presentation model. Games editions are never part of SavedNewspaperState. */
export interface GamesOfNationsNewspaperIssue {
  id: string;
  issueType: 'gamesSpecial';
  gamesNumber: number;
  competitionDay: number;
  sport: string;
  issueRound: number;
  coverageStartRound: number;
  coverageEndRound: number;
  worldYear: number;
  dateLabel: string;
  mainArticle: NewspaperArticle;
  secondaryArticles: [NewspaperArticle, NewspaperArticle, NewspaperArticle];
}

export type NewspaperPresentedIssue = NewspaperIssue | GamesOfNationsNewspaperIssue;

export interface SavedNewspaperState {
  lastConsumedIssueRound: number;
  /**
   * Highest History event id that existed when the latest regular Chronicle
   * was published. This gives publication an exact intra-round boundary: an
   * event registered before the issue is eligible immediately, while an event
   * registered later in that same round remains eligible for the next issue.
   */
  lastConsumedTimelineEventId?: number;
  issues?: NewspaperIssue[];
}
