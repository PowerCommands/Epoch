/**
 * Reclaim Capital orchestration + diagnostic logging.
 *
 * Owns no game rules of its own: it derives each non-human nation's Reclaim
 * Capital objective from canonical city state (via the pure `reclaimCapital`
 * module), assesses opportunity once per round, caches both for the systems
 * that consume them (war-declaration, joint-war, military targeting), and emits
 * concise `[ReclaimCapital]` logs only on major state transitions.
 *
 * All state is transient and reconstructs from city state on load, so nothing
 * here needs to enter the save format. Dependencies are injected as narrow
 * function interfaces so the system stays deterministic and unit-testable.
 */

import {
  assessReclaimOpportunity,
  deriveReclaimObjective,
  reclaimWarModifier,
  OVERMATCHED_RATIO,
  type ReclaimCapitalObjective,
  type ReclaimCityView,
  type ReclaimOpportunity,
  type ReclaimWarModifier,
} from './reclaimCapital';

export interface ReclaimCapitalDeps {
  getAllCities(): readonly ReclaimCityView[];
  getAllNationIds(): readonly string[];
  getNonHumanNationIds(): readonly string[];
  nationExists(nationId: string): boolean;
  getMilitaryStrength(nationId: string): number;
  /** Nations `nationId` is currently at WAR with. */
  getWarringNationIds(nationId: string): readonly string[];
  /** Whether `viewer` currently regards `other` as hostile. */
  isHostileTowards(viewer: string, other: string): boolean;
  haveMet(a: string, b: string): boolean;
  /** Economy currently sustainable (non-negative gold and income). */
  isEconomyHealthy(nationId: string): boolean;
  /** Whether a fresh war on `holderId` is permitted now (cooldowns). */
  isWarPermitted(nationId: string, holderId: string): boolean;
  /** Whether `nationId` is currently at war with `holderId`. */
  isAtWarWith(nationId: string, holderId: string): boolean;
  log(message: string): void;
}

interface ReclaimState {
  active: boolean;
  targetCityId: string;
  holderId: string;
  opportunity: ReclaimOpportunity;
  seekingPeaceLogged: boolean;
}

export class ReclaimCapitalSystem {
  private readonly lastState = new Map<string, ReclaimState>();
  private readonly objectiveCache = new Map<string, ReclaimCapitalObjective | null>();
  private readonly opportunityCache = new Map<string, ReclaimOpportunity>();
  private cacheRound = -1;

  constructor(private readonly deps: ReclaimCapitalDeps) {}

  handleRoundStart(round: number): void {
    this.resetCache(round);
    for (const nationId of this.deps.getNonHumanNationIds()) {
      const objective = this.computeObjective(nationId);
      const previous = this.lastState.get(nationId);

      if (!objective) {
        if (previous?.active) {
          // Only a genuine recovery is a completion; a collapsed/destroyed nation
          // simply drops the objective without the triumphant log.
          if (this.deps.nationExists(nationId)) {
            this.deps.log(`[ReclaimCapital] ${nationId} reclaimed its capital. Strategic objective completed.`);
          }
          this.lastState.delete(nationId);
        }
        continue;
      }

      const opportunity = this.computeOpportunity(nationId, objective);
      const seekingPeaceLogged = this.logTransitions(nationId, objective, opportunity, previous);
      this.lastState.set(nationId, {
        active: true,
        targetCityId: objective.targetCityId,
        holderId: objective.currentHolderId,
        opportunity,
        seekingPeaceLogged,
      });
    }
  }

  /** The active objective for `nationId`, derived fresh if not cached this round. */
  getObjective(nationId: string): ReclaimCapitalObjective | null {
    if (this.objectiveCache.has(nationId)) return this.objectiveCache.get(nationId) ?? null;
    return this.computeObjective(nationId);
  }

  getOpportunity(nationId: string): ReclaimOpportunity {
    const cached = this.opportunityCache.get(nationId);
    if (cached) return cached;
    const objective = this.getObjective(nationId);
    if (!objective) return 'none';
    return this.computeOpportunity(nationId, objective);
  }

  /** War-declaration modifier consumed by AIDiplomacySystem. */
  getReclaimWarModifier(selfId: string, opponentId: string): ReclaimWarModifier {
    return reclaimWarModifier(this.getObjective(selfId), this.getOpportunity(selfId), opponentId);
  }

  /** Current holder of `nationId`'s lost capital, consumed by JointWarSystem. */
  getReclaimHolderId(nationId: string): string | undefined {
    return this.getObjective(nationId)?.currentHolderId;
  }

  private resetCache(round: number): void {
    if (round === this.cacheRound) return;
    this.cacheRound = round;
    this.objectiveCache.clear();
    this.opportunityCache.clear();
  }

  private computeObjective(nationId: string): ReclaimCapitalObjective | null {
    const objective = deriveReclaimObjective(nationId, this.deps.getAllCities());
    this.objectiveCache.set(nationId, objective);
    return objective;
  }

  private computeOpportunity(nationId: string, objective: ReclaimCapitalObjective): ReclaimOpportunity {
    const holderId = objective.currentHolderId;
    const holderOtherWarCount = this.deps.getWarringNationIds(holderId)
      .filter((id) => id !== nationId).length;
    const availablePartnerCount = this.deps.getAllNationIds().filter((other) => (
      other !== nationId
      && other !== holderId
      && this.deps.haveMet(nationId, other)
      // A common enemy is useful, but does not erase an existing feud. Count
      // only nations with which cooperation is still diplomatically plausible.
      && !this.deps.isHostileTowards(nationId, other)
      && !this.deps.isHostileTowards(other, nationId)
      && (this.deps.isAtWarWith(other, holderId) || this.deps.isHostileTowards(other, holderId))
    )).length;

    const result = assessReclaimOpportunity({
      ownMilitaryStrength: this.deps.getMilitaryStrength(nationId),
      holderMilitaryStrength: this.deps.getMilitaryStrength(holderId),
      holderOtherWarCount,
      availablePartnerCount,
      economyHealthy: this.deps.isEconomyHealthy(nationId),
      warPermittedByCooldown: this.deps.isWarPermitted(nationId, holderId),
    });
    this.opportunityCache.set(nationId, result.level);
    return result.level;
  }

  /**
   * Emit transition logs and return whether the "seeking peace to preserve
   * recovery" note is currently in effect for this (nation, holder) span — the
   * caller carries that flag forward so the note is logged at most once per span.
   */
  private logTransitions(
    nationId: string,
    objective: ReclaimCapitalObjective,
    opportunity: ReclaimOpportunity,
    previous: ReclaimState | undefined,
  ): boolean {
    const holderId = objective.currentHolderId;
    const holderChanged = previous?.active === true && previous.holderId !== holderId;

    if (!previous?.active) {
      this.deps.log(
        `[ReclaimCapital] ${nationId} lost ${objective.targetCityName} to ${holderId}. `
        + `Strategic objective activated.`,
      );
    } else if (holderChanged) {
      this.deps.log(
        `[ReclaimCapital] ${nationId}'s capital ${objective.targetCityName} is now held by `
        + `${holderId}. Objective retargeted.`,
      );
    }

    // Weak-and-at-war nations should be seeking peace to preserve recovery
    // potential; surface that reasoning once per (nation, holder) span.
    const alreadyLoggedSeekingPeace = previous?.seekingPeaceLogged === true && !holderChanged;
    const outmatched = this.deps.getMilitaryStrength(nationId)
      < this.deps.getMilitaryStrength(holderId) * OVERMATCHED_RATIO;
    const seekingPeaceNow = opportunity === 'low'
      && outmatched
      && this.deps.isAtWarWith(nationId, holderId);
    if (seekingPeaceNow) {
      if (!alreadyLoggedSeekingPeace) {
        this.deps.log(
          `[ReclaimCapital] ${nationId} seeking peace with ${holderId} to preserve recovery potential.`,
        );
      }
      return true;
    }

    if (opportunity !== previous?.opportunity) {
      if (opportunity === 'high') {
        this.deps.log(
          `[ReclaimCapital] ${nationId} sees opportunity to reclaim ${objective.targetCityName} from `
          + `${holderId}: opportunity=HIGH. Preparing reclamation.`,
        );
      } else if (opportunity === 'medium' && previous?.opportunity !== 'high') {
        this.deps.log(
          `[ReclaimCapital] ${nationId} recovery toward ${objective.targetCityName}: opportunity=MEDIUM.`,
        );
      }
    }
    return false;
  }
}
