import type { NationManager } from './NationManager';
import type { CityManager } from './CityManager';
import type { ResourceSystem } from './ResourceSystem';
import type { DiscoverySystem } from './DiscoverySystem';
import type { WorldCouncilResolutionSystem } from './WorldCouncilResolutionSystem';
import type { TurnStartEvent } from '../types/events';
import { isBarbarianNation } from '../data/barbarians';
import type {
  WorldCouncilContributionChoice,
  WorldCouncilEmergencyTrigger,
  WorldCouncilMeeting,
  WorldCouncilMember,
  WorldCouncilState,
} from '../types/worldCouncil';
import {
  WORLD_COUNCIL_CONSTRUCTION_TURNS,
  WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD,
  WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS,
} from '../types/worldCouncil';
import { getLeaderPersonalityByNationId } from '../data/leaders';

export interface WorldCouncilContributionOffer {
  readonly gold: number;
  readonly sciencePercent: number;
  readonly culturePercent: number;
}

export interface FoundWorldCouncilOptions {
  readonly foundingCityId: string;
  readonly foundingNationId: string;
  readonly foundingTurn: number;
  readonly founderOffer: WorldCouncilContributionOffer;
}

export type WorldCouncilChangedListener = () => void;
export type WorldCouncilCompletedListener = (state: WorldCouncilState) => void;
export type WorldCouncilMeetingListener = (meeting: WorldCouncilMeeting, state: WorldCouncilState) => void;

const MINIMUM_COUNCIL_SCIENCE_PERCENT = 1;
const MINIMUM_COUNCIL_CULTURE_PERCENT = 1;
const NON_STANDARD_WORLD_COUNCIL_NATION_IDS = new Set(['nation_pirate']);

export class WorldCouncilSystem {
  private state: WorldCouncilState | null = null;
  private readonly changedListeners: WorldCouncilChangedListener[] = [];
  private readonly completedListeners: WorldCouncilCompletedListener[] = [];
  private readonly meetingListeners: WorldCouncilMeetingListener[] = [];
  private hasSkippedInitialTurnStart = false;
  private lastProcessedCouncilRound = 0;

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly resolutionSystem?: WorldCouncilResolutionSystem,
    private readonly discoverySystem?: DiscoverySystem,
  ) {}

  hasCouncil(): boolean {
    return this.state !== null;
  }

  isActive(): boolean {
    return this.state?.status === 'active';
  }

  getState(): WorldCouncilState | null {
    return this.state ? cloneState(this.state) : null;
  }

  getMembers(): WorldCouncilMember[] {
    return this.state?.members.map((member) => ({ ...member })) ?? [];
  }

  isMember(nationId: string): boolean {
    return this.state?.members.some((member) => member.nationId === nationId) ?? false;
  }

  getTradeAgreementCapacityBetweenNations(nationAId: string, nationBId: string): number {
    if (!this.state) return 0;
    return this.state.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'global_free_trade_agreement'
      && resolution.participantNationIds?.includes(nationAId) === true
      && resolution.participantNationIds.includes(nationBId))
      ? 1
      : 0;
  }

  hasWorldHeritageProtection(): boolean {
    return this.state?.enactedResolutions.some((resolution) =>
      resolution.resolutionId === 'protect_world_heritage') ?? false;
  }

  getDiplomacyScoreThreshold(): number {
    return WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD;
  }

  hasPendingHumanContribution(nationId: string): boolean {
    return this.state?.pendingContributionNegotiation?.awaitingHumanNationId === nationId;
  }

  submitHumanContribution(nationId: string, offer: WorldCouncilContributionOffer): boolean {
    if (!this.state?.pendingContributionNegotiation) return false;
    if (this.state.pendingContributionNegotiation.awaitingHumanNationId !== nationId) return false;
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

  triggerEmergencyMeeting(turn: number, trigger: WorldCouncilEmergencyTrigger): WorldCouncilMeeting | null {
    if (!this.state || this.state.status !== 'active') return null;
    this.pruneEliminatedMembers();
    const meeting = this.createMeeting({
      kind: 'emergency',
      turn,
      emergencyTrigger: trigger,
    });
    this.notifyChanged();
    this.notifyMeeting(meeting);
    return { ...meeting, emergencyTrigger: meeting.emergencyTrigger ? { ...meeting.emergencyTrigger } : undefined };
  }

  found(options: FoundWorldCouncilOptions): boolean {
    if (this.state !== null) return false;
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

  handleTurnStart(event: TurnStartEvent): void {
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }
    if (!this.state) return;

    const membershipChanged = this.pruneEliminatedMembers();
    const scoreAdvanced = this.advanceDiplomacyScore(event.nation.id);
    const lifecycleChanged = this.advanceCouncilLifecycle(event.round);

    if (scoreAdvanced || membershipChanged || lifecycleChanged) {
      this.notifyChanged();
    }
  }

  restore(state: WorldCouncilState | undefined): void {
    this.state = state ? cloneState(normalizeState(state)) : null;
    this.hasSkippedInitialTurnStart = true;
    this.lastProcessedCouncilRound = this.state?.lastRegularMeetingTurn ?? 0;
    this.pruneEliminatedMembers();
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
    const resources = this.nationManager.getResources(nationId);
    const gold = clampWhole(offer.gold, 0, resources.gold);
    const sciencePercent = clampWhole(offer.sciencePercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100);
    const culturePercent = clampWhole(offer.culturePercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100);

    if (gold > 0) this.resourceSystem.addGold(nationId, -gold);

    return {
      nationId,
      goldContributed: gold,
      scienceContributionPercent: sciencePercent,
      cultureContributionPercent: culturePercent,
      diplomacyScore: 0,
      diplomacyScoreSinceLastRegularMeeting: 0,
    };
  }

  private advanceDiplomacyScore(nationId: string): boolean {
    if (!this.state) return false;
    if (!this.nationManager.getNation(nationId)) return false;
    const index = this.state.members.findIndex((member) => member.nationId === nationId);
    if (index < 0) return false;
    const members = this.state.members.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      return {
        ...member,
        diplomacyScore: member.diplomacyScore + getDiplomacyScoreGain(member),
        diplomacyScoreSinceLastRegularMeeting: member.diplomacyScoreSinceLastRegularMeeting + getDiplomacyScoreGain(member),
      };
    });
    this.state = {
      ...this.state,
      members,
      memberNationIds: members.map((member) => member.nationId),
    };
    return true;
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
      this.notifyMeeting(meeting);
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
    const proposals = options.kind === 'regular' && this.resolutionSystem
      ? this.createRegularMeetingProposals(options.turn, options.hostNationId)
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
    this.state = {
      ...this.state,
      meetings: [...this.state.meetings, meeting],
      nextMeetingId: this.state.nextMeetingId + 1,
    };
    if (options.kind === 'regular' && meeting.proposals && this.resolutionSystem) {
      return this.resolveMeetingProposals(meeting.id) ?? meeting;
    }
    return meeting;
  }

  private createRegularMeetingProposals(turn: number, hostNationId: string | undefined) {
    if (!this.resolutionSystem || !this.state) return undefined;
    const hostProposal = this.resolutionSystem.chooseHostProposal(hostNationId);
    const randomProposal = this.resolutionSystem.chooseRandomProposal(
      stableMeetingSeed(turn, this.state.nextMeetingId, hostNationId),
      hostProposal.resolutionId,
    );
    return [hostProposal, randomProposal];
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
      }));
    const proposals = resolved.map((result) => result.proposal);
    const enacted = resolved
      .map((result) => result.enacted)
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const meetings = this.state.meetings.map((item) =>
      item.id === meetingId ? { ...item, proposals } : item);
    this.state = {
      ...this.state,
      meetings,
      enactedResolutions: [...(this.state.enactedResolutions ?? []), ...enacted],
    };
    for (const proposal of proposals) {
      this.resolutionSystem.execute(proposal, {
        meetingId,
        turn: meeting.turn,
        proposerNationId: proposal.proposerNationId,
        memberNationIds: this.state.memberNationIds,
        participantNationIds: proposal.participantNationIds,
        targetNationId: proposal.targetNationId,
      });
    }
    return meetings.find((item) => item.id === meetingId) ?? null;
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
      const contribution = this.enforceMinimumContribution(choice);
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

    const goldShare = clampNumber(0.04 + commitment / 600, 0, 0.25);
    const sciencePercent = clampWhole(
      6 + Math.round((commitment + personality.economyBias) / 14),
      MINIMUM_COUNCIL_SCIENCE_PERCENT,
      25,
    );
    const culturePercent = clampWhole(
      6 + Math.round((commitment + personality.cultureBias) / 14),
      MINIMUM_COUNCIL_CULTURE_PERCENT,
      25,
    );
    return {
      nationId,
      goldContributed: clampWhole(resources.gold * goldShare, 0, resources.gold),
      scienceContributionPercent: sciencePercent,
      cultureContributionPercent: culturePercent,
    };
  }

  private makeContributionChoice(
    nationId: string,
    offer: WorldCouncilContributionOffer,
  ): WorldCouncilContributionChoice {
    const resources = this.nationManager.getResources(nationId);
    return this.enforceMinimumContribution({
      nationId,
      goldContributed: clampWhole(offer.gold, 0, resources.gold),
      scienceContributionPercent: clampWhole(offer.sciencePercent, 0, 100),
      cultureContributionPercent: clampWhole(offer.culturePercent, 0, 100),
    });
  }

  private enforceMinimumContribution(choice: WorldCouncilContributionChoice): WorldCouncilContributionChoice {
    return {
      ...choice,
      scienceContributionPercent: clampWhole(choice.scienceContributionPercent, MINIMUM_COUNCIL_SCIENCE_PERCENT, 100),
      cultureContributionPercent: clampWhole(choice.cultureContributionPercent, MINIMUM_COUNCIL_CULTURE_PERCENT, 100),
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
      enactedResolutions: this.state.enactedResolutions.map((resolution) => ({
        ...resolution,
        participantNationIds: resolution.participantNationIds
          ? resolution.participantNationIds.filter((participantNationId) => participantNationId !== nationId)
          : undefined,
        targetNationId: resolution.targetNationId === nationId ? undefined : resolution.targetNationId,
      })),
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
        votes: proposal.votes?.map((vote) => ({ ...vote })),
      })),
    };
    const stateCopy = cloneState(this.state);
    for (const listener of this.meetingListeners) listener(meetingCopy, stateCopy);
  }
}

function isMemberContribution(member: WorldCouncilMember): boolean {
  return member.goldContributed > 0
    || member.scienceContributionPercent > 0
    || member.cultureContributionPercent > 0;
}

function getDiplomacyScoreGain(member: WorldCouncilMember): number {
  return member.goldContributed / 100
    + member.scienceContributionPercent
    + member.cultureContributionPercent;
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
    }));
    const meetings = Array.isArray(state.meetings) ? state.meetings : [];
    return {
      ...state,
      members: normalizedMembers,
      memberNationIds: normalizedMembers.map((member) => member.nationId),
      lastRegularMeetingTurn: state.lastRegularMeetingTurn ?? state.foundingTurn,
      nextRegularMeetingTurn: state.nextRegularMeetingTurn
        ?? ((state.lastRegularMeetingTurn ?? state.foundingTurn) + WORLD_COUNCIL_REGULAR_MEETING_INTERVAL_TURNS),
      meetings,
      nextMeetingId: state.nextMeetingId ?? (meetings.reduce((max, meeting) => Math.max(max, meeting.id), 0) + 1),
      enactedResolutions: state.enactedResolutions ?? [],
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
  })).filter(isMemberContribution);

  return {
    ...state,
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
