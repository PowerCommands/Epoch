import type { TurnStartEvent } from '../types/events';
import type { SavedConsolidationState, SavedNation } from '../types/saveGame';

/**
 * Why a nation entered Consolidation Mode. Determines how/when it ends.
 * `economicCrisis` outranks `postWar`: a crisis persists while the economy is
 * negative, whereas post-war consolidation always ends after a fixed period.
 */
export type ConsolidationReason = 'postWar' | 'economicCrisis';

export interface ConsolidationState {
  reason: ConsolidationReason;
  startedTurn: number;
  minimumUntilTurn: number;
  loggedMinimumReached: boolean;
}

/** Duration of post-war recovery consolidation, in turns. */
export const POST_WAR_CONSOLIDATION_TURNS = 10;
/** Minimum duration of economic-crisis consolidation, in turns. */
export const ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS = 10;

export interface ConsolidationSystemDeps {
  getCurrentRound: () => number;
  /** Net national income (gold per turn minus upkeep). Uses existing economy calc. */
  getNetIncome: (nationId: string) => number;
  isHuman: (nationId: string) => boolean;
  getNationName?: (nationId: string) => string;
  logEvent?: (nationId: string, message: string) => void;
}

/**
 * Lightweight nation-level AI state for temporary "consolidation" periods.
 *
 * Consolidation Mode is an internal AI decision hint — while active, AI cities
 * strongly prefer the Economic Development project over ordinary military and
 * marginal construction (see AISystem). It is NOT a strategic framework: it
 * only tracks whether a nation is consolidating, why, and the minimum period.
 *
 * The system deliberately reacts to existing events (forced upkeep dismissal,
 * war ending) rather than owning any economy/diplomacy rules of its own.
 */
export class ConsolidationSystem {
  private readonly states = new Map<string, ConsolidationState>();

  constructor(private readonly deps: ConsolidationSystemDeps) {}

  isConsolidating(nationId: string): boolean {
    return this.states.has(nationId);
  }

  getReason(nationId: string): ConsolidationReason | undefined {
    return this.states.get(nationId)?.reason;
  }

  /**
   * Enter (or reinforce) post-war consolidation. Human nations never enter
   * Consolidation Mode. If already consolidating, the minimum period is only
   * ever extended, never shortened, and an existing economic crisis is kept.
   */
  enterPostWar(nationId: string): void {
    if (this.deps.isHuman(nationId)) return;
    const turn = this.deps.getCurrentRound();
    const target = turn + POST_WAR_CONSOLIDATION_TURNS;
    const existing = this.states.get(nationId);
    if (existing) {
      // Never shorten an in-progress period; keep the stronger crisis reason.
      existing.minimumUntilTurn = Math.max(existing.minimumUntilTurn, target);
      return;
    }
    this.states.set(nationId, {
      reason: 'postWar',
      startedTurn: turn,
      minimumUntilTurn: target,
      loggedMinimumReached: false,
    });
    this.log(nationId, `Entering post-war consolidation for ${POST_WAR_CONSOLIDATION_TURNS} turns`);
  }

  /**
   * Enter (or upgrade to) economic-crisis consolidation after a forced military
   * dismissal caused by insufficient upkeep. Outranks post-war consolidation.
   */
  enterEconomicCrisis(nationId: string): void {
    if (this.deps.isHuman(nationId)) return;
    const turn = this.deps.getCurrentRound();
    const target = turn + ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS;
    const existing = this.states.get(nationId);
    if (existing) {
      const wasCrisis = existing.reason === 'economicCrisis';
      existing.reason = 'economicCrisis';
      existing.minimumUntilTurn = Math.max(existing.minimumUntilTurn, target);
      // Re-arm the "still negative" log for a fresh crisis so the next minimum
      // boundary is reported again.
      if (!wasCrisis) existing.loggedMinimumReached = false;
      return;
    }
    this.states.set(nationId, {
      reason: 'economicCrisis',
      startedTurn: turn,
      minimumUntilTurn: target,
      loggedMinimumReached: false,
    });
    this.log(nationId, 'Entering consolidation: forced military dismissal due to upkeep');
  }

  /** Re-evaluate a nation's consolidation each turn and expire it deterministically. */
  handleTurnStart(event: TurnStartEvent): void {
    this.evaluate(event.nation.id);
  }

  /** Public for tests: run the expiry evaluation for one nation. */
  evaluate(nationId: string): void {
    const state = this.states.get(nationId);
    if (!state) return;
    const turn = this.deps.getCurrentRound();

    if (state.reason === 'postWar') {
      if (turn >= state.minimumUntilTurn) {
        this.states.delete(nationId);
        this.log(nationId, 'Leaving post-war consolidation: recovery period complete');
      }
      return;
    }

    // economicCrisis: hold until the minimum period passes, then leave only
    // once net income is non-negative. Avoids rapid enter/exit oscillation.
    if (turn < state.minimumUntilTurn) return;

    const netIncome = Math.round(this.deps.getNetIncome(nationId));
    if (netIncome >= 0) {
      this.states.delete(nationId);
      this.log(nationId, `Leaving consolidation: economy recovered (${formatGpt(netIncome)})`);
      return;
    }

    if (!state.loggedMinimumReached) {
      state.loggedMinimumReached = true;
      this.log(nationId, `Consolidation minimum period complete, economy still negative (${formatGpt(netIncome)})`);
    }
  }

  /** Serialize per-nation state for save embedding on SavedNation. */
  getSavedState(nationId: string): SavedConsolidationState | undefined {
    const state = this.states.get(nationId);
    if (!state) return undefined;
    return {
      reason: state.reason,
      startedTurn: state.startedTurn,
      minimumUntilTurn: state.minimumUntilTurn,
      loggedMinimumReached: state.loggedMinimumReached,
    };
  }

  /** Restore state from saved nations. Replaces any live state. */
  restore(nations: readonly SavedNation[]): void {
    this.states.clear();
    for (const nation of nations) {
      const saved = nation.consolidation;
      if (!saved) continue;
      this.states.set(nation.id, {
        reason: saved.reason,
        startedTurn: saved.startedTurn,
        minimumUntilTurn: saved.minimumUntilTurn,
        loggedMinimumReached: saved.loggedMinimumReached ?? false,
      });
    }
  }

  private log(nationId: string, message: string): void {
    const name = this.deps.getNationName?.(nationId) ?? nationId;
    console.log(`[AI][${name}] ${message}`);
    this.deps.logEvent?.(nationId, message);
  }
}

function formatGpt(netIncome: number): string {
  return `${netIncome >= 0 ? '+' : ''}${netIncome} GPT`;
}
