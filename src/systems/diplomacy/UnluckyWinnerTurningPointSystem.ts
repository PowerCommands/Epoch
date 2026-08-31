import type { DiplomacyManager } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import type { GameDate } from '../GameDate';
import { compareGameDates, createGameDate, formatGameDate } from '../GameDate';

/**
 * Unlucky Winner — a one-time historical turning point that pushes the
 * culturally strongest AI nation into a new war late in the game, creating
 * military/diplomatic/economic turbulence around a cultural runaway without ever
 * applying a direct cultural penalty.
 *
 * It fires once, in July 1914. At that moment it picks the culturally strongest
 * living AI nation as the "unlucky winner" (never the human) and, walking the
 * Cultural Victory ranking from weakest upward, the first other living nation not
 * already at war with it (the human may be that target). It then temporarily
 * sours only the attacker's relationship toward that target — strongly enough
 * that normal AI war logic chooses to declare war on its own. The event never
 * calls a forced war declaration.
 *
 * Like Cultural Jealousy this is a spark, not a permanent state: every memory
 * delta it applies is recorded in an influence ledger, and the moment the
 * intended war actually starts the recorded influence is subtracted back out of
 * the *current* relation. This removes only Unlucky Winner's own contribution;
 * the normal war-declaration penalties and any later diplomacy remain, so the
 * post-war relationship reflects real history rather than the artificial shock.
 *
 * If the attacker is already at war with every valid nation, the event is NOT
 * consumed — it retries on a short cadence until a valid new target exists.
 */
export const UNLUCKY_WINNER_TRIGGER_YEAR = 1914;
/** 0-based month index — July. */
export const UNLUCKY_WINNER_TRIGGER_MONTH_INDEX = 6;
/** Short retry cadence used only while no valid new-war target exists. */
export const UNLUCKY_WINNER_RETRY_TURNS = 5;

// One-directional activation swing (attacker → target). Sized to clear the AI
// "hostile" attitude bar (hostility >= 50) with margin so normal war logic
// engages; the target receives no artificial hostility toward the attacker.
const ACTIVATION_HOSTILITY_GAIN = 60;
const ACTIVATION_SUSPICION_GAIN = 30;
const ACTIVATION_TRUST_LOSS = 30;
const ACTIVATION_AFFINITY_LOSS = 30;

// Bounded per-round top-up while waiting for the AI to actually declare, so the
// pressure persists (and keeps rising toward the severe bar) instead of decaying
// away before the attacker acts. Silent — never logs per turn.
const REINFORCE_HOSTILITY_CEILING = 90;
const REINFORCE_HOSTILITY_STEP = 8;
const REINFORCE_SUSPICION_CEILING = 80;
const REINFORCE_SUSPICION_STEP = 5;
const REINFORCE_TRUST_FLOOR = 0;
const REINFORCE_TRUST_STEP = 5;
const REINFORCE_AFFINITY_FLOOR = 0;
const REINFORCE_AFFINITY_STEP = 5;

const MIN_MEMORY_VALUE = 0;
const MAX_MEMORY_VALUE = 100;

function clampMemory(value: number): number {
  return Math.max(MIN_MEMORY_VALUE, Math.min(MAX_MEMORY_VALUE, value));
}

function riseToward(current: number, ceiling: number, step: number): number {
  if (current >= ceiling) return current;
  return Math.min(ceiling, current + step);
}

function fallToward(current: number, floor: number, step: number): number {
  if (current <= floor) return current;
  return Math.max(floor, current - step);
}

/** Net delta Unlucky Winner has applied to the pair (fear is never touched). */
interface MemoryInfluence {
  trust: number;
  hostility: number;
  affinity: number;
  suspicion: number;
}

function emptyInfluence(): MemoryInfluence {
  return { trust: 0, hostility: 0, affinity: 0, suspicion: 0 };
}

/** One cultural-ranking entry, ordered strongest → weakest by the caller. */
export interface CulturalRankEntry {
  readonly nationId: string;
  readonly cultureValue: number;
}

export interface UnluckyWinnerWarEvent {
  readonly attackerNationId: string;
  readonly targetNationId: string;
  readonly turn: number;
}

export interface SavedUnluckyWinnerTurningPointState {
  activationReached: boolean;
  completed: boolean;
  /** A target is selected and its temporary influence is applied, awaiting war. */
  armed: boolean;
  nextRetryTurn: number | null;
  attackerId?: string;
  targetId?: string;
  /** Net applied delta on attacker→target, so only this influence is removed later. */
  influence?: MemoryInfluence;
}

export interface UnluckyWinnerTurningPointContext {
  readonly nationManager: NationManager;
  readonly diplomacyManager: DiplomacyManager;
  readonly getGameDate: () => GameDate;
  readonly getCurrentTurn: () => number;
  /** Authoritative Cultural Victory ranking, strongest → weakest. */
  readonly getCulturalRanking: () => readonly CulturalRankEntry[];
  readonly isNationLiving: (nationId: string) => boolean;
  readonly getNationName: (nationId: string) => string;
  readonly log?: (message: string) => void;
  readonly recordHistory?: (event: UnluckyWinnerWarEvent) => void;
}

/**
 * One-shot Turning Point lifecycle:
 * `not triggered → (July 1914) search/retry → arm attacker→target → AI declares
 * war → remove temporary influence → completed (never re-fires)`.
 */
export class UnluckyWinnerTurningPointSystem {
  private activationReached = false;
  private completed = false;
  private armed = false;
  private nextRetryTurn: number | null = null;
  private attackerId: string | undefined;
  private targetId: string | undefined;
  private influence: MemoryInfluence | undefined;

  constructor(private readonly context: UnluckyWinnerTurningPointContext) {}

  handleTurnStart(turn = this.context.getCurrentTurn()): void {
    if (this.completed) return;

    if (!this.activationReached) {
      if (!this.hasReachedTriggerDate()) return;
      this.activationReached = true;
      this.log(`[TurningPoint:UnluckyWinner] Trigger date reached (${formatGameDate(this.context.getGameDate())}).`);
    }

    if (this.armed) {
      this.handleArmed(turn);
      return;
    }

    if (this.nextRetryTurn !== null && turn < this.nextRetryTurn) return;
    this.attemptActivation(turn);
  }

  serialize(): SavedUnluckyWinnerTurningPointState {
    return {
      activationReached: this.activationReached,
      completed: this.completed,
      armed: this.armed,
      nextRetryTurn: this.nextRetryTurn,
      ...(this.attackerId ? { attackerId: this.attackerId } : {}),
      ...(this.targetId ? { targetId: this.targetId } : {}),
      ...(this.influence ? { influence: { ...this.influence } } : {}),
    };
  }

  restore(saved: SavedUnluckyWinnerTurningPointState | undefined): void {
    this.completed = saved?.completed === true;
    this.activationReached = this.completed || saved?.activationReached === true;
    this.armed = !this.completed && saved?.armed === true;
    this.attackerId = this.armed && typeof saved?.attackerId === 'string' ? saved.attackerId : undefined;
    this.targetId = this.armed && typeof saved?.targetId === 'string' ? saved.targetId : undefined;
    this.influence = this.armed && saved?.influence
      ? {
        trust: saved.influence.trust ?? 0,
        hostility: saved.influence.hostility ?? 0,
        affinity: saved.influence.affinity ?? 0,
        suspicion: saved.influence.suspicion ?? 0,
      }
      : undefined;
    this.nextRetryTurn = this.completed
      ? null
      : Number.isInteger(saved?.nextRetryTurn) && (saved?.nextRetryTurn ?? -1) >= 0
        ? saved!.nextRetryTurn
        : null;
    // A corrupt/partial armed state cannot be acted on — fall back to unarmed so
    // selection can run cleanly rather than crash or leave dangling influence.
    if (this.armed && (!this.attackerId || !this.targetId)) {
      this.armed = false;
      this.attackerId = undefined;
      this.targetId = undefined;
      this.influence = undefined;
    }
  }

  private hasReachedTriggerDate(): boolean {
    const target = createGameDate(UNLUCKY_WINNER_TRIGGER_YEAR, false, UNLUCKY_WINNER_TRIGGER_MONTH_INDEX);
    return compareGameDates(this.context.getGameDate(), target) >= 0;
  }

  private attemptActivation(turn: number): void {
    const ranking = this.context.getCulturalRanking()
      .filter((entry) => this.context.isNationLiving(entry.nationId));

    // Attacker: culturally strongest living AI nation (never the human).
    const attackerIndex = ranking.findIndex((entry) => !this.isHuman(entry.nationId));
    const attacker = attackerIndex >= 0 ? ranking[attackerIndex] : undefined;
    if (!attacker) {
      this.scheduleRetry(turn, 'no living AI nation available to select as the cultural leader');
      return;
    }

    // Target: from culturally weakest upward, the first other living nation not
    // already at war with the attacker (the human is a valid target).
    const weakestFirst = [...ranking].reverse();
    const target = weakestFirst.find((entry) =>
      entry.nationId !== attacker.nationId
      && this.context.diplomacyManager.getState(attacker.nationId, entry.nationId) !== 'WAR');
    if (!target) {
      this.scheduleRetry(
        turn,
        `${this.name(attacker.nationId)} is already at war with every valid nation`,
      );
      return;
    }

    this.arm(attacker, attackerIndex + 1, target);
  }

  private arm(attacker: CulturalRankEntry, attackerRank: number, target: CulturalRankEntry): void {
    this.log(
      `[TurningPoint:UnluckyWinner] ${this.name(attacker.nationId)} selected as cultural leader `
      + `(rank #${attackerRank}, culture ${Math.round(attacker.cultureValue)}).`,
    );
    this.log(
      `[TurningPoint:UnluckyWinner] ${this.name(target.nationId)} selected as culturally weakest available target `
      + `(culture ${Math.round(target.cultureValue)}).`,
    );

    this.attackerId = attacker.nationId;
    this.targetId = target.nationId;
    this.armed = true;
    this.nextRetryTurn = null;
    this.influence = emptyInfluence();
    this.applyActivationSwing(attacker.nationId, target.nationId);

    const relation = this.context.diplomacyManager.getRelation(attacker.nationId, target.nationId);
    this.log(
      `[TurningPoint:UnluckyWinner] Temporary relation influence applied — ${this.name(attacker.nationId)} `
      + `hostility toward ${this.name(target.nationId)} now ${Math.round(relation.hostility)}; `
      + 'normal AI war logic should now declare war.',
    );
  }

  private handleArmed(turn: number): void {
    const attackerId = this.attackerId;
    const targetId = this.targetId;
    if (!attackerId || !targetId) {
      this.disarm();
      return;
    }

    // Either side leaving the game before war started dissolves the pairing;
    // strip our influence and let a fresh attacker/target be chosen next turn.
    if (!this.context.isNationLiving(attackerId) || !this.context.isNationLiving(targetId)) {
      const removed = this.removeInfluence();
      if (removed) {
        this.log(
          `[TurningPoint:UnluckyWinner] Pairing ${this.name(attackerId)} vs ${this.name(targetId)} dissolved `
          + 'before war; temporary relation influence removed. Reselecting.',
        );
      }
      this.disarm();
      return;
    }

    if (this.context.diplomacyManager.getState(attackerId, targetId) === 'WAR') {
      this.complete(attackerId, targetId, turn);
      return;
    }

    // Keep the pressure on until the AI declares the war itself.
    this.reinforceTowardTarget(attackerId, targetId);
  }

  private complete(attackerId: string, targetId: string, turn: number): void {
    this.log(`[TurningPoint:UnluckyWinner] ${this.name(attackerId)} declared war on ${this.name(targetId)}.`);

    const removed = this.removeInfluence();
    if (removed) {
      this.log(
        `[TurningPoint:UnluckyWinner] Temporary relation influence removed — `
        + `hostility ${Math.round(removed.before.hostility)}→${Math.round(removed.after.hostility)}, `
        + `suspicion ${Math.round(removed.before.suspicion)}→${Math.round(removed.after.suspicion)}, `
        + `trust ${Math.round(removed.before.trust)}→${Math.round(removed.after.trust)}, `
        + `affinity ${Math.round(removed.before.affinity)}→${Math.round(removed.after.affinity)}. `
        + 'Normal war diplomacy now governs.',
      );
    } else {
      this.log('[TurningPoint:UnluckyWinner] Temporary relation influence removed. Normal war diplomacy now governs.');
    }

    // Commit completion before any callback can save or re-enter the system.
    this.completed = true;
    this.armed = false;
    this.nextRetryTurn = null;
    this.log(`[TurningPoint:UnluckyWinner] Event completed — ${this.name(attackerId)} vs ${this.name(targetId)}.`);
    this.context.recordHistory?.({ attackerNationId: attackerId, targetNationId: targetId, turn });
  }

  private scheduleRetry(turn: number, reason: string): void {
    this.nextRetryTurn = turn + UNLUCKY_WINNER_RETRY_TURNS;
    this.log(
      `[TurningPoint:UnluckyWinner] No valid new-war target (${reason}). `
      + `Retrying in ${UNLUCKY_WINNER_RETRY_TURNS} turns.`,
    );
  }

  private disarm(): void {
    this.armed = false;
    this.attackerId = undefined;
    this.targetId = undefined;
    this.influence = undefined;
    this.nextRetryTurn = null;
  }

  private applyActivationSwing(attackerId: string, targetId: string): void {
    const relation = this.context.diplomacyManager.getRelation(attackerId, targetId);
    this.writeMemoryRecording(attackerId, targetId, {
      trust: clampMemory(relation.trust - ACTIVATION_TRUST_LOSS),
      fear: relation.fear,
      hostility: clampMemory(relation.hostility + ACTIVATION_HOSTILITY_GAIN),
      affinity: clampMemory(relation.affinity - ACTIVATION_AFFINITY_LOSS),
      suspicion: clampMemory(relation.suspicion + ACTIVATION_SUSPICION_GAIN),
    });
  }

  private reinforceTowardTarget(attackerId: string, targetId: string): void {
    const relation = this.context.diplomacyManager.getRelation(attackerId, targetId);
    this.writeMemoryRecording(attackerId, targetId, {
      trust: fallToward(relation.trust, REINFORCE_TRUST_FLOOR, REINFORCE_TRUST_STEP),
      fear: relation.fear,
      hostility: riseToward(relation.hostility, REINFORCE_HOSTILITY_CEILING, REINFORCE_HOSTILITY_STEP),
      affinity: fallToward(relation.affinity, REINFORCE_AFFINITY_FLOOR, REINFORCE_AFFINITY_STEP),
      suspicion: riseToward(relation.suspicion, REINFORCE_SUSPICION_CEILING, REINFORCE_SUSPICION_STEP),
    });
  }

  /** Write memory values AND record the actual (post-clamp) applied delta. */
  private writeMemoryRecording(
    a: string,
    b: string,
    next: { trust: number; fear: number; hostility: number; affinity: number; suspicion: number },
  ): void {
    const before = this.context.diplomacyManager.getRelation(a, b);
    this.context.diplomacyManager.setMemoryValues(a, b, next);
    const delta: MemoryInfluence = {
      trust: next.trust - before.trust,
      hostility: next.hostility - before.hostility,
      affinity: next.affinity - before.affinity,
      suspicion: next.suspicion - before.suspicion,
    };
    if (!this.influence) this.influence = emptyInfluence();
    this.influence.trust += delta.trust;
    this.influence.hostility += delta.hostility;
    this.influence.affinity += delta.affinity;
    this.influence.suspicion += delta.suspicion;
  }

  /**
   * Subtract the recorded influence out of the *current* attacker→target
   * relation (never a pre-event snapshot), then forget it. War-declaration
   * penalties and any later diplomacy that changed the relation after arming are
   * preserved (fear is never touched by Unlucky Winner).
   */
  private removeInfluence(): { before: MemoryInfluence; after: MemoryInfluence } | undefined {
    const delta = this.influence;
    const attackerId = this.attackerId;
    const targetId = this.targetId;
    if (!delta || !attackerId || !targetId) return undefined;

    const relation = this.context.diplomacyManager.getRelation(attackerId, targetId);
    const before: MemoryInfluence = {
      trust: relation.trust,
      hostility: relation.hostility,
      affinity: relation.affinity,
      suspicion: relation.suspicion,
    };
    const after: MemoryInfluence = {
      trust: clampMemory(relation.trust - delta.trust),
      hostility: clampMemory(relation.hostility - delta.hostility),
      affinity: clampMemory(relation.affinity - delta.affinity),
      suspicion: clampMemory(relation.suspicion - delta.suspicion),
    };
    this.context.diplomacyManager.setMemoryValues(attackerId, targetId, {
      trust: after.trust,
      fear: relation.fear,
      hostility: after.hostility,
      affinity: after.affinity,
      suspicion: after.suspicion,
    });
    this.influence = undefined;
    return { before, after };
  }

  private isHuman(nationId: string): boolean {
    return this.context.nationManager.getNation(nationId)?.isHuman === true;
  }

  private name(nationId: string): string {
    return this.context.getNationName(nationId);
  }

  private log(message: string): void {
    this.context.log?.(message);
  }
}
