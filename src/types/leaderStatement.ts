export type StatementTone = 'theatrical' | 'constructive' | 'concerned' | 'assertive' | 'grandiose' | 'bizarre' | 'threatening';
export type StatementContext = 'economic_success' | 'economic_difficulty' | 'diplomatic_success' | 'alliance' | 'peace_agreement' | 'construction' | 'wonder' | 'games_success' | 'city_victory' | 'city_loss' | 'recovery' | 'general' | 'fake_news' | 'retreat' | 'endorsement' | 'defense';
export interface LeaderStatementDefinition {
  readonly id: string;
  readonly tone: StatementTone;
  readonly context: StatementContext;
  readonly text: string;
  readonly requiredTrait?: 'showman';
}
export interface LeaderStatement {
  readonly id: string;
  readonly speakerId: string;
  readonly round: number;
  readonly contentId: string;
  readonly tone: StatementTone;
  readonly context: StatementContext;
  readonly text: string;
  readonly observerIds: readonly string[];
  readonly responseTo?: string;
  readonly subjectNationId?: string;
}
export interface SavedLeaderStatements {
  nextId: number;
  speakers: Array<{ id: string; nextRound: number; recent: string[] }>;
}
