import type { DiplomacyManager, DiplomacyRelation } from '../DiplomacyManager';
import type {
  DiplomaticEvaluationResult,
  DiplomaticEvaluationSystem,
  DiplomaticAttitude,
} from '../diplomacy/DiplomaticEvaluationSystem';
import type { NationManager } from '../NationManager';
import type { TurnManager } from '../TurnManager';
import type { AIMilitaryEvaluationSystem, MilitaryComparison } from './AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from './AIMilitaryThreatEvaluationSystem';
import type { AIDiplomacyAction, AIDiplomacyDecisionReason } from '../../types/aiDiplomacy';
import type { AILeaderPersonality } from '../../types/aiLeaderPersonality';
import type { AILeaderEraStrategy } from '../../types/aiLeaderEraStrategy';
import { getLeaderByNationId, getLeaderPersonalityByNationId } from '../../data/leaders';
import { classifyWarDeclarationReason } from './WarDeclarationNarrative';
import {
  getMilitaryIntent,
  getNationPersonalityFactor,
  type MilitaryIntent,
} from './utils/AIMilitaryUtils';
import type { AILogFormatter } from './AILogFormatter';
import { NO_RECLAIM_WAR_MODIFIER, type ReclaimWarModifier } from './reclaimCapital';
import type { PeaceTreatySystem } from '../PeaceTreatySystem';
import { AI_PEACE_MODERATE_PRESSURE } from '../PeaceTreatySystem';
import { MIN_WAR_TURNS_FOR_PEACE } from '../DiplomacyManager';
import {
  getSuspicionOpenBordersPenalty,
  suspicionBlocksOpenBorders,
  getSuspicionWarScoreBonus,
} from '../diplomacy/suspicionEffects';
import {
  ECONOMIC_PRESSURE_AI_AI_DURATION_TURNS,
  ECONOMIC_PRESSURE_LABEL,
  ECONOMIC_PRESSURE_LEVEL,
  type EconomicPressureType,
} from '../../data/economicPressure';

// AIDiplomacySystem v1:
// Uses diplomatic attitude to trigger simple decisions.
// This is a minimal layer connecting diplomacy data to AI behavior.
//
// Cooldowns prevent AI from making rapid contradictory diplomatic decisions.
// This stabilizes diplomacy behavior without changing core rules.
const WAR_COOLDOWN = 10;
const PEACE_COOLDOWN = 5;
const OPEN_BORDERS_COOLDOWN = 5;
const NO_IMMEDIATE_PEACE_AFTER_WAR = 3;
const NO_IMMEDIATE_WAR_AFTER_PEACE = 5;
const ECONOMIC_PRESSURE_ESCALATION_COOLDOWN = 8;
/** Tariff willingness bump toward a Cultural Jealousy target (threshold is 0.48). */
const CULTURAL_JEALOUSY_TARIFF_BIAS = 0.35;
const fallbackFormatLog: AILogFormatter = (nationId, message) => `[r?] [?] ${nationId} (era: ancient, gold: 0, happiness: 0) ${message}`;

export type EconomicPressureAIEvent =
  | { readonly kind: 'war_declared'; readonly aggressorNationId: string; readonly victimNationId: string }
  | { readonly kind: 'city_captured'; readonly aggressorNationId: string; readonly victimNationId: string; readonly cityName?: string }
  | { readonly kind: 'gossip_insult'; readonly aggressorNationId: string; readonly victimNationId: string; readonly insultWeight: number }
  | { readonly kind: 'covert_exposure'; readonly aggressorNationId: string; readonly victimNationId: string }
  | { readonly kind: 'embargo_received'; readonly aggressorNationId: string; readonly victimNationId: string };

export interface EconomicPressureWillingnessInput {
  readonly attitude: DiplomaticAttitude;
  readonly trust: number;
  readonly hostility: number;
  readonly affinity: number;
  readonly suspicion: number;
  readonly ideologyCompatibility: number;
  readonly militaryComparison: MilitaryComparison;
  readonly threatLevel: ThreatLevel;
  readonly warTooRisky: boolean;
  readonly currentPressure: EconomicPressureType | null;
  readonly diplomacyBias: number;
  /**
   * Extra tariff willingness when the target is this nation's Cultural Jealousy
   * target. Feeds the agenda into the existing tariff decision rather than
   * creating a separate mechanic. Defaults to 0 (no agenda).
   */
  readonly culturalJealousyBias?: number;
}

export interface EconomicPressureWillingness {
  readonly tariffs: number;
  readonly embargo: number;
}

/** Pure deterministic weighting, exported so AI tests do not rely on luck. */
export function evaluateEconomicPressureWillingness(
  input: EconomicPressureWillingnessInput,
): EconomicPressureWillingness {
  const hostility = clamp01(input.hostility / 100) * 0.5;
  const lowTrust = clamp01((50 - input.trust) / 50) * 0.25;
  const lowAffinity = clamp01(-input.affinity / 50) * 0.15;
  const ideologyTension = clamp01(-input.ideologyCompatibility / 50) * 0.1;
  const suspicion = clamp01(input.suspicion / 100) * 0.1;
  const deterioration = hostility + lowTrust + lowAffinity + ideologyTension + suspicion;
  const hostile = input.attitude === 'hostile' ? 0.12 : 0;
  const antiDiplomacyBias = clamp01(-input.diplomacyBias / 50) * 0.08;
  const weaknessOutlet = input.warTooRisky || input.militaryComparison === 'weaker' ? 0.3 : 0;
  const highThreatOutlet = input.threatLevel === 'high' ? 0.18 : 0;
  const culturalJealousy = Math.max(0, input.culturalJealousyBias ?? 0);
  return {
    tariffs: deterioration + hostile * 0.65 + antiDiplomacyBias + culturalJealousy,
    embargo: deterioration + hostile + weaknessOutlet + highThreatOutlet
      + (input.currentPressure === 'tariffs' ? 0.1 : 0),
  };
}

/**
 * Bridge to the existing CapitulationSystem so the AI can reach it without this
 * module depending on the concrete system. `evaluate` mirrors
 * `evaluateCapitulationDemand`; `apply` mirrors a full `applyCapitulation` call
 * with the demanding leader's chosen reparations/terms already resolved.
 */
export interface AICapitulationController {
  evaluate(demandingNationId: string, targetNationId: string): {
    accepted: boolean;
    pressure: number;
    factors: Record<string, number>;
  };
  apply(demandingNationId: string, targetNationId: string): { accepted: boolean };
}

export interface AIIndependenceController {
  canBuyIndependence(nationId: string): boolean;
  buyIndependence(nationId: string): boolean;
}

export class AIDiplomacySystem {
  // AI diplomacy reason logging explains decisions without changing them.
  private readonly decisionListeners: Array<(reason: AIDiplomacyDecisionReason) => void> = [];
  private readonly expiredPressureTurnByPair = new Map<string, number>();
  private capitulationController?: AICapitulationController;
  private independenceController?: AIIndependenceController;
  /**
   * Reclaim Capital war bias. Defaults to a no-op so callers/tests that do not
   * wire the objective keep their existing behavior; production supplies the
   * ReclaimCapitalSystem-backed provider.
   */
  private getReclaimWarModifier: (selfId: string, otherId: string) => ReclaimWarModifier =
    () => NO_RECLAIM_WAR_MODIFIER;
  private isHumanNation: (nationId: string) => boolean = (nationId) =>
    this.nationManager.getNation(nationId)?.isHuman === true;
  /**
   * Cultural Jealousy hook. Returns whether `selfId` is currently jealous of
   * `otherId`; defaults to never, so callers/tests that do not wire the agenda
   * keep their existing behavior.
   */
  private isCulturalJealousyTarget: (selfId: string, otherId: string) => boolean = () => false;
  private applyEconomicPressure: (
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
  ) => boolean = (sourceNationId, targetNationId, type) => {
    return this.diplomacyManager.imposeEconomicPressureAction(sourceNationId, targetNationId, type).imposed;
  };

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly evaluationSystem: DiplomaticEvaluationSystem,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly threatEvaluationSystem: AIMilitaryThreatEvaluationSystem,
    private readonly haveMet: (a: string, b: string) => boolean,
    private readonly formatLog: AILogFormatter = fallbackFormatLog,
    private readonly getEraStrategy?: (nationId: string) => AILeaderEraStrategy | undefined,
    private readonly peaceTreatySystem?: PeaceTreatySystem,
    /** Injectable deterministic roll for tests; production hashes pair/turn/action. */
    private readonly economicPressureRoll: (seed: string) => number = hashToUnit,
  ) {}

  setEconomicPressureApplier(
    apply: (sourceNationId: string, targetNationId: string, type: EconomicPressureType) => boolean,
  ): void {
    this.applyEconomicPressure = apply;
  }

  /**
   * Wire the Cultural Jealousy agenda so a jealous nation strongly prefers its
   * cultural-leader target for routine Tariffs. Optional: unset, the AI keeps
   * its ordinary economic-pressure targeting.
   */
  setCulturalJealousyTargetPredicate(predicate: (selfId: string, otherId: string) => boolean): void {
    this.isCulturalJealousyTarget = predicate;
  }

  /** Stable Human identity; production must not depend on autoplay's temporary flag changes. */
  setHumanNationPredicate(predicate: (nationId: string) => boolean): void {
    this.isHumanNation = predicate;
  }

  /**
   * Wire the existing capitulation system so a winning AI can demand
   * unconditional surrender once a beaten opponent has collapsed far enough to
   * accept it. Optional: without it, the AI simply never initiates capitulation.
   */
  setCapitulationController(controller: AICapitulationController): void {
    this.capitulationController = controller;
  }

  /** AI vassals use the same authoritative purchase path as human players. */
  setIndependenceController(controller: AIIndependenceController): void {
    this.independenceController = controller;
  }

  /**
   * Wire the Reclaim Capital objective's war bias: toward the current holder of
   * a lost capital it can raise war interest when the opportunity is favourable;
   * toward unrelated nations it discourages wars of choice during recovery. It
   * never bypasses the existing military/cooldown safety gates.
   */
  setReclaimWarModifierProvider(
    provider: (selfId: string, otherId: string) => ReclaimWarModifier,
  ): void {
    this.getReclaimWarModifier = provider;
  }

  onDecision(listener: (reason: AIDiplomacyDecisionReason) => void): void {
    this.decisionListeners.push(listener);
  }

  runTurn(nationId: string): void {
    const self = this.nationManager.getNation(nationId);
    if (!self || this.isHumanNation(nationId)) return; // human players control their own diplomacy

    // Initial deterministic rule: an AI vassal buys independence as soon as it
    // can afford the fixed price. Economic strategy can become richer later.
    if (this.independenceController?.canBuyIndependence(nationId)) {
      this.independenceController.buyIndependence(nationId);
    }

    const intent = getMilitaryIntent(self.aiGoals);
    console.log(
      this.formatLog(nationId, `AI military: aggression=${intent.aggression.toFixed(2)} defense=${intent.defense.toFixed(2)}`),
    );

    const currentTurn = this.turnManager.getCurrentRound();
    this.expireAIToAISanctions(nationId, currentTurn);
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (!this.haveMet(nationId, other.id)) continue;
      this.decideAgainst(nationId, other.id, currentTurn, intent);
    }
  }

  /**
   * Apply at most one action per pair per turn. Priority order is
   * peace → war → open-border adjustments, so an aggressive turn never both
   * declares war and fiddles with borders against the same nation.
   */
  private decideAgainst(selfId: string, otherId: string, currentTurn: number, intent: MilitaryIntent): void {
    if (!this.haveMet(selfId, otherId)) return;

    const relation = this.diplomacyManager.getRelation(selfId, otherId);
    const evaluation = this.evaluationSystem.evaluateRelation(selfId, otherId);
    const attitude = evaluation.attitude;
    const comparison = this.militaryEvaluationSystem.compareMilitaryStrength(selfId, otherId);
    const threat = this.threatEvaluationSystem.getThreatLevel(selfId, otherId);
    const personality = getLeaderPersonalityByNationId(selfId);
    const ideologyPeaceModifier = getIdeologyPeaceModifier(evaluation.ideologyCompatibility);
    const ideologyWarModifier = getIdeologyWarModifier(evaluation.ideologyCompatibility);
    const ideologyOpenBordersModifier = getIdeologyOpenBordersModifier(evaluation.ideologyCompatibility);

    if (relation.state === 'WAR') {
      const warDuration = this.diplomacyManager.getWarDuration(selfId, otherId, currentTurn);

      // Decisive endpoint: once a beaten opponent has collapsed far enough that
      // the existing capitulation system would accept an unconditional surrender,
      // the winning AI demands it instead of fighting on forever. This is checked
      // before ordinary peace because it only fires at a much higher pressure than
      // peace initiation, so peace has already been attempted over prior turns.
      // The human is never auto-capitulated: there is no UI path for an AI to
      // demand the human's surrender, so we leave that case untouched.
      if (this.capitulationController && !this.isHumanNation(otherId)) {
        const capitulation = this.capitulationController.evaluate(selfId, otherId);
        if (capitulation.accepted) {
          const result = this.capitulationController.apply(selfId, otherId);
          if (result.accepted) {
            const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
            console.log(this.formatLog(
              selfId,
              `[WarTerminationAI] ${selfId} -> ${otherId} (${otherName}): capitulation threshold reached, `
                + `pressure=${capitulation.pressure.toFixed(2)}, warDuration=${warDuration}, `
                + `factors=${JSON.stringify(this.roundFactors(capitulation.factors))}.`,
            ));
            return;
          }
        }
      }

      const seeking = this.peaceTreatySystem?.evaluateAIPeaceSeeking(selfId, otherId, warDuration);
      // Compatibility fallback for callers/tests that do not wire PeaceTreatySystem.
      // Production uses the authoritative pressure evaluation above.
      const adjustedPeacePreference = personality.peacePreference + ideologyPeaceModifier;
      const wantsPeace = seeking?.shouldInitiate ?? (
        (threat === 'high' || attitude === 'afraid' || comparison === 'weaker'
          || (adjustedPeacePreference >= 70 && attitude !== 'hostile'))
        && this.shouldNationConsiderPeace(selfId, otherId, personality)
      );
      if (
        wantsPeace &&
        this.diplomacyManager.canProposePeace(selfId, otherId, currentTurn) &&
        this.noPendingProposal(selfId, otherId) &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= PEACE_COOLDOWN
      ) {
        const plan = this.peaceTreatySystem?.buildAIPeaceProposal(selfId, otherId, warDuration);
        const treaty = plan?.proposal ?? this.peaceTreatySystem?.buildAIPeaceTreaty(selfId, otherId);
        if (!treaty) return;
        const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
        const offeredCities = 'offeredCityIds' in treaty ? treaty.offeredCityIds?.length ?? 0 : treaty.offeredCityId ? 1 : 0;
        const offersExploitation = 'offeredExploitationRights' in treaty && treaty.offeredExploitationRights === true;
        const pressureText = plan
          ? `pressure=${plan.seeking.warPressure.toFixed(2)} disadvantage=${plan.seeking.strategicDisadvantage.toFixed(2)} `
            + `threshold=${Math.round(plan.recipientAcceptanceThreshold)}`
          : 'legacy peace evaluation';
        console.log(this.formatLog(
          selfId,
          `seeks peace with ${otherName}: ${pressureText}; offer gold=${treaty.goldReparations ?? 0} cities=${offeredCities}`
            + `${offersExploitation ? ' +exploitationRights' : ''}; `
            + `factors=${JSON.stringify(seeking ? this.roundFactors(seeking.factors) : {})}.`,
        ));
        if (seeking) {
          console.log(this.formatLog(
            selfId,
            `[WarTerminationAI] ${selfId} -> ${otherId} (${otherName}): seeking peace, `
              + `capitalCaptured=${seeking.factors.capitalCaptured === 1}, `
              + `objectiveAchieved=${seeking.factors.objectiveAchieved === 1}, `
              + `warPressure=${seeking.warPressure.toFixed(2)}, `
              + `strategicDisadvantage=${seeking.strategicDisadvantage.toFixed(2)}, warDuration=${warDuration}.`,
          ));
        }
        const reason = this.createDecisionReason(
          'proposePeace',
          selfId,
          otherId,
          relation,
          attitude,
          comparison,
          threat,
          personality,
          evaluation,
          ideologyPeaceModifier,
        );
        this.diplomacyManager.proposePeace(selfId, otherId, {
          offeredCityId: treaty.offeredCityId,
          offeredCityIds: 'offeredCityIds' in treaty ? treaty.offeredCityIds : undefined,
          goldReparations: treaty.goldReparations,
          ...(offersExploitation ? { offeredExploitationRights: true } : {}),
        });
        this.emitDecision(reason);
      } else if (wantsPeace && !this.diplomacyManager.canProposePeace(selfId, otherId, currentTurn)) {
        const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
        console.log(
          this.formatLog(selfId, `cannot propose peace to ${otherName} yet (${warDuration}/${MIN_WAR_TURNS_FOR_PEACE} turns elapsed).`),
        );
      } else if (wantsPeace && this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) < PEACE_COOLDOWN) {
        const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
        console.log(this.formatLog(selfId, `peace-offer cooldown prevents another proposal to ${otherName}.`));
      } else if (seeking && seeking.warPressure >= AI_PEACE_MODERATE_PRESSURE && !seeking.shouldInitiate) {
        // Moderate pressure is deliberately acceptance territory, not initiation.
        // Do not emit a decision or a per-turn log for this ordinary state.
      }
      return; // never touch borders while at war
    }

    // PEACE branch — hostile escalates to war (which itself clears border
    // grants), friendly opens borders, anything else stays put.
    // Holding this nation's original capital is a persistent strategic
    // grievance. It lets a genuinely high reclaim opportunity reach the normal
    // war evaluation even if ordinary relations have cooled during a long
    // peace; the reclaim modifier still supplies no aggression while weak.
    const reclaimMod = this.getReclaimWarModifier(selfId, otherId);
    if (attitude === 'hostile' || (!reclaimMod.suppressUnrelated && reclaimMod.warScoreDelta > 0)) {
      if (this.diplomacyManager.isPeaceTreatyActive(selfId, otherId, currentTurn)) return;
      if (this.diplomacyManager.isCeasefireActive(selfId, otherId, currentTurn)) return;
      // Alliance-aware: attacking an allied target means facing the defender
      // plus the ally that defensive alliance activation would pull in. Price
      // the war against that combined strength, not the isolated target.
      const warComparison = this.militaryEvaluationSystem.compareMilitaryStrengthForWar(selfId, otherId);
      const defensiveBreakdown = this.militaryEvaluationSystem.getDefensiveWarPowerBreakdown(selfId, otherId);
      if (defensiveBreakdown.allyNationId || defensiveBreakdown.peacekeepingPower > 0) {
        const targetName = this.nationManager.getNation(otherId)?.name ?? otherId;
        const allyName = defensiveBreakdown.allyNationId
          ? this.nationManager.getNation(defensiveBreakdown.allyNationId)?.name ?? defensiveBreakdown.allyNationId
          : null;
        const allianceText = allyName
          ? ` + alliance ${allyName} ${Math.round(defensiveBreakdown.alliancePower)}`
          : '';
        const peacekeepingText = defensiveBreakdown.peacekeepingPower > 0
          ? ` + UN peacekeepers ${Math.round(defensiveBreakdown.peacekeepingPower)}`
          : '';
        console.log(this.formatLog(
          selfId,
          `evaluated war against ${targetName}: defender power ${Math.round(defensiveBreakdown.defenderPower)}${allianceText}${peacekeepingText} = ${Math.round(defensiveBreakdown.totalDefensivePower)}${defensiveBreakdown.allianceName ? ` (Alliance: ${defensiveBreakdown.allianceName})` : ''}.`,
        ));
      }
      // Don't pick a fight we'll obviously lose, or while the enemy is
      // already threatening our cities.
      if (warComparison === 'weaker' || threat === 'high') {
        this.considerRoutineEconomicPressure(
          selfId,
          otherId,
          currentTurn,
          relation,
          evaluation,
          warComparison,
          threat,
          personality,
          true,
        );
        return;
      }
      const adjustedWarTolerance = personality.warTolerance + ideologyWarModifier;
      const personalityWantsWar = adjustedWarTolerance >= 50 || personality.aggressionBias > 0;

      // Goal-driven war score augments — but never bypasses — the safety
      // gates above. A nation with a prepare_war/expand goal can declare even
      // when its personality alone would not, but only if the existing
      // cooldowns and military checks already permit it.
      let warScore = intent.aggression * 0.3;
      if (warComparison === 'stronger') warScore += 0.4;
      else if (warComparison === 'equal') warScore += 0.2;
      if (threat === 'low' || threat === 'medium') warScore += 0.3;
      warScore += ideologyWarModifier / 100;
      // Suspicion amplifies an already-hostile, already-viable war intent (we are
      // inside the hostile branch, past the weaker/high-threat gates). It never
      // starts a war on its own — only nudges escalation when tension exists. The
      // deciding nation's covert personality scales this (paranoid/fanatic escalate
      // harder from suspicion; a merchant barely does).
      const selfPersonality = this.nationManager.getCovertPersonality(selfId);
      const suspicionWarBonus = getSuspicionWarScoreBonus(relation.suspicion) * selfPersonality.suspicionToWar;
      warScore += suspicionWarBonus;
      const personalityFactor = getNationPersonalityFactor(selfId);
      warScore *= 0.8 + personalityFactor * 0.4;
      // Era-strategy multiplier dampens or amplifies war propensity per
      // leader/era preset. Defaults to 1.0 when no era strategy is wired.
      const eraStrategy = this.getEraStrategy?.(selfId);
      if (eraStrategy) {
        warScore *= eraStrategy.diplomacyWeights.war;
      }

      // Reclaim Capital: additive bias applied after the multiplicative shaping
      // above so it is not amplified/dampened by personality or era weights.
      warScore += reclaimMod.warScoreDelta;

      const targetName = this.nationManager.getNation(otherId)?.name ?? otherId;
      const suspicionNote = suspicionWarBonus > 0
        ? ` (war pressure increased by suspicion ${Math.round(relation.suspicion)}`
          + `${selfPersonality.suspicionToWar > 1 ? `, amplified by ${selfPersonality.name} personality` : ''})`
        : '';
      console.log(
        this.formatLog(selfId, `AI war decision toward ${targetName}: score=${warScore.toFixed(2)}${suspicionNote}`),
      );

      const goalWantsWar = warScore > 0.7;
      // A recovering nation avoids opening unrelated wars of choice, even when
      // its personality would otherwise want one — it should husband its strength
      // for the capital. Defensive/high-threat cases already returned above.
      const wantsWar = (personalityWantsWar || goalWantsWar || reclaimMod.treatAsWarDesire)
        && !reclaimMod.suppressUnrelated;
      if (!wantsWar) {
        this.considerRoutineEconomicPressure(
          selfId,
          otherId,
          currentTurn,
          relation,
          evaluation,
          warComparison,
          threat,
          personality,
          false,
        );
        return;
      }

      if (
        this.turnsSince(relation.lastWarDeclarationTurn, currentTurn) >= WAR_COOLDOWN &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= NO_IMMEDIATE_WAR_AFTER_PEACE
      ) {
        // The decision event is presentation/diagnostic metadata for a war that
        // actually began. A blocked or already-existing war must not masquerade
        // as a fresh direct AI declaration.
        if (this.diplomacyManager.declareWar(selfId, otherId)) {
          this.emitDecision(this.createDecisionReason(
            'declareWar',
            selfId,
            otherId,
            relation,
            attitude,
            warComparison,
            threat,
            personality,
            evaluation,
            ideologyWarModifier,
          ));
          return;
        }
      }
      this.considerRoutineEconomicPressure(
        selfId,
        otherId,
        currentTurn,
        relation,
        evaluation,
        warComparison,
        threat,
        personality,
        false,
      );
      return;
    }

    // A deteriorating relation can produce symbolic Tariffs before it crosses
    // the coarse hostile-attitude threshold. Friendly/ordinary neutral pairs
    // score too low, and a successful sanction consumes this pair's action.
    if (this.considerRoutineEconomicPressure(
      selfId,
      otherId,
      currentTurn,
      relation,
      evaluation,
      comparison,
      threat,
      personality,
      false,
    )) return;

    // Suspicion reduces open-borders willingness (penalty on the trust/bias
    // gate) and, when very high, refuses to grant outright unless an
    // overwhelmingly friendly bond exists. Existing grants are never revoked here.
    const suspicionPenalty = getSuspicionOpenBordersPenalty(relation.suspicion);
    const adjustedDiplomacyBias = personality.diplomacyBias + ideologyOpenBordersModifier + suspicionPenalty;
    const adjustedTrust = relation.trust + ideologyOpenBordersModifier + suspicionPenalty;
    const baseWantsOpenBorders =
      attitude === 'friendly' || (attitude === 'neutral' && adjustedDiplomacyBias >= 15 && adjustedTrust >= 50);
    const refusedBySuspicion = suspicionBlocksOpenBorders(relation.suspicion, {
      trust: relation.trust,
      affinity: relation.affinity,
    });
    if (baseWantsOpenBorders && !refusedBySuspicion) {
      if (this.turnsSince(relation.lastOpenBordersChangeTurn, currentTurn) >= OPEN_BORDERS_COOLDOWN) {
        this.ensureOpenBorders(
          selfId,
          otherId,
          true,
          relation,
          attitude,
          comparison,
          threat,
          personality,
          evaluation,
          ideologyOpenBordersModifier,
        );
      }
    } else if (suspicionPenalty < 0 && !this.diplomacyManager.isOpenBorderGrantedFrom(selfId, otherId)) {
      // Log only when suspicion is the deciding factor: the relation is warm
      // enough that open borders would be wanted at suspicion 0 (raw thresholds,
      // independent of the suspicion-suppressed attitude), yet it is not granted.
      // Kept cheap and quiet — fires only when suspicion is already elevated.
      const wouldWantWithoutSuspicion =
        (relation.trust >= 70 && relation.affinity >= 10) || // friendly-equivalent warmth
        (personality.diplomacyBias + ideologyOpenBordersModifier >= 15 && relation.trust + ideologyOpenBordersModifier >= 50);
      if (wouldWantWithoutSuspicion) {
        const targetName = this.nationManager.getNation(otherId)?.name ?? otherId;
        console.log(this.formatLog(
          selfId,
          `suspicion ${Math.round(relation.suspicion)} reduced open borders willingness toward ${targetName}.`,
        ));
      }
    }
  }

  /**
   * Event-driven Boycott entry point. Third-party aggression is filtered by
   * the observer's support for the victim; direct insults/exposure target only
   * the offended AI. Returns the nations that actually imposed a Boycott.
   */
  handleEconomicPressureEvent(event: EconomicPressureAIEvent): string[] {
    const actors = event.kind === 'war_declared' || event.kind === 'city_captured'
      ? this.nationManager.getAllNations()
        .filter((nation) => !this.isHumanNation(nation.id) && nation.id !== event.aggressorNationId && nation.id !== event.victimNationId)
        .map((nation) => nation.id)
      : [event.victimNationId];
    const imposedBy: string[] = [];
    for (const reactorId of actors) {
      const reactor = this.nationManager.getNation(reactorId);
      if (!reactor || this.isHumanNation(reactorId)) continue;
      if (!this.haveMet(reactorId, event.aggressorNationId)) continue;
      if (!this.diplomacyManager.canImposeEconomicPressure(reactorId, event.aggressorNationId, 'boycott').ok) continue;
      const current = this.diplomacyManager.getEconomicPressure(reactorId, event.aggressorNationId);
      if (current === 'boycott' || current === 'embargo') continue;

      const aggressorRelation = this.diplomacyManager.getRelation(reactorId, event.aggressorNationId);
      let score = aggressorRelation.hostility / 200 + Math.max(0, 40 - aggressorRelation.trust) / 100;
      let reason: string;
      if (event.kind === 'war_declared' || event.kind === 'city_captured') {
        if (!this.haveMet(reactorId, event.victimNationId)) continue;
        const victimRelation = this.diplomacyManager.getRelation(reactorId, event.victimNationId);
        const supportsVictim = this.evaluationSystem.evaluateAttitude(reactorId, event.victimNationId) === 'friendly'
          || (victimRelation.trust >= 65 && victimRelation.affinity >= 10);
        if (!supportsVictim) continue;
        if (this.evaluationSystem.evaluateAttitude(reactorId, event.aggressorNationId) === 'friendly') continue;
        score += (event.kind === 'city_captured' ? 0.5 : 0.42)
          + Math.max(0, victimRelation.trust - 60) / 100
          + Math.max(0, victimRelation.affinity) / 200;
        const victimName = this.nationManager.getNation(event.victimNationId)?.name ?? event.victimNationId;
        reason = event.kind === 'city_captured'
          ? `after the capture of ${event.cityName ?? 'a city'} from ${victimName}; strong relations with ${victimName}`
          : `after war was declared on ${victimName}; strong relations with ${victimName}`;
      } else if (event.kind === 'gossip_insult') {
        score += 0.28 + clamp01(event.insultWeight / 2) * 0.4;
        reason = `after a hostile Gossip Insult (weight ${event.insultWeight.toFixed(1)})`;
      } else if (event.kind === 'covert_exposure') {
        score += 0.65;
        reason = 'after an exposed hostile covert operation';
      } else {
        score += 0.48;
        reason = 'as an asymmetric response to an incoming Embargo';
      }

      const turn = this.turnManager.getCurrentRound();
      const roll = this.economicPressureRoll(`boycott|${event.kind}|${reactorId}|${event.aggressorNationId}|${turn}`);
      if (score < 0.55 || roll >= Math.min(0.85, (score - 0.35) * 1.5)) continue;
      if (!this.applyEconomicPressure(reactorId, event.aggressorNationId, 'boycott')) continue;
      imposedBy.push(reactorId);
      const reactorName = reactor.name;
      const aggressorName = this.nationManager.getNation(event.aggressorNationId)?.name ?? event.aggressorNationId;
      console.debug(`[EconomicPressureAI] ${reactorName} imposed Boycott on ${aggressorName} ${reason}.`);
    }
    return imposedBy;
  }

  private considerRoutineEconomicPressure(
    selfId: string,
    otherId: string,
    currentTurn: number,
    relation: DiplomacyRelation,
    evaluation: DiplomaticEvaluationResult,
    militaryComparison: MilitaryComparison,
    threatLevel: ThreatLevel,
    personality: AILeaderPersonality,
    warTooRisky: boolean,
  ): boolean {
    if (this.expiredPressureTurnByPair.get(`${selfId}>${otherId}`) === currentTurn) return false;
    const current = this.diplomacyManager.getEconomicPressureRecord(selfId, otherId);
    if (current?.type === 'boycott' || current?.type === 'embargo') return false;
    if (current && currentTurn - current.imposedTurn < ECONOMIC_PRESSURE_ESCALATION_COOLDOWN) return false;

    const willingness = evaluateEconomicPressureWillingness({
      attitude: evaluation.attitude,
      trust: relation.trust,
      hostility: relation.hostility,
      affinity: relation.affinity,
      suspicion: relation.suspicion,
      ideologyCompatibility: evaluation.ideologyCompatibility,
      militaryComparison,
      threatLevel,
      warTooRisky,
      currentPressure: current?.type ?? null,
      diplomacyBias: personality.diplomacyBias,
      culturalJealousyBias: this.isCulturalJealousyTarget(selfId, otherId) ? CULTURAL_JEALOUSY_TARIFF_BIAS : 0,
    });
    const candidates: Array<{ type: EconomicPressureType; score: number; threshold: number }> = [
      { type: 'embargo', score: willingness.embargo, threshold: 0.78 },
      { type: 'tariffs', score: willingness.tariffs, threshold: 0.48 },
    ];
    for (const candidate of candidates) {
      if (current && ECONOMIC_PRESSURE_LEVEL[candidate.type] <= ECONOMIC_PRESSURE_LEVEL[current.type]) continue;
      if (!this.diplomacyManager.canImposeEconomicPressure(selfId, otherId, candidate.type).ok) continue;
      const chance = Math.min(0.75, Math.max(0, (candidate.score - candidate.threshold + 0.18) * 1.4));
      const roll = this.economicPressureRoll(`${candidate.type}|${selfId}|${otherId}|${currentTurn}`);
      if (candidate.score < candidate.threshold || roll >= chance) continue;
      if (!this.applyEconomicPressure(selfId, otherId, candidate.type)) continue;
      const selfName = this.nationManager.getNation(selfId)?.name ?? selfId;
      const targetName = this.nationManager.getNation(otherId)?.name ?? otherId;
      const weaknessReason = candidate.type === 'embargo' && warTooRisky
        ? '; military comparison weaker/high threat made war too risky'
        : '';
      const jealousyReason = candidate.type === 'tariffs' && this.isCulturalJealousyTarget(selfId, otherId)
        ? '; Cultural Jealousy prioritized this target'
        : '';
      console.debug(
        `[EconomicPressureAI] ${selfName} imposed ${ECONOMIC_PRESSURE_LABEL[candidate.type]} on ${targetName}: `
        + `score ${candidate.score.toFixed(2)}, trust ${Math.round(relation.trust)}, hostility ${Math.round(relation.hostility)}${weaknessReason}${jealousyReason}.`,
      );
      return true;
    }
    return false;
  }

  private expireAIToAISanctions(sourceNationId: string, currentTurn: number): void {
    const source = this.nationManager.getNation(sourceNationId);
    if (!source || this.isHumanNation(sourceNationId)) return;
    for (const record of this.diplomacyManager.getEconomicPressureAgainst(sourceNationId)) {
      const target = this.nationManager.getNation(record.targetNationId);
      if (!target || this.isHumanNation(record.targetNationId)) continue;
      if (currentTurn - record.imposedTurn < ECONOMIC_PRESSURE_AI_AI_DURATION_TURNS) continue;
      if (!this.diplomacyManager.liftEconomicPressure(sourceNationId, record.targetNationId)) continue;
      this.expiredPressureTurnByPair.set(`${sourceNationId}>${record.targetNationId}`, currentTurn);
      console.debug(
        `[EconomicPressure] ${source.name}'s ${ECONOMIC_PRESSURE_LABEL[record.type]} against ${target.name} `
        + `expired after ${ECONOMIC_PRESSURE_AI_AI_DURATION_TURNS} turns.`,
      );
    }
  }

  /**
   * Gates peace consideration behind war-exhaustion thresholds. A nation must
   * have lost at least `minimumUnitsLostBeforePeace` military units, AND — if
   * a starting-strength snapshot exists — at least `casualtyToleranceRatio`
   * of that strength, before its other peace conditions are evaluated.
   */
  private shouldNationConsiderPeace(selfId: string, otherId: string, personality: AILeaderPersonality): boolean {
    const exhaustion = this.diplomacyManager.getWarExhaustion(selfId, otherId);
    if (exhaustion.unitsLost < personality.minimumUnitsLostBeforePeace) {
      const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
      console.log(
        this.formatLog(selfId, `war exhaustion gate: only ${exhaustion.unitsLost}/${personality.minimumUnitsLostBeforePeace} units lost vs ${otherName} — not ready for peace.`),
      );
      return false;
    }
    if (exhaustion.startStrength > 0) {
      const ratio = exhaustion.unitsLost / exhaustion.startStrength;
      if (ratio < personality.casualtyToleranceRatio) {
        const otherName = this.nationManager.getNation(otherId)?.name ?? otherId;
        console.log(
          this.formatLog(selfId, `war exhaustion gate: casualty ratio ${ratio.toFixed(2)} < tolerance ${personality.casualtyToleranceRatio} vs ${otherName} — not ready for peace.`),
        );
        return false;
      }
    }
    return true;
  }

  private turnsSince(lastTurn: number | null, currentTurn: number): number {
    if (lastTurn === null) return Infinity;
    return currentTurn - lastTurn;
  }

  private roundFactors(factors: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, Number(value.toFixed(2))]));
  }

  private noPendingProposal(_fromId: string, toId: string): boolean {
    return this.diplomacyManager.getPendingProposal(toId) === null;
  }

  /**
   * Toggle border grants until they match `desired`. v1 covers both sides
   * for AI↔AI to keep things simple, but never overrides a human's grant —
   * the human owns their own permission.
   */
  private ensureOpenBorders(
    selfId: string,
    otherId: string,
    desired: boolean,
    relation: DiplomacyRelation,
    attitude: DiplomaticAttitude,
    comparison: MilitaryComparison,
    threat: ThreatLevel,
    personality: AILeaderPersonality,
    evaluation: DiplomaticEvaluationResult,
    ideologyModifier: number,
  ): void {
    if (this.diplomacyManager.isOpenBorderGrantedFrom(selfId, otherId) !== desired) {
      const reason = this.createDecisionReason(
        desired ? 'openBorders' : 'cancelOpenBorders',
        selfId,
        otherId,
        relation,
        attitude,
        comparison,
        threat,
        personality,
        evaluation,
        ideologyModifier,
      );
      this.diplomacyManager.toggleOpenBorders(selfId, otherId);
      this.emitDecision(reason);
    }

    const otherNation = this.nationManager.getNation(otherId);
    if (!otherNation || otherNation.isHuman) return;

    if (this.diplomacyManager.isOpenBorderGrantedFrom(otherId, selfId) !== desired) {
      const reverseRelation = this.diplomacyManager.getRelation(otherId, selfId);
      const reverseEvaluation = this.evaluationSystem.evaluateRelation(otherId, selfId);
      const reverseAttitude = reverseEvaluation.attitude;
      const reverseComparison = this.militaryEvaluationSystem.compareMilitaryStrength(otherId, selfId);
      const reverseThreat = this.threatEvaluationSystem.getThreatLevel(otherId, selfId);
      const reversePersonality = getLeaderPersonalityByNationId(otherId);
      const reverseIdeologyModifier = getIdeologyOpenBordersModifier(reverseEvaluation.ideologyCompatibility);
      const reason = this.createDecisionReason(
        desired ? 'openBorders' : 'cancelOpenBorders',
        otherId,
        selfId,
        reverseRelation,
        reverseAttitude,
        reverseComparison,
        reverseThreat,
        reversePersonality,
        reverseEvaluation,
        reverseIdeologyModifier,
      );
      this.diplomacyManager.toggleOpenBorders(otherId, selfId);
      this.emitDecision(reason);
    }
  }

  private emitDecision(reason: AIDiplomacyDecisionReason): void {
    for (const listener of this.decisionListeners) {
      listener(reason);
    }
  }

  private createDecisionReason(
    action: AIDiplomacyAction,
    actorNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
    attitude: DiplomaticAttitude,
    militaryComparison: MilitaryComparison,
    threatLevel: ThreatLevel,
    personality: AILeaderPersonality,
    evaluation: DiplomaticEvaluationResult,
    ideologyModifier: number,
  ): AIDiplomacyDecisionReason {
    const leader = getLeaderByNationId(actorNationId);
    const warDeclarationReason = action === 'declareWar'
      ? classifyWarDeclarationReason({
        militaryComparison,
        threatLevel,
        trust: relation.trust,
        fear: relation.fear,
        hostility: relation.hostility,
        affinity: relation.affinity,
        suspicion: relation.suspicion,
        ideologyCompatibility: evaluation.ideologyCompatibility,
        personality,
        nationalAgendaId: leader?.aiNationalAgendaId,
      })
      : undefined;
    return {
      action,
      actorNationId,
      targetNationId,
      attitude,
      militaryComparison,
      threatLevel,
      relationState: relation.state,
      trust: relation.trust,
      fear: relation.fear,
      hostility: relation.hostility,
      affinity: relation.affinity,
      suspicion: relation.suspicion,
      ideologyCompatibility: evaluation.ideologyCompatibility,
      ideologyCompatibilityLabel: evaluation.ideologyCompatibilityLabel,
      sourceIdeologyName: evaluation.sourceIdeologyName,
      targetIdeologyName: evaluation.targetIdeologyName,
      warDeclarationReason,
      reasonText: this.createReasonText(
        action,
        attitude,
        militaryComparison,
        threatLevel,
        personality,
        relation,
        evaluation,
        ideologyModifier,
      ),
    };
  }

  private createReasonText(
    action: AIDiplomacyAction,
    attitude: DiplomaticAttitude,
    militaryComparison: MilitaryComparison,
    threatLevel: ThreatLevel,
    personality: AILeaderPersonality,
    relation: DiplomacyRelation,
    evaluation: DiplomaticEvaluationResult,
    ideologyModifier: number,
  ): string {
    const ideologyText = formatIdeologyReason(action, evaluation, ideologyModifier);
    const relationText = formatRelationReason(relation);
    switch (action) {
      case 'declareWar':
        return `${attitude} attitude, ${militaryComparison} military, threat level ${threatLevel}, and ${formatTolerance(personality.warTolerance, 'war tolerance')}${relationText}${ideologyText}.`;
      case 'proposePeace':
        return `${attitude} attitude, ${militaryComparison} military, threat level ${threatLevel}, and ${formatTolerance(personality.peacePreference, 'peace preference')}${relationText}${ideologyText}.`;
      case 'openBorders':
        return `${attitude} attitude and stable relation; military ${militaryComparison}, threat level ${threatLevel}, diplomacy bias ${formatSignedBias(personality.diplomacyBias)}${relationText}${ideologyText}.`;
      case 'cancelOpenBorders':
        return `${attitude} attitude; military ${militaryComparison}, threat level ${threatLevel}, diplomacy bias ${formatSignedBias(personality.diplomacyBias)}${relationText}${ideologyText}.`;
    }
  }
}

function getIdeologyOpenBordersModifier(ideologyCompatibility: number): number {
  return Math.round(ideologyCompatibility / 4);
}

function getIdeologyWarModifier(ideologyCompatibility: number): number {
  if (ideologyCompatibility <= -30) return 10;
  if (ideologyCompatibility <= -20) return 6;
  if (ideologyCompatibility >= 25) return -8;
  if (ideologyCompatibility >= 10) return -4;
  return 0;
}

function getIdeologyPeaceModifier(ideologyCompatibility: number): number {
  if (ideologyCompatibility >= 25) return 8;
  if (ideologyCompatibility >= 10) return 4;
  if (ideologyCompatibility <= -30) return -8;
  if (ideologyCompatibility <= -20) return -4;
  return 0;
}

function formatIdeologyReason(
  action: AIDiplomacyAction,
  evaluation: DiplomaticEvaluationResult,
  ideologyModifier: number,
): string {
  if (ideologyModifier === 0) return '';

  const effect = getIdeologyEffectText(action, ideologyModifier);
  return `; ideology ${evaluation.ideologyCompatibilityLabel} ${evaluation.sourceIdeologyName} vs ${evaluation.targetIdeologyName} ${formatSignedBias(evaluation.ideologyCompatibility)} ${effect}`;
}

function formatRelationReason(relation: DiplomacyRelation): string {
  return `; relation trust ${Math.round(relation.trust)}, fear ${Math.round(relation.fear)}, hostility ${Math.round(relation.hostility)}, suspicion ${Math.round(relation.suspicion)}, affinity ${Math.round(relation.affinity)}`;
}

function getIdeologyEffectText(action: AIDiplomacyAction, ideologyModifier: number): string {
  switch (action) {
    case 'declareWar':
      return ideologyModifier > 0 ? 'increased war pressure' : 'reduced war pressure';
    case 'proposePeace':
      return ideologyModifier > 0 ? 'increased peace willingness' : 'reduced peace willingness';
    case 'openBorders':
      return ideologyModifier > 0 ? 'increased open borders willingness' : 'reduced open borders willingness';
    case 'cancelOpenBorders':
      return ideologyModifier > 0 ? 'increased border trust' : 'reduced border trust';
  }
}

function formatTolerance(value: number, label: string): string {
  if (value >= 70) return `high ${label}`;
  if (value <= 30) return `low ${label}`;
  return `moderate ${label}`;
}

function formatSignedBias(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Stable FNV-1a roll keeps autorun reproducible without global RNG coupling. */
function hashToUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
