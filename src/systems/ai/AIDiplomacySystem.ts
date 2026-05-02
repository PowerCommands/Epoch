import type { DiplomacyManager, DiplomacyRelation } from '../DiplomacyManager';
import type { DiplomaticEvaluationSystem, DiplomaticAttitude } from '../diplomacy/DiplomaticEvaluationSystem';
import type { NationManager } from '../NationManager';
import type { TurnManager } from '../TurnManager';
import type { AIMilitaryEvaluationSystem, MilitaryComparison } from './AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem, ThreatLevel } from './AIMilitaryThreatEvaluationSystem';
import type { AIDiplomacyAction, AIDiplomacyDecisionReason } from '../../types/aiDiplomacy';
import type { AILeaderPersonality } from '../../types/aiLeaderPersonality';
import { getLeaderPersonalityByNationId } from '../../data/leaders';
import {
  getMilitaryIntent,
  getNationPersonalityFactor,
  type MilitaryIntent,
} from './utils/AIMilitaryUtils';

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

export class AIDiplomacySystem {
  // AI diplomacy reason logging explains decisions without changing them.
  private readonly decisionListeners: Array<(reason: AIDiplomacyDecisionReason) => void> = [];

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly evaluationSystem: DiplomaticEvaluationSystem,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly threatEvaluationSystem: AIMilitaryThreatEvaluationSystem,
  ) {}

  onDecision(listener: (reason: AIDiplomacyDecisionReason) => void): void {
    this.decisionListeners.push(listener);
  }

  runTurn(nationId: string): void {
    const self = this.nationManager.getNation(nationId);
    if (!self || self.isHuman) return; // human players control their own diplomacy

    const intent = getMilitaryIntent(self.aiGoals);
    console.log(
      `[AI Military] ${self.name}: aggression=${intent.aggression.toFixed(2)} defense=${intent.defense.toFixed(2)}`,
    );

    const currentTurn = this.turnManager.getCurrentRound();
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      this.decideAgainst(nationId, other.id, currentTurn, intent);
    }
  }

  /**
   * Apply at most one action per pair per turn. Priority order is
   * peace → war → open-border adjustments, so an aggressive turn never both
   * declares war and fiddles with borders against the same nation.
   */
  private decideAgainst(selfId: string, otherId: string, currentTurn: number, intent: MilitaryIntent): void {
    const relation = this.diplomacyManager.getRelation(selfId, otherId);
    const attitude = this.evaluationSystem.evaluateAttitude(selfId, otherId);
    const comparison = this.militaryEvaluationSystem.compareMilitaryStrength(selfId, otherId);
    const threat = this.threatEvaluationSystem.getThreatLevel(selfId, otherId);
    const personality = getLeaderPersonalityByNationId(selfId);

    if (relation.state === 'WAR') {
      // Sue for peace when geographically threatened, frightened, or when
      // materially outmatched and the relation is already strained.
      const wantsPeace =
        threat === 'high' ||
        attitude === 'afraid' ||
        comparison === 'weaker' ||
        (personality.peacePreference >= 70 && attitude !== 'hostile');
      if (
        wantsPeace &&
        this.canProposePeace(selfId, otherId) &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= PEACE_COOLDOWN &&
        this.turnsSince(relation.lastWarDeclarationTurn, currentTurn) >= NO_IMMEDIATE_PEACE_AFTER_WAR
      ) {
        const reason = this.createDecisionReason(
          'proposePeace',
          selfId,
          otherId,
          relation,
          attitude,
          comparison,
          threat,
          personality,
        );
        this.diplomacyManager.proposePeace(selfId, otherId);
        this.emitDecision(reason);
      }
      return; // never touch borders while at war
    }

    // PEACE branch — hostile escalates to war (which itself clears border
    // grants), friendly opens borders, anything else stays put.
    if (attitude === 'hostile') {
      // Don't pick a fight we'll obviously lose, or while the enemy is
      // already threatening our cities.
      if (comparison === 'weaker' || threat === 'high') return;
      const personalityWantsWar = personality.warTolerance >= 50 || personality.aggressionBias > 0;

      // Goal-driven war score augments — but never bypasses — the safety
      // gates above. A nation with a prepare_war/expand goal can declare even
      // when its personality alone would not, but only if the existing
      // cooldowns and military checks already permit it.
      let warScore = intent.aggression * 0.3;
      if (comparison === 'stronger') warScore += 0.4;
      else if (comparison === 'equal') warScore += 0.2;
      if (threat === 'low' || threat === 'medium') warScore += 0.3;
      const personalityFactor = getNationPersonalityFactor(selfId);
      warScore *= 0.8 + personalityFactor * 0.4;

      const targetName = this.nationManager.getNation(otherId)?.name ?? otherId;
      const selfName = this.nationManager.getNation(selfId)?.name ?? selfId;
      console.log(
        `[AI War Decision] ${selfName} → ${targetName}: score=${warScore.toFixed(2)}`,
      );

      const goalWantsWar = warScore > 0.7;
      if (!personalityWantsWar && !goalWantsWar) return;

      if (
        this.turnsSince(relation.lastWarDeclarationTurn, currentTurn) >= WAR_COOLDOWN &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= NO_IMMEDIATE_WAR_AFTER_PEACE
      ) {
        const reason = this.createDecisionReason(
          'declareWar',
          selfId,
          otherId,
          relation,
          attitude,
          comparison,
          threat,
          personality,
        );
        this.diplomacyManager.declareWar(selfId, otherId);
        this.emitDecision(reason);
      }
      return;
    }

    if (attitude === 'friendly' || (attitude === 'neutral' && personality.diplomacyBias >= 15 && relation.trust >= 50)) {
      if (this.turnsSince(relation.lastOpenBordersChangeTurn, currentTurn) >= OPEN_BORDERS_COOLDOWN) {
        this.ensureOpenBorders(selfId, otherId, true, relation, attitude, comparison, threat, personality);
      }
    }
  }

  private turnsSince(lastTurn: number | null, currentTurn: number): number {
    if (lastTurn === null) return Infinity;
    return currentTurn - lastTurn;
  }

  private canProposePeace(fromId: string, toId: string): boolean {
    // Skip if a proposal from us is already pending — avoids re-spamming.
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
      );
      this.diplomacyManager.toggleOpenBorders(selfId, otherId);
      this.emitDecision(reason);
    }

    const otherNation = this.nationManager.getNation(otherId);
    if (!otherNation || otherNation.isHuman) return;

    if (this.diplomacyManager.isOpenBorderGrantedFrom(otherId, selfId) !== desired) {
      const reverseRelation = this.diplomacyManager.getRelation(otherId, selfId);
      const reverseAttitude = this.evaluationSystem.evaluateAttitude(otherId, selfId);
      const reverseComparison = this.militaryEvaluationSystem.compareMilitaryStrength(otherId, selfId);
      const reverseThreat = this.threatEvaluationSystem.getThreatLevel(otherId, selfId);
      const reversePersonality = getLeaderPersonalityByNationId(otherId);
      const reason = this.createDecisionReason(
        desired ? 'openBorders' : 'cancelOpenBorders',
        otherId,
        selfId,
        reverseRelation,
        reverseAttitude,
        reverseComparison,
        reverseThreat,
        reversePersonality,
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
  ): AIDiplomacyDecisionReason {
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
      reasonText: this.createReasonText(action, attitude, militaryComparison, threatLevel, personality),
    };
  }

  private createReasonText(
    action: AIDiplomacyAction,
    attitude: DiplomaticAttitude,
    militaryComparison: MilitaryComparison,
    threatLevel: ThreatLevel,
    personality: AILeaderPersonality,
  ): string {
    switch (action) {
      case 'declareWar':
        return `${attitude} attitude, ${militaryComparison} military, threat level ${threatLevel}, and ${formatTolerance(personality.warTolerance, 'war tolerance')}.`;
      case 'proposePeace':
        return `${attitude} attitude, ${militaryComparison} military, threat level ${threatLevel}, and ${formatTolerance(personality.peacePreference, 'peace preference')}.`;
      case 'openBorders':
        return `${attitude} attitude and stable relation; military ${militaryComparison}, threat level ${threatLevel}, diplomacy bias ${formatSignedBias(personality.diplomacyBias)}.`;
      case 'cancelOpenBorders':
        return `${attitude} attitude; military ${militaryComparison}, threat level ${threatLevel}, diplomacy bias ${formatSignedBias(personality.diplomacyBias)}.`;
    }
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
