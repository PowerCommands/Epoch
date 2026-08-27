import { NEWSPAPER_EVENT_DEFINITIONS, NEWSPAPER_IMAGE_PATHS } from '../data/newspaperContent';
import { ALL_WONDERS, getWonderById } from '../data/wonders';
import type { HistoricalEvent } from '../types/historicalTimeline';
import { getWonderSpritePath } from '../utils/assetPaths';
import type {
  NewspaperArticle,
  NewspaperArticleContext,
  NewspaperEventType,
  NewspaperIssue,
  SavedNewspaperState,
  NewspaperVictoryType,
} from '../types/newspaper';

export const FIRST_NEWSPAPER_ROUND = 11;
export const NEWSPAPER_INTERVAL_ROUNDS = 10;

export interface NewspaperSystemDependencies {
  humanNationId: string;
  getTimelineEvents: () => readonly HistoricalEvent[];
  getDominationRanking: () => readonly string[];
  getNationName: (nationId: string) => string | undefined;
  getLeaderName: (nationId: string) => string | undefined;
  seed: string;
}

export function isNewspaperRound(round: number): boolean {
  return round >= FIRST_NEWSPAPER_ROUND && (round - 1) % NEWSPAPER_INTERVAL_ROUNDS === 0;
}

export function latestNewspaperRoundAtOrBefore(round: number): number {
  if (round < FIRST_NEWSPAPER_ROUND) return 1;
  return round - ((round - 1) % NEWSPAPER_INTERVAL_ROUNDS);
}

export class NewspaperSystem {
  private lastConsumedIssueRound: number;
  private lastConsumedTimelineEventId: number;
  private issues: NewspaperIssue[];

  private constructor(
    private readonly dependencies: NewspaperSystemDependencies,
    state: SavedNewspaperState,
  ) {
    this.lastConsumedIssueRound = Math.max(1, Math.floor(state.lastConsumedIssueRound));
    this.lastConsumedTimelineEventId = Number.isFinite(state.lastConsumedTimelineEventId)
      ? Math.max(0, Math.floor(state.lastConsumedTimelineEventId!))
      : 0;
    this.issues = normalizeSavedIssues(state.issues);
  }

  static forNewGame(dependencies: NewspaperSystemDependencies): NewspaperSystem {
    return new NewspaperSystem(dependencies, {
      lastConsumedIssueRound: 1,
      lastConsumedTimelineEventId: 0,
      issues: [],
    });
  }

  static fromSave(
    dependencies: NewspaperSystemDependencies,
    savedState: SavedNewspaperState | undefined,
    currentRound: number,
  ): NewspaperSystem {
    if (isValidSavedState(savedState)) {
      const legacyTimelineCursor = savedState.lastConsumedTimelineEventId === undefined
        ? highestTimelineEventId(dependencies.getTimelineEvents(), (event) => event.round < savedState.lastConsumedIssueRound)
        : savedState.lastConsumedTimelineEventId;
      return new NewspaperSystem(dependencies, {
        ...savedState,
        lastConsumedTimelineEventId: legacyTimelineCursor,
      });
    }
    // A pre-feature save consumes every boundary through its saved round, so it
    // waits for the next future issue and never creates a historical backlog.
    const partialIssues = savedState && typeof savedState === 'object'
      ? (savedState as SavedNewspaperState).issues
      : undefined;
    return new NewspaperSystem(dependencies, {
      lastConsumedIssueRound: latestNewspaperRoundAtOrBefore(currentRound),
      lastConsumedTimelineEventId: highestTimelineEventId(dependencies.getTimelineEvents()),
      issues: partialIssues,
    });
  }

  /** Archives before returning; suppression affects presentation only. */
  consumeDueIssue(round: number, dateLabel: string, suppressPresentation = false, worldYear = 0): NewspaperIssue | null {
    if (!isNewspaperRound(round) || round <= this.lastConsumedIssueRound) return null;
    const coverageStartRound = this.lastConsumedIssueRound;
    // Snapshot at the actual publication point. roundStart systems have already
    // recorded their facts, while events occurring later in this logical round
    // do not exist yet and therefore cannot leak into this issue.
    const availableEvents = this.dependencies.getTimelineEvents().filter((event) => event.round <= round);
    const issue = this.buildIssue(round, dateLabel, coverageStartRound, worldYear, availableEvents);
    this.issues.push(issue);
    this.lastConsumedIssueRound = round;
    this.lastConsumedTimelineEventId = Math.max(
      this.lastConsumedTimelineEventId,
      highestTimelineEventId(availableEvents),
    );
    return suppressPresentation ? null : cloneIssue(issue);
  }

  getState(): SavedNewspaperState {
    return {
      lastConsumedIssueRound: this.lastConsumedIssueRound,
      lastConsumedTimelineEventId: this.lastConsumedTimelineEventId,
      issues: this.issues.map(cloneIssue),
    };
  }

  getIssues(): NewspaperIssue[] {
    return this.issues.map(cloneIssue);
  }

  /** Builds and archives the single terminal edition, replacing a same-round regular issue. */
  consumeVictoryIssue(args: {
    round: number;
    worldYear: number;
    dateLabel: string;
    nationId: string;
    victoryType: NewspaperVictoryType;
  }): NewspaperIssue {
    const existing = this.issues.find((issue) => issue.issueType === 'victory');
    if (existing) return cloneIssue(existing);

    const sameRoundRegularIndex = this.issues.findIndex((issue) =>
      issue.issueType === 'regular' && issue.issueRound === args.round,
    );
    const replaced = sameRoundRegularIndex >= 0 ? this.issues[sameRoundRegularIndex] : undefined;
    if (sameRoundRegularIndex >= 0) this.issues.splice(sameRoundRegularIndex, 1);

    const coverageStartRound = replaced?.coverageStartRound ?? this.lastConsumedIssueRound;
    const issueNumber = this.issues.length + 1;
    const issue = this.buildVictoryIssue(args, coverageStartRound, issueNumber);
    this.lastConsumedIssueRound = Math.max(this.lastConsumedIssueRound, args.round);
    this.lastConsumedTimelineEventId = Math.max(
      this.lastConsumedTimelineEventId,
      highestTimelineEventId(this.dependencies.getTimelineEvents(), (event) => event.round <= args.round),
    );
    this.issues.push(issue);
    return cloneIssue(issue);
  }

  private buildIssue(
    issueRound: number,
    dateLabel: string,
    coverageStartRound: number,
    worldYear: number,
    availableEvents: readonly HistoricalEvent[],
  ): NewspaperIssue {
    const candidates = availableEvents.filter((event) => event.id > this.lastConsumedTimelineEventId);
    const normal = candidates.filter(isSupportedNormalEvent).sort((a, b) => this.compareNormal(a, b));
    const insults = candidates.filter(isUsableInsult).sort((a, b) => this.compareRelevance(a, b));
    const used = new Set<number>();

    const mainEvent = normal.shift();
    const mainArticle = mainEvent
      ? this.buildNormalArticle(mainEvent, issueRound, 'main', true)
      : quietMainArticle();
    if (mainEvent) used.add(mainEvent.id);

    const secondary: NewspaperArticle[] = [];
    for (const insult of insults) {
      if (secondary.length >= 3 || used.has(insult.id)) continue;
      secondary.push(this.buildInsultArticle(insult));
      used.add(insult.id);
    }
    for (const event of normal) {
      if (secondary.length >= 3 || used.has(event.id)) continue;
      secondary.push(this.buildNormalArticle(event, issueRound, `secondary-${secondary.length}`, false));
      used.add(event.id);
    }
    while (secondary.length < 3) secondary.push(quietSecondaryArticle(secondary.length));

    return {
      id: `newspaper-${this.issues.length + 1}`,
      issueNumber: this.issues.length + 1,
      issueType: 'regular',
      issueRound,
      coverageStartRound,
      coverageEndRound: issueRound,
      worldYear,
      dateLabel,
      mainArticle,
      secondaryArticles: secondary as [NewspaperArticle, NewspaperArticle, NewspaperArticle],
    };
  }

  private buildVictoryIssue(
    args: { round: number; worldYear: number; dateLabel: string; nationId: string; victoryType: NewspaperVictoryType },
    coverageStartRound: number,
    issueNumber: number,
  ): NewspaperIssue {
    const nationName = this.dependencies.getNationName(args.nationId) ?? args.nationId;
    const leaderName = this.dependencies.getLeaderName(args.nationId);
    const presentation = VICTORY_PRESENTATION[args.victoryType];
    const candidates = this.dependencies.getTimelineEvents().filter((event) =>
      event.round >= coverageStartRound && event.round <= args.round,
    );
    const normal = candidates.filter(isSupportedNormalEvent).sort((a, b) => this.compareNormal(a, b));
    const insults = candidates.filter(isUsableInsult).sort((a, b) => this.compareRelevance(a, b));
    const secondary: NewspaperArticle[] = [];
    const used = new Set<number>();
    for (const insult of insults) {
      if (secondary.length >= 3 || used.has(insult.id)) continue;
      secondary.push(this.buildInsultArticle(insult));
      used.add(insult.id);
    }
    for (const event of normal) {
      if (secondary.length >= 3 || used.has(event.id)) continue;
      secondary.push(this.buildNormalArticle(event, args.round, `victory-secondary-${secondary.length}`, false));
      used.add(event.id);
    }
    while (secondary.length < 3) secondary.push(quietSecondaryArticle(secondary.length));

    const victoryTypeLabel = `${presentation.displayName} Victory`;
    return {
      id: `newspaper-victory-${args.round}-${args.nationId}-${args.victoryType}`,
      issueNumber,
      issueType: 'victory',
      issueRound: args.round,
      coverageStartRound,
      coverageEndRound: args.round,
      worldYear: args.worldYear,
      dateLabel: args.dateLabel,
      mainArticle: {
        eventType: undefined,
        headline: presentation.headline(nationName),
        body: `Under the leadership of ${leaderName ?? nationName}, ${nationName} has secured a ${victoryTypeLabel} on ${args.dateLabel} (Round ${args.round}).`,
        comment: presentation.comment,
        involvedNationIds: [args.nationId],
        involvedNationNames: [nationName],
        involvedLeaderNames: leaderName ? [leaderName] : [],
        imagePath: NEWSPAPER_IMAGE_PATHS.victory,
      },
      secondaryArticles: secondary as [NewspaperArticle, NewspaperArticle, NewspaperArticle],
      victory: { nationId: args.nationId, nationName, leaderName, victoryType: args.victoryType, victoryTypeLabel },
    };
  }

  private compareNormal(a: HistoricalEvent, b: HistoricalEvent): number {
    const priorityDifference = getSelectionPriority(b) - getSelectionPriority(a);
    return priorityDifference || this.compareRelevance(a, b);
  }

  private compareRelevance(a: HistoricalEvent, b: HistoricalEvent): number {
    const humanDifference = Number(b.eventNationIds.includes(this.dependencies.humanNationId))
      - Number(a.eventNationIds.includes(this.dependencies.humanNationId));
    if (humanDifference !== 0) return humanDifference;

    const ranks = new Map(this.dependencies.getDominationRanking().map((nationId, index) => [nationId, index]));
    const bestRank = (event: HistoricalEvent): number => Math.min(
      ...event.eventNationIds.map((nationId) => ranks.get(nationId) ?? Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER,
    );
    const rankDifference = bestRank(a) - bestRank(b);
    if (rankDifference !== 0) return rankDifference;
    return b.round - a.round || b.id - a.id;
  }

  private buildNormalArticle(
    event: HistoricalEvent,
    issueRound: number,
    slot: string,
    includeImage: boolean,
  ): NewspaperArticle {
    const definition = getDefinition(event);
    const context = this.buildContext(event);
    const commentIndex = stableIndex(
      `${this.dependencies.seed}|${issueRound}|${event.id}|${slot}`,
      definition.comments.length,
    );
    return {
      historicalEventId: event.id,
      eventType: event.type,
      headline: definition.buildHeadline(context),
      body: definition.buildBody(context),
      comment: definition.comments[commentIndex]!,
      involvedNationIds: [...event.eventNationIds],
      involvedNationNames: context.nationNames,
      involvedLeaderNames: context.leaderNames,
      imagePath: includeImage ? resolveArticleImagePath(event, definition.imagePath) : undefined,
    };
  }

  private buildInsultArticle(event: HistoricalEvent): NewspaperArticle {
    const metadata = event.metadata!;
    const speakerId = metadata.aggressorNationId ?? event.eventNationIds[0]!;
    const recipientId = metadata.targetNationId ?? event.eventNationIds[1]!;
    const speakerLeader = metadata.leaderNames?.[0] ?? this.dependencies.getLeaderName(speakerId)
      ?? this.dependencies.getNationName(speakerId) ?? speakerId;
    const recipientLeader = metadata.leaderNames?.[1] ?? this.dependencies.getLeaderName(recipientId)
      ?? this.dependencies.getNationName(recipientId) ?? recipientId;
    const verb = metadata.leaderInsultSubtype === 'threat' ? 'THREATENS' : 'INSULTS';
    return {
      historicalEventId: event.id,
      eventType: event.type,
      headline: `${speakerLeader.toLocaleUpperCase()} ${verb} ${recipientLeader.toLocaleUpperCase()}`,
      body: `“${metadata.leaderInsultText}”`,
      comment: '',
      involvedNationIds: [...event.eventNationIds],
      involvedNationNames: event.eventNationIds.map((id, index) => metadata.nationNames?.[index] ?? this.dependencies.getNationName(id) ?? id),
      involvedLeaderNames: [speakerLeader, recipientLeader],
      isInsult: true,
    };
  }

  private buildContext(event: HistoricalEvent): NewspaperArticleContext {
    const metadata = event.metadata;
    return {
      event,
      nationNames: event.eventNationIds.map((id, index) => metadata?.nationNames?.[index] ?? this.dependencies.getNationName(id) ?? id),
      leaderNames: event.eventNationIds.map((id, index) => metadata?.leaderNames?.[index] ?? this.dependencies.getLeaderName(id) ?? this.dependencies.getNationName(id) ?? id),
      cityName: metadata?.cityName,
      wonderName: metadata?.wonderName,
      eraName: metadata?.eraName,
      corporationName: metadata?.corporationName,
      resolutionName: metadata?.resolutionName,
      governmentName: metadata?.governmentName,
      discoveryName: metadata?.discoveryName,
    };
  }
}

/** Maps optional lower-is-more-important History values into the newspaper's higher-priority scale. */
export function getSelectionPriority(event: HistoricalEvent): number {
  if (Number.isFinite(event.newsImportance) && event.newsImportance! >= 0) {
    return Math.max(0, 100 - Math.floor(event.newsImportance!) * 10);
  }
  return getDefinition(event).priority;
}

function isSupportedNormalEvent(event: HistoricalEvent): event is HistoricalEvent & { type: NewspaperEventType } {
  return event.type in NEWSPAPER_EVENT_DEFINITIONS;
}

function isUsableInsult(event: HistoricalEvent): boolean {
  return event.type === 'leaderInsult'
    && typeof event.metadata?.leaderInsultText === 'string'
    && event.metadata.leaderInsultText.length > 0
    && event.eventNationIds.length >= 2;
}

function getDefinition(event: HistoricalEvent): NewspaperEventDefinitionValue {
  return NEWSPAPER_EVENT_DEFINITIONS[event.type as NewspaperEventType];
}

type NewspaperEventDefinitionValue = (typeof NEWSPAPER_EVENT_DEFINITIONS)[NewspaperEventType];

function resolveArticleImagePath(event: HistoricalEvent, fallbackPath: string): string {
  if (event.type !== 'wonderBuilt') return fallbackPath;

  const metadataWonder = event.metadata?.wonderId
    ? getWonderById(event.metadata.wonderId)
    : undefined;
  const namedWonder = metadataWonder ?? ALL_WONDERS.find((wonder) =>
    wonder.name.toLocaleLowerCase() === event.metadata?.wonderName?.trim().toLocaleLowerCase(),
  );
  const loggedWonder = namedWonder ?? [...ALL_WONDERS]
    .sort((a, b) => b.name.length - a.name.length)
    .find((wonder) => event.text.toLocaleLowerCase().includes(wonder.name.toLocaleLowerCase()));

  return loggedWonder ? `/${getWonderSpritePath(loggedWonder.id)}` : fallbackPath;
}

function stableIndex(key: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function quietMainArticle(): NewspaperArticle {
  return {
    headline: 'A QUIET DECADE ACROSS THE WORLD',
    body: 'No single event dominated the chronicle during the decade now concluded.',
    comment: 'Nations nevertheless continue to look toward the years ahead.',
    involvedNationIds: [],
    involvedNationNames: [],
    involvedLeaderNames: [],
    imagePath: NEWSPAPER_IMAGE_PATHS.majorDiscovery,
    isFiller: true,
  };
}

function quietSecondaryArticle(index: number): NewspaperArticle {
  const fillers = [
    ['NATIONS LOOK TO THE FUTURE', 'Courts and councils continue their work as another decade begins.'],
    ['LIFE CONTINUES ACROSS THE WORLD', 'Citizens pursue their daily affairs beneath a changing sky.'],
    ['A NEW DECADE BEGINS', 'The next chapter of the world chronicle remains unwritten.'],
  ] as const;
  const [headline, body] = fillers[index % fillers.length]!;
  return { headline, body, comment: '', involvedNationIds: [], involvedNationNames: [], involvedLeaderNames: [], isFiller: true };
}

function isValidSavedState(value: SavedNewspaperState | undefined): value is SavedNewspaperState {
  return value !== undefined
    && Number.isFinite(value.lastConsumedIssueRound)
    && value.lastConsumedIssueRound >= 1;
}

function highestTimelineEventId(
  events: readonly HistoricalEvent[],
  include: (event: HistoricalEvent) => boolean = () => true,
): number {
  let highest = 0;
  for (const event of events) {
    if (include(event)) highest = Math.max(highest, event.id);
  }
  return highest;
}

const VICTORY_PRESENTATION: Readonly<Record<NewspaperVictoryType, {
  displayName: string;
  headline: (nationName: string) => string;
  comment: string;
}>> = {
  domination: { displayName: 'Domination', headline: (name) => `${name.toLocaleUpperCase()} CONQUERS THE WORLD`, comment: 'The age of rival capitals has come to an end.' },
  science: { displayName: 'Science', headline: (name) => `${name.toLocaleUpperCase()} LEADS HUMANITY INTO A NEW AGE`, comment: 'A new chapter in human achievement has begun.' },
  cultural: { displayName: 'Cultural', headline: (name) => `${name.toLocaleUpperCase()} CULTURE CAPTURES THE WORLD`, comment: 'Across every frontier, its influence is now unmistakable.' },
  diplomatic: { displayName: 'Diplomatic', headline: (name) => `${name.toLocaleUpperCase()} EMERGES AS LEADER OF THE WORLD`, comment: 'The nations of the world acknowledge a new center of global influence.' },
};

function cloneIssue(issue: NewspaperIssue): NewspaperIssue {
  return {
    ...issue,
    mainArticle: cloneArticle(issue.mainArticle),
    secondaryArticles: issue.secondaryArticles.map(cloneArticle) as [NewspaperArticle, NewspaperArticle, NewspaperArticle],
    victory: issue.victory ? { ...issue.victory } : undefined,
  };
}

function cloneArticle(article: NewspaperArticle): NewspaperArticle {
  return {
    ...article,
    involvedNationIds: [...article.involvedNationIds],
    involvedNationNames: [...article.involvedNationNames],
    involvedLeaderNames: [...article.involvedLeaderNames],
  };
}

function normalizeSavedIssues(value: SavedNewspaperState['issues']): NewspaperIssue[] {
  if (!Array.isArray(value)) return [];
  const normalized: NewspaperIssue[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || !candidate.mainArticle || !Array.isArray(candidate.secondaryArticles)) continue;
    const issueNumber = Number.isFinite(candidate.issueNumber) ? Math.max(1, Math.floor(candidate.issueNumber)) : normalized.length + 1;
    const article = (saved: NewspaperArticle): NewspaperArticle => ({
      ...saved,
      comment: typeof saved.comment === 'string' ? saved.comment : '',
      involvedNationIds: Array.isArray(saved.involvedNationIds) ? [...saved.involvedNationIds] : [],
      involvedNationNames: Array.isArray(saved.involvedNationNames) ? [...saved.involvedNationNames] : [],
      involvedLeaderNames: Array.isArray(saved.involvedLeaderNames) ? [...saved.involvedLeaderNames] : [],
    });
    const secondary = candidate.secondaryArticles.slice(0, 3).map(article);
    while (secondary.length < 3) secondary.push(quietSecondaryArticle(secondary.length));
    normalized.push({
      ...candidate,
      id: typeof candidate.id === 'string' ? candidate.id : `newspaper-${issueNumber}`,
      issueNumber,
      issueType: candidate.issueType === 'victory' ? 'victory' : 'regular',
      worldYear: Number.isFinite(candidate.worldYear) ? candidate.worldYear : 0,
      mainArticle: article(candidate.mainArticle),
      secondaryArticles: secondary as [NewspaperArticle, NewspaperArticle, NewspaperArticle],
      victory: candidate.victory ? { ...candidate.victory } : undefined,
    });
  }
  return normalized;
}
