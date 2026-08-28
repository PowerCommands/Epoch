import type { City } from '../entities/City';
import type { DiplomacyManager, PeaceProposal } from './DiplomacyManager';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { ResourceSystem } from './ResourceSystem';
import type { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { ProductionSystem } from './ProductionSystem';
import type { AIMilitaryEvaluationSystem } from './ai/AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem } from './ai/AIMilitaryThreatEvaluationSystem';
import type { DiplomaticEvaluationSystem } from './diplomacy/DiplomaticEvaluationSystem';
import { CityTerritorySystem } from './CityTerritorySystem';
import { CulturalSphereSystem } from './CulturalSphereSystem';
import { getLeaderExploitationInterestByNationId, getLeaderPersonalityByNationId } from '../data/leaders';
import type { NationCollapseSystem } from './NationCollapseSystem';
import {
  EXPLOITATION_HOLDING_VALUE,
  commitExploitationRightsConcession,
  createExploitationRightsConcession,
  getExploitationRightsValueForInterest,
  validateExploitationRightsConcession,
} from './diplomacy/ExploitationRightsConcession';
import {
  countForeignExploitationHoldings,
  removeForeignExploitationHoldings,
} from './ImprovementOwnership';

export const MAX_REPARATIONS_GOLD = 10_000;
export const REPARATIONS_FRACTION = 0.5;

/**
 * Gold-equivalent a fully confident (zero war-pressure) nation demands before it
 * will accept peace. Scaled down toward 0 as the recipient's war pressure rises.
 */
export const PEACE_ACCEPTANCE_BASE_DEMAND = 700;
/** How fast the demand falls as war pressure rises; demand hits 0 near pressure ≈ 0.9. */
export const PEACE_DEMAND_PRESSURE_SCALE = 1.1;
/** City gold-equivalent = base + population·pop + production·prod. Cities dwarf small gold gifts. */
export const CITY_CONCESSION_BASE_VALUE = 250;
export const CITY_CONCESSION_POPULATION_VALUE = 55;
export const CITY_CONCESSION_PRODUCTION_VALUE = 20;
/** Pressure bands shared by AI peace consideration, offer construction and diagnostics. */
export const AI_PEACE_MODERATE_PRESSURE = 0.35;
export const AI_PEACE_INITIATION_PRESSURE = 0.55;
export const AI_PEACE_CITY_CONCESSION_PRESSURE = 0.78;
/**
 * War-pressure weight of having lost one's own original capital. A strong but
 * not overwhelming signal: on its own it cannot reach the peace-initiation or
 * capitulation bands, but it makes a losing nation clearly more willing to seek
 * and accept peace.
 */
export const CAPITAL_LOST_PRESSURE_WEIGHT = 0.18;
/**
 * Highest strategic disadvantage a nation may have and still be considered the
 * *winning* side for the "objective achieved" peace trigger (i.e. it captured
 * the enemy capital without itself materially losing the war).
 */
export const AI_PEACE_OBJECTIVE_MAX_DISADVANTAGE = 0.18;

/**
 * Deterministic, UI-independent result of evaluating a peace proposal from the
 * recipient's perspective. `factors` is diagnostic only — never shown raw to the
 * normal player UI, but logged for development/autorun analysis.
 */
export interface PeaceProposalEvaluation {
  accepted: boolean;
  /** 0..1 — how strongly the recipient currently wants the war to end. */
  warPressure: number;
  /** Gold-equivalent value of the offer that would actually transfer. */
  settlementValue: number;
  /** Gold-equivalent the recipient demands given its war pressure. */
  acceptanceThreshold: number;
  factors: Record<string, number>;
  summary: string;
}

/** What a settlement actually moved, for logging/UI after the fact. */
export interface PeaceSettlementResult {
  goldTransferred: number;
  cityIdsTransferred: string[];
  /** Whether the proposer's offered exploitation rights were committed post-peace. */
  exploitationRightsGranted: boolean;
  /** Proposer's own surviving holdings removed from the recipient's territory. */
  proposerHoldingsRemoved: number;
  /** Recipient's surviving holdings removed from the proposer's territory. */
  recipientHoldingsRemoved: number;
}

export interface AIPeaceSeekingEvaluation {
  shouldInitiate: boolean;
  warPressure: number;
  /** Weighted evidence that this opponent is actually winning the war. */
  strategicDisadvantage: number;
  factors: Record<string, number>;
}

export interface AIPeaceOfferPlan {
  proposal: PeaceProposal;
  seeking: AIPeaceSeekingEvaluation;
  intendedSettlementValue: number;
  recipientAcceptanceThreshold: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function threatToPressure(level: string | undefined): number {
  switch (level) {
    case 'high': return 1;
    case 'medium': return 0.6;
    case 'low': return 0.25;
    default: return 0;
  }
}

export class PeaceTreatySystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly mapData: MapData,
    private readonly gridSystem: IGridSystem,
    private readonly productionSystem: ProductionSystem,
    private readonly militaryEvaluationSystem?: AIMilitaryEvaluationSystem,
    private readonly threatEvaluationSystem?: AIMilitaryThreatEvaluationSystem,
    private readonly diplomaticEvaluationSystem?: DiplomaticEvaluationSystem,
    private nationCollapseSystem?: NationCollapseSystem,
  ) {}

  setNationCollapseSystem(system: NationCollapseSystem): void {
    this.nationCollapseSystem = system;
  }

  /**
   * All cities, or an empty list when the injected city source cannot enumerate
   * them. This keeps the capital-based war signals inert for minimal callers and
   * mocks while working fully against the real CityManager.
   */
  private getAllCitiesSafe(): readonly City[] {
    const source = this.cityManager as { getAllCities?: () => readonly City[] };
    return typeof source.getAllCities === 'function' ? source.getAllCities() : [];
  }

  /** True when `captorNationId` currently holds `victimNationId`'s original capital. */
  hasCapturedOriginalCapital(captorNationId: string, victimNationId: string): boolean {
    return this.getAllCitiesSafe().some((city) => (
      city.isOriginalCapital === true
      && city.originNationId === victimNationId
      && city.ownerId === captorNationId
    ));
  }

  /** True when `nationId` no longer holds its own original capital (it was captured). */
  hasLostOriginalCapital(nationId: string): boolean {
    return this.getAllCitiesSafe().some((city) => (
      city.isOriginalCapital === true
      && city.originNationId === nationId
      && city.ownerId !== nationId
    ));
  }

  selectPeaceOfferCity(nationId: string): City | null {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    const nonCapitals = cities.filter((c) => !c.isCapital);
    if (nonCapitals.length === 0) return null;
    // Prefer smallest population; use name as tiebreaker for determinism.
    const sorted = [...nonCapitals].sort((a, b) => {
      if (a.population !== b.population) return a.population - b.population;
      return a.name.localeCompare(b.name);
    });
    return sorted[0];
  }

  calculateReparations(nationId: string): number {
    const resources = this.nationManager.getResources(nationId);
    return Math.min(Math.floor(resources.gold * REPARATIONS_FRACTION), MAX_REPARATIONS_GOLD);
  }

  buildAIPeaceTreaty(
    proposerNationId: string,
    receiverNationId: string,
  ): { offeredCityId: string; goldReparations?: number } | null {
    const city = this.selectPeaceOfferCity(proposerNationId);
    if (!city) return null;

    const aggressorId = this.diplomacyManager.getAggressorNationId(proposerNationId, receiverNationId);
    const isAggressor = aggressorId === proposerNationId;

    return {
      offeredCityId: city.id,
      goldReparations: isAggressor ? this.calculateReparations(proposerNationId) : undefined,
    };
  }

  /** Non-capital cities the nation currently owns and could therefore cede. */
  getOfferableCities(nationId: string): City[] {
    return this.cityManager.getCitiesByOwner(nationId).filter((city) => !city.isCapital);
  }

  /** Gold-equivalent worth of a single city concession (population + production weighted). */
  cityConcessionValue(city: City): number {
    const production = Math.max(0, this.cityManager.getResources(city.id)?.productionPerTurn ?? 0);
    return CITY_CONCESSION_BASE_VALUE
      + Math.max(0, city.population) * CITY_CONCESSION_POPULATION_VALUE
      + production * CITY_CONCESSION_PRODUCTION_VALUE;
  }

  /**
   * Cities the proposal can actually cede: combines legacy + new fields, dedupes,
   * and keeps only non-capital cities the proposer still owns. This same guard is
   * used for both evaluation and application, so the two never disagree.
   */
  resolveOfferedCityIds(proposal: PeaceProposal): string[] {
    const requested = [
      ...(proposal.offeredCityId ? [proposal.offeredCityId] : []),
      ...(proposal.offeredCityIds ?? []),
    ];
    const seen = new Set<string>();
    const valid: string[] = [];
    for (const cityId of requested) {
      if (seen.has(cityId)) continue;
      seen.add(cityId);
      const city = this.cityManager.getCity(cityId);
      if (!city || city.isCapital || city.ownerId !== proposal.fromNationId) continue;
      valid.push(cityId);
    }
    return valid;
  }

  /** Gold the proposer can actually pay: non-negative and capped by its treasury. */
  resolveOfferedGold(proposal: PeaceProposal): number {
    const requested = Math.max(0, Math.floor(proposal.goldReparations ?? 0));
    const treasury = Math.max(0, Math.floor(this.nationManager.getResources(proposal.fromNationId).gold));
    return Math.min(requested, treasury);
  }

  /**
   * Apply the agreed assets. Re-validates ownership/capital/treasury at the moment
   * of transfer so an offer can never move a city the proposer no longer owns, the
   * capital, a duplicate, or more gold than it holds. Returns what actually moved.
   */
  /**
   * Authoritative single-city ownership transfer used by both negotiated peace and
   * capitulation restoration: moves the city, its territory and cultural sphere, and
   * collapses a previous owner left with no cities. Keeps every dependent system
   * (tiles, buildings, production, occupation/integration, rendering) consistent.
   */
  transferCityOwnership(cityId: string, toNationId: string): boolean {
    const city = this.cityManager.getCity(cityId);
    if (!city || city.ownerId === toNationId) return false;
    const previousOwnerId = city.ownerId;
    city.occupiedOriginalNationId = city.originNationId !== toNationId ? city.originNationId : undefined;
    this.cityManager.transferOwnership(cityId, toNationId, this.productionSystem);
    new CityTerritorySystem().transferCityTerritory(city, toNationId, this.mapData);
    new CulturalSphereSystem().claimInitialCityCulture(city, this.mapData, this.gridSystem);
    this.collapsePreviousOwnerWithoutCities(previousOwnerId, toNationId, city);
    return true;
  }

  executeTreaty(proposal: PeaceProposal): PeaceSettlementResult {
    const cityIdsTransferred: string[] = [];
    for (const cityId of this.resolveOfferedCityIds(proposal)) {
      const city = this.cityManager.getCity(cityId);
      if (!city || city.isCapital || city.ownerId !== proposal.fromNationId) continue; // re-validate at apply
      if (this.transferCityOwnership(cityId, proposal.toNationId)) cityIdsTransferred.push(cityId);
    }
    const goldTransferred = this.resolveOfferedGold(proposal);
    if (goldTransferred > 0) {
      this.resourceSystem.addGold(proposal.fromNationId, -goldTransferred);
      this.resourceSystem.addGold(proposal.toNationId, goldTransferred);
    }
    // Post-war exploitation holdings terms. Removal is destruction, never a
    // transfer — the natural resource stays; the territorial owner is unchanged.
    // "Retain" is the default, so it is simply the absence of a removal term.
    const proposerHoldingsRemoved = proposal.removeProposerHoldings === true
      ? removeForeignExploitationHoldings(this.mapData, proposal.toNationId, proposal.fromNationId)
      : 0;
    const recipientHoldingsRemoved = proposal.removeRecipientHoldings === true
      ? removeForeignExploitationHoldings(this.mapData, proposal.fromNationId, proposal.toNationId)
      : 0;
    // Exploitation rights are intentionally committed later, after the war ends —
    // see settleAcceptedPeace. The core grant refuses wartime grants outright.
    return {
      goldTransferred, cityIdsTransferred, exploitationRightsGranted: false,
      proposerHoldingsRemoved, recipientHoldingsRemoved,
    };
  }

  /**
   * Atomically settle an accepted peace: re-validate + transfer the assets, then
   * end the war through the authoritative DiplomacyManager path (which also starts
   * the scenario-configured Peace Treaty cooldown). Reusable for any initiator.
   */
  settleAcceptedPeace(proposal: PeaceProposal): PeaceSettlementResult {
    if (this.diplomacyManager.getState(proposal.fromNationId, proposal.toNationId) !== 'WAR') {
      return {
        goldTransferred: 0, cityIdsTransferred: [], exploitationRightsGranted: false,
        proposerHoldingsRemoved: 0, recipientHoldingsRemoved: 0,
      };
    }
    const result = this.executeTreaty(proposal);
    // Order matters: end the war first, then commit exploitation rights. The core
    // grant refuses while the nations are still at WAR, so this ordering is what
    // makes a peace-time exploitation concession legal.
    this.diplomacyManager.respondToPeace(proposal.fromNationId, proposal.toNationId, true);
    const exploitationRightsGranted = proposal.offeredExploitationRights === true
      && commitExploitationRightsConcession(
        this.diplomacyManager,
        this.offeredExploitationRightsConcession(proposal),
      );
    return { ...result, exploitationRightsGranted };
  }

  /** Gold-equivalent value of everything the offer would actually transfer to the recipient. */
  computeSettlementValue(
    proposal: PeaceProposal,
  ): { value: number; gold: number; cityValue: number; exploitationValue: number; holdingsValue: number } {
    const gold = this.resolveOfferedGold(proposal);
    let cityValue = 0;
    for (const cityId of this.resolveOfferedCityIds(proposal)) {
      const city = this.cityManager.getCity(cityId);
      if (city) cityValue += this.cityConcessionValue(city);
    }
    // The recipient (toNationId) is the beneficiary of the offered rights, so its
    // leader's exploitation interest determines how much the concession is worth
    // to it. A recipient with zero interest values it at nothing.
    const exploitationValue = this.offeredExploitationRightsCount(proposal)
      ? getExploitationRightsValueForInterest(getLeaderExploitationInterestByNationId(proposal.toNationId))
      : 0;
    const holdingsValue = this.holdingsSettlementValue(proposal);
    return {
      value: gold + cityValue + exploitationValue + holdingsValue,
      gold, cityValue, exploitationValue, holdingsValue,
    };
  }

  /**
   * Signed gold-equivalent the holdings terms are worth to the recipient. Removing
   * the proposer's own holdings from the recipient's land is a concession the
   * recipient gains (+); demanding removal of the recipient's holdings from the
   * proposer's land is a loss to the recipient (−). Flat per-improvement value —
   * never scaled by resource type or quantity beyond a simple count.
   */
  private holdingsSettlementValue(proposal: PeaceProposal): number {
    let value = 0;
    if (proposal.removeProposerHoldings) {
      value += EXPLOITATION_HOLDING_VALUE
        * countForeignExploitationHoldings(this.mapData, proposal.toNationId, proposal.fromNationId);
    }
    if (proposal.removeRecipientHoldings) {
      value -= EXPLOITATION_HOLDING_VALUE
        * countForeignExploitationHoldings(this.mapData, proposal.fromNationId, proposal.toNationId);
    }
    return value;
  }

  /** Surviving foreign holdings owned by `improvementOwner` inside `territorialOwner`. */
  countForeignHoldings(territorialOwnerNationId: string, improvementOwnerNationId: string): number {
    return countForeignExploitationHoldings(this.mapData, territorialOwnerNationId, improvementOwnerNationId);
  }

  /** Dismantle all foreign holdings owned by `improvementOwner` inside `territorialOwner`. */
  removeForeignHoldings(territorialOwnerNationId: string, improvementOwnerNationId: string): number {
    return removeForeignExploitationHoldings(this.mapData, territorialOwnerNationId, improvementOwnerNationId);
  }

  /**
   * The proposer offers exploitation rights in its own territory (grantor =
   * proposer, beneficiary = recipient). Counts toward settlement value only when
   * the grant would actually be committable once peace lands — i.e. the proposer
   * has Colonialism and the exact directional right does not already exist. The
   * still-active WAR state is expected here, so it is not treated as a blocker.
   */
  private offeredExploitationRightsConcession(proposal: PeaceProposal) {
    return createExploitationRightsConcession(proposal.fromNationId, proposal.toNationId, proposal.fromNationId, 'peace');
  }

  private offeredExploitationRightsCount(proposal: PeaceProposal): boolean {
    if (!proposal.offeredExploitationRights) return false;
    return validateExploitationRightsConcession(
      this.diplomacyManager,
      this.offeredExploitationRightsConcession(proposal),
      { allowWhileAtWar: true },
    ).ok;
  }

  /**
   * Deterministic 0..1 measure of how strongly the recipient wants the war with the
   * opponent to end. Several understandable, independently tunable weighted factors
   * — no single opaque formula, no randomness.
   */
  computeWarPressure(
    recipientId: string,
    opponentId: string,
    warDuration: number,
  ): { pressure: number; factors: Record<string, number> } {
    const recipientStrength = this.militaryEvaluationSystem?.getMilitaryStrength(recipientId).totalStrength ?? 0;
    const opponentStrength = this.militaryEvaluationSystem?.getMilitaryStrength(opponentId).totalStrength ?? 0;
    const strengthGap = (opponentStrength - recipientStrength) / (opponentStrength + recipientStrength + 1);
    const outmatched = clamp01(strengthGap); // only a disadvantage raises pressure

    const exhaustion = this.diplomacyManager.getWarExhaustion(recipientId, opponentId);
    const citiesLost = clamp01(exhaustion.citiesLost / 2);
    const unitsLost = clamp01(exhaustion.unitsLost / 8);

    const fear = clamp01(this.diplomacyManager.getRelation(recipientId, opponentId).fear / 100);
    const threat = threatToPressure(this.threatEvaluationSystem?.getThreatLevel(recipientId, opponentId));
    const simultaneousWars = clamp01((this.diplomacyManager.getWarringNationIds(recipientId).length - 1) / 2);
    const duration = clamp01(warDuration / 40);
    const economic = this.nationManager.getResources(recipientId).gold < 0 ? 1 : 0;
    // Losing one's own original capital is a distinct, strong peace-pressure
    // signal on top of ordinary city losses. It does not feed strategicDisadvantage
    // (see evaluateAIPeaceSeeking), so it never makes a winner look like a loser.
    const capitalLost = this.hasLostOriginalCapital(recipientId) ? 1 : 0;

    const personality = getLeaderPersonalityByNationId(recipientId);
    const peaceBias = (personality.peacePreference - 50) / 50; // -1..1
    const warToleranceBias = -(personality.warTolerance - 50) / 50; // high tolerance lowers pressure

    // Each factor is a signed contribution to raw pressure; weights are independent.
    const factors: Record<string, number> = {
      outmatched: 0.28 * outmatched,
      citiesLost: 0.22 * citiesLost,
      unitsLost: 0.12 * unitsLost,
      fear: 0.12 * fear,
      threat: 0.12 * threat,
      simultaneousWars: 0.10 * simultaneousWars,
      warDuration: 0.06 * duration,
      economicStrain: 0.05 * economic,
      capitalLost: CAPITAL_LOST_PRESSURE_WEIGHT * capitalLost,
      peacePreference: 0.08 * peaceBias,
      warTolerance: 0.06 * warToleranceBias,
    };
    const pressure = clamp01(Object.values(factors).reduce((sum, value) => sum + value, 0));
    return { pressure, factors };
  }

  /**
   * The authoritative AI initiation view of the existing war-pressure model.
   * Moderate pressure can make an AI receptive to incoming peace; only the high
   * band proactively creates an offer. No second war-score formula is involved.
   */
  evaluateAIPeaceSeeking(
    proposerNationId: string,
    opponentNationId: string,
    warDuration: number,
  ): AIPeaceSeekingEvaluation {
    const { pressure, factors } = this.computeWarPressure(proposerNationId, opponentNationId, warDuration);
    const strategicDisadvantage = (factors.outmatched ?? 0)
      + (factors.citiesLost ?? 0)
      + (factors.unitsLost ?? 0);

    // Winner-side trigger: a major war objective (the enemy's original capital)
    // has been achieved and the proposer is not itself materially losing. This
    // makes a winning nation actively seek a (status-quo) peace instead of
    // fighting on to exterminate a beaten opponent. Capital capture only raises
    // peace *interest* — the recipient still evaluates and may refuse.
    const capturedEnemyCapital = this.hasCapturedOriginalCapital(proposerNationId, opponentNationId);
    const objectiveAchieved = capturedEnemyCapital
      && strategicDisadvantage < AI_PEACE_OBJECTIVE_MAX_DISADVANTAGE;

    return {
      shouldInitiate: pressure >= AI_PEACE_INITIATION_PRESSURE || objectiveAchieved,
      warPressure: pressure,
      strategicDisadvantage,
      factors: {
        ...factors,
        capitalCaptured: capturedEnemyCapital ? 1 : 0,
        objectiveAchieved: objectiveAchieved ? 1 : 0,
      },
    };
  }

  /**
   * Build one deterministic negotiated-peace offer from the proposer's pressure
   * and the recipient's existing settlement threshold. Increasing desperation
   * expands the gold budget; a non-capital city is considered only in the severe
   * band and only when gold cannot cover the intended value.
   */
  buildAIPeaceProposal(
    proposerNationId: string,
    receiverNationId: string,
    warDuration: number,
  ): AIPeaceOfferPlan {
    const seeking = this.evaluateAIPeaceSeeking(proposerNationId, receiverNationId, warDuration);
    const emptyProposal: PeaceProposal = {
      fromNationId: proposerNationId,
      toNationId: receiverNationId,
      warDuration,
    };
    const recipientAcceptanceThreshold = this.evaluatePeaceProposal(emptyProposal).acceptanceThreshold;

    // Duration, personality or multiple fronts may justify asking for status quo,
    // but an AI that lacks concrete evidence it is losing must not pay the enemy.
    const materiallyLosing = seeking.strategicDisadvantage >= 0.06;
    if (!materiallyLosing || seeking.warPressure < AI_PEACE_INITIATION_PRESSURE) {
      return {
        proposal: emptyProposal,
        seeking,
        intendedSettlementValue: 0,
        recipientAcceptanceThreshold,
      };
    }

    const severity = clamp01(
      (seeking.warPressure - AI_PEACE_INITIATION_PRESSURE)
      / (1 - AI_PEACE_INITIATION_PRESSURE),
    );
    // Early offers may be insufficient. Near collapse the AI aims slightly over
    // the current threshold, without trying to mathematically optimize every coin.
    const intendedSettlementValue = Math.max(0, Math.round(
      recipientAcceptanceThreshold * (0.35 + severity * 0.8),
    ));
    const treasury = Math.max(0, Math.floor(this.nationManager.getResources(proposerNationId).gold));
    const goldBudget = Math.floor(treasury * (0.08 + severity * 0.67));
    const goldReparations = Math.min(treasury, goldBudget, intendedSettlementValue);

    const offeredCityIds: string[] = [];
    if (
      seeking.warPressure >= AI_PEACE_CITY_CONCESSION_PRESSURE
      && goldReparations < intendedSettlementValue
    ) {
      const city = [...this.getOfferableCities(proposerNationId)].sort((a, b) =>
        this.cityConcessionValue(a) - this.cityConcessionValue(b)
        || a.name.localeCompare(b.name)
        || a.id.localeCompare(b.id))[0];
      if (city) offeredCityIds.push(city.id);
    }

    // A losing AI with Colonialism may also surrender its own exploitation rights
    // as a peace sweetener when gold still falls short of the intended value. This
    // does NOT depend on the offering leader's own acquisition interest — it is a
    // desperation concession whose worth is set by the recipient's interest at
    // evaluation time. It is committed only after the war ends (settleAcceptedPeace).
    const offeredExploitationRights = goldReparations < intendedSettlementValue
      && this.diplomacyManager.canUseExploitationRights(proposerNationId)
      && !this.diplomacyManager.hasExploitationRights(receiverNationId, proposerNationId);

    return {
      proposal: {
        ...emptyProposal,
        ...(goldReparations > 0 ? { goldReparations } : {}),
        ...(offeredCityIds.length > 0 ? { offeredCityIds } : {}),
        ...(offeredExploitationRights ? { offeredExploitationRights: true } : {}),
      },
      seeking,
      intendedSettlementValue,
      recipientAcceptanceThreshold,
    };
  }

  /**
   * UI-independent evaluation of whether the recipient accepts a peace proposal.
   * Works for any proposer/recipient pairing so a future AI can reuse it verbatim.
   */
  evaluatePeaceProposal(proposal: PeaceProposal): PeaceProposalEvaluation {
    const recipientId = proposal.toNationId;
    const opponentId = proposal.fromNationId;
    const { pressure, factors } = this.computeWarPressure(recipientId, opponentId, proposal.warDuration);
    const settlement = this.computeSettlementValue(proposal);
    const acceptanceThreshold = PEACE_ACCEPTANCE_BASE_DEMAND
      * clamp01(1 - pressure * PEACE_DEMAND_PRESSURE_SCALE);
    const accepted = settlement.value >= acceptanceThreshold;
    return {
      accepted,
      warPressure: pressure,
      settlementValue: settlement.value,
      acceptanceThreshold,
      factors: {
        ...factors,
        settlementGold: settlement.gold,
        settlementCityValue: settlement.cityValue,
        settlementExploitationValue: settlement.exploitationValue,
        settlementHoldingsValue: settlement.holdingsValue,
      },
      summary: `pressure=${pressure.toFixed(2)} settlement=${Math.round(settlement.value)} `
        + `threshold=${Math.round(acceptanceThreshold)} → ${accepted ? 'ACCEPT' : 'REJECT'}`,
    };
  }

  aiShouldAcceptTreaty(proposal: PeaceProposal, receiverNationId: string): boolean {
    if (proposal.toNationId !== receiverNationId) return false;
    return this.evaluatePeaceProposal(proposal).accepted;
  }

  private collapsePreviousOwnerWithoutCities(previousOwnerId: string, receiverNationId: string, city: City): void {
    if (!this.nationCollapseSystem) return;
    if (this.cityManager.getCitiesByOwner(previousOwnerId).length > 0) return;
    this.nationCollapseSystem.collapse({
      nationId: previousOwnerId,
      conquerorNationId: receiverNationId,
      triggerCity: city,
      reason: 'no_valid_survival_state',
    });
  }
}
