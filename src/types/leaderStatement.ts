export type StatementTone = 'constructive' | 'concerned' | 'assertive' | 'grandiose' | 'bizarre' | 'threatening';
export type StatementContext = 'general' | 'fake_news' | 'retreat' | 'endorsement' | 'defense';
export interface LeaderStatementDefinition {
  readonly id: string;
  readonly tone: StatementTone;
  readonly context: StatementContext;
  readonly text: string;
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
