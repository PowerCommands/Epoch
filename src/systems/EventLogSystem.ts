import type { DiscoverySystem } from './DiscoverySystem';

const MAX_ENTRIES = 100;

export interface EventLogEntry {
  id: number;
  text: string;
  nationIds: string[];
  round: number;
}

type ChangedListener = () => void;

/**
 * EventLogSystem — persistent strategic event log.
 *
 * Entries carry the set of nations they involve. Visibility is derived
 * at read time: an entry is visible to the human player only when every
 * involved nation is known to them (self or met via DiscoverySystem).
 */
export class EventLogSystem {
  private readonly entries: EventLogEntry[] = [];
  private readonly listeners: ChangedListener[] = [];
  private nextId = 1;
  // When non-null, all entries are accumulated here without a size cap.
  // Activated by enableFullLog() for autorun / diagnostic sessions.
  private fullLog: EventLogEntry[] | null = null;

  constructor(
    private readonly discovery: DiscoverySystem,
    private readonly humanNationId: string | undefined,
  ) {}

  /**
   * Enables an unbounded accumulator that captures every entry for the
   * lifetime of the session. Must be called before the first log() for
   * complete coverage. Does not affect the capped UI buffer.
   */
  enableFullLog(): void {
    if (this.fullLog === null) this.fullLog = [];
  }

  log(text: string, nationIds: string[], round: number): void {
    const entry: EventLogEntry = {
      id: this.nextId++,
      text,
      nationIds: [...nationIds],
      round,
    };
    this.entries.push(entry);
    while (this.entries.length > MAX_ENTRIES) this.entries.shift();
    if (this.fullLog !== null) this.fullLog.push(entry);
    for (const cb of this.listeners) cb();
  }

  getVisibleEntries(): EventLogEntry[] {
    const humanId = this.humanNationId;
    if (!humanId) return [...this.entries];
    return this.entries.filter((entry) =>
      entry.nationIds.every((id) => this.discovery.hasMet(humanId, id)),
    );
  }

  /**
   * Returns every entry regardless of human discovery state. Used by
   * debug UIs (autoplay) that need to display omniscient activity.
   * Capped at MAX_ENTRIES — only the most recent entries are retained.
   */
  getAllEntries(): EventLogEntry[] {
    return [...this.entries];
  }

  /**
   * Returns the complete session log when enableFullLog() was called,
   * otherwise falls back to the capped getAllEntries() result.
   */
  getFullLogEntries(): EventLogEntry[] {
    return this.fullLog !== null ? [...this.fullLog] : [...this.entries];
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  /** Re-emit a change without adding a new entry — used when discovery state changes. */
  notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }
}
