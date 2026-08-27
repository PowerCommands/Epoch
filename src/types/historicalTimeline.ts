/** The kinds of world events recorded in the historical timeline. */
export type HistoricalEventType =
  | 'cityFounded'
  | 'firstContact'
  | 'allianceFormed'
  | 'embassyEstablished'
  | 'tradeRelations'
  | 'warDeclared'
  | 'worldWarStarted'
  | 'worldWarEnded'
  | 'joinedWar'
  | 'peace'
  | 'cityCaptured'
  | 'tradeRouteCompleted'
  | 'wonderBuilt'
  | 'worldCouncilFounded'
  | 'worldCouncilActive'
  | 'worldCouncilMeeting'
  | 'worldCouncilResolution'
  | 'corporationFounded'
  | 'nationEliminated'
  | 'capitalCaptured'
  | 'eraReached'
  | 'governmentChanged'
  | 'majorDiscovery'
  | 'gamesGold'
  | 'gamesCompleted'
  | 'gamesHostingAnnounced'
  | 'gamesParticipantExcluded'
  | 'gamesCancelled'
  | 'gamesSportIntroduced'
  | 'leaderInsult';

/** Optional structured newspaper/replay facts; old saves may omit all fields. */
export interface HistoricalEventMetadata {
  /** Frozen display names aligned with eventNationIds for removed-nation safety. */
  nationNames?: string[];
  leaderNames?: string[];
  cityId?: string;
  cityName?: string;
  aggressorNationId?: string;
  targetNationId?: string;
  previousOwnerNationId?: string;
  wonderId?: string;
  wonderName?: string;
  eraName?: string;
  corporationId?: string;
  corporationName?: string;
  resolutionId?: string;
  resolutionName?: string;
  governmentName?: string;
  discoveryName?: string;
  leaderInsultSubtype?: 'insult' | 'threat';
  leaderInsultText?: string;
  gamesNumber?: number;
  gamesSport?: string;
  gamesSportId?: string;
  gamesIntroducingNationId?: string;
  gamesWinningBid?: number;
  gamesWinnerNationId?: string;
  gamesHostNationId?: string;
  gamesGold?: number;
  gamesSilver?: number;
  gamesBronze?: number;
  scheduledGamesTurn?: number;
  scheduledGamesYear?: number;
  gamesCancellationReason?: string;
  scenarioHistoricalEventId?: string;
  scenarioHistoricalEventName?: string;
  scenarioHistoricalEventDescription?: string;
  worldWarConflictNames?: string[];
  worldWarCompletionReason?: 'peace' | 'elimination';
  worldWarEndConditionNationId?: string;
  worldWarEndConditionNationName?: string;
  worldWarTimelineRestored?: boolean;
}

/**
 * A single entry in the world chronicle.
 *
 * `icon` + `text` render the line ("🏠 Sweden founded its capital Stockholm");
 * `dateLabel` + `round` render the header ("January 2764 BC (Round 58)").
 *
 * The visibility fields are metadata only for now — they exist so a future
 * fog-of-war-aware "History View" / replay can filter entries by what the human
 * knew at the time. No reveal/filter logic is applied yet.
 */
export interface HistoricalEvent {
  /** Monotonic id, also defines chronological order. */
  id: number;
  type: HistoricalEventType;
  /** Game round the event occurred on. */
  round: number;
  /** Frozen display date, e.g. "January 2764 BC". */
  dateLabel: string;
  /** Leading emoji for the line. */
  icon: string;
  /** Event sentence without the icon, e.g. "Sweden met Japan". */
  text: string;
  /** Nations the event concerns (subjects/objects). */
  eventNationIds: string[];
  /** Nations that could observe the event when it happened (future filtering). */
  visibleToNationIds: string[];
  /** Round the event entered the timeline (future fog-aware reveal). */
  discoveredTurn: number;
  /** Lower values are more newsworthy; optional for backward compatibility. */
  newsImportance?: number;
  metadata?: HistoricalEventMetadata;
}
