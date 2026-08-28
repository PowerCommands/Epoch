import type { DiplomacyManager } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import type { AllianceManager } from './AllianceManager';
import type { AIMilitaryEvaluationSystem } from '../ai/AIMilitaryEvaluationSystem';
import type { DiplomaticEvaluationSystem } from './DiplomaticEvaluationSystem';
import type { JointWarKind, JointWarProposal, JointWarValidationResult } from '../../types/jointWar';
import { getExploitationRightsJoinWarBonusForInterest } from './ExploitationRightsConcession';
import { getLeaderExploitationInterestByNationId } from '../../data/leaders';
import { RECLAIM_JOINT_WAR_BONUS } from '../ai/reclaimCapital';

/** AI willingness threshold; tuned conservatively so allied/strong asks pass. */
const ACCEPT_THRESHOLD = 3;
/** A receiver already fighting this many wars refuses to open another front. */
const MAX_CONCURRENT_WARS = 2;
/** Reject outright when the target's defensive power dwarfs the receiver. */
const OVERMATCH_RATIO = 1.6;

/**
 * Joint War Requests — pure validation and deterministic AI acceptance rules.
 *
 * It does not declare wars, log, or touch UI; the caller (GameScene) executes
 * the resulting wars through the central diplomacy system and handles side
 * effects. Acceptance reuses the existing relation, attitude, and
 * (alliance-aware) military systems rather than inventing a parallel model.
 */
export class JointWarSystem {
  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly diplomaticEvaluationSystem: DiplomaticEvaluationSystem,
    private readonly militaryEvaluationSystem: AIMilitaryEvaluationSystem,
    private readonly allianceManager: AllianceManager,
    private readonly nationManager: NationManager,
    private readonly haveMet: (a: string, b: string) => boolean,
  ) {}

  /**
   * Reclaim Capital hook: the current holder of a nation's lost capital, or
   * undefined. Defaults to none so existing callers/tests are unaffected; when
   * wired it makes a nation more eager to join wars against its capital holder
   * and to seek partners who already oppose that holder — a modifier on top of
   * the ordinary relation/military scoring, never an override.
   */
  private getReclaimHolderId: (nationId: string) => string | undefined = () => undefined;

  setReclaimHolderProvider(provider: (nationId: string) => string | undefined): void {
    this.getReclaimHolderId = provider;
  }

  /**
   * Validate a joint-war ask from `proposerId` to `receiverId` against
   * `targetId`. Encapsulates every target-validity rule so neither UI nor AI
   * code re-implements them.
   */
  canRequestJointWar(
    proposerId: string,
    receiverId: string,
    targetId: string,
    kind: JointWarKind,
  ): JointWarValidationResult {
    if (proposerId === receiverId) return { ok: false, reason: 'Cannot make a joint-war request with yourself.' };
    if (targetId === proposerId || targetId === receiverId) return { ok: false, reason: 'The target must be a third nation.' };
    if (!this.haveMet(proposerId, receiverId)) return { ok: false, reason: 'You have not met this nation.' };
    if (!this.haveMet(proposerId, targetId)) return { ok: false, reason: 'You have not met the target nation.' };
    if (!this.militaryEvaluationSystem.isNationActive(targetId)) return { ok: false, reason: 'The target nation is no longer active.' };
    if (this.diplomacyManager.getState(proposerId, receiverId) === 'WAR') return { ok: false, reason: 'You are at war with this nation.' };
    if (this.allianceManager.areAllied(proposerId, targetId) || this.allianceManager.areAllied(receiverId, targetId)) {
      return { ok: false, reason: 'The target is an alliance partner.' };
    }
    if (this.diplomacyManager.getState(receiverId, targetId) === 'WAR') {
      return { ok: false, reason: 'They are already at war with the target.' };
    }
    if (kind === 'request') {
      if (this.diplomacyManager.getState(proposerId, targetId) === 'WAR') {
        return { ok: false, reason: 'You are already at war with the target — ask them to join instead.' };
      }
    } else {
      if (this.diplomacyManager.getState(proposerId, targetId) !== 'WAR') {
        return { ok: false, reason: 'You are not at war with the target — request a joint war instead.' };
      }
    }
    return { ok: true };
  }

  /** Known third nations that form a valid joint-war target for this kind. */
  getValidJointWarTargets(proposerId: string, receiverId: string, kind: JointWarKind): string[] {
    return this.nationManager.getAllNations()
      .map((nation) => nation.id)
      .filter((targetId) => this.canRequestJointWar(proposerId, receiverId, targetId, kind).ok);
  }

  /**
   * Deterministic v1 AI acceptance. Combines relation with the proposer,
   * antipathy toward the target, alliance ties, and an alliance-aware military
   * comparison. Hard rejects guard the obvious no-go cases.
   */
  shouldAccept(
    receiverId: string,
    proposerId: string,
    targetId: string,
    kind: JointWarKind,
    offeredExploitationRights = false,
  ): boolean {
    if (!this.canRequestJointWar(proposerId, receiverId, targetId, kind).ok) return false;
    const reclaimHolderId = this.getReclaimHolderId(receiverId);
    // Hard strategic restriction: a recovering nation never volunteers for an
    // offensive joint war that does not directly target its capital holder.
    // Defensive alliance activation is handled separately by AllianceWarSystem.
    if (reclaimHolderId !== undefined && reclaimHolderId !== targetId) return false;
    if (this.allianceManager.areAllied(receiverId, targetId)) return false;

    const attitudeToTarget = this.diplomaticEvaluationSystem.evaluateAttitude(receiverId, targetId);
    if (attitudeToTarget === 'friendly') return false; // won't attack a friend

    const receiverPower = this.militaryEvaluationSystem.getMilitaryStrength(receiverId).totalStrength;
    if (receiverPower <= 0) return false; // no army to commit

    // Alliance-aware: attacking the target may also mean fighting the target's ally.
    const targetDefensivePower = this.militaryEvaluationSystem.getDefensiveWarPowerAgainst(receiverId, targetId);
    if (targetDefensivePower > receiverPower * OVERMATCH_RATIO) return false; // target bloc too strong

    const warCount = this.countActiveWars(receiverId);
    if (warCount >= MAX_CONCURRENT_WARS) return false; // already overcommitted

    const relProposer = this.diplomacyManager.getRelation(receiverId, proposerId);
    const relTarget = this.diplomacyManager.getRelation(receiverId, targetId);
    const attitudeToProposer = this.diplomaticEvaluationSystem.evaluateAttitude(receiverId, proposerId);

    let score = 0;
    // Relationship with the proposer.
    score += (relProposer.trust - 50) / 12;
    score += relProposer.affinity / 25;
    if (this.allianceManager.areAllied(proposerId, receiverId)) score += 3;
    if (attitudeToProposer === 'friendly') score += 1.5;
    else if (attitudeToProposer === 'hostile') score -= 3;

    // Antipathy toward the target.
    score += relTarget.hostility / 18;
    score += relTarget.fear / 30;
    if (attitudeToTarget === 'hostile') score += 1.5;
    else if (attitudeToTarget === 'afraid') score += 0.8;

    // Reclaim Capital: a war against the nation currently holding the receiver's
    // own lost capital directly serves its overriding strategic objective.
    if (this.getReclaimHolderId(receiverId) === targetId) score += RECLAIM_JOINT_WAR_BONUS;

    // Military advantage against the target's defensive bloc.
    if (receiverPower >= targetDefensivePower * 1.25) score += 2;
    else if (receiverPower >= targetDefensivePower) score += 1;
    else score -= 1.5;

    // Each ongoing war makes opening another front less appealing.
    score -= warCount * 1.5;

    // Joining an existing war is a smaller commitment than starting a new one.
    if (kind === 'join') score += 0.5;

    // A sweetener the proposer offers from its own territory. The receiver is the
    // beneficiary, so its leader's exploitation interest scales the bonus: an
    // interest-0 leader gains nothing from the offer; a very-high-interest leader
    // is strongly swayed. Personality only — never the map or its resources.
    if (offeredExploitationRights) {
      score += getExploitationRightsJoinWarBonusForInterest(getLeaderExploitationInterestByNationId(receiverId));
    }

    return score >= ACCEPT_THRESHOLD;
  }

  /**
   * Find a plausible joint-war proposal for an AI proposer to send, or null.
   * Prefers allied/friendly receivers and targets the proposer already dislikes
   * or fights. Used sparingly (cooldown-gated) by the AI turn loop.
   */
  findAIProposal(proposerId: string): JointWarProposal | null {
    const nations = this.nationManager.getAllNations();
    const reclaimHolderId = this.getReclaimHolderId(proposerId);
    const receivers = nations
      .map((nation) => nation.id)
      .filter((receiverId) => receiverId !== proposerId)
      .filter((receiverId) => this.haveMet(proposerId, receiverId))
      .filter((receiverId) => this.diplomacyManager.getState(proposerId, receiverId) !== 'WAR')
      .filter((receiverId) => {
        const attitude = this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, receiverId);
        if (attitude === 'friendly' || this.allianceManager.areAllied(proposerId, receiverId)) return true;
        if (!reclaimHolderId || !this.opposesHolder(receiverId, reclaimHolderId)) return false;
        // Shared opposition makes a neutral nation worth approaching, but never
        // turns a deeply hostile bilateral relationship into an automatic pact.
        return attitude !== 'hostile'
          && this.diplomaticEvaluationSystem.evaluateAttitude(receiverId, proposerId) !== 'hostile';
      });
    if (receivers.length === 0) return null;

    // Reclaim Capital takes precedence: seek a partner against the nation holding
    // the proposer's lost capital, favouring receivers who already oppose it.
    const reclaimProposal = this.findReclaimJointWarProposal(proposerId, receivers);
    // While reclaiming, this is the only offensive war proposal the nation may
    // originate. If no suitable partner exists, wait instead of falling through
    // to an unrelated ordinary joint-war proposal.
    if (reclaimHolderId) return reclaimProposal;

    for (const receiverId of receivers) {
      const offerExploitationRights = this.shouldOfferExploitationRights(proposerId, receiverId);
      // Prefer recruiting help for a war the proposer is already fighting.
      for (const target of nations) {
        if (this.diplomacyManager.getState(proposerId, target.id) !== 'WAR') continue;
        if (this.canRequestJointWar(proposerId, receiverId, target.id, 'join').ok) {
          return { proposerNationId: proposerId, receiverNationId: receiverId, targetNationId: target.id, kind: 'join', offerExploitationRights };
        }
      }
      // Otherwise propose a coordinated new war against a disliked target.
      for (const target of nations) {
        if (this.diplomaticEvaluationSystem.evaluateAttitude(proposerId, target.id) !== 'hostile') continue;
        if (this.canRequestJointWar(proposerId, receiverId, target.id, 'request').ok) {
          return { proposerNationId: proposerId, receiverNationId: receiverId, targetNationId: target.id, kind: 'request', offerExploitationRights };
        }
      }
    }
    return null;
  }

  /**
   * A joint-war proposal targeting the proposer's capital holder, or null. The
   * kind follows whether the proposer already fights the holder (join) or not
   * (request), and receivers already opposing the holder are tried first.
   */
  private findReclaimJointWarProposal(
    proposerId: string,
    receivers: readonly string[],
  ): JointWarProposal | null {
    const holderId = this.getReclaimHolderId(proposerId);
    if (!holderId) return null;
    const kind: JointWarKind = this.diplomacyManager.getState(proposerId, holderId) === 'WAR'
      ? 'join'
      : 'request';

    const ordered = [...receivers].sort(
      (a, b) => Number(this.opposesHolder(b, holderId)) - Number(this.opposesHolder(a, holderId)),
    );
    for (const receiverId of ordered) {
      if (!this.canRequestJointWar(proposerId, receiverId, holderId, kind).ok) continue;
      return {
        proposerNationId: proposerId,
        receiverNationId: receiverId,
        targetNationId: holderId,
        kind,
        offerExploitationRights: this.shouldOfferExploitationRights(proposerId, receiverId),
      };
    }
    return null;
  }

  /** Whether `nationId` already opposes `holderId` (at war or hostile attitude). */
  private opposesHolder(nationId: string, holderId: string): boolean {
    return this.diplomacyManager.getState(nationId, holderId) === 'WAR'
      || this.diplomaticEvaluationSystem.evaluateAttitude(nationId, holderId) === 'hostile';
  }

  /**
   * Whether an AI proposer should sweeten a joint-war ask with exploitation rights
   * in its own territory: it has Colonialism, does not already grant the receiver
   * those rights, and the receiver actually values them (nonzero interest) so the
   * concession is not wasted. The proposer's own acquisition interest is
   * irrelevant here — this is about giving, not acquiring.
   */
  private shouldOfferExploitationRights(proposerId: string, receiverId: string): boolean {
    if (!this.diplomacyManager.canUseExploitationRights(proposerId)) return false;
    if (this.diplomacyManager.hasExploitationRights(receiverId, proposerId)) return false;
    return getLeaderExploitationInterestByNationId(receiverId) > 0;
  }

  private countActiveWars(nationId: string): number {
    let count = 0;
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) === 'WAR') count += 1;
    }
    return count;
  }
}
