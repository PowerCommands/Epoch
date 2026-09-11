import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';
import type { ResourceSystem } from './ResourceSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { DiplomacyManager } from './DiplomacyManager';
import type { PeaceTreatySystem } from './PeaceTreatySystem';
import type { AIMilitaryEvaluationSystem } from './ai/AIMilitaryEvaluationSystem';
import { isMilitaryUnitType } from '../utils/unitRoleUtils';
import { getUnitTypeById } from '../data/units';
import {
  commitExploitationRightsConcession,
  createExploitationRightsConcession,
} from './diplomacy/ExploitationRightsConcession';
import {
  getAlternativeLeadersByNationId,
  getLeaderById,
  getLeaderByNationId,
  getLeaderExploitationInterestByNationId,
  setActiveLeaderForNation,
} from '../data/leaders';
import type { LeaderDefinition } from '../types/leader';
import type { MilitaryVassalizationSystem } from './diplomacy/MilitaryVassalizationSystem';

/** War pressure at/above which demanding capitulation is at least plausible (button shows). */
export const CAPITULATION_ELIGIBILITY_THRESHOLD = 0.42;
/** Legacy/default pressure at which the target accepts unconditional surrender. */
export const DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD = 0.7;
/** @deprecated Use a CapitulationSystem instance's configured threshold. */
export const CAPITULATION_ACCEPTANCE_THRESHOLD = DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD;

/** Resolve scenario/save input while preserving the supported 0.01–1.00 range. */
export function resolveCapitulationAcceptanceThreshold(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.01 && value <= 1
    ? value
    : DEFAULT_CAPITULATION_ACCEPTANCE_THRESHOLD;
}

export const DEMILITARIZATION_PRODUCTION_BLOCK_REASON = 'Demilitarized after capitulation';

export interface CapitulationEvaluation {
  /** True when the target's position is dire enough that a demand is reasonable. */
  eligible: boolean;
  /** True when the target would accept the demand right now. */
  accepted: boolean;
  /** 0..1 deterministic collapse pressure driving the decision. */
  pressure: number;
  factors: Record<string, number>;
  summary: string;
}

/** Facts about a completed "Overthrow Leadership" capitulation outcome. */
export interface LeadershipOverthrowResult {
  nationId: string;
  previousLeaderId: string;
  previousLeaderName: string;
  newLeaderId: string;
  newLeaderName: string;
}

/**
 * Optional non-default settlement terms a capitulation may impose. When
 * `overthrowLeaderId` is present the defeated nation keeps its independence but
 * has its active leader replaced (regime change) instead of being vassalized.
 */
export interface CapitulationOutcomeOptions {
  overthrowLeaderId?: string;
}

export interface CapitulationResult {
  accepted: boolean;
  /** Diagnostic reason when application rejects before making changes. */
  failureReason?: string;
  /** Present only when the imposed outcome was a leadership overthrow (no vassalage). */
  leadershipOverthrow?: LeadershipOverthrowResult;
  reparationsPaid: number;
  reparationShares: Array<{ nationId: string; amount: number }>;
  formerEnemyIds: string[];
  removedUnitCount: number;
  restoredCityIds: string[];
  demilitarizedUntilTurn: number;
  /** Whether the demanding nation's exploitation-rights demand was committed. */
  exploitationRightsGranted: boolean;
  /** Surviving foreign holdings the capitulating exploiter lost in victors' territory. */
  exploitationHoldingsRemoved: number;
}

export interface SavedCapitulationState {
  demilitarized: Array<{ nationId: string; untilTurn: number }>;
}

export interface CapitulationSystemDependencies {
  diplomacyManager: DiplomacyManager;
  cityManager: CityManager;
  nationManager: NationManager;
  unitManager: UnitManager;
  resourceSystem: ResourceSystem;
  productionSystem: ProductionSystem;
  peaceTreatySystem: PeaceTreatySystem;
  militaryEvaluationSystem?: AIMilitaryEvaluationSystem;
  getCurrentTurn: () => number;
  /** Demilitarization duration; V1 reuses the scenario Peace Treaty cooldown. */
  getDemilitarizationTurns: () => number;
  /** Scenario-configured pressure required for acceptance; legacy default is 0.70. */
  acceptanceThreshold?: number;
  log?: (message: string) => void;
  onCapitulation?: (event: CapitulationAppliedEvent) => void;
  /** Production common path shared with capital capture; optional for focused legacy callers. */
  militaryVassalizationSystem?: MilitaryVassalizationSystem;
}

export interface CapitulationAppliedEvent {
  demandingNationId: string;
  capitulatingNationId: string;
  reparationsPaid: number;
  reparationShares: Array<{ nationId: string; amount: number }>;
  formerEnemyIds: string[];
  removedUnitCount: number;
  restoredCityIds: string[];
  demilitarizedUntilTurn: number;
  exploitationRightsGranted: boolean;
  exploitationHoldingsRemoved: number;
  /** Present only when the imposed outcome was a leadership overthrow (no vassalage). */
  leadershipOverthrow?: LeadershipOverthrowResult;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * `Demand Capitulation` — the exceptional end state of a decisively lost war. All
 * evaluation and application logic is UI-independent and initiator-agnostic so a
 * future AI can demand capitulation through the same methods.
 */
export class CapitulationSystem {
  /** nationId → world turn until which the nation cannot produce military units. */
  private readonly demilitarizedUntilTurn = new Map<string, number>();
  private acceptanceThreshold: number;

  constructor(private readonly deps: CapitulationSystemDependencies) {
    this.acceptanceThreshold = resolveCapitulationAcceptanceThreshold(deps.acceptanceThreshold);
  }

  // --- Demilitarization state (save/loaded) ---------------------------------

  isDemilitarized(nationId: string): boolean {
    const until = this.demilitarizedUntilTurn.get(nationId);
    return until !== undefined && this.deps.getCurrentTurn() < until;
  }

  getDemilitarizationRemaining(nationId: string): number {
    const until = this.demilitarizedUntilTurn.get(nationId);
    if (until === undefined) return 0;
    return Math.max(0, until - this.deps.getCurrentTurn());
  }

  getAcceptanceThreshold(): number {
    return this.acceptanceThreshold;
  }

  setAcceptanceThreshold(value: number): void {
    this.acceptanceThreshold = resolveCapitulationAcceptanceThreshold(value);
  }

  /** Authoritative military-production block consulted by UI, AI, and ProductionSystem. */
  getMilitaryProductionBlockReason(nationId: string, unitTypeId: string): string | undefined {
    if (!this.isDemilitarized(nationId)) return undefined;
    const unitType = getUnitTypeById(unitTypeId);
    if (!unitType || !isMilitaryUnitType(unitType)) return undefined;
    return DEMILITARIZATION_PRODUCTION_BLOCK_REASON;
  }

  // --- Evaluation -----------------------------------------------------------

  /** True when the button should be offered: at war and the target is plausibly collapsing. */
  canDemandCapitulation(demandingNationId: string, targetNationId: string): boolean {
    if (demandingNationId === targetNationId) return false;
    if (!this.canCreateVassalOutcome(demandingNationId, targetNationId)) return false;
    if (this.deps.diplomacyManager.getState(demandingNationId, targetNationId) !== 'WAR') return false;
    return this.computeCapitulationPressure(targetNationId, demandingNationId).pressure
      >= CAPITULATION_ELIGIBILITY_THRESHOLD;
  }

  /**
   * Deterministic 0..1 measure of how catastrophic the target's war is. Reuses the
   * negotiated-peace war pressure and adds collapse-specific evidence so Fear can
   * never trigger capitulation on its own — it must be backed by military/territorial
   * ruin.
   */
  computeCapitulationPressure(
    targetNationId: string,
    demandingNationId: string,
  ): { pressure: number; factors: Record<string, number> } {
    const currentTurn = this.deps.getCurrentTurn();
    const warDuration = this.deps.diplomacyManager.getWarDuration(targetNationId, demandingNationId, currentTurn);
    const peace = this.deps.peaceTreatySystem.computeWarPressure(targetNationId, demandingNationId, warDuration);

    const exhaustion = this.deps.diplomacyManager.getWarExhaustion(targetNationId, demandingNationId);
    const targetStrength = this.deps.militaryEvaluationSystem?.getMilitaryStrength(targetNationId).totalStrength ?? 0;
    const demanderStrength = this.deps.militaryEvaluationSystem?.getMilitaryStrength(demandingNationId).totalStrength ?? 0;
    const strengthShare = targetStrength / (targetStrength + demanderStrength + 1);
    const militaryCollapse = clamp01(1 - strengthShare * 2.2);
    const attrition = exhaustion.startStrength > 0
      ? clamp01((exhaustion.startStrength - targetStrength) / exhaustion.startStrength)
      : 0;
    const remainingCities = this.deps.cityManager.getCitiesByOwner(targetNationId).length;
    const territorialCollapse = clamp01((exhaustion.citiesLost / (exhaustion.citiesLost + remainingCities + 1)) * 2);

    const factors: Record<string, number> = {
      warPressure: 0.35 * peace.pressure,
      militaryCollapse: 0.30 * militaryCollapse,
      attrition: 0.15 * attrition,
      territorialCollapse: 0.20 * territorialCollapse,
    };
    const pressure = clamp01(Object.values(factors).reduce((sum, value) => sum + value, 0));
    return { pressure, factors };
  }

  /** UI-independent evaluation of eligibility + acceptance for a capitulation demand. */
  evaluateCapitulationDemand(demandingNationId: string, targetNationId: string): CapitulationEvaluation {
    const { pressure, factors } = this.computeCapitulationPressure(targetNationId, demandingNationId);
    const atWar = this.deps.diplomacyManager.getState(demandingNationId, targetNationId) === 'WAR';
    const canBecomeVassal = this.canCreateVassalOutcome(demandingNationId, targetNationId);
    const eligible = atWar && canBecomeVassal && pressure >= CAPITULATION_ELIGIBILITY_THRESHOLD;
    const accepted = atWar && canBecomeVassal && pressure >= this.getAcceptanceThreshold();
    return {
      eligible,
      accepted,
      pressure,
      factors,
      summary: `pressure=${pressure.toFixed(2)} eligible=${eligible} → ${accepted ? 'ACCEPT' : 'REFUSE'}`,
    };
  }

  /**
   * Whether a demanding AI leader would add exploitation rights to a capitulation
   * demand: it must have Colonialism, a nonzero exploitation interest, not already
   * hold the exact directional right, and be at war with the target. Personality
   * only — the defeated nation's resources are never inspected. An interest-0
   * leader never demands them; higher interest makes the demand attractive.
   *
   * NOTE: no AI-initiated capitulation flow exists yet (only the human can demand
   * capitulation today), so this helper is currently exercised by tests and ready
   * for the future AI caller rather than driving live AI behavior.
   */
  shouldDemandExploitationRights(demandingNationId: string, targetNationId: string): boolean {
    if (demandingNationId === targetNationId) return false;
    if (this.deps.diplomacyManager.getState(demandingNationId, targetNationId) !== 'WAR') return false;
    if (!this.deps.diplomacyManager.canUseExploitationRights(demandingNationId)) return false;
    if (getLeaderExploitationInterestByNationId(demandingNationId) <= 0) return false;
    // Grantor = the defeated nation, beneficiary = the demanding nation.
    if (this.deps.diplomacyManager.hasExploitationRights(demandingNationId, targetNationId)) return false;
    return true;
  }

  // --- Application ----------------------------------------------------------

  /**
   * Apply a full, unconditional surrender atomically in a deliberate order. Returns
   * the result (accepted:false with no side effects if the target refuses or the
   * demand is no longer valid). Initiator-agnostic.
   *
   * `force` bypasses only the willingness gate (the war-pressure acceptance check),
   * for callers that already carry their own deterministic trigger — e.g. an attack
   * that pushes the target's original capital below its defensive collapse
   * threshold. The hierarchy/integrity checks (must be at war, must be able to form
   * the vassal outcome) are always enforced.
   */
  applyCapitulation(
    demandingNationId: string,
    targetNationId: string,
    requestedReparations: number,
    demandExploitationRights = false,
    force = false,
    outcome: CapitulationOutcomeOptions = {},
  ): CapitulationResult {
    const rejected = (failureReason: string): CapitulationResult => ({
      accepted: false, failureReason, reparationsPaid: 0, reparationShares: [], formerEnemyIds: [],
      removedUnitCount: 0, restoredCityIds: [], demilitarizedUntilTurn: 0,
      exploitationRightsGranted: false, exploitationHoldingsRemoved: 0,
    });

    // 1. Revalidate that capitulation can still be applied.
    if (this.deps.diplomacyManager.getState(demandingNationId, targetNationId) !== 'WAR') {
      return rejected('The nations are no longer at war.');
    }
    if (!this.canCreateVassalOutcome(demandingNationId, targetNationId)) {
      return rejected('The demanded vassal relationship cannot be created.');
    }
    if (!force && !this.evaluateCapitulationDemand(demandingNationId, targetNationId).accepted) {
      return rejected(`Pressure is below the current acceptance threshold (${this.getAcceptanceThreshold().toFixed(2)}).`);
    }
    // Validate a requested regime change before any side effects run, so an
    // invalid leader choice never leaves a half-applied surrender.
    const overthrowLeaderId = outcome.overthrowLeaderId;
    if (overthrowLeaderId !== undefined
      && !this.getOverthrowCandidates(targetNationId).some((leader) => leader.id === overthrowLeaderId)) {
      return rejected('The chosen replacement leader is not valid for this nation.');
    }

    // 2. Capture the complete enemy list before any war ends (needed for reparations + treaties).
    const formerEnemyIds = [...this.deps.diplomacyManager.getWarringNationIds(targetNationId)].sort();

    // 3. Validate reparations against the actual current treasury.
    const treasury = Math.max(0, Math.floor(this.deps.nationManager.getResources(targetNationId).gold));
    const reparations = Math.max(0, Math.min(Math.floor(requestedReparations), treasury));

    // 4. Determine all required city restorations (snapshot before transfers).
    const restorations = this.determineRestorations(targetNationId, formerEnemyIds);

    // 5. Remove/cancel in-progress military production.
    const targetCityIds = this.deps.cityManager.getCitiesByOwner(targetNationId).map((city) => city.id);
    this.deps.productionSystem.removeMilitaryUnitsFromQueues(
      targetCityIds,
      (unitTypeId) => {
        const unitType = getUnitTypeById(unitTypeId);
        return unitType ? isMilitaryUnitType(unitType) : false;
      },
    );

    // 6. Remove all military units.
    const removedUnitCount = this.removeMilitaryUnits(targetNationId);

    // 7. Transfer reparations, divided evenly among former enemies (deterministic remainder).
    const reparationShares = this.distributeReparations(targetNationId, formerEnemyIds, reparations);

    // 8. Restore conquered city ownership toward original founders.
    const restoredCityIds: string[] = [];
    for (const { cityId, toNationId } of restorations) {
      if (this.deps.peaceTreatySystem.transferCityOwnership(cityId, toNationId)) restoredCityIds.push(cityId);
    }

    // 9 + 10. End every war involving the surrendered nation and start Peace Treaties.
    for (const enemyId of formerEnemyIds) {
      this.deps.diplomacyManager.respondToPeace(targetNationId, enemyId, true);
    }

    // 11. Start the nation's global demilitarization cooldown.
    const demilitarizedUntilTurn = this.deps.getCurrentTurn() + Math.max(0, Math.floor(this.deps.getDemilitarizationTurns()));
    this.demilitarizedUntilTurn.set(targetNationId, demilitarizedUntilTurn);

    // Capitulation's lasting geopolitical result. This changes only foreign
    // policy state; the nation and all of its normal gameplay systems remain live.
    //
    // Two mutually exclusive outcomes: the victor either subordinates the nation
    // (vassalage, the default) or imposes regime change (Overthrow Leadership).
    // Every other consequence above (disarmament, reparations, restored cities,
    // ended wars, demilitarization) is applied identically in both cases; only
    // this final step differs. All wars have already ended in step 9/10, so the
    // overthrow path needs no separate peace handling.
    let leadershipOverthrow: LeadershipOverthrowResult | undefined;
    if (overthrowLeaderId !== undefined) {
      leadershipOverthrow = this.performLeadershipOverthrow(
        demandingNationId,
        targetNationId,
        overthrowLeaderId,
      );
    } else if (this.deps.militaryVassalizationSystem) {
      this.deps.militaryVassalizationSystem.vassalize({
        victorNationId: demandingNationId,
        defeatedNationId: targetNationId,
        reason: 'capitulation',
      });
    } else {
      this.deps.diplomacyManager.establishVassal(targetNationId, demandingNationId);
    }

    // 11b. Commit any demanded exploitation rights — the capitulator (grantor)
    // yields rights in its territory to the demanding nation (beneficiary). This
    // runs after the wars end above, so the two nations are already at PEACE and
    // the core grant will accept it. The demanding nation introduces the demand
    // and must therefore have Colonialism (enforced by the concession validator).
    const exploitationRightsGranted = demandExploitationRights
      && commitExploitationRightsConcession(
        this.deps.diplomacyManager,
        createExploitationRightsConcession(targetNationId, demandingNationId, demandingNationId, 'capitulation'),
      );

    // 11c. Liberation cleanup: a defeated exploiter loses every surviving holding
    // it owns inside the territory of each nation it capitulated to. This is the
    // "exploited defeats exploiter" case only — the holdings are the CAPITULATOR's
    // improvements in the VICTORS' land. Improvements are destroyed, never
    // transferred; the reverse direction (victorious exploiter) removes nothing
    // because the capitulator holds no improvements in the loser's own territory.
    let exploitationHoldingsRemoved = 0;
    for (const enemyId of formerEnemyIds) {
      exploitationHoldingsRemoved += this.deps.peaceTreatySystem.removeForeignHoldings(enemyId, targetNationId);
    }

    const result: CapitulationResult = {
      accepted: true, reparationsPaid: reparations, reparationShares, formerEnemyIds,
      removedUnitCount, restoredCityIds, demilitarizedUntilTurn, exploitationRightsGranted,
      exploitationHoldingsRemoved, leadershipOverthrow,
    };
    // 12. Record history/diplomatic events.
    const targetName = this.deps.diplomacyManager.getNationDisplayName(targetNationId);
    const demandingName = this.deps.diplomacyManager.getNationDisplayName(demandingNationId);
    const outcomeSummary = leadershipOverthrow
      ? `regime change (${leadershipOverthrow.previousLeaderName} -> ${leadershipOverthrow.newLeaderName})`
      : 'became a vassal state';
    this.deps.log?.(`[Capitulation] ${targetName} capitulated to ${demandingName} and ${outcomeSummary}. `
      + `reparations=${reparations} units=-${removedUnitCount} cities=${restoredCityIds.length} `
      + `wars=${formerEnemyIds.length} demilUntil=${demilitarizedUntilTurn} exploitation=${exploitationRightsGranted} `
      + `holdingsRemoved=${exploitationHoldingsRemoved}`);
    this.deps.onCapitulation?.({
      demandingNationId, capitulatingNationId: targetNationId, reparationsPaid: reparations,
      reparationShares, formerEnemyIds, removedUnitCount, restoredCityIds, demilitarizedUntilTurn,
      exploitationRightsGranted, exploitationHoldingsRemoved, leadershipOverthrow,
    });
    return result;
  }

  /**
   * Restorations toward original founders:
   *  (a) cities the capitulating nation holds that another active nation founded → to founder;
   *  (b) cities the capitulating nation founded but an enemy currently holds → back to it.
   */
  private determineRestorations(
    capitulatingNationId: string,
    enemyIds: readonly string[],
  ): Array<{ cityId: string; toNationId: string }> {
    const restorations: Array<{ cityId: string; toNationId: string }> = [];
    for (const city of this.deps.cityManager.getCitiesByOwner(capitulatingNationId)) {
      const founder = city.originNationId;
      if (founder !== capitulatingNationId && this.deps.nationManager.getNation(founder)) {
        restorations.push({ cityId: city.id, toNationId: founder });
      }
    }
    for (const enemyId of enemyIds) {
      for (const city of this.deps.cityManager.getCitiesByOwner(enemyId)) {
        if (city.originNationId === capitulatingNationId) {
          restorations.push({ cityId: city.id, toNationId: capitulatingNationId });
        }
      }
    }
    return restorations;
  }

  private removeMilitaryUnits(nationId: string): number {
    const military = this.deps.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => isMilitaryUnitType(unit.unitType));
    for (const unit of military) this.deps.unitManager.removeUnit(unit.id);
    return military.length;
  }

  private canCreateVassalOutcome(victorNationId: string, defeatedNationId: string): boolean {
    return this.deps.militaryVassalizationSystem
      ? this.deps.militaryVassalizationSystem.canVassalize(victorNationId, defeatedNationId)
      : this.deps.diplomacyManager.canEstablishVassal(defeatedNationId, victorNationId);
  }

  // --- Overthrow Leadership outcome -----------------------------------------

  /**
   * The valid replacement leaders for a defeated nation (all leaders of its
   * effective identity except the one currently in power). Thin, testable wrapper
   * over the canonical leader roster so the UI and AI use one source of truth.
   */
  getOverthrowCandidates(defeatedNationId: string): LeaderDefinition[] {
    return getAlternativeLeadersByNationId(defeatedNationId);
  }

  /** Whether Overthrow Leadership can be offered: at least one alternative leader exists. */
  canOverthrowLeadership(defeatedNationId: string): boolean {
    return this.getOverthrowCandidates(defeatedNationId).length > 0;
  }

  /**
   * Conservative AI victor rule: choose a replacement leader only when one is
   * strictly more compatible with the victor than the incumbent, otherwise return
   * undefined so the existing vassal outcome is used. Compatibility is a simple,
   * deterministic score — shared ideology plus closeness of aggression bias — so
   * the AI never installs a leader more hostile to itself than the current one.
   */
  chooseOverthrowLeaderForVictor(demandingNationId: string, defeatedNationId: string): string | undefined {
    const candidates = this.getOverthrowCandidates(defeatedNationId);
    if (candidates.length === 0) return undefined;
    const incumbent = getLeaderByNationId(defeatedNationId);
    if (!incumbent) return undefined;
    const victor = getLeaderByNationId(demandingNationId);
    if (!victor) return undefined;

    const compatibility = (leader: LeaderDefinition): number => {
      const sharedIdeology = leader.ideologyId && leader.ideologyId === victor.ideologyId ? 40 : 0;
      const victorAggression = victor.aiPersonality?.aggressionBias ?? 0;
      const leaderAggression = leader.aiPersonality?.aggressionBias ?? 0;
      // Closer aggression posture reads as a friendlier, more predictable regime.
      const aggressionCloseness = 40 - Math.min(40, Math.abs(victorAggression - leaderAggression));
      return sharedIdeology + aggressionCloseness;
    };

    const incumbentScore = compatibility(incumbent);
    let best: { id: string; score: number } | undefined;
    for (const candidate of candidates) {
      const score = compatibility(candidate);
      if (!best || score > best.score) best = { id: candidate.id, score };
    }
    return best && best.score > incumbentScore ? best.id : undefined;
  }

  /**
   * Convert an already-applied conquest vassalage into a regime change. The
   * combat-driven capitulation path (capital capture, last-city subjugation,
   * original-capital collapse) vassalizes the defeated nation up front through
   * MilitaryVassalizationSystem; when the victor instead chooses Overthrow
   * Leadership from the post-conquest settlement dialog, this dissolves the
   * vassal contract just formed with the victor and installs the chosen leader,
   * leaving the nation independent. Returns the overthrow facts, or undefined if
   * the replacement leader is invalid or the leader change could not be applied
   * (in which case no diplomatic state is touched).
   */
  convertVassalageToOverthrow(
    victorNationId: string,
    defeatedNationId: string,
    newLeaderId: string,
  ): LeadershipOverthrowResult | undefined {
    if (!this.getOverthrowCandidates(defeatedNationId).some((leader) => leader.id === newLeaderId)) {
      return undefined;
    }
    const overthrow = this.performLeadershipOverthrow(victorNationId, defeatedNationId, newLeaderId);
    if (!overthrow) return undefined;
    // Only dissolve the vassal contract once the leader change has succeeded, so a
    // failed swap can never leave the nation independent by accident.
    this.deps.diplomacyManager.terminateVassalage(victorNationId, defeatedNationId);
    return overthrow;
  }

  /**
   * Replace the defeated nation's active leader through the canonical single
   * source of truth. Returns the before/after facts, or undefined if the change
   * could not be applied (validated earlier, so this is defensive).
   */
  private performLeadershipOverthrow(
    demandingNationId: string,
    defeatedNationId: string,
    newLeaderId: string,
  ): LeadershipOverthrowResult | undefined {
    const previous = getLeaderByNationId(defeatedNationId);
    if (!previous || previous.id === newLeaderId) return undefined;
    if (!setActiveLeaderForNation(defeatedNationId, newLeaderId)) return undefined;
    // Resolve the installed leader (with any scenario name override) after the change.
    const installed = getLeaderByNationId(defeatedNationId) ?? getLeaderById(newLeaderId);
    const result: LeadershipOverthrowResult = {
      nationId: defeatedNationId,
      previousLeaderId: previous.id,
      previousLeaderName: previous.name,
      newLeaderId,
      newLeaderName: installed?.name ?? newLeaderId,
    };
    // A new regime starts with a clean slate toward the victor that installed
    // it: negative memory (fear/hostility/suspicion) is cleared and affinity is
    // floored to 50, using the shared amicable reset (same relationship reset as
    // a peaceful vassal release/liberation). Only the victor↔defeated pair is
    // touched; the nation's relations with everyone else are left untouched.
    const reset = this.deps.diplomacyManager.applyAmicableRelationshipReset(demandingNationId, defeatedNationId);
    const defeatedName = this.deps.diplomacyManager.getNationDisplayName(defeatedNationId);
    const demandingName = this.deps.diplomacyManager.getNationDisplayName(demandingNationId);
    this.deps.log?.(`[Capitulation] ${defeatedName} leadership overthrown by ${demandingName}: `
      + `${result.previousLeaderName} -> ${result.newLeaderName}; relations reset `
      + `(affinity ${reset.previousAffinity} -> ${reset.affinity}, negatives cleared).`);
    return result;
  }

  /** Never creates or destroys money: the shares always sum exactly to `amount`. */
  private distributeReparations(
    payerNationId: string,
    enemyIds: readonly string[],
    amount: number,
  ): Array<{ nationId: string; amount: number }> {
    if (amount <= 0 || enemyIds.length === 0) return [];
    const ordered = [...enemyIds].sort();
    const base = Math.floor(amount / ordered.length);
    const remainder = amount - base * ordered.length;
    const shares = ordered.map((nationId, index) => ({ nationId, amount: base + (index < remainder ? 1 : 0) }));
    this.deps.resourceSystem.addGold(payerNationId, -amount);
    for (const share of shares) {
      if (share.amount > 0) this.deps.resourceSystem.addGold(share.nationId, share.amount);
    }
    return shares;
  }

  // --- Save / load ----------------------------------------------------------

  serialize(): SavedCapitulationState {
    return {
      demilitarized: [...this.demilitarizedUntilTurn.entries()].map(([nationId, untilTurn]) => ({ nationId, untilTurn })),
    };
  }

  restore(state: SavedCapitulationState | undefined): void {
    this.demilitarizedUntilTurn.clear();
    for (const entry of state?.demilitarized ?? []) {
      if (typeof entry?.nationId === 'string' && Number.isFinite(entry.untilTurn)) {
        this.demilitarizedUntilTurn.set(entry.nationId, Math.floor(entry.untilTurn));
      }
    }
  }
}
