import { NEWSPAPER_EVENT_DEFINITIONS, NEWSPAPER_IMAGE_PATHS } from '../data/newspaperContent';
import type { HistoricalEvent } from '../types/historicalTimeline';
import type {
  NewspaperArticle,
  NewspaperArticleContext,
  NewspaperEventType,
  NewspaperIssue,
  SavedNewspaperState,
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

  private constructor(
    private readonly dependencies: NewspaperSystemDependencies,
    state: SavedNewspaperState,
  ) {
    this.lastConsumedIssueRound = Math.max(1, Math.floor(state.lastConsumedIssueRound));
  }

  static forNewGame(dependencies: NewspaperSystemDependencies): NewspaperSystem {
    return new NewspaperSystem(dependencies, { lastConsumedIssueRound: 1 });
  }

  static fromSave(
    dependencies: NewspaperSystemDependencies,
    savedState: SavedNewspaperState | undefined,
    currentRound: number,
  ): NewspaperSystem {
    if (isValidSavedState(savedState)) return new NewspaperSystem(dependencies, savedState);
    // A pre-feature save consumes every boundary through its saved round, so it
    // waits for the next future issue and never creates a historical backlog.
    return new NewspaperSystem(dependencies, {
      lastConsumedIssueRound: latestNewspaperRoundAtOrBefore(currentRound),
    });
  }

  /** Advances the cursor even when presentation is suppressed by autoplay. */
  consumeDueIssue(round: number, dateLabel: string, suppressPresentation = false): NewspaperIssue | null {
    if (!isNewspaperRound(round) || round <= this.lastConsumedIssueRound) return null;
    const coverageStartRound = this.lastConsumedIssueRound;
    this.lastConsumedIssueRound = round;
    if (suppressPresentation) return null;
    return this.buildIssue(round, dateLabel, coverageStartRound);
  }

  getState(): SavedNewspaperState {
    return { lastConsumedIssueRound: this.lastConsumedIssueRound };
  }

  private buildIssue(issueRound: number, dateLabel: string, coverageStartRound: number): NewspaperIssue {
    const candidates = this.dependencies.getTimelineEvents().filter((event) =>
      event.round >= coverageStartRound && event.round < issueRound,
    );
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
      issueRound,
      coverageStartRound,
      coverageEndRound: issueRound - 1,
      dateLabel,
      mainArticle,
      secondaryArticles: secondary as [NewspaperArticle, NewspaperArticle, NewspaperArticle],
    };
  }

  private compareNormal(a: HistoricalEvent, b: HistoricalEvent): number {
    const priorityDifference = getDefinition(b).priority - getDefinition(a).priority;
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
      involvedNationNames: context.nationNames,
      involvedLeaderNames: context.leaderNames,
      imagePath: includeImage ? definition.imagePath : undefined,
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
  return { headline, body, comment: '', involvedNationNames: [], involvedLeaderNames: [], isFiller: true };
}

function isValidSavedState(value: SavedNewspaperState | undefined): value is SavedNewspaperState {
  return value !== undefined
    && Number.isFinite(value.lastConsumedIssueRound)
    && value.lastConsumedIssueRound >= 1;
}
