import type { DiplomacyManager } from '../DiplomacyManager';
import type { DiplomaticEvaluationSystem } from '../diplomacy/DiplomaticEvaluationSystem';
import type { NationManager } from '../NationManager';
import type { TurnManager } from '../TurnManager';
import type { AIMilitaryEvaluationSystem } from './AIMilitaryEvaluationSystem';
import type { AIMilitaryThreatEvaluationSystem } from './AIMilitaryThreatEvaluationSystem';

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
  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly evaluationSystem: DiplomaticEvaluationSystem,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly threatEvaluationSystem: AIMilitaryThreatEvaluationSystem,
  ) {}

  runTurn(nationId: string): void {
    const self = this.nationManager.getNation(nationId);
    if (!self || self.isHuman) return; // human players control their own diplomacy

    const currentTurn = this.turnManager.getCurrentRound();
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      this.decideAgainst(nationId, other.id, currentTurn);
    }
  }

  /**
   * Apply at most one action per pair per turn. Priority order is
   * peace → war → open-border adjustments, so an aggressive turn never both
   * declares war and fiddles with borders against the same nation.
   */
  private decideAgainst(selfId: string, otherId: string, currentTurn: number): void {
    const relation = this.diplomacyManager.getRelation(selfId, otherId);
    const attitude = this.evaluationSystem.evaluateAttitude(selfId, otherId);
    const comparison = this.militaryEvaluationSystem.compareMilitaryStrength(selfId, otherId);
    const threat = this.threatEvaluationSystem.getThreatLevel(selfId, otherId);

    if (relation.state === 'WAR') {
      // Sue for peace when geographically threatened, frightened, or when
      // materially outmatched and the relation is already strained.
      const wantsPeace =
        threat === 'high' ||
        attitude === 'afraid' ||
        (comparison === 'weaker' && attitude === 'hostile');
      if (
        wantsPeace &&
        this.canProposePeace(selfId, otherId) &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= PEACE_COOLDOWN &&
        this.turnsSince(relation.lastWarDeclarationTurn, currentTurn) >= NO_IMMEDIATE_PEACE_AFTER_WAR
      ) {
        this.diplomacyManager.proposePeace(selfId, otherId);
      }
      return; // never touch borders while at war
    }

    // PEACE branch — hostile escalates to war (which itself clears border
    // grants), friendly opens borders, anything else stays put.
    if (attitude === 'hostile') {
      // Don't pick a fight we'll obviously lose, or while the enemy is
      // already threatening our cities.
      if (comparison === 'weaker' || threat === 'high') return;
      if (
        this.turnsSince(relation.lastWarDeclarationTurn, currentTurn) >= WAR_COOLDOWN &&
        this.turnsSince(relation.lastPeaceProposalTurn, currentTurn) >= NO_IMMEDIATE_WAR_AFTER_PEACE
      ) {
        this.diplomacyManager.declareWar(selfId, otherId);
      }
      return;
    }

    if (attitude === 'friendly') {
      if (this.turnsSince(relation.lastOpenBordersChangeTurn, currentTurn) >= OPEN_BORDERS_COOLDOWN) {
        this.ensureOpenBorders(selfId, otherId, true);
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
  private ensureOpenBorders(selfId: string, otherId: string, desired: boolean): void {
    if (this.diplomacyManager.isOpenBorderGrantedFrom(selfId, otherId) !== desired) {
      this.diplomacyManager.toggleOpenBorders(selfId, otherId);
    }

    const otherNation = this.nationManager.getNation(otherId);
    if (!otherNation || otherNation.isHuman) return;

    if (this.diplomacyManager.isOpenBorderGrantedFrom(otherId, selfId) !== desired) {
      this.diplomacyManager.toggleOpenBorders(otherId, selfId);
    }
  }
}
