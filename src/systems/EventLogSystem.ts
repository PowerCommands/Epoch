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

  constructor(
    private readonly discovery: DiscoverySystem,
    private readonly humanNationId: string | undefined,
  ) {}

  log(text: string, nationIds: string[], round: number): void {
    const entry: EventLogEntry = {
      id: this.nextId++,
      text,
      nationIds: [...nationIds],
      round,
    };
    this.entries.push(entry);
    while (this.entries.length > MAX_ENTRIES) this.entries.shift();
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
   */
  getAllEntries(): EventLogEntry[] {
    return [...this.entries];
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  /** Re-emit a change without adding a new entry — used when discovery state changes. */
  notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }
}
