import type { ScenarioHistoricalEvent } from '../types/scenario';
import type { DiplomacyManager } from './DiplomacyManager';
import type { AllianceManager } from './diplomacy/AllianceManager';
import {
  compareGameDates,
  createGameDate,
  formatGameDate,
  gameDateToMonthOrdinal,
  hasReachedOrCrossedDate,
  type GameDate,
} from './GameDate';
import type {
  DateProgressionContinuation,
  RuntimeDateProgression,
  TurnManager,
} from './TurnManager';

export type ScenarioHistoricalEventRuntimeStatus = 'pending' | 'active' | 'completed';
export type WorldWarCompletionReason = 'peace' | 'elimination';

export interface ScenarioHistoricalEventRuntimeState {
  eventId: string;
  status: ScenarioHistoricalEventRuntimeStatus;
  triggeredRound?: number;
  triggeredDate?: GameDate;
  completedRound?: number;
  completedDate?: GameDate;
  completionReason?: WorldWarCompletionReason;
}

export interface WorldWarStartedEvent {
  definition: ScenarioHistoricalEvent;
  state: ScenarioHistoricalEventRuntimeState;
}

export interface WorldWarCompletedEvent {
  definition: ScenarioHistoricalEvent;
  state: ScenarioHistoricalEventRuntimeState;
  completionReason: WorldWarCompletionReason;
  timelineRestored: boolean;
  remainingActiveWorldWars: number;
}

/** Plain JSON-compatible save payload. Authored event definitions stay in the scenario. */
export interface SavedScenarioHistoricalEventsState {
  events: ScenarioHistoricalEventRuntimeState[];
  preWorldWarProgression?: DateProgressionContinuation;
  timelineProgression?: RuntimeDateProgression;
}

export interface ScenarioHistoricalEventSystemOptions {
  isNationActive?: (nationId: string) => boolean;
  /** Must use Epoch's canonical elimination state (NationManager membership). */
  isNationEliminated?: (nationId: string) => boolean;
  getNationName?: (nationId: string) => string;
  log?: (message: string) => void;
}

interface PendingEvent {
  event: ScenarioHistoricalEvent;
  date: GameDate;
  scenarioIndex: number;
}

/** Deterministic runtime lifecycle coordinator for editor-authored historical events. */
export class ScenarioHistoricalEventSystem {
  private readonly states = new Map<string, ScenarioHistoricalEventRuntimeState>();
  private readonly events: PendingEvent[];
  private preWorldWarProgression: DateProgressionContinuation | null = null;
  private readonly isNationActive: (nationId: string) => boolean;
  private readonly isNationEliminated: (nationId: string) => boolean;
  private readonly getNationName: (nationId: string) => string;
  private readonly log: (message: string) => void;
  private readonly startedListeners: Array<(event: WorldWarStartedEvent) => void> = [];
  private readonly completedListeners: Array<(event: WorldWarCompletedEvent) => void> = [];

  constructor(
    events: readonly ScenarioHistoricalEvent[] | undefined,
    private readonly turnManager: TurnManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly allianceManager: AllianceManager,
    options: ScenarioHistoricalEventSystemOptions = {},
  ) {
    this.events = (events ?? []).map((event, scenarioIndex) => ({
      event,
      date: createGameDate(event.startYear, event.startYearIsBC ?? false, event.startMonth - 1),
      scenarioIndex,
    }));
    for (const { event } of this.events) {
      if (!this.states.has(event.id)) this.states.set(event.id, { eventId: event.id, status: 'pending' });
    }
    this.isNationActive = options.isNationActive ?? (() => true);
    this.isNationEliminated = options.isNationEliminated ?? (() => false);
    this.getNationName = options.getNationName ?? ((id) => id);
    this.log = options.log ?? ((message) => console.log(message));

    if (this.events.length > 0) {
      this.turnManager.on('beforeRoundStart', ({ round, previousRound }) => {
        this.evaluatePendingEvents(round, previousRound);
      });
      this.turnManager.on('roundEnd', ({ round }) => this.evaluateActiveEvents(round));
    }
  }

  hasTriggered(eventId: string): boolean {
    return this.states.has(eventId) && this.states.get(eventId)?.status !== 'pending';
  }

  getTriggeredEventIds(): string[] {
    return this.events
      .map(({ event }) => event.id)
      .filter((eventId) => this.states.get(eventId)?.status !== 'pending');
  }

  hasActiveWorldWar(): boolean {
    return [...this.states.values()].some((state) => state.status === 'active');
  }

  getActiveWorldWars(): ScenarioHistoricalEvent[] {
    return this.events
      .filter(({ event }) => this.states.get(event.id)?.status === 'active')
      .map(({ event }) => event);
  }

  getRuntimeStates(): ScenarioHistoricalEventRuntimeState[] {
    return this.events.map(({ event }) => this.cloneState(this.states.get(event.id)!));
  }

  onWorldWarStarted(listener: (event: WorldWarStartedEvent) => void): void {
    this.startedListeners.push(listener);
  }

  onWorldWarCompleted(listener: (event: WorldWarCompletedEvent) => void): void {
    this.completedListeners.push(listener);
  }

  serialize(): SavedScenarioHistoricalEventsState {
    return {
      events: this.getRuntimeStates(),
      preWorldWarProgression: this.preWorldWarProgression
        ? { ...this.preWorldWarProgression }
        : undefined,
      timelineProgression: this.turnManager.getRuntimeDateProgression() ?? undefined,
    };
  }

  /** Restore authoritative lifecycle and calendar state before gameplay resumes. */
  restore(saved: SavedScenarioHistoricalEventsState | undefined): void {
    for (const { event } of this.events) {
      this.states.set(event.id, { eventId: event.id, status: 'pending' });
    }
    this.preWorldWarProgression = null;
    this.turnManager.clearRuntimeDateProgression();
    if (!saved) return; // older save: pending events follow Prompt 2's reached-date rule

    const authoredIds = new Set(this.events.map(({ event }) => event.id));
    for (const candidate of saved.events ?? []) {
      if (!authoredIds.has(candidate.eventId)) {
        this.log(`Historical Event save state ignored for unknown event: ${candidate.eventId}`);
        continue;
      }
      if (!this.isValidStatus(candidate.status)) continue;
      this.states.set(candidate.eventId, this.cloneState(candidate));
    }

    this.preWorldWarProgression = saved.preWorldWarProgression
      ? { ...saved.preWorldWarProgression }
      : null;
    if (saved.timelineProgression) {
      this.turnManager.setRuntimeDateProgression(saved.timelineProgression);
    } else if (this.hasActiveWorldWar()) {
      // Defensive fallback for an incomplete/transitional save payload.
      this.turnManager.setRuntimeDateProgression({
        mode: 'monthly',
        anchorRound: this.turnManager.getCurrentRound(),
        anchorDate: this.turnManager.getGameDate(),
      });
    }
  }

  private evaluatePendingEvents(round: number, previousRound: number | null): void {
    const prospectiveDate = this.turnManager.getGameDateForRound(round);
    const reached = this.pendingEvents().filter(({ date }) => previousRound === null
      ? compareGameDates(date, prospectiveDate) <= 0
      : hasReachedOrCrossedDate(this.turnManager.getGameDateForRound(previousRound), prospectiveDate, date));

    if (reached.length === 0) return;
    reached.sort((a, b) => gameDateToMonthOrdinal(a.date) - gameDateToMonthOrdinal(b.date)
      || a.scenarioIndex - b.scenarioIndex
      || a.event.id.localeCompare(b.event.id));

    // During a normal jump, the earliest date group changes the timeline and
    // later reached events must wait to be reached naturally on that new line.
    const selected = previousRound === null
      ? reached
      : reached.filter(({ date }) => compareGameDates(date, reached[0].date) === 0);

    if (!this.hasActiveWorldWar()) {
      this.preWorldWarProgression = this.turnManager.getDateProgressionContinuation(round);
      const anchorDate = previousRound === null ? prospectiveDate : selected[0].date;
      this.turnManager.setRuntimeDateProgression({ mode: 'monthly', anchorRound: round, anchorDate });
      this.log(`Historical Event timeline switched to monthly progression at ${formatGameDate(anchorDate)}`);
    }

    for (const pending of selected) this.activate(pending, round);
  }

  private evaluateActiveEvents(round: number): void {
    const completed: Array<{ pending: PendingEvent; reason: WorldWarCompletionReason }> = [];
    for (const pending of this.events) {
      if (this.states.get(pending.event.id)?.status !== 'active') continue;
      const endNationId = pending.event.endConditionNationId;
      const eliminated = this.isNationEliminated(endNationId);
      if (!eliminated && this.diplomacyManager.isAtWarWithAnyNation(endNationId)) continue;
      completed.push({ pending, reason: eliminated ? 'elimination' : 'peace' });
    }
    if (completed.length === 0) return;

    const completedDate = this.turnManager.getGameDateForRound(round);
    const completionEvents: Array<{
      definition: ScenarioHistoricalEvent;
      state: ScenarioHistoricalEventRuntimeState;
      completionReason: WorldWarCompletionReason;
    }> = [];
    for (const { pending: { event }, reason } of completed) {
      const previous = this.states.get(event.id)!;
      this.states.set(event.id, {
        ...previous,
        status: 'completed',
        completedRound: round,
        completedDate: { ...completedDate },
        completionReason: reason,
      });
      completionEvents.push({
        definition: event,
        state: this.cloneState(this.states.get(event.id)!),
        completionReason: reason,
      });
      this.log(`Historical Event completed: ${event.name} (${formatGameDate(completedDate)})`);
    }

    const activeCount = this.getActiveWorldWars().length;
    if (activeCount > 0) {
      this.log(`Historical Event timeline remains monthly: ${activeCount} World War${activeCount === 1 ? '' : 's'} still active`);
      for (const event of completionEvents) {
        this.emitCompleted({ ...event, timelineRestored: false, remainingActiveWorldWars: activeCount });
      }
      return;
    }

    const continuation = this.preWorldWarProgression;
    if (continuation) {
      this.turnManager.setRuntimeDateProgression({
        ...continuation,
        anchorRound: round,
        anchorDate: completedDate,
      });
      this.log(`Historical Event timeline restored after final active World War: ${this.describeProgression(continuation)}`);
    } else {
      this.turnManager.clearRuntimeDateProgression();
    }
    this.preWorldWarProgression = null;
    for (const [index, event] of completionEvents.entries()) {
      this.emitCompleted({
        ...event,
        timelineRestored: index === completionEvents.length - 1,
        remainingActiveWorldWars: 0,
      });
    }
  }

  private pendingEvents(): PendingEvent[] {
    return this.events.filter(({ event }) => this.states.get(event.id)?.status === 'pending');
  }

  private activate({ event, date }: PendingEvent, round: number): void {
    if (this.states.get(event.id)?.status !== 'pending') return;
    const triggeredDate = this.turnManager.getGameDateForRound(round);

    // Apply every conflict before publishing ACTIVE. Completion is only checked
    // later at roundEnd, never during this atomic activation transition.
    for (const conflict of event.conflicts) {
      const { nationAId, nationBId } = conflict;
      if (nationAId === nationBId || !this.isNationActive(nationAId) || !this.isNationActive(nationBId)) continue;
      const nameA = this.getNationName(nationAId);
      const nameB = this.getNationName(nationBId);
      if (this.diplomacyManager.getState(nationAId, nationBId) === 'WAR') {
        this.log(`Historical Event conflict already active: ${nameA} ↔ ${nameB}`);
        continue;
      }
      this.allianceManager.separateAlliedNations(nationAId, nationBId);
      if (this.diplomacyManager.forceDeclareWar(nationAId, nationBId, { source: 'scenarioHistoricalEvent' })) {
        this.log(`Historical Event conflict started: ${nameA} ↔ ${nameB}`);
      }
    }

    this.states.set(event.id, {
      eventId: event.id,
      status: 'active',
      triggeredRound: round,
      triggeredDate: { ...triggeredDate },
    });
    this.log(`Historical Event triggered: ${event.name} (${formatGameDate(date)})`);
    const state = this.cloneState(this.states.get(event.id)!);
    for (const listener of this.startedListeners) listener({ definition: event, state });
  }

  private cloneState(state: ScenarioHistoricalEventRuntimeState): ScenarioHistoricalEventRuntimeState {
    return {
      ...state,
      triggeredDate: state.triggeredDate ? { ...state.triggeredDate } : undefined,
      completedDate: state.completedDate ? { ...state.completedDate } : undefined,
    };
  }

  private isValidStatus(status: unknown): status is ScenarioHistoricalEventRuntimeStatus {
    return status === 'pending' || status === 'active' || status === 'completed';
  }

  private describeProgression(progression: DateProgressionContinuation): string {
    if (progression.mode === 'monthly') return 'monthly progression';
    if (progression.mode === 'auto') return 'auto progression';
    return `${progression.staticYearStep} ${progression.staticYearStep === 1 ? 'year' : 'years'} per round`;
  }

  private emitCompleted(event: WorldWarCompletedEvent): void {
    for (const listener of this.completedListeners) listener(event);
  }
}
