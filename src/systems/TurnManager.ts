import { Nation } from '../entities/Nation';
import { NationManager } from './NationManager';
import type {
  TurnStartEvent,
  TurnEndEvent,
  RoundStartEvent,
  RoundEndEvent,
} from '../types/events';

/**
 * TurnManager hanterar turordning och varvräkning.
 *
 * Helt fri från Phaser — ren data + synkront event-system.
 * Framtida system (produktion, AI, rörelse) prenumererar på events
 * för att koppla in sig utan att TurnManager känner till dem.
 *
 * Terminologi:
 * - **Round** (varv): en komplett cykel där varje nation haft en tur.
 * - **Turn** (tur): en nations aktiva fas inom en runda.
 *
 * Event-ordning vid rundbyte:
 *   turnEnd (sista nationen) → roundEnd → roundStart → turnStart (första nationen)
 */
export class TurnManager {
  private currentRound = 1;
  private readonly turnOrder: Nation[];
  private currentTurnIndex = 0;

  private readonly listeners = {
    turnStart:  [] as ((e: TurnStartEvent) => void)[],
    turnEnd:    [] as ((e: TurnEndEvent) => void)[],
    roundStart: [] as ((e: RoundStartEvent) => void)[],
    roundEnd:   [] as ((e: RoundEndEvent) => void)[],
  };

  constructor(nationManager: NationManager) {
    this.turnOrder = nationManager.getAllNations();
  }

  /**
   * Starta spelet. Anropas en gång efter att alla lyssnare kopplats,
   * så att UI-komponenter inte missar det första eventet.
   */
  start(): void {
    this.emit('roundStart', { round: this.currentRound });
    this.emit('turnStart', {
      round: this.currentRound,
      nation: this.getCurrentNation(),
    });
  }

  /** Avsluta nuvarande nations tur och avancera. */
  endCurrentTurn(): void {
    const endedNation = this.getCurrentNation();

    // 1. Avsluta nuvarande tur
    this.emit('turnEnd', { round: this.currentRound, nation: endedNation });

    // 2. Avancera
    this.currentTurnIndex++;

    // 3. Rundbyte?
    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.emit('roundEnd', { round: this.currentRound });
      this.currentRound++;
      this.currentTurnIndex = 0;
      this.emit('roundStart', { round: this.currentRound });
    }

    // 4. Starta den nya turen
    this.emit('turnStart', {
      round: this.currentRound,
      nation: this.getCurrentNation(),
    });
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getCurrentNation(): Nation {
    return this.turnOrder[this.currentTurnIndex];
  }

  /** Den nation som har turen efter nuvarande (hanterar wraparound). */
  getNextNation(): Nation {
    const nextIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    return this.turnOrder[nextIndex];
  }

  // ─── Pub/sub ───────────────────────────────────────────────────────────────

  on(event: 'turnStart', cb: (e: TurnStartEvent) => void): void;
  on(event: 'turnEnd', cb: (e: TurnEndEvent) => void): void;
  on(event: 'roundStart', cb: (e: RoundStartEvent) => void): void;
  on(event: 'roundEnd', cb: (e: RoundEndEvent) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, cb: (e: any) => void): void {
    const list = this.listeners[event as keyof typeof this.listeners];
    if (list) list.push(cb);
  }

  private emit(event: 'turnStart', data: TurnStartEvent): void;
  private emit(event: 'turnEnd', data: TurnEndEvent): void;
  private emit(event: 'roundStart', data: RoundStartEvent): void;
  private emit(event: 'roundEnd', data: RoundEndEvent): void;
  private emit(event: string, data: unknown): void {
    const list = this.listeners[event as keyof typeof this.listeners];
    if (list) {
      for (const cb of list) {
        (cb as (e: unknown) => void)(data);
      }
    }
  }
}
