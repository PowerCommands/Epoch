import type { DiplomacyManager } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import { SeededRandom } from '../procedural/SeededRandom';
import { LEGACY_TURNING_POINT_TRIGGER_YEARS } from '../scenarioTurningPoints';

/** Legacy default used only when a scenario predates explicit Turning Point entries. */
export const LUCKY_LOSER_TRIGGER_YEAR = LEGACY_TURNING_POINT_TRIGGER_YEARS.luckyLoser;
/** Exact turn interval between failed candidate checks. */
export const LUCKY_LOSER_RETRY_TURNS = 100;
/** One-time treasury injection. It never purchases independence automatically. */
export const LUCKY_LOSER_GOLD_REWARD = 100_000;

export interface SavedLuckyLoserTurningPointState {
  activationReached: boolean;
  occurred: boolean;
  nextRetryTurn: number | null;
  winnerNationId?: string;
}

export interface LuckyLoserAwardEvent {
  winnerNationId: string;
  eligibleVassalCount: number;
  goldAwarded: number;
  treasuryBefore: number;
  treasuryAfter: number;
  turn: number;
}

export interface LuckyLoserTurningPointContext {
  readonly nationManager: NationManager;
  readonly diplomacyManager: DiplomacyManager;
  readonly getGlobalYear: () => number;
  /** Null disables this Turning Point; omitted retains the legacy default for direct callers. */
  readonly triggerYear?: number | null;
  readonly getCurrentTurn: () => number;
  readonly randomSeed: string;
  readonly getGold: (nationId: string) => number;
  readonly addGold: (nationId: string, amount: number) => number | null;
  readonly getNationName: (nationId: string) => string;
  readonly log?: (message: string) => void;
  readonly recordHistory?: (event: LuckyLoserAwardEvent) => void;
  readonly notifyHuman?: (event: LuckyLoserAwardEvent) => void;
}

/**
 * One-shot Turning Point: calendar gate -> scheduled candidate check -> one
 * deterministic random vassal -> one treasury injection -> normal systems resume.
 */
export class LuckyLoserTurningPointSystem {
  private activationReached = false;
  private occurred = false;
  private nextRetryTurn: number | null = null;
  private winnerNationId: string | undefined;

  constructor(private readonly context: LuckyLoserTurningPointContext) {}

  handleTurnStart(turn = this.context.getCurrentTurn()): void {
    if (this.occurred) return;

    if (!this.activationReached) {
      const triggerYear = this.context.triggerYear === undefined
        ? LUCKY_LOSER_TRIGGER_YEAR
        : this.context.triggerYear;
      if (triggerYear === null || this.context.getGlobalYear() < triggerYear) return;
      this.activationReached = true;
    }

    if (this.nextRetryTurn !== null && turn < this.nextRetryTurn) return;

    const eligibleVassalIds = this.getEligibleVassalIds();
    if (eligibleVassalIds.length === 0) {
      this.nextRetryTurn = turn + LUCKY_LOSER_RETRY_TURNS;
      this.context.log?.(
        `[TurningPoint:LuckyLoser] No eligible vassal state found. Retrying in ${LUCKY_LOSER_RETRY_TURNS} turns.`,
      );
      return;
    }

    const winnerNationId = this.selectWinner(eligibleVassalIds, turn);
    this.applyAward(winnerNationId, eligibleVassalIds.length, turn);
  }

  serialize(): SavedLuckyLoserTurningPointState {
    return {
      activationReached: this.activationReached,
      occurred: this.occurred,
      nextRetryTurn: this.nextRetryTurn,
      ...(this.winnerNationId ? { winnerNationId: this.winnerNationId } : {}),
    };
  }

  restore(saved: SavedLuckyLoserTurningPointState | undefined): void {
    this.occurred = saved?.occurred === true;
    this.activationReached = this.occurred || saved?.activationReached === true;
    this.winnerNationId = this.occurred && typeof saved?.winnerNationId === 'string'
      ? saved.winnerNationId
      : undefined;
    this.nextRetryTurn = this.occurred
      ? null
      : Number.isInteger(saved?.nextRetryTurn) && (saved?.nextRetryTurn ?? -1) >= 0
        ? saved!.nextRetryTurn
        : null;
  }

  private getEligibleVassalIds(): string[] {
    // NationManager's active participant list is the authoritative living set;
    // eliminated nations have already been removed from it.
    return this.context.nationManager.getAllNations()
      .filter((nation) => this.context.diplomacyManager.isVassal(nation.id))
      .map((nation) => nation.id)
      .sort((a, b) => a.localeCompare(b));
  }

  private selectWinner(eligibleVassalIds: readonly string[], turn: number): string {
    if (eligibleVassalIds.length === 1) return eligibleVassalIds[0]!;
    const rng = new SeededRandom(
      `${this.context.randomSeed}|turn:${turn}|candidates:${eligibleVassalIds.join(',')}`,
    );
    return rng.pick(eligibleVassalIds);
  }

  private applyAward(winnerNationId: string, eligibleVassalCount: number, turn: number): void {
    const treasuryBefore = this.context.getGold(winnerNationId);
    const treasuryAfter = this.context.addGold(winnerNationId, LUCKY_LOSER_GOLD_REWARD);
    if (treasuryAfter === null) {
      throw new Error(`Lucky Loser could not grant Gold to living nation ${winnerNationId}.`);
    }

    // Commit completion before any callback can save or re-enter the system.
    this.occurred = true;
    this.nextRetryTurn = null;
    this.winnerNationId = winnerNationId;
    const event: LuckyLoserAwardEvent = {
      winnerNationId,
      eligibleVassalCount,
      goldAwarded: LUCKY_LOSER_GOLD_REWARD,
      treasuryBefore,
      treasuryAfter,
      turn,
    };
    const winnerName = this.context.getNationName(winnerNationId);
    this.context.log?.(
      eligibleVassalCount === 1
        ? `[TurningPoint:LuckyLoser] ${winnerName} is the only eligible vassal state and receives ${LUCKY_LOSER_GOLD_REWARD.toLocaleString('en-US')} Gold.`
        : `[TurningPoint:LuckyLoser] ${winnerName} selected from ${eligibleVassalCount} eligible vassal states and receives ${LUCKY_LOSER_GOLD_REWARD.toLocaleString('en-US')} Gold.`,
    );
    this.context.recordHistory?.(event);
    if (this.context.nationManager.getNation(winnerNationId)?.isHuman === true) {
      this.context.notifyHuman?.(event);
    }
  }
}
