import type { CameraController } from './CameraController';
import type { CombatSystem, CityCombatEvent, CombatEvent } from './CombatSystem';
import type { EventLogSystem } from './EventLogSystem';
import type { FoundCitySystem } from './FoundCitySystem';
import type { NationManager } from './NationManager';
import type { TileMap } from './TileMap';
import type { TurnManager } from './TurnManager';
import type { City } from '../entities/City';
import type { Nation } from '../entities/Nation';
import type { RoundEndEvent } from '../types/events';

export type AutoplayNationRunner = (nation: Nation) => void;

/**
 * AutoplaySystem v1.1 — debug-only.
 *
 * v1.0 ran the existing AI-turn chain synchronously. v1.1 owns its async
 * autoplay loop here and receives the per-nation AI work as a callback from
 * GameScene. Nations are still temporarily marked non-human for lower-level
 * AI helpers that guard their own work.
 *
 * Logging reuses EventLogSystem: every entry it appends while autoplay is
 * active is forwarded as a `log` event for the HUD. AutoplaySystem does
 * not subscribe to AI internals.
 *
 * GameScene's normal AI `turnStart` listener is disabled while autoplay is
 * active. AutoplaySystem is the only owner of `endCurrentTurn()` during
 * autoplay.
 */

const TURN_DELAY_MS = 30;

export interface AutoplayProgressEvent {
  readonly completedRounds: number;
  readonly requestedRounds: number;
  readonly currentTurnLabel: string;
}

export interface AutoplayLogEvent {
  readonly message: string;
  readonly round: number;
}

export interface AutoplayStartedEvent {
  readonly requestedRounds: number;
}

type StartedListener = (e: AutoplayStartedEvent) => void;
type ProgressListener = (e: AutoplayProgressEvent) => void;
type PausedListener = () => void;
type ResumedListener = () => void;
type StoppedListener = () => void;
type LogListener = (e: AutoplayLogEvent) => void;

export class AutoplaySystem {
  private active = false;
  private paused = false;
  private requestedRounds = 0;
  private completedRounds = 0;
  private startRound = 0;
  private nextTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingResume = false;
  private readonly originalIsHuman = new Map<string, boolean>();

  private lastSeenEventLogId = 0;
  private hooksInstalled = false;

  private readonly startedListeners: StartedListener[] = [];
  private readonly progressListeners: ProgressListener[] = [];
  private readonly pausedListeners: PausedListener[] = [];
  private readonly resumedListeners: ResumedListener[] = [];
  private readonly stoppedListeners: StoppedListener[] = [];
  private readonly logListeners: LogListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly cameraController: CameraController,
    private readonly tileMap: TileMap,
    private readonly combatSystem: CombatSystem,
    private readonly foundCitySystem: FoundCitySystem,
    private readonly eventLog: EventLogSystem,
    private readonly runAutoplayNationTurn: AutoplayNationRunner,
  ) {
    this.turnManager.on('roundEnd', (e) => this.handleRoundEnd(e));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  start(rounds: number): void {
    if (!Number.isFinite(rounds) || rounds <= 0) {
      console.log(`[AUTOPLAY] Invalid round count: ${rounds}`);
      return;
    }
    if (this.active) {
      // Spec: starting again while running should restart cleanly.
      this.stop();
    }

    this.installEventHooksOnce();

    this.requestedRounds = Math.floor(rounds);
    this.completedRounds = 0;
    this.startRound = this.turnManager.getCurrentRound();
    this.lastSeenEventLogId = this.lastEventLogIdSnapshot();

    this.originalIsHuman.clear();
    for (const nation of this.nationManager.getAllNations()) {
      this.originalIsHuman.set(nation.id, nation.isHuman);
      nation.isHuman = false;
    }
    this.active = true;
    this.paused = false;

    console.log(`[AUTOPLAY] Starting at round ${this.startRound} for ${this.requestedRounds} rounds.`);
    this.emitStarted();
    this.safeEmitProgress();

    // Kick the chain, including the current active nation.
    this.scheduleNextTurn();
  }

  pause(): void {
    if (!this.active || this.paused) return;
    this.paused = true;
    if (this.nextTurnTimer !== null) {
      clearTimeout(this.nextTurnTimer);
      this.nextTurnTimer = null;
      this.hasPendingResume = true;
    }
    console.log(`[AUTOPLAY] Paused at round ${this.turnManager.getCurrentRound()}.`);
    for (const cb of this.pausedListeners) {
      try {
        cb();
      } catch (error) {
        console.error('[AUTOPLAY] paused listener failed', error);
      }
    }
  }

  resume(): void {
    if (!this.active || !this.paused) return;
    this.paused = false;
    console.log(`[AUTOPLAY] Resumed at round ${this.turnManager.getCurrentRound()}.`);
    for (const cb of this.resumedListeners) {
      try {
        cb();
      } catch (error) {
        console.error('[AUTOPLAY] resumed listener failed', error);
      }
    }
    if (this.hasPendingResume) {
      this.hasPendingResume = false;
      this.scheduleNextTurn();
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.paused = false;
    this.hasPendingResume = false;
    if (this.nextTurnTimer !== null) {
      clearTimeout(this.nextTurnTimer);
      this.nextTurnTimer = null;
    }
    for (const [nationId, wasHuman] of this.originalIsHuman) {
      const nation = this.nationManager.getNation(nationId);
      if (nation) nation.isHuman = wasHuman;
    }
    this.originalIsHuman.clear();
    console.log(`[AUTOPLAY] Stopped at round ${this.turnManager.getCurrentRound()}.`);
    for (const cb of this.stoppedListeners) {
      try {
        cb();
      } catch (error) {
        console.error('[AUTOPLAY] stopped listener failed', error);
      }
    }
  }

  isRunning(): boolean { return this.active && !this.paused; }
  isPaused(): boolean { return this.active && this.paused; }
  isActive(): boolean { return this.active; }
  getRequestedRounds(): number { return this.requestedRounds; }
  getCompletedRounds(): number { return this.completedRounds; }
  getRemainingRounds(): number { return Math.max(0, this.requestedRounds - this.completedRounds); }

  logDiagnostic(message: string): void {
    if (!this.active) return;
    const payload: AutoplayLogEvent = {
      message,
      round: this.turnManager.getCurrentRound(),
    };
    for (const cb of this.logListeners) {
      try {
        cb(payload);
      } catch (error) {
        console.error('[AUTOPLAY] log listener failed', error);
      }
    }
  }

  // ─── Event subscriptions ───────────────────────────────────────────────────

  onStarted(cb: StartedListener): void { this.startedListeners.push(cb); }
  onProgress(cb: ProgressListener): void { this.progressListeners.push(cb); }
  onPaused(cb: PausedListener): void { this.pausedListeners.push(cb); }
  onResumed(cb: ResumedListener): void { this.resumedListeners.push(cb); }
  onStopped(cb: StoppedListener): void { this.stoppedListeners.push(cb); }
  onLog(cb: LogListener): void { this.logListeners.push(cb); }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private scheduleNextTurn(): void {
    if (!this.active || this.paused) return;
    if (this.nextTurnTimer !== null) {
      console.debug('[AUTOPLAY] Next turn already scheduled, skipping duplicate schedule.');
      return;
    }
    const scheduledRound = this.turnManager.getCurrentRound();
    const scheduledNation = this.turnManager.getCurrentNation();
    console.debug(`[AUTOPLAY] Scheduling next step: Round ${scheduledRound} — ${scheduledNation.name}`);
    this.nextTurnTimer = setTimeout(() => {
      this.nextTurnTimer = null;
      if (!this.active || this.paused) {
        this.hasPendingResume = this.active;
        return;
      }
      const currentRound = this.turnManager.getCurrentRound();
      const currentNation = this.turnManager.getCurrentNation();
      console.debug(`[AUTOPLAY] Advancing from Round ${currentRound} — ${currentNation.name}`);
      this.runCurrentAutoplayTurn();
    }, TURN_DELAY_MS);
  }

  private runCurrentAutoplayTurn(): void {
    if (!this.active || this.paused) return;

    const nation = this.turnManager.getCurrentNation();

    try {
      this.runAutoplayNationTurn(nation);
    } catch (error) {
      console.error(`[AUTOPLAY] AI turn failed for ${nation.name}`, error);
      this.logDiagnostic(`ERROR: ${nation.name} AI turn failed. See browser console.`);
    }

    this.safeFlushEventLog();
    this.safeEmitProgress();

    if (this.completedRounds >= this.requestedRounds) {
      this.stop();
      return;
    }

    try {
      this.turnManager.endCurrentTurn();
    } catch (error) {
      const currentNation = this.turnManager.getCurrentNation();
      console.error(
        `[AUTOPLAY] Turn transition failed. Current nation is now ${currentNation.name}.`,
        error,
      );
      this.logDiagnostic(
        `ERROR: turn transition failed near ${currentNation.name}. Continuing autoplay; see browser console.`,
      );
    } finally {
      this.safeFlushEventLog();
      this.safeEmitProgress();

      if (this.completedRounds >= this.requestedRounds) {
        this.stop();
        return;
      }

      if (this.active && !this.paused) {
        console.debug('[AUTOPLAY] Reached final scheduling block');
        this.scheduleNextTurn();
      }
    }
  }

  private handleRoundEnd(e: RoundEndEvent): void {
    if (!this.active) return;
    this.completedRounds = e.round - this.startRound + 1;
    this.safeFlushEventLog();
    this.safeEmitProgress();
  }

  private installEventHooksOnce(): void {
    if (this.hooksInstalled) return;
    this.hooksInstalled = true;

    this.combatSystem.on((event: CombatEvent) => {
      if (!this.active) return;
      this.focusTile(event.defender.tileX, event.defender.tileY);
    });
    this.combatSystem.onCityCombat((event: CityCombatEvent) => {
      if (!this.active) return;
      this.focusTile(event.city.tileX, event.city.tileY);
    });
    this.foundCitySystem.onCityFounded((city: City) => {
      if (!this.active) return;
      this.focusTile(city.tileX, city.tileY);
    });
    this.eventLog.onChanged(() => {
      if (!this.active) return;
      this.safeFlushEventLog();
    });
  }

  private safeEmitProgress(): void {
    try {
      this.emitProgress();
    } catch (error) {
      console.error('[AUTOPLAY] Progress listener failed', error);
    }
  }

  private safeFlushEventLog(): void {
    try {
      this.flushEventLog();
    } catch (error) {
      console.error('[AUTOPLAY] Log listener failed', error);
    }
  }

  private flushEventLog(): void {
    const entries = this.eventLog.getAllEntries();
    for (const entry of entries) {
      if (entry.id <= this.lastSeenEventLogId) continue;
      this.lastSeenEventLogId = entry.id;
      const payload: AutoplayLogEvent = { message: entry.text, round: entry.round };
      for (const cb of this.logListeners) {
        try {
          cb(payload);
        } catch (error) {
          console.error('[AUTOPLAY] log listener failed', error);
        }
      }
    }
  }

  private lastEventLogIdSnapshot(): number {
    const entries = this.eventLog.getAllEntries();
    return entries.length === 0 ? 0 : entries[entries.length - 1].id;
  }

  private emitStarted(): void {
    const payload: AutoplayStartedEvent = { requestedRounds: this.requestedRounds };
    for (const cb of this.startedListeners) {
      try {
        cb(payload);
      } catch (error) {
        console.error('[AUTOPLAY] started listener failed', error);
      }
    }
  }

  private emitProgress(): void {
    const currentRound = this.turnManager.getCurrentRound();
    const currentNation = this.turnManager.getCurrentNation();
    const payload: AutoplayProgressEvent = {
      completedRounds: this.completedRounds,
      requestedRounds: this.requestedRounds,
      currentTurnLabel: `Round ${currentRound} — ${currentNation.name}`,
    };
    for (const cb of this.progressListeners) {
      try {
        cb(payload);
      } catch (error) {
        console.error('[AUTOPLAY] progress listener failed', error);
      }
    }
  }

  private focusTile(tileX: number, tileY: number): void {
    const { x, y } = this.tileMap.tileToWorld(tileX, tileY);
    this.cameraController.focusOn(x, y, 1.5);
  }
}
