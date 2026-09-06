import type { NationManager } from './NationManager';
import type { CityManager } from './CityManager';
import type { ResourceSystem } from './ResourceSystem';
import type { DiscoverySystem } from './DiscoverySystem';
import type { WorldCouncilResolutionSystem } from './WorldCouncilResolutionSystem';
import { selectAggressiveWarCondemnationTarget } from './WorldCouncilResolutionSystem';
import type { TurnStartEvent } from '../types/events';
import { isBarbarianNation } from '../data/barbarians';
import type {
  WorldCouncilContributionChoice,
  WorldCouncilEnactedResolution,
  WorldCouncilEmergencyTrigger,
  WorldCouncilMeeting,
  WorldCouncilMember,
  WorldCouncilOrganizationKind,
  WorldCouncilResolutionCandidateScore,
  WorldCouncilResolutionId,
  WorldCouncilResolutionProposal,
  WorldCouncilState,
} from '../types/worldCouncil';
import {
  WORLD_COUNCIL_CONSTRUCTION_TURNS,
  WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD,
  WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED,
  WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL,
  WORLD_COUNCIL_DIPLOMACY_SCORE_DEFENSE_DONATION_MAX,
  WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS,
} from '../types/worldCouncil';
import { getLeaderPersonalityByNationId } from '../data/leaders';

/** Signature for the optional Diplomatic Score audit logger. */
export type WorldCouncilLogger = (nationId: string, message: string) => void;

export interface WorldCouncilContributionOffer {
  readonly gold: number;
  readonly sciencePercent: number;
  readonly culturePercent: number;
}

export interface DiplomaticScoreBreakdown {
  readonly nationId: string;
  readonly total: number;
  /** Score from proposing resolutions that passed (primary source). */
  readonly proposalScore: number;
  /** Score from spending Influence to support resolutions that passed. */
  readonly supportScore: number;
  /** Small participation reward from genuine gold contributions. */
  readonly contributionScore: number;
  /** Legacy / uncategorised score (e.g. from pre-redesign saves). */
  readonly otherScore: number;
}

export interface FoundWorldCouncilOptions {
  readonly foundingCityId: string;
  readonly foundingNationId: string;
  readonly foundingTurn: number;
  readonly founderOffer: WorldCouncilContributionOffer;
  readonly organizationKind?: WorldCouncilOrganizationKind;
}

export type WorldCouncilChangedListener = () => void;
export type WorldCouncilCompletedListener = (state: WorldCouncilState) => void;
export type WorldCouncilMeetingListener = (meeting: WorldCouncilMeeting, state: WorldCouncilState) => void;
export type WorldCouncilResolutionExpiredListener = (
  resolution: WorldCouncilEnactedResolution,
  state: WorldCouncilState,
) => void;

export function isWorldCouncilVoteActive(
  state: Pick<WorldCouncilState, 'status' | 'nextRegularMeetingTurn' | 'meetings'> | null,
  currentRound: number,
): boolean {
  if (!state || state.status !== 'active') return false;
  if (state.nextRegularMeetingTurn === currentRound) return true;
  const latestMeeting = state.meetings[state.meetings.length - 1];
  return latestMeeting?.turn === currentRound && (latestMeeting.proposals?.length ?? 0) > 0;
}
export type WorldCouncilTradeResourceCategory = 'luxury' | 'strategic' | 'bonus' | 'manufactured' | 'unknown';

const MINIMUM_COUNCIL_SCIENCE_PERCENT = 1;
const MINIMUM_COUNCIL_CULTURE_PERCENT = 1;
const NON_STANDARD_WORLD_COUNCIL_NATION_IDS = new Set(['nation_pirate']);
const NUCLEAR_NON_PROLIFERATION_UNIT_IDS = new Set(['atomic_bomb', 'nuclear_missile']);
const NUCLEAR_NON_PROLIFERATION_BLOCK_REASON =
  'Production prohibited by the United Nations Nuclear Non-Proliferation Treaty.';
const RECENT_RESOLUTION_MEMORY_TURNS = 160;
const RECENT_RESOLUTION_PENALTY_PER_MEETING = 24;
const REPEAT_PROPOSER_MEMORY_TURNS = 240;
const REPEAT_PROPOSER_PENALTY_PER_MEETING = 34;
const DIVERSITY_BONUS_PER_UNUSED_KIND = 10;

export class WorldCouncilSystem {
  private state: WorldCouncilState | null = null;
  private readonly changedListeners: WorldCouncilChangedListener[] = [];
  private readonly completedListeners: WorldCouncilCompletedListener[] = [];
  private readonly meetingListeners: WorldCouncilMeetingListener[] = [];
  private readonly resolutionExpiredListeners: WorldCouncilResolutionExpiredListener[] = [];
  private hasSkippedInitialTurnStart = false;
  private lastProcessedCouncilRound = 0;
  /**
   * When set, a freshly created meeting's proposals are held unresolved so an
   * interactive human member can vote through the in-game Council Session UI.
   * The meeting resolves via {@link resolvePendingHumanVoteMeeting}. This is a
   * transient runtime flag, reconstructed from canonical state on {@link restore}.
   */
  private pendingHumanVoteMeetingId: number | null = null;
  private humanVotingDeferralEnabled?: () => boolean;
  /**
   * Diplomatic Score needed to win the Diplomatic Victory. Scenario-authored via
   * the Editor's Scenario Details; defaults to the built-in threshold and is set
   * from the resolved scenario/save value at game start.
   */
  private diplomacyScoreThreshold = WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD;

  /**
   * Provide a predicate that decides whether meetings with a human member should
   * defer proposal resolution for interactive voting (true for a normal
   * human-played game; false for autorun / AI-only, which resolves synchronously).
   */
  setHumanVotingDeferralEnabled(predicate: () => boolean): void {
    this.humanVotingDeferralEnabled = predicate;
  }

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly resolutionSystem?: WorldCouncilResolutionSystem,
    private readonly discoverySystem?: DiscoverySystem,
    private readonly log?: WorldCouncilLogger,
  ) {}

  hasCouncil(): boolean {
    return this.state !== null;
  }

  isActive(): boolean {
    return this.state?.status === 'active';
  }

  getOrganizationKind(): WorldCouncilOrganizationKind {
    return this.state?.organizationKind ?? 'worldCouncil';
  }

  getOrganizationName(): string {
    return getOrganizationName(this.getOrganizationKind());
  }

  getState(): WorldCouncilState | null {
    return this.state ? cloneState(this.state) : null;
  }

  getMembers(): WorldCouncilMember[] {
    return this.state?.members.map((member) => ({ ...member })) ?? [];
  }

  getDiplomaticScoreBreakdown(nationId: string): DiplomaticScoreBreakdown {
    const member = this.state?.members.find((entry) => entry.nationId === nationId);
    if (!member) {
      return {
        nationId,
        total: 0,
        proposalScore: 0,
        supportScore: 0,
        contributionScore: 0,
        otherScore: 0,
      };
    }
    return getDiplomaticScoreBreakdown(member);
  }

  getMaxGoldContributionForOffer(
    nationId: string,
    scienceContributionPercent: number,
    cultureContributionPercent: number,
  ): number {
    const resources = this.nationManager.getResources(nationId);
    const science = getScienceDiplomacyScoreGain(clampWhole(scienceContributionPercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100));
    const culture = getCultureDiplomacyScoreGain(clampWhole(cultureContributionPercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100));
    return clampWhole(getGoldForDiplomacyScore(science + culture), 0, resources.gold);
  }

  isMember(nationId: string): boolean {
    return this.state?.members.some((member) => member.nationId === nationId) ?? false;
  }

  canProposeResolution(nationId: string, resolutionId: WorldCouncilResolutionId): boolean {
    return this.state?.status === 'active'
      && this.isMember(nationId)
      && this.resolutionSystem?.isProposalEligible(resolutionId, nationId) === true;
  }

  /**
   * The Council member a Condemn Aggressive War proposal would target, derived
   * from the Council's own emergency-meeting (war-declared) history. Returns
   * undefined when there is no legitimate nation to condemn. This is the single
   * authoritative source used both to gate proposal generation and to bake the
   * target into the proposal the human votes on.
   */
  getAggressiveWarCondemnationTarget(proposerNationId: string | undefined): string | undefined {
    if (!this.state) return undefined;
    const emergencyMeetings = this.state.meetings.filter((meeting) => meeting.kind === 'emergency');
    return selectAggressiveWarCondemnationTarget(
      emergencyMeetings,
      this.state.members.map((member) => member.nationId),
      proposerNationId,
    );
  }

  getTradeAgreementCapacityBetweenNations(nationAId: string, nationBId: string): number {
    if (!this.state) return 0;
    if (
      this.getActiveTradeRestrictionForDeal(nationAId, nationBId, 'unknown')?.resolutionId === 'international_embargo'
    ) {
      return 0;
    }
    return this.state.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'global_free_trade_agreement'
      && isEnactedResolutionActive(resolution)
      && resolution.participantNationIds?.includes(nationAId) === true
      && resolution.participantNationIds.includes(nationBId))
      ? 1
      : 0;
  }

  hasWorldHeritageProtection(): boolean {
    return this.state?.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'protect_world_heritage'
      && isEnactedResolutionActive(resolution)) ?? false;
  }

  getUnitProductionRestrictionReason(nationId: string, unitTypeId: string): string | undefined {
    if (!this.state || this.state.organizationKind !== 'un') return undefined;
    if (!NUCLEAR_NON_PROLIFERATION_UNIT_IDS.has(unitTypeId)) return undefined;
    if (!this.isMember(nationId)) return undefined;
    const treatyActive = this.state.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'nuclear_non_proliferation_treaty'
      && isEnactedResolutionActive(resolution));
    return treatyActive ? NUCLEAR_NON_PROLIFERATION_BLOCK_REASON : undefined;
  }

  getActivePeacekeepingMissionForHost(hostNationId: string): WorldCouncilEnactedResolution | undefined {
    if (!this.state || this.state.organizationKind !== 'un') return undefined;
    return this.state.enactedResolutions.find((resolution) =>
      resolution.resolutionId === 'un_peacekeeping_mission'
      && resolution.targetNationId === hostNationId
      && resolution.secondaryTargetNationId !== undefined
      && isEnactedResolutionActive(resolution));
  }

  hasActivePeacekeepingMissionForHost(hostNationId: string): boolean {
    return this.getActivePeacekeepingMissionForHost(hostNationId) !== undefined;
  }

  canPeacekeeperEnterTerritory(unitOwnerNationId: string, territoryOwnerNationId: string, isMilitaryUnit: boolean): boolean {
    if (!isMilitaryUnit) return false;
    const mission = this.getActivePeacekeepingMissionForHost(territoryOwnerNationId);
    if (!mission) return false;
    return mission.participantNationIds?.includes(unitOwnerNationId) === true;
  }

  canResolvePeacekeepingCombat(attackerNationId: string, defenderNationId: string, tileOwnerNationId?: string): boolean {
    if (!tileOwnerNationId) return false;
    const mission = this.getActivePeacekeepingMissionForHost(tileOwnerNationId);
    if (!mission?.secondaryTargetNationId) return false;
    const threatNationId = mission.secondaryTargetNationId;
    const participants = mission.participantNationIds ?? [];
    return (
      participants.includes(attackerNationId) && defenderNationId === threatNationId
    ) || (
      attackerNationId === threatNationId && participants.includes(defenderNationId)
    );
  }

  getPeacekeepingDefensivePowerAgainst(
    attackerNationId: string,
    hostNationId: string,
    getMilitaryStrength: (nationId: string) => number,
  ): number {
    const mission = this.getActivePeacekeepingMissionForHost(hostNationId);
    if (!mission || mission.secondaryTargetNationId !== attackerNationId) return 0;
    return (mission.participantNationIds ?? [])
      .filter((participantNationId) => participantNationId !== attackerNationId && participantNationId !== hostNationId)
      .reduce((sum, participantNationId) => sum + getMilitaryStrength(participantNationId) * 0.65, 0);
  }

  getTradeRestrictionReason(
    sellerNationId: string,
    buyerNationId: string,
    resourceCategory: WorldCouncilTradeResourceCategory,
  ): string | undefined {
    const restriction = this.getActiveTradeRestrictionForDeal(sellerNationId, buyerNationId, resourceCategory);
    if (!restriction) return undefined;
    const targetName = this.nationManager.getNation(restriction.targetNationId ?? '')?.name
      ?? restriction.targetNationId
      ?? 'target nation';
    return restriction.resolutionId === 'international_embargo'
      ? `International Embargo against ${targetName} prohibits trade agreements.`
      : `Economic Sanctions against ${targetName} prohibit Luxury Resource trade.`;
  }

  getDiplomacyScoreThreshold(): number {
    return this.diplomacyScoreThreshold;
  }

  /**
   * Set the scenario-authored Diplomatic Victory score threshold. Invalid values
   * (non-finite or ≤ 0) are ignored so the built-in default is retained.
   */
  setDiplomacyScoreThreshold(value: number): void {
    if (Number.isFinite(value) && value > 0) {
      this.diplomacyScoreThreshold = Math.floor(value);
    }
  }

  /**
   * Small, bounded participation reward for genuinely donating gold to an
   * emergency Defense Support resolution. This is a one-time award per donation
   * (not passive per-turn accrual) and is capped so it stays secondary to
   * political success from proposing and supporting resolutions.
   */
  awardGoldContributionDiplomacyScore(nationId: string, gold: number): boolean {
    if (!this.state || gold <= 0) return false;
    const index = this.state.members.findIndex((member) => member.nationId === nationId);
    if (index < 0) return false;
    const member = this.state.members[index]!;
    const scoreGain = Math.min(
      getGoldDiplomacyScoreGain(gold),
      WORLD_COUNCIL_DIPLOMACY_SCORE_DEFENSE_DONATION_MAX,
    );
    if (scoreGain <= 0) return false;
    const members = this.state.members.map((entry, memberIndex) =>
      memberIndex === index
        ? {
            ...entry,
            diplomacyScore: entry.diplomacyScore + scoreGain,
            diplomacyScoreSinceLastRegularMeeting: entry.diplomacyScoreSinceLastRegularMeeting + scoreGain,
            diplomacyScoreFromGold: entry.diplomacyScoreFromGold + scoreGain,
          }
        : entry);
    this.state = {
      ...this.state,
      members,
    };
    this.logScoreAward(nationId, scoreGain, member.diplomacyScore + scoreGain,
      `donated ${gold} gold to a Defense Support resolution`);
    this.notifyChanged();
    return true;
  }

  hasPendingHumanContribution(nationId: string): boolean {
    return this.state?.pendingContributionNegotiation?.awaitingHumanNationId === nationId;
  }

  /**
   * Votes resolve during their scheduled Council round rather than through a
   * second phase timer. Derive the active window from the existing meeting
   * schedule and resolved meeting record so every nation turn in that round
   * observes the same state.
   */
  isVoteActive(currentRound: number): boolean {
    return isWorldCouncilVoteActive(this.state, currentRound);
  }

  submitHumanContribution(nationId: string, offer: WorldCouncilContributionOffer): boolean {
    if (!this.state?.pendingContributionNegotiation) return false;
    if (this.state.pendingContributionNegotiation.awaitingHumanNationId !== nationId) return false;
    const requestedSciencePercent = clampWhole(offer.sciencePercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100);
    const requestedCulturePercent = clampWhole(offer.culturePercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100);
    const maxGold = this.getMaxGoldContributionForOffer(
      nationId,
      requestedSciencePercent,
      requestedCulturePercent,
    );
    if (clampWhole(offer.gold, 0, Number.POSITIVE_INFINITY) > maxGold) return false;
    const choices = this.state.pendingContributionNegotiation.choices
      .filter((choice) => choice.nationId !== nationId);
    choices.push(this.makeContributionChoice(nationId, offer));
    this.finalizeContributionNegotiation(choices);
    this.notifyChanged();
    return true;
  }

  leaveCouncil(nationId: string): boolean {
    if (!this.state || !this.isMember(nationId)) return false;
    this.removeMember(nationId);
    this.notifyChanged();
    return true;
  }

  removeEliminatedNation(nationId: string): boolean {
    if (!this.state || !this.isMember(nationId)) return false;
    this.removeMember(nationId);
    this.notifyChanged();
    return true;
  }

  expirePeacekeepingMissionBecauseHostDeclaredWar(
    hostNationId: string,
    threatNationId: string,
  ): WorldCouncilEnactedResolution | undefined {
    return this.expirePeacekeepingMission((resolution) =>
      resolution.targetNationId === hostNationId
      && resolution.secondaryTargetNationId === threatNationId);
  }

  triggerEmergencyMeeting(turn: number, trigger: WorldCouncilEmergencyTrigger): WorldCouncilMeeting | null {
    if (!this.state) return null;
    this.pruneEliminatedMembers();
    if (this.state.status !== 'active' && !this.canCreateDefenseSupportEmergency(trigger)) return null;
    const meeting = this.createMeeting({
      kind: 'emergency',
      turn,
      emergencyTrigger: trigger,
    });
    this.notifyChanged();
    // A deferred meeting notifies only once it resolves after human voting.
    if (!this.isMeetingPendingHumanVote(meeting.id)) this.notifyMeeting(meeting);
    return { ...meeting, emergencyTrigger: meeting.emergencyTrigger ? { ...meeting.emergencyTrigger } : undefined };
  }

  private canCreateDefenseSupportEmergency(trigger: WorldCouncilEmergencyTrigger): boolean {
    if (trigger.eventType !== 'warDeclared') return false;
    const aggressorNationId = trigger.aggressorNationId;
    const targetNationId = trigger.targetNationId;
    return aggressorNationId !== undefined
      && targetNationId !== undefined
      && this.isMember(aggressorNationId)
      && this.isMember(targetNationId);
  }

  found(options: FoundWorldCouncilOptions): boolean {
    const organizationKind = options.organizationKind ?? 'worldCouncil';
    if (this.state !== null) {
      if (organizationKind !== 'un' || this.getOrganizationKind() === 'un') return false;
      return this.upgradeToUnitedNations(options);
    }
    const city = this.cityManager.getCity(options.foundingCityId);
    if (!city) return false;

    const members: WorldCouncilMember[] = [];
    const founderMember = this.applyContribution(options.foundingNationId, options.founderOffer);
    if (isMemberContribution(founderMember)) members.push(founderMember);

    for (const nation of this.nationManager.getAllNations()) {
      if (nation.id === options.foundingNationId) continue;
      if (!this.isEligibleForInvitation(nation.id, options.foundingNationId)) continue;
      const offer = this.chooseAIContribution(nation.id);
      if (!offer) continue;
      const member = this.applyContribution(nation.id, offer);
      if (isMemberContribution(member)) members.push(member);
    }

    this.state = {
      organizationKind,
      foundingCityId: city.id,
      foundingNationId: options.foundingNationId,
      foundingTurn: options.foundingTurn,
      constructionStartedTurn: options.foundingTurn,
      constructionTurnsRemaining: WORLD_COUNCIL_CONSTRUCTION_TURNS,
      status: 'construction',
      memberNationIds: members.map((member) => member.nationId),
      members,
      lastRegularMeetingTurn: options.foundingTurn,
      nextRegularMeetingTurn: options.foundingTurn + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS,
      meetings: [],
      nextMeetingId: 1,
      enactedResolutions: [],
    };
    this.notifyChanged();
    return true;
  }

  private upgradeToUnitedNations(options: FoundWorldCouncilOptions): boolean {
    if (!this.state) return false;
    const city = this.cityManager.getCity(options.foundingCityId);
    if (!city) return false;

    const byNationId = new Map(this.state.members.map((member) => [member.nationId, member]));
    const founderContribution = this.applyContribution(options.foundingNationId, options.founderOffer);
    const existingFounder = byNationId.get(options.foundingNationId);
    byNationId.set(options.foundingNationId, existingFounder
      ? this.enforceGoldContributionCap({
          ...existingFounder,
          goldContributed: existingFounder.goldContributed + founderContribution.goldContributed,
          scienceContributionPercent: Math.max(
            existingFounder.scienceContributionPercent,
            founderContribution.scienceContributionPercent,
          ),
          cultureContributionPercent: Math.max(
            existingFounder.cultureContributionPercent,
            founderContribution.cultureContributionPercent,
          ),
        })
      : founderContribution);

    for (const nation of this.nationManager.getAllNations()) {
      if (byNationId.has(nation.id)) continue;
      if (!this.isEligibleForInvitation(nation.id, options.foundingNationId)) continue;
      const offer = this.chooseAIContribution(nation.id);
      if (!offer) continue;
      const member = this.applyContribution(nation.id, offer);
      if (isMemberContribution(member)) byNationId.set(nation.id, member);
    }

    const members = Array.from(byNationId.values());
    this.state = {
      ...this.state,
      organizationKind: 'un',
      foundingCityId: city.id,
      foundingNationId: options.foundingNationId,
      foundingTurn: options.foundingTurn,
      constructionStartedTurn: options.foundingTurn,
      constructionTurnsRemaining: WORLD_COUNCIL_CONSTRUCTION_TURNS,
      status: 'construction',
      memberNationIds: members.map((member) => member.nationId),
      members,
      pendingContributionNegotiation: undefined,
    };
    this.notifyChanged();
    return true;
  }

  handleTurnStart(event: TurnStartEvent): void {
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }
    if (!this.state) return;

    const expiredResolutions = this.expireTimedResolutions(event.round);
    const membershipChanged = this.pruneEliminatedMembers();
    // Diplomatic Score is no longer accrued passively each turn. It is awarded
    // only from political outcomes at meetings (see awardMeetingPoliticalScores).
    const lifecycleChanged = this.advanceCouncilLifecycle(event.round);

    if (membershipChanged || lifecycleChanged || expiredResolutions.length > 0) {
      this.notifyChanged();
    }
    for (const resolution of expiredResolutions) this.notifyResolutionExpired(resolution);
  }

  restore(state: WorldCouncilState | undefined): void {
    this.state = state ? cloneState(normalizeState(state)) : null;
    this.hasSkippedInitialTurnStart = true;
    this.lastProcessedCouncilRound = this.state?.lastRegularMeetingTurn ?? 0;
    this.pruneEliminatedMembers();
    // Reconstruct a pending human-vote session from canonical state: a saved
    // meeting whose proposals are still unresolved means a human vote was pending
    // (AI-only meetings always resolve synchronously). Re-open it for the human.
    this.pendingHumanVoteMeetingId = null;
    const hasHumanMember = this.state?.members.some((member) =>
      this.nationManager.getNation(member.nationId)?.isHuman === true) ?? false;
    if (hasHumanMember) {
      const unresolved = this.state?.meetings.find((meeting) =>
        (meeting.proposals?.length ?? 0) > 0
        && meeting.proposals!.some((proposal) => proposal.resolved !== true));
      if (unresolved) this.pendingHumanVoteMeetingId = unresolved.id;
    }
    this.notifyChanged();
  }

  clear(): void {
    this.state = null;
    this.notifyChanged();
  }

  onChanged(listener: WorldCouncilChangedListener): void {
    this.changedListeners.push(listener);
  }

  onCompleted(listener: WorldCouncilCompletedListener): void {
    this.completedListeners.push(listener);
  }

  onMeeting(listener: WorldCouncilMeetingListener): void {
    this.meetingListeners.push(listener);
  }

  onResolutionExpired(listener: WorldCouncilResolutionExpiredListener): void {
    this.resolutionExpiredListeners.push(listener);
  }

  private chooseAIContribution(nationId: string): WorldCouncilContributionOffer | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return null;

    const resources = this.nationManager.getResources(nationId);
    const personality = getLeaderPersonalityByNationId(nationId);
    const commitment = this.getCouncilCommitment(nationId);
    const positiveCommitment = Math.max(0, commitment);
    const goldShare = clampNumber(
      0.03 + positiveCommitment / 650 + Math.max(0, personality.economyBias) / 1000,
      0.01,
      0.24,
    );
    const sciencePercent = clampWhole(
      4 + Math.round((personality.diplomacyBias + personality.economyBias + personality.peacePreference - personality.aggressionBias) / 16),
      MINIMUM_COUNCIL_SCIENCE_PERCENT,
      25,
    );
    const culturePercent = clampWhole(
      4 + Math.round((personality.diplomacyBias + personality.cultureBias + personality.peacePreference - personality.aggressionBias) / 16),
      MINIMUM_COUNCIL_CULTURE_PERCENT,
      25,
    );

    return {
      gold: Math.max(0, Math.floor(resources.gold * goldShare)),
      sciencePercent,
      culturePercent,
    };
  }

  private applyContribution(
    nationId: string,
    offer: WorldCouncilContributionOffer,
  ): WorldCouncilMember {
    const sciencePercent = clampWhole(offer.sciencePercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100);
    const culturePercent = clampWhole(offer.culturePercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100);
    const gold = clampWhole(
      offer.gold,
      0,
      this.getMaxGoldContributionForOffer(nationId, sciencePercent, culturePercent),
    );

    if (gold > 0) this.resourceSystem.addGold(nationId, -gold);

    return {
      nationId,
      goldContributed: gold,
      scienceContributionPercent: sciencePercent,
      cultureContributionPercent: culturePercent,
      diplomacyScore: 0,
      diplomacyScoreSinceLastRegularMeeting: 0,
      diplomacyScoreFromProposals: 0,
      diplomacyScoreFromSupport: 0,
      diplomacyScoreFromGold: 0,
      diplomacyScoreFromScience: 0,
      diplomacyScoreFromCulture: 0,
      diplomacyScoreFromOther: 0,
    };
  }

  /**
   * Awards Diplomatic Score from the political outcomes of a resolved meeting.
   * Only regular meetings score, so emergency/war meetings cannot be farmed.
   * Proposers of passed resolutions earn the largest reward; Influence-spending
   * supporters share a smaller pool by their commitment. Blocking earns nothing.
   */
  private awardMeetingPoliticalScores(meeting: WorldCouncilMeeting): boolean {
    if (!this.state) return false;
    const awards = computeMeetingPoliticalScoreAwards(meeting, this.state.memberNationIds);
    if (awards.length === 0) return false;
    const byNation = new Map(awards.map((award) => [award.nationId, award]));
    const members = this.state.members.map((member) => {
      const award = byNation.get(member.nationId);
      if (!award) return member;
      const totalGain = award.proposalScore + award.supportScore;
      if (totalGain <= 0) return member;
      return {
        ...member,
        diplomacyScore: member.diplomacyScore + totalGain,
        diplomacyScoreSinceLastRegularMeeting: member.diplomacyScoreSinceLastRegularMeeting + totalGain,
        diplomacyScoreFromProposals: member.diplomacyScoreFromProposals + award.proposalScore,
        diplomacyScoreFromSupport: member.diplomacyScoreFromSupport + award.supportScore,
      };
    });
    this.state = { ...this.state, members };

    const meetingLabel = `${this.getOrganizationName()} regular meeting`;
    for (const member of members) {
      const award = byNation.get(member.nationId);
      if (!award) continue;
      const totalGain = award.proposalScore + award.supportScore;
      if (totalGain <= 0) continue;
      const role = award.proposalScore > 0 ? 'proposer' : 'supporter';
      this.logScoreAward(member.nationId, totalGain, member.diplomacyScore,
        `${award.reasons.join('; ')} at ${meetingLabel} (${role})`);
    }
    return true;
  }

  private logScoreAward(nationId: string, gained: number, totalAfter: number, reason: string): void {
    if (!this.log || gained <= 0) return;
    const name = this.nationManager.getNation(nationId)?.name ?? nationId;
    this.log(
      nationId,
      `${name} gained ${Math.round(gained).toLocaleString()} Diplomatic Score: ${reason}. `
      + `Total: ${Math.round(totalAfter).toLocaleString()} / ${this.diplomacyScoreThreshold.toLocaleString()}.`,
    );
  }

  private advanceCouncilLifecycle(round: number): boolean {
    if (!this.state) return false;
    if (round <= this.state.foundingTurn) return false;
    if (round === this.lastProcessedCouncilRound) return false;
    this.lastProcessedCouncilRound = round;

    if (this.state.status === 'construction') {
      const remaining = Math.max(0, this.state.constructionTurnsRemaining - 1);
      const becameActive = remaining === 0;
      this.state = {
        ...this.state,
        constructionTurnsRemaining: remaining,
        status: becameActive ? 'active' : 'construction',
      };
      if (becameActive) this.notifyCompleted(this.state);
      return true;
    }

    const meeting = this.maybeCreateRegularMeeting(round);
    if (meeting) {
      // A deferred meeting notifies only once it resolves after human voting.
      if (!this.isMeetingPendingHumanVote(meeting.id)) this.notifyMeeting(meeting);
      return true;
    }
    return false;
  }

  private maybeCreateRegularMeeting(turn: number): WorldCouncilMeeting | null {
    if (!this.state || this.state.status !== 'active') return null;
    this.pruneEliminatedMembers();
    if (turn < this.state.nextRegularMeetingTurn) return null;

    const hostNationId = this.getRegularMeetingHostNationId();
    const meeting = this.createMeeting({ kind: 'regular', turn, hostNationId });
    const members = this.state.members.map((member) => ({
      ...member,
      diplomacyScoreSinceLastRegularMeeting: 0,
    }));
    const choices = members
      .filter((member) => this.nationManager.getNation(member.nationId)?.isHuman !== true)
      .map((member) => this.chooseAIRegularMeetingContribution(member.nationId));
    const humanMember = members.find((member) =>
      this.nationManager.getNation(member.nationId)?.isHuman === true);
    this.state = {
      ...this.state,
      members,
      memberNationIds: members.map((member) => member.nationId),
      lastRegularMeetingTurn: turn,
      nextRegularMeetingTurn: turn + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS,
      pendingContributionNegotiation: humanMember
        ? {
            meetingId: meeting.id,
            choices,
            awaitingHumanNationId: humanMember.nationId,
          }
        : undefined,
    };
    if (!humanMember) {
      this.finalizeContributionNegotiation(choices);
    }
    return meeting;
  }

  private getRegularMeetingHostNationId(): string | undefined {
    if (!this.state || this.state.members.length === 0) return undefined;
    return [...this.state.members].sort((a, b) =>
      b.diplomacyScoreSinceLastRegularMeeting - a.diplomacyScoreSinceLastRegularMeeting
      || b.diplomacyScore - a.diplomacyScore
      || a.nationId.localeCompare(b.nationId),
    )[0]?.nationId;
  }

  private createMeeting(options: {
    kind: 'regular' | 'emergency';
    turn: number;
    hostNationId?: string;
    emergencyTrigger?: WorldCouncilEmergencyTrigger;
  }): WorldCouncilMeeting {
    if (!this.state) throw new Error('Cannot create World Council meeting before the Council exists.');
    const proposals = this.resolutionSystem
      ? options.kind === 'regular'
        ? this.createRegularMeetingProposals(options.turn, options.hostNationId)
        : this.createEmergencyMeetingProposals(options.emergencyTrigger)
      : undefined;
    const meeting: WorldCouncilMeeting = {
      id: this.state.nextMeetingId,
      kind: options.kind,
      turn: options.turn,
      cityId: this.state.foundingCityId,
      hostNationId: options.hostNationId,
      emergencyTrigger: options.emergencyTrigger ? { ...options.emergencyTrigger } : undefined,
      proposals,
    };
    for (const proposal of proposals ?? []) {
      if (!proposal.proposerNationId || !proposal.targetNationId) continue;
      const proposerName = this.nationManager.getNation(proposal.proposerNationId)?.name ?? proposal.proposerNationId;
      const targetName = this.nationManager.getNation(proposal.targetNationId)?.name ?? proposal.targetNationId;
      if (proposal.resolutionId === 'games_of_nations_hosting') {
        this.log?.(proposal.proposerNationId,
          `${proposerName} proposed Games of Nations Hosting Resolution: replace ${targetName} with ${proposerName}.`);
      } else if (proposal.resolutionId === 'exclude_games_of_nations_participant') {
        this.log?.(proposal.proposerNationId,
          `${proposerName} proposed Games of Nations Participation Resolution targeting ${targetName}.`);
      }
    }
    this.state = {
      ...this.state,
      meetings: [...this.state.meetings, meeting],
      nextMeetingId: this.state.nextMeetingId + 1,
    };
    if (meeting.proposals && this.resolutionSystem) {
      const humanMemberId = this.state.members.find((member) =>
        this.nationManager.getNation(member.nationId)?.isHuman === true)?.nationId;
      // Only defer when the human actually casts a YES/NO + Influence vote on this
      // meeting. Donation-only / no-vote meetings (e.g. emergency Defense Support)
      // keep resolving synchronously and are not routed through the vote session.
      const hasHumanInfluenceVote = meeting.proposals.some((proposal) =>
        proposal.repealTargetEnactedResolutionId !== undefined
        || this.resolutionSystem!.getDefinition(proposal.resolutionId)?.votingType === 'influence');
      if (humanMemberId !== undefined && hasHumanInfluenceVote && this.humanVotingDeferralEnabled?.() === true) {
        // Hold resolution: an interactive human votes through the Council Session
        // UI, then GameScene calls resolvePendingHumanVoteMeeting() to finish.
        this.pendingHumanVoteMeetingId = meeting.id;
        return meeting;
      }
      return this.resolveMeetingProposals(meeting.id) ?? meeting;
    }
    return meeting;
  }

  /** True while a created meeting is waiting for interactive human voting. */
  isMeetingPendingHumanVote(meetingId: number): boolean {
    return this.pendingHumanVoteMeetingId === meetingId;
  }

  /** The meeting currently awaiting interactive human votes, if any. */
  getPendingHumanVoteMeeting(): WorldCouncilMeeting | null {
    if (this.pendingHumanVoteMeetingId === null) return null;
    return this.getState()?.meetings.find((meeting) => meeting.id === this.pendingHumanVoteMeetingId) ?? null;
  }

  /**
   * Preview which nation(s) a proposal in the pending human-vote meeting would
   * target, so the voting UI can show the human the specific countries a
   * resolution concerns (e.g. the two nations a Ceasefire Resolution would
   * separate). Read-only: it builds the same context the resolution uses but
   * never mutates state. Returns empty when nothing is pending or the proposal
   * has no meaningful target.
   */
  previewPendingProposalTargets(
    proposal: WorldCouncilResolutionProposal,
  ): { targetNationId?: string; secondaryTargetNationId?: string } {
    if (!this.state || !this.resolutionSystem) return {};
    const meeting = this.getPendingHumanVoteMeeting();
    if (!meeting) return {};
    const previousEmergencyMeetings = this.state.meetings.filter((item) =>
      item.id !== meeting.id && item.kind === 'emergency');
    return this.resolutionSystem.previewProposalTargets(proposal, {
      meeting,
      turn: meeting.turn,
      members: this.state.members,
      previousEmergencyMeetings,
      nextRegularMeetingTurn: meeting.kind === 'regular'
        ? meeting.turn + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS
        : this.state.nextRegularMeetingTurn,
    });
  }

  /**
   * Resolve the pending human-vote meeting through the canonical resolution path
   * (the human's collected votes are read back through the existing
   * requestHumanInfluenceVote boundary). Returns the resolved meeting.
   */
  resolvePendingHumanVoteMeeting(): WorldCouncilMeeting | null {
    const meetingId = this.pendingHumanVoteMeetingId;
    if (meetingId === null) return null;
    this.pendingHumanVoteMeetingId = null;
    const resolved = this.resolveMeetingProposals(meetingId);
    this.notifyChanged();
    if (resolved) this.notifyMeeting(resolved);
    return this.getState()?.meetings.find((meeting) => meeting.id === meetingId) ?? null;
  }

  private createEmergencyMeetingProposals(
    emergencyTrigger: WorldCouncilEmergencyTrigger | undefined,
  ): WorldCouncilResolutionProposal[] | undefined {
    if (!emergencyTrigger || emergencyTrigger.eventType !== 'warDeclared') return undefined;
    const aggressorNationId = emergencyTrigger.aggressorNationId;
    const targetNationId = emergencyTrigger.targetNationId;
    if (!aggressorNationId || !targetNationId) return undefined;
    if (!this.isMember(aggressorNationId) || !this.isMember(targetNationId)) return undefined;
    return [{
      slot: 'host',
      resolutionId: 'defense_support',
      proposerNationId: targetNationId,
      targetNationId,
      secondaryTargetNationId: aggressorNationId,
    }];
  }

  private createRegularMeetingProposals(turn: number, hostNationId: string | undefined): WorldCouncilResolutionProposal[] | undefined {
    if (!this.resolutionSystem || !this.state) return undefined;
    const seed = stableMeetingSeed(turn, this.state.nextMeetingId, hostNationId);
    const hostProposal = this.chooseRegularProposal('host', seed, hostNationId);
    const randomProposal = this.chooseRegularProposal('random', seed + 1, undefined, hostProposal.resolutionId);
    return [hostProposal, randomProposal];
  }

  private chooseRegularProposal(
    slot: 'host' | 'random',
    seed: number,
    proposerNationId?: string,
    excludedResolutionId?: WorldCouncilResolutionId,
  ): WorldCouncilResolutionProposal {
    if (!this.resolutionSystem || !this.state) {
      return {
        slot,
        proposerNationId,
        resolutionId: 'shared_cartography',
      };
    }

    const repealTargets = this.getRepealableResolutions();
    const normalProposals = this.resolutionSystem.getEligibleDefinitions(this.getOrganizationKind(), proposerNationId)
      .filter((definition) => definition.votingType !== 'special')
      .filter((definition) => definition.id !== excludedResolutionId)
      .filter((definition) => slot === 'host' || definition.id !== 'un_peacekeeping_mission')
      .map((definition) => ({
        slot,
        proposerNationId,
        resolutionId: definition.id,
      }));
    const candidates: WorldCouncilResolutionProposal[] = [];
    for (const proposal of normalProposals) {
      if (!this.hasActiveRepealableResolution(proposal.resolutionId)) {
        candidates.push(proposal);
      }
    }
    for (const target of repealTargets) {
      if (target.resolutionId === excludedResolutionId) continue;
      candidates.push({
        slot,
        proposerNationId,
        resolutionId: target.resolutionId,
        repealTargetEnactedResolutionId: target.id,
        repealTargetResolutionId: target.resolutionId,
      });
    }
    if (candidates.length === 0) {
      const fallback = slot === 'host'
        ? this.resolutionSystem.chooseHostProposal(proposerNationId, this.getOrganizationKind())
        : this.resolutionSystem.chooseRandomProposal(seed, excludedResolutionId, this.getOrganizationKind());
      candidates.push(fallback);
    }
    return this.chooseScoredRegularProposal(candidates, slot, seed, proposerNationId);
  }

  private chooseScoredRegularProposal(
    candidates: readonly WorldCouncilResolutionProposal[],
    slot: 'host' | 'random',
    seed: number,
    proposerNationId: string | undefined,
  ): WorldCouncilResolutionProposal {
    const scored = candidates.map((proposal) =>
      this.scoreRegularProposalCandidate(proposal, slot, seed, proposerNationId));
    const selected = [...scored].sort((a, b) =>
      b.score.finalScore - a.score.finalScore
      || stableResolutionTieBreak(seed, a.proposal.resolutionId, a.proposal.repealTargetEnactedResolutionId)
        - stableResolutionTieBreak(seed, b.proposal.resolutionId, b.proposal.repealTargetEnactedResolutionId))[0]!;
    return this.resolutionSystem!.prepareProposal({
      ...selected.proposal,
      selectionDiagnostics: {
        selectedResolutionId: selected.proposal.resolutionId,
        selectedRepealTargetEnactedResolutionId: selected.proposal.repealTargetEnactedResolutionId,
        candidates: scored
          .map((entry) => entry.score)
          .sort((a, b) => b.finalScore - a.finalScore || a.resolutionId.localeCompare(b.resolutionId)),
      },
    }, seed);
  }

  private scoreRegularProposalCandidate(
    proposal: WorldCouncilResolutionProposal,
    slot: 'host' | 'random',
    seed: number,
    proposerNationId: string | undefined,
  ): { proposal: WorldCouncilResolutionProposal; score: WorldCouncilResolutionCandidateScore } {
    const baseScore = this.getRegularProposalBaseScore(proposal, slot, seed, proposerNationId);
    const recentPenalty = this.getRecentResolutionPenalty(proposal.resolutionId);
    const repeatProposerPenalty = proposerNationId
      ? this.getRepeatProposerResolutionPenalty(proposerNationId, proposal.resolutionId)
      : 0;
    const diversityBonus = this.getResolutionDiversityBonus(proposal.resolutionId);
    const finalScore = baseScore - recentPenalty - repeatProposerPenalty + diversityBonus;
    const reasons = [`base ${Math.round(baseScore)}`];
    if (recentPenalty > 0) reasons.push(`recent -${Math.round(recentPenalty)}`);
    if (repeatProposerPenalty > 0) reasons.push(`same proposer -${Math.round(repeatProposerPenalty)}`);
    if (diversityBonus > 0) reasons.push(`diversity +${Math.round(diversityBonus)}`);
    if (proposal.repealTargetEnactedResolutionId) reasons.push('repeal candidate');
    return {
      proposal,
      score: {
        resolutionId: proposal.resolutionId,
        repealTargetEnactedResolutionId: proposal.repealTargetEnactedResolutionId,
        baseScore: Math.round(baseScore),
        recentPenalty: Math.round(recentPenalty),
        repeatProposerPenalty: Math.round(repeatProposerPenalty),
        diversityBonus: Math.round(diversityBonus),
        finalScore: Math.round(finalScore),
        reason: reasons.join(', '),
      },
    };
  }

  private getRegularProposalBaseScore(
    proposal: WorldCouncilResolutionProposal,
    slot: 'host' | 'random',
    seed: number,
    proposerNationId: string | undefined,
  ): number {
    if (proposal.repealTargetEnactedResolutionId) return 70;
    const organizationKind = this.getOrganizationKind();
    const hostPreferred = proposerNationId
      ? this.resolutionSystem?.chooseHostProposal(proposerNationId, organizationKind).resolutionId
      : undefined;
    const randomPreferred = this.resolutionSystem?.chooseRandomProposal(seed, undefined, organizationKind).resolutionId;
    let score = slot === 'host' && proposal.resolutionId === hostPreferred ? 104 : 76;
    if (slot === 'random' && proposal.resolutionId === randomPreferred) score += 18;
    score += stableResolutionTieBreak(seed, proposal.resolutionId) / 10;

    const recentEmergencyPressure = this.getRecentEmergencyPressure(proposerNationId);
    if (proposal.resolutionId === 'un_peacekeeping_mission') score += recentEmergencyPressure;
    if (proposal.resolutionId === 'ceasefire_resolution') score += Math.max(0, recentEmergencyPressure - 10);
    if (proposal.resolutionId === 'condemn_aggressive_war') score += Math.max(0, recentEmergencyPressure - 18);
    if (proposal.resolutionId === 'shared_cartography' && this.hasResolutionEverPassed('shared_cartography')) score -= 35;
    if (proposal.resolutionId === 'global_infrastructure_initiative') score += 8;
    if (proposal.resolutionId === 'games_of_nations_hosting') score += 8;
    if (proposal.resolutionId === 'exclude_games_of_nations_participant') score += 6;
    if (proposal.resolutionId === 'international_development_fund') score += 6;
    if (proposal.resolutionId === 'climate_accord') score += 4;
    return score;
  }

  private getRecentEmergencyPressure(proposerNationId: string | undefined): number {
    if (!this.state) return 0;
    const lastRegularTurn = this.state.lastRegularMeetingTurn;
    return this.state.meetings
      .filter((meeting) => meeting.kind === 'emergency' && lastRegularTurn - meeting.turn <= 120)
      .reduce((score, meeting) => {
        const trigger = meeting.emergencyTrigger;
        if (!trigger) return score;
        const proposerInvolved = proposerNationId
          && (trigger.aggressorNationId === proposerNationId || trigger.targetNationId === proposerNationId);
        return score + (proposerInvolved ? 34 : 16);
      }, 0);
  }

  private getRecentResolutionPenalty(resolutionId: WorldCouncilResolutionId): number {
    if (!this.state) return 0;
    return this.state.meetings.reduce((penalty, meeting) => {
      const age = this.state!.lastRegularMeetingTurn - meeting.turn;
      if (age < 0 || age > RECENT_RESOLUTION_MEMORY_TURNS) return penalty;
      const count = meeting.proposals?.filter((proposal) => proposal.resolutionId === resolutionId).length ?? 0;
      const ageFactor = 1 - age / RECENT_RESOLUTION_MEMORY_TURNS;
      return penalty + count * RECENT_RESOLUTION_PENALTY_PER_MEETING * ageFactor;
    }, 0);
  }

  private getRepeatProposerResolutionPenalty(
    proposerNationId: string,
    resolutionId: WorldCouncilResolutionId,
  ): number {
    if (!this.state) return 0;
    return this.state.meetings.reduce((penalty, meeting) => {
      const age = this.state!.lastRegularMeetingTurn - meeting.turn;
      if (age < 0 || age > REPEAT_PROPOSER_MEMORY_TURNS) return penalty;
      const count = meeting.proposals?.filter((proposal) =>
        proposal.proposerNationId === proposerNationId && proposal.resolutionId === resolutionId).length ?? 0;
      const ageFactor = 1 - age / REPEAT_PROPOSER_MEMORY_TURNS;
      return penalty + count * REPEAT_PROPOSER_PENALTY_PER_MEETING * ageFactor;
    }, 0);
  }

  private getResolutionDiversityBonus(resolutionId: WorldCouncilResolutionId): number {
    if (!this.state) return 0;
    const recentKinds = new Set(
      this.state.meetings
        .filter((meeting) => this.state!.lastRegularMeetingTurn - meeting.turn <= RECENT_RESOLUTION_MEMORY_TURNS)
        .flatMap((meeting) => meeting.proposals ?? [])
        .map((proposal) => getResolutionKind(proposal.resolutionId)),
    );
    return recentKinds.has(getResolutionKind(resolutionId)) ? 0 : DIVERSITY_BONUS_PER_UNUSED_KIND;
  }

  private hasResolutionEverPassed(resolutionId: WorldCouncilResolutionId): boolean {
    return this.state?.meetings.some((meeting) =>
      meeting.proposals?.some((proposal) => proposal.resolutionId === resolutionId && proposal.passed === true)) ?? false;
  }

  private resolveMeetingProposals(meetingId: number): WorldCouncilMeeting | null {
    if (!this.state || !this.resolutionSystem) return null;
    const meeting = this.state.meetings.find((item) => item.id === meetingId);
    if (!meeting?.proposals) return meeting ?? null;
    const previousEmergencyMeetings = this.state.meetings.filter((item) =>
      item.id !== meetingId && item.kind === 'emergency');
    const resolved = meeting.proposals.map((proposal) =>
      this.resolutionSystem!.resolve(proposal, {
        meeting,
        turn: meeting.turn,
        members: this.state!.members,
        previousEmergencyMeetings,
        nextRegularMeetingTurn: meeting.kind === 'regular'
          ? meeting.turn + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS
          : this.state!.nextRegularMeetingTurn,
      }));
    const proposals = resolved.map((result) => result.proposal);
    const enacted = resolved
      .map((result) => result.enacted)
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const meetings = this.state.meetings.map((item) =>
      item.id === meetingId ? { ...item, proposals } : item);
    const repealedIds = new Set(
      proposals
        .filter((proposal) => proposal.passed === true && proposal.repealTargetEnactedResolutionId)
        .map((proposal) => proposal.repealTargetEnactedResolutionId!),
    );
    const enactedResolutions = this.state.enactedResolutions.map((resolution) =>
      repealedIds.has(resolution.id)
        ? {
            ...resolution,
            active: false,
            repealed: true,
            repealTurn: meeting.turn,
            repealMeetingId: meetingId,
          }
        : resolution);
    this.state = {
      ...this.state,
      meetings,
      enactedResolutions: [...enactedResolutions, ...enacted],
    };
    for (const proposal of proposals) {
      if (proposal.resolutionId === 'games_of_nations_hosting') {
        const currentHostName = proposal.targetNationId
          ? this.nationManager.getNation(proposal.targetNationId)?.name ?? proposal.targetNationId
          : 'the current host';
        this.log?.(proposal.proposerNationId ?? proposal.targetNationId ?? '', proposal.passed
          ? 'Games of Nations Hosting Resolution PASSED.'
          : `Games of Nations Hosting Resolution REJECTED; ${currentHostName} remains host.`);
      }
      if (proposal.resolutionId === 'exclude_games_of_nations_participant') {
        const targetName = proposal.targetNationId
          ? this.nationManager.getNation(proposal.targetNationId)?.name ?? proposal.targetNationId
          : 'the targeted nation';
        this.log?.(proposal.proposerNationId ?? proposal.targetNationId ?? '', proposal.passed
          ? `GoN Participation Resolution PASSED: ${targetName} excluded from Games #${proposal.gamesNumber ?? '?'}.`
          : `GoN Participation Resolution REJECTED: ${targetName} remains eligible for Games #${proposal.gamesNumber ?? '?'}.`);
      }
      if (proposal.repealTargetEnactedResolutionId) continue;
      this.resolutionSystem.execute(proposal, {
        meetingId,
        turn: meeting.turn,
        proposerNationId: proposal.proposerNationId,
        memberNationIds: this.state.memberNationIds,
        participantNationIds: proposal.participantNationIds,
        targetNationId: proposal.targetNationId,
        secondaryTargetNationId: proposal.secondaryTargetNationId,
        gamesNumber: proposal.gamesNumber,
        gamesParticipationJustification: proposal.gamesParticipationJustification,
      });
    }
    const resolvedMeeting = this.state.meetings.find((item) => item.id === meetingId);
    if (resolvedMeeting) this.awardMeetingPoliticalScores(resolvedMeeting);
    return this.state.meetings.find((item) => item.id === meetingId) ?? null;
  }

  private getRepealableResolutions(): WorldCouncilEnactedResolution[] {
    if (!this.state || !this.resolutionSystem) return [];
    return this.state.enactedResolutions.filter((resolution) =>
      isEnactedResolutionActive(resolution)
      && resolution.meetingKind === 'regular'
      && this.resolutionSystem?.supportsRepeal(resolution.resolutionId) === true);
  }

  private hasActiveRepealableResolution(resolutionId: WorldCouncilResolutionId): boolean {
    if (!this.resolutionSystem?.supportsRepeal(resolutionId)) return false;
    return this.getRepealableResolutions().some((resolution) => resolution.resolutionId === resolutionId);
  }

  private getActiveTradeRestrictionForDeal(
    sellerNationId: string,
    buyerNationId: string,
    resourceCategory: WorldCouncilTradeResourceCategory,
  ): WorldCouncilEnactedResolution | undefined {
    if (!this.state) return undefined;
    return this.state.enactedResolutions.find((resolution) => {
      if (!isEnactedResolutionActive(resolution)) return false;
      if (
        resolution.resolutionId !== 'international_sanctions'
        && resolution.resolutionId !== 'international_embargo'
      ) {
        return false;
      }
      if (!resolution.targetNationId) return false;
      if (resolution.targetNationId !== sellerNationId && resolution.targetNationId !== buyerNationId) return false;
      return resolution.resolutionId === 'international_embargo' || resourceCategory === 'luxury';
    });
  }

  private expireTimedResolutions(turn: number): WorldCouncilEnactedResolution[] {
    if (!this.state) return [];
    const expired: WorldCouncilEnactedResolution[] = [];
    const enactedResolutions = this.state.enactedResolutions.map((resolution) => {
      if (
        !isEnactedResolutionActive(resolution)
        || resolution.expirationTurn === undefined
        || turn < resolution.expirationTurn
      ) {
        return resolution;
      }
      const updated = {
        ...resolution,
        active: false,
        expired: true,
      };
      expired.push(updated);
      return updated;
    });
    if (expired.length === 0) return [];
    this.state = {
      ...this.state,
      enactedResolutions,
    };
    return expired;
  }

  private expirePeacekeepingMission(
    predicate: (resolution: WorldCouncilEnactedResolution) => boolean,
  ): WorldCouncilEnactedResolution | undefined {
    if (!this.state) return undefined;
    let expired: WorldCouncilEnactedResolution | undefined;
    const enactedResolutions = this.state.enactedResolutions.map((resolution) => {
      if (
        expired !== undefined
        || resolution.resolutionId !== 'un_peacekeeping_mission'
        || !isEnactedResolutionActive(resolution)
        || !predicate(resolution)
      ) {
        return resolution;
      }
      expired = {
        ...resolution,
        active: false,
        expired: true,
      };
      return expired;
    });
    if (!expired) return undefined;
    this.state = {
      ...this.state,
      enactedResolutions,
    };
    this.notifyChanged();
    return { ...expired, participantNationIds: expired.participantNationIds ? [...expired.participantNationIds] : undefined };
  }

  private finalizeContributionNegotiation(choices: WorldCouncilContributionChoice[]): void {
    if (!this.state) return;
    const byNation = new Map(choices.map((choice) => [choice.nationId, choice]));
    const members: WorldCouncilMember[] = [];
    for (const member of this.state.members) {
      const choice = byNation.get(member.nationId);
      if (!choice) {
        members.push(member);
        continue;
      }
      const contribution = this.enforceGoldContributionCap(this.enforceMinimumContribution(choice));
      members.push({
        ...member,
        goldContributed: contribution.goldContributed,
        scienceContributionPercent: contribution.scienceContributionPercent,
        cultureContributionPercent: contribution.cultureContributionPercent,
      });
    }
    this.state = {
      ...this.state,
      members,
      memberNationIds: members.map((member) => member.nationId),
      pendingContributionNegotiation: undefined,
    };
  }

  private chooseAIRegularMeetingContribution(nationId: string): WorldCouncilContributionChoice {
    const resources = this.nationManager.getResources(nationId);
    const personality = getLeaderPersonalityByNationId(nationId);
    const commitment = this.getCouncilCommitment(nationId);
    const embargoPressure = this.isNationEmbargoed(nationId) ? 10 : 0;

    const goldShare = clampNumber(0.04 + (commitment - embargoPressure) / 600, 0, 0.22);
    const sciencePercent = clampWhole(
      5 + Math.round((commitment + personality.economyBias - embargoPressure) / 16),
      MINIMUM_COUNCIL_SCIENCE_PERCENT,
      22,
    );
    const culturePercent = clampWhole(
      5 + Math.round((commitment + personality.cultureBias - embargoPressure) / 16),
      MINIMUM_COUNCIL_CULTURE_PERCENT,
      22,
    );
    return {
      nationId,
      goldContributed: clampWhole(
        resources.gold * goldShare,
        0,
        this.getMaxGoldContributionForOffer(nationId, sciencePercent, culturePercent),
      ),
      scienceContributionPercent: sciencePercent,
      cultureContributionPercent: culturePercent,
    };
  }

  private makeContributionChoice(
    nationId: string,
    offer: WorldCouncilContributionOffer,
  ): WorldCouncilContributionChoice {
    const resources = this.nationManager.getResources(nationId);
    return this.enforceGoldContributionCap(this.enforceMinimumContribution({
      nationId,
      goldContributed: clampWhole(offer.gold, 0, resources.gold),
      scienceContributionPercent: clampWhole(offer.sciencePercent, 0, 100),
      cultureContributionPercent: clampWhole(offer.culturePercent, 0, 100),
    }));
  }

  private enforceMinimumContribution(choice: WorldCouncilContributionChoice): WorldCouncilContributionChoice {
    return {
      ...choice,
      scienceContributionPercent: clampWhole(choice.scienceContributionPercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100),
      cultureContributionPercent: clampWhole(choice.cultureContributionPercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100),
    };
  }

  private enforceGoldContributionCap<T extends WorldCouncilContributionChoice | WorldCouncilMember>(choice: T): T {
    const maxGold = this.getMaxGoldContributionForOffer(
      choice.nationId,
      choice.scienceContributionPercent,
      choice.cultureContributionPercent,
    );
    return {
      ...choice,
      goldContributed: clampWhole(choice.goldContributed, 0, maxGold),
    };
  }

  private isEligibleForInvitation(nationId: string, foundingNationId: string): boolean {
    if (nationId === foundingNationId) return true;
    if (isBarbarianNation(nationId)) return false;
    if (NON_STANDARD_WORLD_COUNCIL_NATION_IDS.has(nationId)) return false;
    if (this.discoverySystem && !this.discoverySystem.hasMet(foundingNationId, nationId)) return false;
    return true;
  }

  private removeMember(nationId: string): void {
    if (!this.state) return;
    const members = this.state.members.filter((member) => member.nationId !== nationId);
    const wasAwaitingContribution = this.state.pendingContributionNegotiation?.awaitingHumanNationId === nationId;
    const pending = this.state.pendingContributionNegotiation
      ? {
          ...this.state.pendingContributionNegotiation,
          choices: this.state.pendingContributionNegotiation.choices
            .filter((choice) => choice.nationId !== nationId),
          awaitingHumanNationId: this.state.pendingContributionNegotiation.awaitingHumanNationId === nationId
            ? undefined
            : this.state.pendingContributionNegotiation.awaitingHumanNationId,
        }
      : undefined;
    this.state = {
      ...this.state,
      members,
      memberNationIds: members.map((member) => member.nationId),
      pendingContributionNegotiation: pending?.awaitingHumanNationId || pending?.choices.length
        ? pending
        : undefined,
      enactedResolutions: this.state.enactedResolutions.map((resolution) => {
        if (
          resolution.resolutionId === 'un_peacekeeping_mission'
          && isEnactedResolutionActive(resolution)
          && (resolution.targetNationId === nationId || resolution.secondaryTargetNationId === nationId)
        ) {
          return {
            ...resolution,
            active: false,
            expired: true,
            participantNationIds: resolution.participantNationIds
              ? resolution.participantNationIds.filter((participantNationId) => participantNationId !== nationId)
              : undefined,
          };
        }
        return {
          ...resolution,
          participantNationIds: resolution.participantNationIds
            ? resolution.participantNationIds.filter((participantNationId) => participantNationId !== nationId)
            : undefined,
          targetNationId: resolution.targetNationId === nationId ? undefined : resolution.targetNationId,
          secondaryTargetNationId: resolution.secondaryTargetNationId === nationId ? undefined : resolution.secondaryTargetNationId,
        };
      }),
    };
    if (wasAwaitingContribution && pending) {
      this.finalizeContributionNegotiation(pending.choices);
    }
  }

  private pruneEliminatedMembers(): boolean {
    if (!this.state) return false;
    const eliminatedMemberIds = this.state.members
      .filter((member) => !this.nationManager.getNation(member.nationId))
      .map((member) => member.nationId);
    if (eliminatedMemberIds.length === 0) return false;
    for (const nationId of eliminatedMemberIds) this.removeMember(nationId);
    return true;
  }

  private getCouncilCommitment(nationId: string): number {
    const nation = this.nationManager.getNation(nationId);
    const resources = this.nationManager.getResources(nationId);
    const personality = getLeaderPersonalityByNationId(nationId);
    const goals = nation?.aiGoals ?? [];
    const isDefensive = goals.some((goal) => goal.type === 'defend');
    const isPreparingWar = goals.some((goal) => goal.type === 'prepare_war');
    const wantsEconomy = goals.some((goal) => goal.type === 'build_economy');
    const wantsHappiness = goals.some((goal) => goal.type === 'recover_happiness');
    const wantsDiplomacy = personality.diplomacyBias + personality.peacePreference - personality.aggressionBias;
    const economyPressure = (resources.goldPerTurn < 0 ? 20 : 0)
      + (resources.gold < 100 ? 15 : 0)
      + (wantsEconomy ? 15 : 0)
      + (wantsHappiness ? 8 : 0);
    const warPressure = (isDefensive ? 18 : 0) + (isPreparingWar ? 12 : 0) + Math.max(0, personality.warTolerance - 50) / 3;
    return wantsDiplomacy + personality.economyBias + personality.cultureBias - economyPressure - warPressure;
  }

  private isNationEmbargoed(nationId: string): boolean {
    return this.state?.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'international_embargo'
      && resolution.targetNationId === nationId
      && isEnactedResolutionActive(resolution)) ?? false;
  }

  private notifyChanged(): void {
    for (const listener of this.changedListeners) listener();
  }

  private notifyCompleted(state: WorldCouncilState): void {
    const copy = cloneState(state);
    for (const listener of this.completedListeners) listener(copy);
  }

  private notifyMeeting(meeting: WorldCouncilMeeting): void {
    if (!this.state) return;
    const meetingCopy = {
      ...meeting,
      emergencyTrigger: meeting.emergencyTrigger ? { ...meeting.emergencyTrigger } : undefined,
      proposals: meeting.proposals?.map((proposal) => ({
        ...proposal,
        participantNationIds: proposal.participantNationIds ? [...proposal.participantNationIds] : undefined,
        donations: proposal.donations?.map((donation) => ({ ...donation })),
        distributions: proposal.distributions?.map((distribution) => ({ ...distribution })),
        votes: proposal.votes?.map((vote) => ({ ...vote })),
      })),
    };
    const stateCopy = cloneState(this.state);
    for (const listener of this.meetingListeners) listener(meetingCopy, stateCopy);
  }

  private notifyResolutionExpired(resolution: WorldCouncilEnactedResolution): void {
    if (!this.state) return;
    const resolutionCopy = {
      ...resolution,
      participantNationIds: resolution.participantNationIds ? [...resolution.participantNationIds] : undefined,
    };
    const stateCopy = cloneState(this.state);
    for (const listener of this.resolutionExpiredListeners) listener(resolutionCopy, stateCopy);
  }
}

function isMemberContribution(member: WorldCouncilMember): boolean {
  return member.goldContributed > 0
    || member.scienceContributionPercent > 0
    || member.cultureContributionPercent > 0;
}

// The following gold helpers remain solely to bound gold contributions via the
// existing contribution cap (getMaxGoldContributionForOffer). They no longer
// drive any passive per-turn Diplomatic Score.
function getGoldDiplomacyScoreGain(gold: number): number {
  return gold / 500;
}

function getScienceDiplomacyScoreGain(scienceContributionPercent: number): number {
  return scienceContributionPercent * 0.72;
}

function getCultureDiplomacyScoreGain(cultureContributionPercent: number): number {
  return cultureContributionPercent * 0.72;
}

function getGoldForDiplomacyScore(score: number): number {
  return Math.floor(score * 500);
}

function formatResolutionLabel(resolutionId: string): string {
  return resolutionId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** One nation's Diplomatic Score award from a single resolved meeting. */
export interface MeetingPoliticalScoreAward {
  readonly nationId: string;
  readonly proposalScore: number;
  readonly supportScore: number;
  readonly reasons: readonly string[];
}

/**
 * Pure computation of Diplomatic Score awards from a resolved meeting. Reads
 * only the meeting's proposals (proposer + passed flag + Influence votes) and
 * the current membership. It never reads contribution percentages, so leader
 * personality cannot create score here — only political success does. Emergency
 * meetings score nothing to prevent war-driven farming.
 */
export function computeMeetingPoliticalScoreAwards(
  meeting: Pick<WorldCouncilMeeting, 'kind' | 'proposals'>,
  memberNationIds: readonly string[],
): MeetingPoliticalScoreAward[] {
  if (meeting.kind !== 'regular' || !meeting.proposals) return [];
  const memberIds = new Set(memberNationIds);
  const awards = new Map<string, { proposal: number; support: number; reasons: string[] }>();
  const add = (nationId: string, kind: 'proposal' | 'support', amount: number, reason: string): void => {
    if (amount <= 0 || !memberIds.has(nationId)) return;
    const entry = awards.get(nationId) ?? { proposal: 0, support: 0, reasons: [] };
    entry[kind] += amount;
    entry.reasons.push(reason);
    awards.set(nationId, entry);
  };

  for (const proposal of meeting.proposals) {
    if (proposal.passed !== true) continue;
    const resolutionLabel = formatResolutionLabel(proposal.resolutionId);

    if (proposal.proposerNationId) {
      add(proposal.proposerNationId, 'proposal', WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED,
        `proposed ${resolutionLabel} passed`);
    }

    const supporters = (proposal.votes ?? []).filter((vote) =>
      vote.support
      && vote.influence > 0
      && vote.nationId !== proposal.proposerNationId
      && memberIds.has(vote.nationId));
    const totalSupportInfluence = supporters.reduce((sum, vote) => sum + vote.influence, 0);
    if (totalSupportInfluence > 0) {
      for (const vote of supporters) {
        const share = WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL * (vote.influence / totalSupportInfluence);
        add(vote.nationId, 'support', share, `backed ${resolutionLabel} with ${vote.influence} Influence`);
      }
    }
  }

  return [...awards.entries()].map(([nationId, entry]) => ({
    nationId,
    proposalScore: Math.round(entry.proposal),
    supportScore: Math.round(entry.support),
    reasons: entry.reasons,
  }));
}

export function getDiplomaticScoreBreakdown(member: WorldCouncilMember): DiplomaticScoreBreakdown {
  const proposalScore = member.diplomacyScoreFromProposals;
  const supportScore = member.diplomacyScoreFromSupport;
  const contributionScore = member.diplomacyScoreFromGold
    + member.diplomacyScoreFromScience
    + member.diplomacyScoreFromCulture;
  const categorised = proposalScore + supportScore + contributionScore + member.diplomacyScoreFromOther;
  const remainder = member.diplomacyScore - categorised;
  return {
    nationId: member.nationId,
    total: member.diplomacyScore,
    proposalScore,
    supportScore,
    contributionScore,
    otherScore: member.diplomacyScoreFromOther + remainder,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampWhole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function cloneState(state: WorldCouncilState): WorldCouncilState {
  return {
    ...state,
    memberNationIds: [...state.memberNationIds],
    members: state.members.map((member) => ({ ...member })),
    meetings: state.meetings.map((meeting) => ({
      ...meeting,
      emergencyTrigger: meeting.emergencyTrigger ? { ...meeting.emergencyTrigger } : undefined,
      proposals: meeting.proposals?.map((proposal) => ({
        ...proposal,
        participantNationIds: proposal.participantNationIds ? [...proposal.participantNationIds] : undefined,
        donations: proposal.donations?.map((donation) => ({ ...donation })),
        distributions: proposal.distributions?.map((distribution) => ({ ...distribution })),
        votes: proposal.votes?.map((vote) => ({ ...vote })),
      })),
    })),
    enactedResolutions: (state.enactedResolutions ?? []).map((resolution) => ({
      ...resolution,
      participantNationIds: resolution.participantNationIds ? [...resolution.participantNationIds] : undefined,
    })),
    pendingContributionNegotiation: state.pendingContributionNegotiation
      ? {
          ...state.pendingContributionNegotiation,
          choices: state.pendingContributionNegotiation.choices.map((choice) => ({ ...choice })),
        }
      : undefined,
  };
}

function normalizeState(state: WorldCouncilState): WorldCouncilState {
  const maybeLegacy = state as WorldCouncilState & {
    contributions?: Array<{
      nationId: string;
      gold?: number;
      sciencePercent?: number;
      culturePercent?: number;
    diplomacyScore?: number;
      diplomacyScoreSinceLastRegularMeeting?: number;
    }>;
  };
  if (Array.isArray(state.members)) {
    const normalizedMembers = state.members.map((member) => ({
      ...member,
      diplomacyScoreSinceLastRegularMeeting: member.diplomacyScoreSinceLastRegularMeeting ?? 0,
      diplomacyScoreFromProposals: member.diplomacyScoreFromProposals ?? 0,
      diplomacyScoreFromSupport: member.diplomacyScoreFromSupport ?? 0,
      diplomacyScoreFromGold: member.diplomacyScoreFromGold ?? 0,
      diplomacyScoreFromScience: member.diplomacyScoreFromScience ?? 0,
      diplomacyScoreFromCulture: member.diplomacyScoreFromCulture ?? 0,
      diplomacyScoreFromOther: member.diplomacyScoreFromOther
        ?? Math.max(
          0,
          member.diplomacyScore
            - (member.diplomacyScoreFromGold ?? 0)
            - (member.diplomacyScoreFromScience ?? 0)
            - (member.diplomacyScoreFromCulture ?? 0),
        ),
    }));
    const meetings = Array.isArray(state.meetings) ? state.meetings : [];
    return {
      ...state,
      organizationKind: state.organizationKind ?? 'worldCouncil',
      members: normalizedMembers,
      memberNationIds: normalizedMembers.map((member) => member.nationId),
      lastRegularMeetingTurn: state.lastRegularMeetingTurn ?? state.foundingTurn,
      nextRegularMeetingTurn: state.nextRegularMeetingTurn
        ?? ((state.lastRegularMeetingTurn ?? state.foundingTurn) + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS),
      meetings,
      nextMeetingId: state.nextMeetingId ?? (meetings.reduce((max, meeting) => Math.max(max, meeting.id), 0) + 1),
      enactedResolutions: (state.enactedResolutions ?? []).map((resolution) =>
        normalizeEnactedResolution(
          resolution,
          new Map(meetings.map((meeting) => [meeting.id, meeting.kind])),
        )),
      pendingContributionNegotiation: state.pendingContributionNegotiation
        ? {
            ...state.pendingContributionNegotiation,
            choices: state.pendingContributionNegotiation.choices.map((choice) => ({ ...choice })),
          }
        : undefined,
    };
  }

  const members: WorldCouncilMember[] = (maybeLegacy.contributions ?? []).map((contribution) => ({
    nationId: contribution.nationId,
    goldContributed: contribution.gold ?? 0,
    scienceContributionPercent: contribution.sciencePercent ?? 0,
    cultureContributionPercent: contribution.culturePercent ?? 0,
    diplomacyScore: contribution.diplomacyScore ?? 0,
    diplomacyScoreSinceLastRegularMeeting: contribution.diplomacyScoreSinceLastRegularMeeting ?? 0,
    diplomacyScoreFromProposals: 0,
    diplomacyScoreFromSupport: 0,
    diplomacyScoreFromGold: 0,
    diplomacyScoreFromScience: 0,
    diplomacyScoreFromCulture: 0,
    diplomacyScoreFromOther: contribution.diplomacyScore ?? 0,
  })).filter(isMemberContribution);

  return {
    ...state,
    organizationKind: state.organizationKind ?? 'worldCouncil',
    memberNationIds: members.map((member) => member.nationId),
    members,
    lastRegularMeetingTurn: state.lastRegularMeetingTurn ?? state.foundingTurn,
    nextRegularMeetingTurn: state.nextRegularMeetingTurn
      ?? ((state.lastRegularMeetingTurn ?? state.foundingTurn) + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS),
    meetings: [],
    nextMeetingId: 1,
    enactedResolutions: [],
  };
}

function stableMeetingSeed(turn: number, meetingId: number, hostNationId: string | undefined): number {
  let hash = turn * 1103515245 + meetingId * 12345;
  for (let i = 0; i < (hostNationId?.length ?? 0); i += 1) {
    hash = ((hash << 5) - hash + hostNationId!.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function stableResolutionTieBreak(
  seed: number,
  resolutionId: WorldCouncilResolutionId,
  repealTargetEnactedResolutionId?: string,
): number {
  let hash = seed || 17;
  const text = `${resolutionId}:${repealTargetEnactedResolutionId ?? ''}`;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 1000);
}

function getResolutionKind(resolutionId: WorldCouncilResolutionId): string {
  if (
    resolutionId === 'un_peacekeeping_mission'
    || resolutionId === 'ceasefire_resolution'
    || resolutionId === 'defense_support'
  ) {
    return 'security';
  }
  if (
    resolutionId === 'international_sanctions'
    || resolutionId === 'international_embargo'
    || resolutionId === 'condemn_aggressive_war'
    || resolutionId === 'nuclear_non_proliferation_treaty'
  ) {
    return 'punitive';
  }
  if (
    resolutionId === 'global_infrastructure_initiative'
    || resolutionId === 'international_development_fund'
    || resolutionId === 'global_free_trade_agreement'
  ) {
    return 'economic';
  }
  if (resolutionId === 'shared_cartography') return 'knowledge';
  if (resolutionId === 'protect_world_heritage') return 'heritage';
  if (resolutionId === 'climate_accord') return 'environment';
  return 'general';
}

function normalizeEnactedResolution(
  resolution: WorldCouncilEnactedResolution,
  meetingKindById: ReadonlyMap<number, WorldCouncilMeeting['kind']>,
): WorldCouncilEnactedResolution {
  return {
    ...resolution,
    meetingKind: resolution.meetingKind ?? meetingKindById.get(resolution.meetingId),
    active: resolution.active ?? (resolution.repealed === true || resolution.expired === true ? false : true),
    repealed: resolution.repealed ?? false,
    expired: resolution.expired ?? false,
    participantNationIds: resolution.participantNationIds ? [...resolution.participantNationIds] : undefined,
  };
}

function isEnactedResolutionActive(resolution: WorldCouncilEnactedResolution): boolean {
  return resolution.active !== false && resolution.repealed !== true && resolution.expired !== true;
}

function getOrganizationName(organizationKind: WorldCouncilOrganizationKind): string {
  return organizationKind === 'un' ? 'United Nations' : 'World Council';
}
