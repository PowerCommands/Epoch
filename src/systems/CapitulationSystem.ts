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
import { getLeaderExploitationInterestByNationId } from '../data/leaders';
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

export interface CapitulationResult {
  accepted: boolean;
  /** Diagnostic reason when application rejects before making changes. */
  failureReason?: string;
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
    if (this.deps.militaryVassalizationSystem) {
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
      exploitationHoldingsRemoved,
    };
    // 12. Record history/diplomatic events.
    const targetName = this.deps.diplomacyManager.getNationDisplayName(targetNationId);
    const demandingName = this.deps.diplomacyManager.getNationDisplayName(demandingNationId);
    this.deps.log?.(`[Capitulation] ${targetName} capitulated to ${demandingName} and became a vassal state. `
      + `reparations=${reparations} units=-${removedUnitCount} cities=${restoredCityIds.length} `
      + `wars=${formerEnemyIds.length} demilUntil=${demilitarizedUntilTurn} exploitation=${exploitationRightsGranted} `
      + `holdingsRemoved=${exploitationHoldingsRemoved}`);
    this.deps.onCapitulation?.({
      demandingNationId, capitulatingNationId: targetNationId, reparationsPaid: reparations,
      reparationShares, formerEnemyIds, removedUnitCount, restoredCityIds, demilitarizedUntilTurn,
      exploitationRightsGranted, exploitationHoldingsRemoved,
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
