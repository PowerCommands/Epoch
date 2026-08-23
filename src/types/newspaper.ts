import type { HistoricalEvent, HistoricalEventType } from './historicalTimeline';

export type NewspaperEventType = Exclude<HistoricalEventType,
  | 'leaderInsult'
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
  involvedNationNames: string[];
  involvedLeaderNames: string[];
  imagePath?: string;
  isInsult?: boolean;
  isFiller?: boolean;
}

export interface NewspaperIssue {
  issueRound: number;
  coverageStartRound: number;
  coverageEndRound: number;
  dateLabel: string;
  mainArticle: NewspaperArticle;
  secondaryArticles: [NewspaperArticle, NewspaperArticle, NewspaperArticle];
}

export interface SavedNewspaperState {
  lastConsumedIssueRound: number;
}
