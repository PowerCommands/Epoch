import type { ScenarioWorldWarHistoricalEvent } from '../types/scenario';
import type { HistoricalTimelineService } from './HistoricalTimelineService';
import {
  formatGameDate,
} from './GameDate';
import type {
  ScenarioHistoricalEventSystem,
  WorldWarCompletedEvent,
  WorldWarCompletionReason,
  WorldWarStartedEvent,
} from './ScenarioHistoricalEventSystem';

export interface WorldWarConflictPresentation {
  nationAId: string;
  nationAName: string;
  nationBId: string;
  nationBName: string;
}

export interface WorldWarAnnouncement {
  kind: 'started' | 'completed';
  eventId: string;
  eventName: string;
  dateLabel: string;
  description: string;
  conflicts: WorldWarConflictPresentation[];
  humanInvolved: boolean;
  completionReason?: WorldWarCompletionReason;
  completionMessage?: string;
  timelineMessage: string;
}

export interface ScenarioHistoricalEventPresentationOptions {
  humanNationId: string;
  getNationName: (nationId: string) => string;
}

type AnnouncementListener = (announcement: WorldWarAnnouncement) => void;

/** Converts runtime lifecycle transitions into History/Chronicle facts and UI models. */
export class ScenarioHistoricalEventPresentationSystem {
  private readonly announcementListeners: AnnouncementListener[] = [];

  constructor(
    runtime: ScenarioHistoricalEventSystem,
    private readonly historicalTimeline: HistoricalTimelineService,
    private readonly options: ScenarioHistoricalEventPresentationOptions,
  ) {
    runtime.onWorldWarStarted((event) => this.handleStarted(event));
    runtime.onWorldWarCompleted((event) => this.handleCompleted(event));
  }

  onAnnouncement(listener: AnnouncementListener): void {
    this.announcementListeners.push(listener);
  }

  private handleStarted(event: WorldWarStartedEvent): void {
    const date = event.state.triggeredDate!;
    const conflicts = this.conflicts(event.definition);
    const nationIds = this.participantIds(event.definition);
    const announcement: WorldWarAnnouncement = {
      kind: 'started',
      eventId: event.definition.id,
      eventName: event.definition.name,
      dateLabel: formatGameDate(date),
      description: event.definition.description,
      conflicts,
      humanInvolved: nationIds.includes(this.options.humanNationId),
      timelineMessage: 'During the World War, each round represents one month.',
    };

    this.historicalTimeline.record({
      type: 'worldWarStarted',
      icon: '☢',
      text: `${event.definition.name} begins`,
      eventNationIds: nationIds,
      newsImportance: 0,
      metadata: {
        nationNames: nationIds.map(this.options.getNationName),
        scenarioHistoricalEventId: event.definition.id,
        scenarioHistoricalEventName: event.definition.name,
        scenarioHistoricalEventDescription: event.definition.description,
        worldWarConflictNames: conflicts.map((conflict) => `${conflict.nationAName} ↔ ${conflict.nationBName}`),
        worldWarEndConditionNationId: event.definition.endConditionNationId,
        worldWarEndConditionNationName: this.options.getNationName(event.definition.endConditionNationId),
      },
    });
    this.emit(announcement);
  }

  private handleCompleted(event: WorldWarCompletedEvent): void {
    const date = event.state.completedDate!;
    const conflicts = this.conflicts(event.definition);
    const nationIds = this.participantIds(event.definition);
    const endNationName = this.options.getNationName(event.definition.endConditionNationId);
    const completionMessage = worldWarCompletionText(event.completionReason, endNationName);
    const announcement: WorldWarAnnouncement = {
      kind: 'completed',
      eventId: event.definition.id,
      eventName: event.definition.name,
      dateLabel: formatGameDate(date),
      description: '',
      conflicts,
      humanInvolved: nationIds.includes(this.options.humanNationId),
      completionReason: event.completionReason,
      completionMessage,
      timelineMessage: event.timelineRestored
        ? 'Normal historical time progression has resumed.'
        : event.remainingActiveWorldWars > 0
          ? `${event.remainingActiveWorldWars} other World War${event.remainingActiveWorldWars === 1 ? ' remains' : 's remain'} active; monthly progression continues.`
          : '',
    };

    this.historicalTimeline.record({
      type: 'worldWarEnded',
      icon: '⚑',
      text: `${event.definition.name} ends`,
      eventNationIds: nationIds,
      newsImportance: 0,
      metadata: {
        nationNames: nationIds.map(this.options.getNationName),
        scenarioHistoricalEventId: event.definition.id,
        scenarioHistoricalEventName: event.definition.name,
        worldWarConflictNames: conflicts.map((conflict) => `${conflict.nationAName} ↔ ${conflict.nationBName}`),
        worldWarCompletionReason: event.completionReason,
        worldWarEndConditionNationId: event.definition.endConditionNationId,
        worldWarEndConditionNationName: endNationName,
        worldWarTimelineRestored: event.timelineRestored,
      },
    });
    this.emit(announcement);
  }

  private conflicts(definition: ScenarioWorldWarHistoricalEvent): WorldWarConflictPresentation[] {
    const seen = new Set<string>();
    const result: WorldWarConflictPresentation[] = [];
    for (const conflict of definition.conflicts) {
      if (conflict.nationAId === conflict.nationBId) continue;
      const pair = [conflict.nationAId, conflict.nationBId].sort();
      const key = `${pair[0]}|${pair[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        nationAId: conflict.nationAId,
        nationAName: this.options.getNationName(conflict.nationAId),
        nationBId: conflict.nationBId,
        nationBName: this.options.getNationName(conflict.nationBId),
      });
    }
    return result;
  }

  private participantIds(definition: ScenarioWorldWarHistoricalEvent): string[] {
    const ids = new Set<string>();
    for (const conflict of definition.conflicts) {
      ids.add(conflict.nationAId);
      ids.add(conflict.nationBId);
    }
    ids.add(definition.endConditionNationId);
    return [...ids];
  }

  private emit(announcement: WorldWarAnnouncement): void {
    for (const listener of this.announcementListeners) listener(announcement);
  }
}

/** Small test-friendly helper for factual completion wording. */
export function worldWarCompletionText(
  reason: WorldWarCompletionReason,
  nationName: string,
): string {
  return reason === 'elimination'
    ? `${nationName} has been eliminated.`
    : `${nationName} is no longer at war with any nation.`;
}
