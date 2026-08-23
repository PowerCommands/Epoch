import type { HistoricalEvent, HistoricalEventMetadata, HistoricalEventType } from '../types/historicalTimeline';

type ChangedListener = () => void;

export interface RecordHistoricalEventInput {
  type: HistoricalEventType;
  icon: string;
  text: string;
  /** Nations the event concerns. */
  eventNationIds: string[];
  /**
   * Nations that could observe it at the time. Defaults to the involved
   * nations. Metadata only for now (future fog-aware history); the panel shows
   * everything.
   */
  visibleToNationIds?: string[];
  metadata?: HistoricalEventMetadata;
}

/**
 * HistoricalTimelineService — the unfolding chronicle of the world.
 *
 * A dedicated record of major historical events (city founded, first contact,
 * wars, wonders, …), separate from the technical event log used for autoplay /
 * diagnostics. It subscribes to existing game events (wired in GameScene) and
 * appends one entry per event, stamped with the current date/round.
 *
 * Entries are stored in chronological order and persisted with the save so the
 * timeline reads identically after loading. The design carries per-event
 * visibility metadata so a future "History View" / replay can filter by what
 * the human knew at the time — no reveal logic is implemented here yet.
 */
export class HistoricalTimelineService {
  private readonly events: HistoricalEvent[] = [];
  private readonly listeners: ChangedListener[] = [];
  private nextId = 1;

  constructor(
    private readonly getRound: () => number,
    private readonly getDateLabel: () => string,
    private readonly getNationName?: (nationId: string) => string | undefined,
    private readonly getLeaderName?: (nationId: string) => string | undefined,
  ) {}

  /** Append a new chronicle entry, stamped with the current round and date. */
  record(input: RecordHistoricalEventInput): void {
    const round = this.getRound();
    this.events.push({
      id: this.nextId++,
      type: input.type,
      round,
      dateLabel: this.getDateLabel(),
      icon: input.icon,
      text: input.text,
      eventNationIds: [...input.eventNationIds],
      visibleToNationIds: [...(input.visibleToNationIds ?? input.eventNationIds)],
      discoveredTurn: round,
      metadata: {
        nationNames: input.eventNationIds.map((id) => this.getNationName?.(id) ?? id),
        leaderNames: input.eventNationIds.map((id) => this.getLeaderName?.(id) ?? this.getNationName?.(id) ?? id),
        ...input.metadata,
      },
    });
    this.notifyChanged();
  }

  /** All entries in chronological (oldest-first) order. */
  getEvents(): readonly HistoricalEvent[] {
    return this.events;
  }

  onChanged(listener: ChangedListener): void {
    this.listeners.push(listener);
  }

  /** Snapshot for saving. */
  serialize(): HistoricalEvent[] {
    return this.events.map((event) => ({
      ...event,
      eventNationIds: [...event.eventNationIds],
      visibleToNationIds: [...event.visibleToNationIds],
      metadata: cloneMetadata(event.metadata),
    }));
  }

  /** Replace all entries from a saved payload, preserving order/ids. */
  restore(events: readonly HistoricalEvent[] | undefined): void {
    this.events.length = 0;
    if (events) {
      for (const event of events) {
        this.events.push({
          ...event,
          eventNationIds: [...event.eventNationIds],
          visibleToNationIds: [...(event.visibleToNationIds ?? event.eventNationIds)],
          metadata: cloneMetadata(event.metadata),
        });
      }
    }
    this.nextId = this.events.reduce((max, event) => Math.max(max, event.id), 0) + 1;
    this.notifyChanged();
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) listener();
  }
}

function cloneMetadata(metadata: HistoricalEventMetadata | undefined): HistoricalEventMetadata | undefined {
  return metadata ? {
    ...metadata,
    nationNames: metadata.nationNames ? [...metadata.nationNames] : undefined,
    leaderNames: metadata.leaderNames ? [...metadata.leaderNames] : undefined,
  } : undefined;
}
