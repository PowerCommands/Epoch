import type {
  WorldCouncilEnactedResolution,
  WorldCouncilMeeting,
  WorldCouncilMember,
  WorldCouncilResolutionDefinition,
  WorldCouncilResolutionDonation,
  WorldCouncilDefenseSupportDonationDiagnostics,
  WorldCouncilResolutionDistribution,
  WorldCouncilResolutionId,
  WorldCouncilOrganizationKind,
  WorldCouncilResolutionProposal,
  WorldCouncilResolutionVote,
  WorldCouncilResolutionVoteSummary,
} from '../types/worldCouncil';

export interface WorldCouncilResolutionContext {
  readonly meetingId: number;
  readonly turn: number;
  readonly proposerNationId?: string;
  readonly memberNationIds: string[];
  readonly participantNationIds?: string[];
  readonly targetNationId?: string;
  readonly secondaryTargetNationId?: string;
}

export interface WorldCouncilResolutionRuntime {
  readonly getDiplomacyState?: (nationAId: string, nationBId: string) => 'WAR' | 'PEACE';
  readonly getRelationMemory?: (nationAId: string, nationBId: string) => {
    readonly trust: number;
    readonly fear?: number;
    readonly hostility: number;
    readonly affinity?: number;
    readonly suspicion?: number;
  };
  readonly areAllied?: (nationAId: string, nationBId: string) => boolean;
  readonly hasOpenBorders?: (nationAId: string, nationBId: string) => boolean;
  readonly hasTradeRelations?: (nationAId: string, nationBId: string) => boolean;
  readonly getActiveTradeGoldPerTurnBetween?: (nationAId: string, nationBId: string) => number;
  readonly getLeaderPersonality?: (nationId: string) => {
    readonly aggressionBias: number;
    readonly economyBias: number;
    readonly diplomacyBias: number;
    readonly warTolerance: number;
    readonly peacePreference: number;
  };
  readonly getIdeologyId?: (nationId: string) => string | undefined;
  readonly getMilitaryStrength?: (nationId: string) => number;
  readonly getAvailableInfluence?: (nationId: string) => number;
  readonly spendInfluence?: (nationId: string, amount: number) => number;
  readonly requestHumanInfluenceVote?: (input: {
    readonly nationId: string;
    readonly proposal: WorldCouncilResolutionProposal;
    readonly targetNationId?: string;
    readonly secondaryTargetNationId?: string;
    readonly suggestedSupport: boolean;
    readonly suggestedInfluence: number;
    readonly maxInfluence: number;
  }) => { readonly support: boolean; readonly influence: number } | null;
  readonly isHumanNation?: (nationId: string) => boolean;
  readonly shareMaps?: (memberNationIds: readonly string[]) => void;
  readonly setWorldHeritageProtection?: (active: boolean) => void;
  readonly condemnAggressiveWar?: (targetNationId: string, memberNationIds: readonly string[]) => void;
  readonly applyTradeRestrictions?: (resolutionId: WorldCouncilResolutionId, targetNationId: string) => void;
  readonly enforceCeasefire?: (nationAId: string, nationBId: string, durationTurns: number) => boolean;
  readonly getAllNationIds?: () => readonly string[];
  readonly isNationActive?: (nationId: string) => boolean;
  readonly getAggressorNationId?: (nationAId: string, nationBId: string) => string | undefined;
  readonly hasActivePeacekeepingMissionForHost?: (hostNationId: string) => boolean;
  readonly getTreasury?: (nationId: string) => number;
  readonly getGoldPerTurn?: (nationId: string) => number;
  readonly getNationName?: (nationId: string) => string;
  readonly isAtWarWithAnyone?: (nationId: string) => boolean;
  readonly transferGold?: (fromNationId: string, toNationId: string, amount: number) => boolean;
  readonly recordGoldGift?: (fromNationId: string, toNationId: string, amount: number) => void;
  readonly awardGoldContributionDiplomacyScore?: (nationId: string, gold: number) => void;
  readonly requestHumanGoldDonation?: (input: {
    readonly nationId: string;
    readonly recipientNationId: string;
    readonly aggressorNationId: string;
    readonly suggestedGold: number;
    readonly maxGold: number;
  }) => number | null;
}

export interface WorldCouncilResolutionResolveContext {
  readonly meeting: WorldCouncilMeeting;
  readonly turn: number;
  readonly members: readonly WorldCouncilMember[];
  readonly previousEmergencyMeetings: readonly WorldCouncilMeeting[];
  readonly nextRegularMeetingTurn?: number;
}

export interface WorldCouncilResolutionResolveResult {
  readonly proposal: WorldCouncilResolutionProposal;
  readonly enacted?: WorldCouncilEnactedResolution;
}

interface ResolutionExecutionContext extends WorldCouncilResolutionContext {
  readonly runtime?: WorldCouncilResolutionRuntime;
}

interface ResolutionDefinitionConfig {
  readonly id: WorldCouncilResolutionId;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly votingType: WorldCouncilResolutionDefinition['votingType'];
  readonly organizationKind: WorldCouncilOrganizationKind | 'both';
  readonly supportsRepeal?: boolean;
  readonly durationTurns?: number;
  readonly execute: (context: ResolutionExecutionContext) => void;
}

const UN_SANCTION_DURATION_TURNS = 30;
const UN_CEASEFIRE_DURATION_TURNS = 30;
const UN_PEACEKEEPING_DURATION_TURNS = 30;

const RESOLUTIONS: readonly ResolutionDefinitionConfig[] = [
  {
    id: 'defense_support',
    title: 'Defense Support Resolution',
    description: 'Coordinate voluntary economic aid for a member nation that has been attacked.',
    icon: '🛡',
    votingType: 'special',
    organizationKind: 'both',
    execute: () => {
      // Donations are resolved immediately as part of the special resolution.
    },
  },
  {
    id: 'global_free_trade_agreement',
    title: 'Global Free Trade Agreement',
    description: 'Signing members gain +1 trade capacity with every other signing member.',
    icon: '🤝',
    votingType: 'optionalParticipation',
    organizationKind: 'worldCouncil',
    supportsRepeal: true,
    execute: () => {
      // The ongoing benefit is applied from WorldCouncilState.enactedResolutions.
    },
  },
  {
    id: 'shared_cartography',
    title: 'Shared Cartography',
    description: 'If passed, all World Council members share maps.',
    icon: '🗺',
    votingType: 'influence',
    organizationKind: 'worldCouncil',
    execute: (context) => context.runtime?.shareMaps?.(context.memberNationIds),
  },
  {
    id: 'protect_world_heritage',
    title: 'Protect World Heritage',
    description: 'If passed, all World Wonders receive a defensive bonus.',
    icon: '🏛',
    votingType: 'influence',
    organizationKind: 'worldCouncil',
    supportsRepeal: true,
    execute: (context) => context.runtime?.setWorldHeritageProtection?.(true),
  },
  {
    id: 'condemn_aggressive_war',
    title: 'Condemn Aggressive War',
    description: 'If passed, members apply a diplomatic penalty toward the condemned Council member.',
    icon: '⚖',
    votingType: 'influence',
    organizationKind: 'worldCouncil',
    execute: (context) => {
      if (!context.targetNationId) return;
      context.runtime?.condemnAggressiveWar?.(context.targetNationId, context.memberNationIds);
    },
  },
  {
    id: 'international_sanctions',
    title: 'Economic Sanctions',
    description: 'Impose international economic sanctions on a selected member nation, blocking Luxury Resource trade for 30 turns.',
    icon: '💰',
    votingType: 'influence',
    organizationKind: 'un',
    durationTurns: UN_SANCTION_DURATION_TURNS,
    execute: (context) => {
      if (!context.targetNationId) return;
      context.runtime?.applyTradeRestrictions?.('international_sanctions', context.targetNationId);
    },
  },
  {
    id: 'international_embargo',
    title: 'International Embargo',
    description: 'Completely isolate a selected member nation from international resource trade for 30 turns.',
    icon: '🚫',
    votingType: 'influence',
    organizationKind: 'un',
    durationTurns: UN_SANCTION_DURATION_TURNS,
    execute: (context) => {
      if (!context.targetNationId) return;
      context.runtime?.applyTradeRestrictions?.('international_embargo', context.targetNationId);
    },
  },
  {
    id: 'ceasefire_resolution',
    title: 'Ceasefire Resolution',
    description: 'Attempt to enforce a ceasefire between two nations currently at war.',
    icon: '🕊',
    votingType: 'influence',
    organizationKind: 'un',
    durationTurns: UN_CEASEFIRE_DURATION_TURNS,
    execute: (context) => {
      if (!context.targetNationId || !context.secondaryTargetNationId) return;
      context.runtime?.enforceCeasefire?.(
        context.targetNationId,
        context.secondaryTargetNationId,
        UN_CEASEFIRE_DURATION_TURNS,
      );
    },
  },
  {
    id: 'nuclear_non_proliferation_treaty',
    title: 'Nuclear Non-Proliferation Treaty',
    description: 'Member nations agree to prohibit production of new Atomic Bombs and Nuclear Missiles.',
    icon: '☢',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
  {
    id: 'global_infrastructure_initiative',
    title: 'Global Infrastructure Initiative',
    description: 'Redistribute a one-time infrastructure fund from the richest UN members to developing members.',
    icon: '👷',
    votingType: 'influence',
    organizationKind: 'un',
    execute: () => {
      // The one-time fund is collected and distributed during resolution.
    },
  },
  {
    id: 'un_peacekeeping_mission',
    title: 'UN Peacekeeping Mission',
    description: 'Authorize voluntary peacekeeping forces to protect a member nation against a named threat for 30 turns.',
    icon: '🕊',
    votingType: 'influence',
    organizationKind: 'un',
    durationTurns: UN_PEACEKEEPING_DURATION_TURNS,
    execute: () => {},
  },
  {
    id: 'climate_accord',
    title: 'Climate Accord',
    description: 'Coordinate international environmental and climate policies. (Not yet implemented.)',
    icon: '🌱',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
  {
    id: 'international_development_fund',
    title: 'International Development Fund',
    description: 'Provide international economic assistance to developing member nations. (Not yet implemented.)',
    icon: '💰',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
];

export class WorldCouncilResolutionSystem {
  private readonly definitions = new Map<WorldCouncilResolutionId, ResolutionDefinitionConfig>(
    RESOLUTIONS.map((definition) => [definition.id, definition]),
  );
  private runtime: WorldCouncilResolutionRuntime = {};

  setRuntime(runtime: WorldCouncilResolutionRuntime): void {
    this.runtime = runtime;
  }

  getDefinitions(organizationKind?: WorldCouncilOrganizationKind): WorldCouncilResolutionDefinition[] {
    return RESOLUTIONS
      .filter((definition) =>
        organizationKind === undefined
        || definition.organizationKind === organizationKind
        || definition.organizationKind === 'both')
      .map(toPublicDefinition);
  }

  getDefinition(id: WorldCouncilResolutionId): WorldCouncilResolutionDefinition | undefined {
    const definition = this.definitions.get(id);
    return definition ? toPublicDefinition(definition) : undefined;
  }

  supportsRepeal(id: WorldCouncilResolutionId): boolean {
    return this.definitions.get(id)?.supportsRepeal === true;
  }

  getDurationTurns(id: WorldCouncilResolutionId): number | undefined {
    return this.definitions.get(id)?.durationTurns;
  }

  chooseHostProposal(
    hostNationId: string | undefined,
    organizationKind: WorldCouncilOrganizationKind = 'worldCouncil',
  ): WorldCouncilResolutionProposal {
    const definitions = this.getDefinitions(organizationKind)
      .filter((definition) => definition.votingType !== 'special');
    const index = hostNationId
      ? stableHash(hostNationId) % definitions.length
      : 0;
    return {
      slot: 'host',
      proposerNationId: hostNationId,
      resolutionId: definitions[index].id,
    };
  }

  chooseRandomProposal(
    seed: number,
    excludedResolutionId?: WorldCouncilResolutionId,
    organizationKind: WorldCouncilOrganizationKind = 'worldCouncil',
  ): WorldCouncilResolutionProposal {
    const definitions = this.getDefinitions(organizationKind)
      .filter((definition) => definition.votingType !== 'special')
      .filter((definition) => definition.id !== 'un_peacekeeping_mission');
    const candidates = excludedResolutionId
      ? definitions.filter((definition) => definition.id !== excludedResolutionId)
      : definitions;
    const pool = candidates.length > 0 ? candidates : definitions;
    return {
      slot: 'random',
      resolutionId: pool[Math.abs(seed) % pool.length].id,
    };
  }

  resolve(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): WorldCouncilResolutionResolveResult {
    const definition = this.definitions.get(proposal.resolutionId);
    if (!definition) {
      return {
        proposal: {
          ...proposal,
          resolved: true,
          passed: false,
          outcomeText: 'Unknown resolution.',
        },
      };
    }

    if (proposal.repealTargetEnactedResolutionId) {
      return this.resolveRepealProposal(proposal, context, definition);
    }

    if (proposal.resolutionId === 'defense_support') {
      return this.resolveDefenseSupport(proposal, context);
    }

    if (proposal.resolutionId === 'global_free_trade_agreement') {
      return this.resolveFreeTradeAgreement(proposal, context);
    }

    if (proposal.resolutionId === 'global_infrastructure_initiative') {
      return this.resolveGlobalInfrastructureInitiative(proposal, context, definition);
    }

    const targets = this.chooseProposalTargets(proposal, context);
    if (proposal.resolutionId === 'ceasefire_resolution' && (!targets.targetNationId || !targets.secondaryTargetNationId)) {
      return {
        proposal: {
          ...proposal,
          resolved: true,
          passed: false,
          votes: [],
          outcomeText: 'No active war between UN members could be targeted.',
        },
      };
    }
    if (proposal.resolutionId === 'un_peacekeeping_mission' && (!targets.targetNationId || !targets.secondaryTargetNationId)) {
      return {
        proposal: {
          ...proposal,
          resolved: true,
          passed: false,
          votes: [],
          outcomeText: 'No eligible Peacekeeping Mission host and threat could be targeted.',
        },
      };
    }
    if (requiresTarget(proposal.resolutionId) && !targets.targetNationId) {
      return {
        proposal: {
          ...proposal,
          resolved: true,
          passed: false,
          votes: [],
          outcomeText: 'No eligible member could be targeted.',
        },
      };
    }

    const proposalWithTargets = {
      ...proposal,
      targetNationId: targets.targetNationId,
      secondaryTargetNationId: targets.secondaryTargetNationId,
    };
    const votes = context.members.map((member) =>
      this.createInfluenceVote(member, proposalWithTargets, targets.targetNationId, targets.secondaryTargetNationId));
    const voteSummary = summarizeInfluenceVotes(votes);
    const passed = voteSummary.supportInfluence > voteSummary.opposeInfluence;
    const participantNationIds = passed && proposal.resolutionId === 'un_peacekeeping_mission'
      ? this.choosePeacekeepingParticipants(targets.targetNationId, targets.secondaryTargetNationId, context)
      : proposal.participantNationIds;
    const resolved: WorldCouncilResolutionProposal = {
      ...proposalWithTargets,
      participantNationIds,
      votes,
      voteSummary,
      passed,
      resolved: true,
      outcomeText: formatInfluenceOutcome(
        definition,
        passed,
        voteSummary.supportInfluence,
        voteSummary.opposeInfluence,
        targets.targetNationId,
        targets.secondaryTargetNationId,
        participantNationIds,
        (nationId) => this.runtime.getNationName?.(nationId) ?? nationId,
      ),
    };
    return {
      proposal: resolved,
      enacted: passed ? this.createEnactedResolution(resolved, context) : undefined,
    };
  }

  execute(proposal: WorldCouncilResolutionProposal, context: WorldCouncilResolutionContext): void {
    if (proposal.passed !== true) return;
    this.definitions.get(proposal.resolutionId)?.execute({
      ...context,
      proposerNationId: proposal.proposerNationId,
      participantNationIds: proposal.participantNationIds,
      targetNationId: proposal.targetNationId,
      secondaryTargetNationId: proposal.secondaryTargetNationId,
      runtime: this.runtime,
    });
  }

  private resolveFreeTradeAgreement(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): WorldCouncilResolutionResolveResult {
    const memberNationIds = new Set(context.members.map((member) => member.nationId));
    const participantNationIds = uniqueNationIds(proposal.participantNationIds)
      .filter((nationId) => memberNationIds.has(nationId));
    if (participantNationIds.length === 0 && proposal.participantNationIds === undefined) {
      participantNationIds.push(...context.members.map((member) => member.nationId));
    }
    const passed = participantNationIds.length >= 2;
    const resolved: WorldCouncilResolutionProposal = {
      ...proposal,
      participantNationIds,
      passed,
      resolved: true,
      outcomeText: passed
        ? `Agreement signed by ${formatNationList(participantNationIds)}.`
        : 'Fewer than two members signed.',
    };
    return {
      proposal: resolved,
      enacted: passed ? this.createEnactedResolution(resolved, context) : undefined,
    };
  }

  private resolveDefenseSupport(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): WorldCouncilResolutionResolveResult {
    const recipientNationId = proposal.targetNationId ?? context.meeting.emergencyTrigger?.targetNationId;
    const aggressorNationId = proposal.secondaryTargetNationId ?? context.meeting.emergencyTrigger?.aggressorNationId;
    const memberIds = new Set(context.members.map((member) => member.nationId));
    if (
      !recipientNationId
      || !aggressorNationId
      || !memberIds.has(recipientNationId)
      || !memberIds.has(aggressorNationId)
      || this.runtime.getDiplomacyState?.(aggressorNationId, recipientNationId) !== 'WAR'
    ) {
      return {
        proposal: {
          ...proposal,
          targetNationId: recipientNationId,
          secondaryTargetNationId: aggressorNationId,
          donations: [],
          totalGoldDonated: 0,
          passed: true,
          resolved: true,
          outcomeText: 'Defense Support completed: no eligible member victim of aggression could be supported.',
        },
      };
    }

    const donations: WorldCouncilResolutionDonation[] = [];
    for (const member of context.members) {
      const donorNationId = member.nationId;
      const decision = donorNationId === recipientNationId
        ? this.createRecipientDefenseSupportDecision(donorNationId)
        : this.chooseDefenseSupportDonation(donorNationId, recipientNationId, aggressorNationId);
      const gold = decision.actualDonation;
      if (gold > 0) {
        const transferred = this.runtime.transferGold?.(donorNationId, recipientNationId, gold) ?? false;
        if (transferred) {
          this.runtime.recordGoldGift?.(donorNationId, recipientNationId, gold);
          this.runtime.awardGoldContributionDiplomacyScore?.(donorNationId, gold);
          donations.push({ nationId: donorNationId, gold, diagnostics: decision });
        } else {
          donations.push({
            nationId: donorNationId,
            gold: 0,
            diagnostics: { ...decision, actualDonation: 0, reason: `${decision.reason} Transfer failed.` },
          });
        }
      } else {
        donations.push({ nationId: donorNationId, gold: 0, diagnostics: decision });
      }
    }

    const totalGoldDonated = donations.reduce((sum, donation) => sum + donation.gold, 0);
    return {
      proposal: {
        ...proposal,
        targetNationId: recipientNationId,
        secondaryTargetNationId: aggressorNationId,
        donations,
        totalGoldDonated,
        passed: true,
        resolved: true,
        outcomeText: formatDefenseSupportOutcome(
          recipientNationId,
          aggressorNationId,
          donations,
          totalGoldDonated,
          (nationId) => this.runtime.getNationName?.(nationId) ?? nationId,
        ),
      },
    };
  }

  private resolveGlobalInfrastructureInitiative(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
    definition: ResolutionDefinitionConfig,
  ): WorldCouncilResolutionResolveResult {
    const votes = context.members.map((member) =>
      this.createInfluenceVote(member, proposal, undefined));
    const voteSummary = summarizeInfluenceVotes(votes);
    const passed = voteSummary.supportInfluence > voteSummary.opposeInfluence;
    if (!passed) {
      return {
        proposal: {
          ...proposal,
          votes,
          voteSummary,
          passed,
          resolved: true,
          outcomeText: `Failed by Influence (${voteSummary.supportInfluence}-${voteSummary.opposeInfluence}).`,
        },
      };
    }

    const { donations, distributions, totalGoldDonated } = this.executeGlobalInfrastructureFund(context.members);
    const resolved: WorldCouncilResolutionProposal = {
      ...proposal,
      votes,
      voteSummary,
      donations,
      distributions,
      totalGoldDonated,
      passed,
      resolved: true,
      outcomeText: formatGlobalInfrastructureOutcome(
        donations,
        distributions,
        totalGoldDonated,
        (nationId) => this.runtime.getNationName?.(nationId) ?? nationId,
      ),
    };
    return {
      proposal: resolved,
      enacted: this.createEnactedResolution(resolved, context),
    };
  }

  private executeGlobalInfrastructureFund(
    members: readonly WorldCouncilMember[],
  ): {
    donations: WorldCouncilResolutionDonation[];
    distributions: WorldCouncilResolutionDistribution[];
    totalGoldDonated: number;
  } {
    const sortedMembers = [...members].sort((a, b) => {
      const treasuryDelta = (this.runtime.getTreasury?.(b.nationId) ?? 0) - (this.runtime.getTreasury?.(a.nationId) ?? 0);
      return treasuryDelta || a.nationId.localeCompare(b.nationId);
    });
    const contributorCount = Math.floor(sortedMembers.length / 2);
    const contributorIds = new Set(sortedMembers.slice(0, contributorCount).map((member) => member.nationId));
    const recipientIds = sortedMembers
      .filter((member) => !contributorIds.has(member.nationId))
      .map((member) => member.nationId)
      .sort((a, b) => a.localeCompare(b));

    const plannedDonations: WorldCouncilResolutionDonation[] = [];
    for (const nationId of contributorIds) {
      const treasury = Math.max(0, Math.floor(this.runtime.getTreasury?.(nationId) ?? 0));
      const gold = Math.floor(treasury * 0.1);
      plannedDonations.push({ nationId, gold });
    }

    const totalGoldDonated = plannedDonations.reduce((sum, donation) => sum + donation.gold, 0);
    const distributions: WorldCouncilResolutionDistribution[] = [];
    if (recipientIds.length === 0 || totalGoldDonated <= 0) {
      return { donations: plannedDonations.map((donation) => ({ ...donation, gold: 0 })), distributions, totalGoldDonated: 0 };
    }

    const baseShare = Math.floor(totalGoldDonated / recipientIds.length);
    let remainder = totalGoldDonated - baseShare * recipientIds.length;
    for (let i = 0; i < recipientIds.length; i += 1) {
      const nationId = recipientIds[i]!;
      const gold = baseShare + (i === recipientIds.length - 1 ? remainder : 0);
      remainder = i === recipientIds.length - 1 ? 0 : remainder;
      distributions.push({ nationId, gold });
    }

    const remainingByContributor = new Map(plannedDonations.map((donation) => [donation.nationId, donation.gold]));
    const actualByContributor = new Map(plannedDonations.map((donation) => [donation.nationId, 0]));
    const actualByRecipient = new Map(distributions.map((distribution) => [distribution.nationId, 0]));

    for (const distribution of distributions) {
      let remainingRecipientShare = distribution.gold;
      for (const donation of plannedDonations) {
        if (remainingRecipientShare <= 0) break;
        const remainingContributorGold = remainingByContributor.get(donation.nationId) ?? 0;
        if (remainingContributorGold <= 0) continue;
        const amount = Math.min(remainingRecipientShare, remainingContributorGold);
        const transferred = this.runtime.transferGold?.(donation.nationId, distribution.nationId, amount) ?? false;
        if (!transferred) continue;
        remainingByContributor.set(donation.nationId, remainingContributorGold - amount);
        actualByContributor.set(donation.nationId, (actualByContributor.get(donation.nationId) ?? 0) + amount);
        actualByRecipient.set(distribution.nationId, (actualByRecipient.get(distribution.nationId) ?? 0) + amount);
        remainingRecipientShare -= amount;
      }
    }

    const donations = plannedDonations.map((donation) => ({
      nationId: donation.nationId,
      gold: actualByContributor.get(donation.nationId) ?? 0,
    }));
    const actualDistributions = distributions.map((distribution) => ({
      nationId: distribution.nationId,
      gold: actualByRecipient.get(distribution.nationId) ?? 0,
    }));
    const actualTotalGoldDonated = donations.reduce((sum, donation) => sum + donation.gold, 0);

    for (const donation of donations) {
      if (donation.gold <= 0) continue;
      this.runtime.awardGoldContributionDiplomacyScore?.(donation.nationId, donation.gold);
      for (const distribution of actualDistributions) {
        if (distribution.gold <= 0) continue;
        this.runtime.recordGoldGift?.(donation.nationId, distribution.nationId, donation.gold);
      }
    }

    return { donations, distributions: actualDistributions, totalGoldDonated: actualTotalGoldDonated };
  }

  private resolveRepealProposal(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
    definition: ResolutionDefinitionConfig,
  ): WorldCouncilResolutionResolveResult {
    const votes = context.members.map((member) =>
      this.createInfluenceVote(member, proposal, undefined));
    const voteSummary = summarizeInfluenceVotes(votes);
    const passed = voteSummary.supportInfluence > voteSummary.opposeInfluence;
    return {
      proposal: {
        ...proposal,
        votes,
        voteSummary,
        passed,
        resolved: true,
        outcomeText: passed
          ? `${definition.title} was repealed by Influence (${voteSummary.supportInfluence}-${voteSummary.opposeInfluence}).`
          : `Repeal failed by Influence (${voteSummary.supportInfluence}-${voteSummary.opposeInfluence}).`,
      },
    };
  }

  private createInfluenceVote(
    member: WorldCouncilMember,
    proposal: WorldCouncilResolutionProposal,
    targetNationId: string | undefined,
    secondaryTargetNationId?: string,
  ): WorldCouncilResolutionVote {
    const availableInfluence = Math.max(0, Math.floor(this.runtime.getAvailableInfluence?.(member.nationId) ?? 0));
    const supportScore = this.scoreProposalSupport(member.nationId, proposal, targetNationId, secondaryTargetNationId);
    let support = supportScore > 0;
    let intendedInfluence = this.chooseInfluenceCommitment(member.nationId, proposal, targetNationId, supportScore, availableInfluence, secondaryTargetNationId);

    if (this.runtime.isHumanNation?.(member.nationId) === true) {
      const humanVote = this.runtime.requestHumanInfluenceVote?.({
        nationId: member.nationId,
        proposal,
        targetNationId,
        secondaryTargetNationId,
        suggestedSupport: support,
        suggestedInfluence: intendedInfluence,
        maxInfluence: availableInfluence,
      });
      if (humanVote) {
        support = humanVote.support;
        intendedInfluence = clampWhole(humanVote.influence, 0, availableInfluence);
      }
    }

    const influence = this.runtime.spendInfluence?.(member.nationId, intendedInfluence)
      ?? Math.min(availableInfluence, intendedInfluence);
    return {
      nationId: member.nationId,
      support,
      influence,
      availableInfluence,
      remainingInfluence: Math.max(0, availableInfluence - influence),
      supportScore: Math.round(supportScore),
    };
  }

  private scoreProposalSupport(
    voterNationId: string,
    proposal: WorldCouncilResolutionProposal,
    targetNationId: string | undefined,
    secondaryTargetNationId?: string,
  ): number {
    if (proposal.resolutionId === 'ceasefire_resolution') {
      return this.scoreCeasefireVote(voterNationId, targetNationId, secondaryTargetNationId);
    }
    if (proposal.resolutionId === 'un_peacekeeping_mission') {
      return this.scorePeacekeepingVote(voterNationId, targetNationId, secondaryTargetNationId);
    }
    if (isNegativeResolution(proposal.resolutionId)) {
      return this.scorePunitiveVote(voterNationId, proposal, targetNationId);
    }
    if (proposal.repealTargetEnactedResolutionId) {
      return this.scoreRepealVote(voterNationId, proposal);
    }
    return 12;
  }

  private chooseInfluenceCommitment(
    voterNationId: string,
    proposal: WorldCouncilResolutionProposal,
    targetNationId: string | undefined,
    supportScore: number,
    availableInfluence: number,
    secondaryTargetNationId?: string,
  ): number {
    if (availableInfluence <= 0) return 0;
    let importance = Math.min(100, Math.abs(supportScore));
    if (targetNationId === voterNationId) importance += 45;
    if (secondaryTargetNationId === voterNationId) importance += 45;
    if (proposal.proposerNationId === voterNationId) importance += 20;
    if (targetNationId && this.runtime.areAllied?.(voterNationId, targetNationId)) importance += 25;
    if (secondaryTargetNationId && this.runtime.areAllied?.(voterNationId, secondaryTargetNationId)) importance += 25;
    if (targetNationId && this.runtime.getDiplomacyState?.(voterNationId, targetNationId) === 'WAR') importance += 25;
    if (secondaryTargetNationId && this.runtime.getDiplomacyState?.(voterNationId, secondaryTargetNationId) === 'WAR') importance += 25;
    if (targetNationId && this.runtime.hasTradeRelations?.(voterNationId, targetNationId)) importance += 10;
    if (secondaryTargetNationId && this.runtime.hasTradeRelations?.(voterNationId, secondaryTargetNationId)) importance += 10;
    if (proposal.repealTargetEnactedResolutionId) importance += 18;

    const ratio = importance >= 85
      ? 0.5 + Math.min(0.5, (importance - 85) / 60)
      : importance >= 45
        ? 0.2 + (importance - 45) / 200
        : 0.05 + Math.max(0, importance) / 400;
    const committed = Math.floor(availableInfluence * clampNumber(ratio, 0.05, 1));
    return Math.min(availableInfluence, Math.max(availableInfluence > 0 ? 1 : 0, committed));
  }

  private scorePunitiveVote(
    voterNationId: string,
    proposal: WorldCouncilResolutionProposal,
    targetNationId: string | undefined,
  ): number {
    if (!targetNationId || voterNationId === targetNationId) return -100;
    const relation = this.runtime.getRelationMemory?.(voterNationId, targetNationId);
    const personality = this.runtime.getLeaderPersonality?.(voterNationId);
    const diplomacyState = this.runtime.getDiplomacyState?.(voterNationId, targetNationId) ?? 'PEACE';
    let score = -8;

    if (diplomacyState === 'WAR') score += 55;
    if (this.runtime.areAllied?.(voterNationId, targetNationId)) score -= 70;
    if (this.runtime.hasOpenBorders?.(voterNationId, targetNationId)) score -= 8;
    if (this.runtime.hasTradeRelations?.(voterNationId, targetNationId)) score -= 14;

    const tradeGpt = this.runtime.getActiveTradeGoldPerTurnBetween?.(voterNationId, targetNationId) ?? 0;
    score -= Math.min(28, tradeGpt * 2);

    if (relation) {
      score += relation.hostility * 0.65;
      score += (relation.suspicion ?? 0) * 0.45;
      score += (relation.fear ?? 0) * 0.2;
      score -= relation.trust * 0.55;
      score -= (relation.affinity ?? 0) * 0.35;
    }

    const voterIdeology = this.runtime.getIdeologyId?.(voterNationId);
    const targetIdeology = this.runtime.getIdeologyId?.(targetNationId);
    if (voterIdeology && targetIdeology && voterIdeology === targetIdeology) score -= 8;

    const voterStrength = this.runtime.getMilitaryStrength?.(voterNationId) ?? 0;
    const targetStrength = this.runtime.getMilitaryStrength?.(targetNationId) ?? 0;
    if (targetStrength > voterStrength * 1.35) score += 8;
    if (voterStrength > targetStrength * 1.8) score += 4;

    if (proposal.proposerNationId) {
      if (this.runtime.areAllied?.(voterNationId, proposal.proposerNationId)) score += 12;
      const proposerRelation = this.runtime.getRelationMemory?.(voterNationId, proposal.proposerNationId);
      if (proposerRelation) score += (proposerRelation.trust - proposerRelation.hostility) * 0.12;
    }

    if (personality) {
      score += personality.aggressionBias * 0.35;
      score += (personality.warTolerance - 50) * 0.18;
      score -= personality.peacePreference * 0.12;
      score -= personality.diplomacyBias * 0.08;
      score -= personality.economyBias * (proposal.resolutionId === 'international_embargo' ? 0.35 : 0.18);
      if (relation && relation.trust > relation.hostility + 20) {
        score -= Math.max(0, personality.peacePreference - personality.aggressionBias) * 0.25;
      }
      if (relation && relation.hostility > relation.trust + 20) {
        score += Math.max(0, personality.aggressionBias + personality.warTolerance - 50) * 0.18;
      }
    }

    return score;
  }

  private scoreCeasefireVote(
    voterNationId: string,
    targetNationId: string | undefined,
    secondaryTargetNationId: string | undefined,
  ): number {
    if (!targetNationId || !secondaryTargetNationId) return -100;
    const personality = this.runtime.getLeaderPersonality?.(voterNationId);
    const involved = voterNationId === targetNationId || voterNationId === secondaryTargetNationId;
    const otherWarNationId = voterNationId === targetNationId
      ? secondaryTargetNationId
      : voterNationId === secondaryTargetNationId
        ? targetNationId
        : undefined;
    let score = involved ? 20 : 24;

    if (otherWarNationId) {
      const voterStrength = this.runtime.getMilitaryStrength?.(voterNationId) ?? 0;
      const opponentStrength = this.runtime.getMilitaryStrength?.(otherWarNationId) ?? 0;
      if (opponentStrength > voterStrength * 1.25) score += 38;
      if (voterStrength > opponentStrength * 1.25) score -= 24;
      const relation = this.runtime.getRelationMemory?.(voterNationId, otherWarNationId);
      if (relation) {
        score += relation.fear ?? 0;
        score += relation.hostility * 0.2;
        score -= (relation.suspicion ?? 0) * 0.1;
      }
    } else {
      if (this.runtime.areAllied?.(voterNationId, targetNationId)) score += 8;
      if (this.runtime.areAllied?.(voterNationId, secondaryTargetNationId)) score += 8;
      const targetRelation = this.runtime.getRelationMemory?.(voterNationId, targetNationId);
      const secondaryRelation = this.runtime.getRelationMemory?.(voterNationId, secondaryTargetNationId);
      score += ((targetRelation?.trust ?? 50) + (secondaryRelation?.trust ?? 50) - 100) * 0.08;
      score -= ((targetRelation?.hostility ?? 0) + (secondaryRelation?.hostility ?? 0)) * 0.05;
    }

    if (personality) {
      score += personality.peacePreference * 0.28;
      score += personality.diplomacyBias * 0.16;
      score += personality.economyBias * 0.08;
      score -= personality.aggressionBias * 0.28;
      score -= Math.max(0, personality.warTolerance - 45) * 0.2;
    }
    return score;
  }

  private scorePeacekeepingVote(
    voterNationId: string,
    hostNationId: string | undefined,
    threatNationId: string | undefined,
  ): number {
    if (!hostNationId || !threatNationId || hostNationId === threatNationId) return -100;
    if (voterNationId === hostNationId) return 80;
    if (voterNationId === threatNationId) return -70;

    const hostRelation = this.runtime.getRelationMemory?.(voterNationId, hostNationId);
    const threatRelation = this.runtime.getRelationMemory?.(voterNationId, threatNationId);
    const personality = this.runtime.getLeaderPersonality?.(voterNationId);
    let score = 12;

    if (this.runtime.areAllied?.(voterNationId, hostNationId)) score += 36;
    if (this.runtime.areAllied?.(voterNationId, threatNationId)) score -= 36;
    if (this.runtime.getDiplomacyState?.(voterNationId, threatNationId) === 'WAR') score += 24;
    if (this.runtime.getDiplomacyState?.(voterNationId, hostNationId) === 'WAR') score -= 45;
    if (this.runtime.hasOpenBorders?.(voterNationId, hostNationId)) score += 8;
    if (this.runtime.hasTradeRelations?.(voterNationId, hostNationId)) score += 8;

    if (hostRelation) {
      score += (hostRelation.trust - 50) * 0.35;
      score += (hostRelation.affinity ?? 0) * 0.24;
      score -= hostRelation.hostility * 0.42;
      score -= (hostRelation.suspicion ?? 0) * 0.16;
    }
    if (threatRelation) {
      score += threatRelation.hostility * 0.34;
      score += (threatRelation.suspicion ?? 0) * 0.22;
      score += (threatRelation.fear ?? 0) * 0.18;
      score -= Math.max(0, threatRelation.trust - 50) * 0.25;
      score -= (threatRelation.affinity ?? 0) * 0.16;
    }

    if (personality) {
      score += personality.peacePreference * 0.26;
      score += personality.diplomacyBias * 0.2;
      score -= personality.aggressionBias * 0.18;
      score -= Math.max(0, personality.warTolerance - 55) * 0.12;
    }
    return score;
  }

  private chooseDefenseSupportDonation(
    donorNationId: string,
    recipientNationId: string,
    aggressorNationId: string,
  ): WorldCouncilDefenseSupportDonationDiagnostics {
    const treasury = Math.max(0, Math.floor(this.runtime.getTreasury?.(donorNationId) ?? 0));
    const goldPerTurn = this.runtime.getGoldPerTurn?.(donorNationId) ?? 0;
    const maximumDonation = this.getDefenseSupportMaxDonation(donorNationId, treasury, goldPerTurn);
    if (treasury <= 0) {
      return this.createDefenseSupportDonationDiagnostics(treasury, goldPerTurn, maximumDonation, 0, 0, 0, 'No treasury available.');
    }
    if (donorNationId === aggressorNationId) {
      return this.createDefenseSupportDonationDiagnostics(treasury, goldPerTurn, maximumDonation, 0, 0, 0, 'Aggressor does not fund defense support against itself.');
    }

    let score = 0;
    const reasons: string[] = [];
    const recipientRelation = this.runtime.getRelationMemory?.(donorNationId, recipientNationId);
    const aggressorRelation = this.runtime.getRelationMemory?.(donorNationId, aggressorNationId);
    const personality = this.runtime.getLeaderPersonality?.(donorNationId);

    if (this.runtime.areAllied?.(donorNationId, recipientNationId)) {
      score += 55;
      reasons.push('friendly ally under attack');
    }
    if (this.runtime.areAllied?.(donorNationId, aggressorNationId)) {
      score -= 55;
      reasons.push('allied with aggressor');
    }
    if (this.runtime.getDiplomacyState?.(donorNationId, aggressorNationId) === 'WAR') {
      score += 45;
      reasons.push('already at war with aggressor');
    }
    if (this.runtime.getDiplomacyState?.(donorNationId, recipientNationId) === 'WAR') {
      score -= 75;
      reasons.push('at war with defended nation');
    }
    if (this.runtime.hasOpenBorders?.(donorNationId, recipientNationId)) score += 8;
    if (this.runtime.hasTradeRelations?.(donorNationId, recipientNationId)) {
      score += 12;
      reasons.push('trade ties with defended nation');
    }

    if (recipientRelation) {
      score += (recipientRelation.trust - 50) * 0.65;
      score += (recipientRelation.affinity ?? 0) * 0.35;
      score -= recipientRelation.hostility * 0.55;
      score -= (recipientRelation.suspicion ?? 0) * 0.25;
      if (recipientRelation.trust >= 65) reasons.push('high trust toward defended nation');
    }
    if (aggressorRelation) {
      score += aggressorRelation.hostility * 0.48;
      score += (aggressorRelation.suspicion ?? 0) * 0.32;
      score -= Math.max(0, aggressorRelation.trust - 50) * 0.3;
      score -= (aggressorRelation.affinity ?? 0) * 0.22;
      if (aggressorRelation.hostility >= 35) reasons.push('hostile toward aggressor');
    }

    if (treasury >= 5000) {
      score += 34;
      reasons.push('large treasury');
    } else if (treasury >= 2500) {
      score += 25;
      reasons.push('strong treasury');
    } else if (treasury >= 1000) {
      score += 16;
      reasons.push('healthy treasury');
    } else if (treasury < 200) {
      score -= 42;
      reasons.push('low treasury');
    } else if (treasury < 500) {
      score -= 22;
      reasons.push('limited treasury');
    }
    if (goldPerTurn > 80) {
      score += 22;
      reasons.push('very strong gold income');
    } else if (goldPerTurn > 30) {
      score += 14;
      reasons.push('positive gold income');
    }
    if (goldPerTurn < 0) {
      score -= 35;
      reasons.push('negative gold income');
    }
    if (this.runtime.isAtWarWithAnyone?.(donorNationId)) {
      score -= 15;
      reasons.push('currently at war and conserving resources');
    }

    if (personality) {
      score += personality.peacePreference * 0.3;
      score += personality.diplomacyBias * 0.26;
      score += personality.economyBias * (treasury >= 1000 && goldPerTurn >= 0 ? 0.18 : -0.14);
      score -= personality.aggressionBias * 0.2;
      score -= Math.max(0, personality.warTolerance - 55) * 0.14;
    }

    const ratio = score >= 115
      ? 0.18
      : score >= 90
        ? 0.13
        : score >= 65
          ? 0.09
          : score >= 35
            ? 0.05
            : score >= 15
              ? 0.025
          : 0;

    const incomeBoost = Math.max(0, goldPerTurn) * (score >= 65 ? 2 : 1);
    const suggestedGold = ratio > 0 ? Math.max(1, Math.floor(treasury * ratio + incomeBoost)) : 0;
    let actualDonation = normalizeDefenseSupportDonation(suggestedGold, maximumDonation);
    if (this.runtime.isHumanNation?.(donorNationId) === true) {
      const humanGold = this.runtime.requestHumanGoldDonation?.({
        nationId: donorNationId,
        recipientNationId,
        aggressorNationId,
        suggestedGold,
        maxGold: maximumDonation,
      });
      if (humanGold !== null && humanGold !== undefined) {
        actualDonation = normalizeDefenseSupportDonation(humanGold, maximumDonation);
      }
    }
    if (actualDonation <= 0 && reasons.length === 0) reasons.push('relationship and strategic score too low');
    return this.createDefenseSupportDonationDiagnostics(
      treasury,
      goldPerTurn,
      maximumDonation,
      suggestedGold,
      actualDonation,
      score,
      reasons.join('; ') || 'meaningful aid justified by relationship and economic position',
    );
  }

  private createRecipientDefenseSupportDecision(nationId: string): WorldCouncilDefenseSupportDonationDiagnostics {
    const treasury = Math.max(0, Math.floor(this.runtime.getTreasury?.(nationId) ?? 0));
    const goldPerTurn = this.runtime.getGoldPerTurn?.(nationId) ?? 0;
    return this.createDefenseSupportDonationDiagnostics(
      treasury,
      goldPerTurn,
      0,
      0,
      0,
      0,
      'Defended nation receives aid instead of donating.',
    );
  }

  private getDefenseSupportMaxDonation(nationId: string, treasury: number, goldPerTurn: number): number {
    const reserve = this.runtime.isAtWarWithAnyone?.(nationId)
      ? Math.max(120, Math.floor(treasury * 0.25))
      : Math.max(80, Math.floor(treasury * 0.12));
    const incomeCapacity = Math.max(0, goldPerTurn) * 8;
    return Math.max(0, Math.min(treasury - reserve, Math.floor(treasury * 0.25 + incomeCapacity)));
  }

  private createDefenseSupportDonationDiagnostics(
    treasury: number,
    goldPerTurn: number,
    maximumDonation: number,
    desiredDonation: number,
    actualDonation: number,
    score: number,
    reason: string,
  ): WorldCouncilDefenseSupportDonationDiagnostics {
    return {
      treasury,
      goldPerTurn: Math.round(goldPerTurn),
      maximumDonation,
      desiredDonation: Math.max(0, Math.floor(desiredDonation)),
      actualDonation,
      score: Math.round(score),
      reason,
    };
  }

  private scoreRepealVote(voterNationId: string, proposal: WorldCouncilResolutionProposal): number {
    const targetNationId = proposal.targetNationId;
    if (!targetNationId) return 8;
    const relation = this.runtime.getRelationMemory?.(voterNationId, targetNationId);
    let score = 0;
    if (voterNationId === targetNationId) score += 40;
    if (this.runtime.areAllied?.(voterNationId, targetNationId)) score += 24;
    if (this.runtime.hasTradeRelations?.(voterNationId, targetNationId)) score += 10;
    if (relation) {
      score += relation.trust * 0.25;
      score -= relation.hostility * 0.25;
      score -= (relation.suspicion ?? 0) * 0.12;
    }
    return score;
  }

  private chooseCondemnationTarget(
    context: WorldCouncilResolutionResolveContext,
    proposerNationId: string | undefined,
  ): string | undefined {
    const memberIds = new Set(context.members.map((member) => member.nationId));
    for (const meeting of [...context.previousEmergencyMeetings].reverse()) {
      const aggressorId = meeting.emergencyTrigger?.aggressorNationId;
      if (aggressorId && memberIds.has(aggressorId) && aggressorId !== proposerNationId) return aggressorId;
    }
    return undefined;
  }

  private createEnactedResolution(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): WorldCouncilEnactedResolution {
    return {
      id: `world_council_resolution_${context.meeting.id}_${proposal.slot}`,
      resolutionId: proposal.resolutionId,
      meetingId: context.meeting.id,
      meetingKind: context.meeting.kind,
      turn: context.turn,
      participantNationIds: proposal.participantNationIds ? [...proposal.participantNationIds] : undefined,
      targetNationId: proposal.targetNationId,
      secondaryTargetNationId: proposal.secondaryTargetNationId,
      expirationTurn: proposal.resolutionId === 'global_infrastructure_initiative'
        ? context.nextRegularMeetingTurn
        : this.getDurationTurns(proposal.resolutionId) !== undefined
        ? context.turn + this.getDurationTurns(proposal.resolutionId)!
        : undefined,
      active: true,
      repealed: false,
      expired: false,
    };
  }

  private chooseProposalTargets(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): { targetNationId?: string; secondaryTargetNationId?: string } {
    if (proposal.resolutionId === 'ceasefire_resolution') {
      return this.chooseCeasefireTargets(proposal, context);
    }
    if (proposal.resolutionId === 'un_peacekeeping_mission') {
      return this.choosePeacekeepingTargets(proposal, context);
    }
    if (proposal.targetNationId && this.isValidTarget(proposal.resolutionId, proposal.targetNationId, proposal.proposerNationId, context)) {
      return { targetNationId: proposal.targetNationId };
    }
    if (proposal.resolutionId === 'condemn_aggressive_war') {
      return { targetNationId: this.chooseCondemnationTarget(context, proposal.proposerNationId) };
    }
    if (proposal.resolutionId === 'international_sanctions' || proposal.resolutionId === 'international_embargo') {
      return { targetNationId: [...context.members]
        .filter((member) => this.isValidTarget(proposal.resolutionId, member.nationId, proposal.proposerNationId, context))
        .sort((a, b) =>
          (this.getTargetPressure(b.nationId, proposal.proposerNationId) - this.getTargetPressure(a.nationId, proposal.proposerNationId))
          || a.nationId.localeCompare(b.nationId))[0]?.nationId };
    }
    return {};
  }

  private chooseCeasefireTargets(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): { targetNationId?: string; secondaryTargetNationId?: string } {
    if (
      proposal.targetNationId
      && proposal.secondaryTargetNationId
      && this.isValidCeasefirePair(proposal.targetNationId, proposal.secondaryTargetNationId, context)
    ) {
      return {
        targetNationId: proposal.targetNationId,
        secondaryTargetNationId: proposal.secondaryTargetNationId,
      };
    }
    const members = context.members.map((member) => member.nationId);
    const candidates: Array<{ a: string; b: string; pressure: number }> = [];
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const a = members[i]!;
        const b = members[j]!;
        if (!this.isValidCeasefirePair(a, b, context)) continue;
        candidates.push({
          a,
          b,
          pressure: this.getCeasefirePressure(a, b, proposal.proposerNationId),
        });
      }
    }
    const selected = candidates.sort((left, right) =>
      right.pressure - left.pressure
      || left.a.localeCompare(right.a)
      || left.b.localeCompare(right.b))[0];
    return selected ? { targetNationId: selected.a, secondaryTargetNationId: selected.b } : {};
  }

  private isValidTarget(
    resolutionId: WorldCouncilResolutionId,
    targetNationId: string,
    proposerNationId: string | undefined,
    context: WorldCouncilResolutionResolveContext,
  ): boolean {
    if (!requiresTarget(resolutionId)) return false;
    if (!context.members.some((member) => member.nationId === targetNationId)) return false;
    if (isNegativeResolution(resolutionId) && targetNationId === proposerNationId) return false;
    return true;
  }

  private isValidCeasefirePair(
    nationAId: string,
    nationBId: string,
    context: WorldCouncilResolutionResolveContext,
  ): boolean {
    if (nationAId === nationBId) return false;
    const memberIds = new Set(context.members.map((member) => member.nationId));
    if (!memberIds.has(nationAId) || !memberIds.has(nationBId)) return false;
    return this.runtime.getDiplomacyState?.(nationAId, nationBId) === 'WAR';
  }

  private choosePeacekeepingTargets(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
  ): { targetNationId?: string; secondaryTargetNationId?: string } {
    const hostNationId = proposal.targetNationId ?? proposal.proposerNationId;
    if (!hostNationId || hostNationId !== proposal.proposerNationId) return {};
    if (
      proposal.secondaryTargetNationId
      && this.isValidPeacekeepingPair(hostNationId, proposal.secondaryTargetNationId, context)
    ) {
      return { targetNationId: hostNationId, secondaryTargetNationId: proposal.secondaryTargetNationId };
    }

    const allNationIds = this.runtime.getAllNationIds?.()
      ?? context.members.map((member) => member.nationId);
    const candidates = allNationIds
      .filter((nationId) => this.isValidPeacekeepingPair(hostNationId, nationId, context))
      .map((nationId) => ({
        nationId,
        pressure: this.getPeacekeepingThreatPressure(hostNationId, nationId),
      }))
      .sort((left, right) =>
        right.pressure - left.pressure
        || left.nationId.localeCompare(right.nationId));
    const selected = candidates[0];
    return selected ? { targetNationId: hostNationId, secondaryTargetNationId: selected.nationId } : {};
  }

  private isValidPeacekeepingPair(
    hostNationId: string,
    threatNationId: string,
    context: WorldCouncilResolutionResolveContext,
  ): boolean {
    if (hostNationId === threatNationId) return false;
    if (context.meeting.kind !== 'regular') return false;
    const memberIds = new Set(context.members.map((member) => member.nationId));
    if (!memberIds.has(hostNationId)) return false;
    if (this.runtime.isNationActive?.(hostNationId) === false) return false;
    if (this.runtime.isNationActive?.(threatNationId) === false) return false;
    if (this.runtime.hasActivePeacekeepingMissionForHost?.(hostNationId)) return false;
    const state = this.runtime.getDiplomacyState?.(hostNationId, threatNationId);
    const aggressorNationId = this.runtime.getAggressorNationId?.(hostNationId, threatNationId);
    if (state === 'WAR' && aggressorNationId === hostNationId) return false;
    return this.getPeacekeepingThreatPressure(hostNationId, threatNationId) > 0;
  }

  private getPeacekeepingThreatPressure(hostNationId: string, threatNationId: string): number {
    const relation = this.runtime.getRelationMemory?.(hostNationId, threatNationId);
    const state = this.runtime.getDiplomacyState?.(hostNationId, threatNationId);
    const hostStrength = this.runtime.getMilitaryStrength?.(hostNationId) ?? 0;
    const threatStrength = this.runtime.getMilitaryStrength?.(threatNationId) ?? 0;
    let pressure = 0;
    if (state === 'WAR') pressure += this.runtime.getAggressorNationId?.(hostNationId, threatNationId) === threatNationId ? 120 : 35;
    pressure += Math.max(0, threatStrength - hostStrength) / 12;
    if (relation) {
      pressure += relation.hostility * 2.6;
      pressure += (relation.suspicion ?? 0) * 1.4;
      pressure += (relation.fear ?? 0) * 1.2;
      pressure -= relation.trust * 1.2;
      pressure -= (relation.affinity ?? 0) * 0.7;
    }
    return pressure;
  }

  private choosePeacekeepingParticipants(
    hostNationId: string | undefined,
    threatNationId: string | undefined,
    context: WorldCouncilResolutionResolveContext,
  ): string[] {
    if (!hostNationId || !threatNationId) return [];
    return context.members
      .map((member) => member.nationId)
      .filter((nationId) => nationId !== hostNationId && nationId !== threatNationId)
      .filter((nationId) => this.runtime.isNationActive?.(nationId) !== false)
      .filter((nationId) => this.scorePeacekeepingParticipation(nationId, hostNationId, threatNationId) >= 28)
      .sort((a, b) => a.localeCompare(b));
  }

  private scorePeacekeepingParticipation(
    nationId: string,
    hostNationId: string,
    threatNationId: string,
  ): number {
    const hostRelation = this.runtime.getRelationMemory?.(nationId, hostNationId);
    const threatRelation = this.runtime.getRelationMemory?.(nationId, threatNationId);
    const personality = this.runtime.getLeaderPersonality?.(nationId);
    const ownStrength = this.runtime.getMilitaryStrength?.(nationId) ?? 0;
    const threatStrength = this.runtime.getMilitaryStrength?.(threatNationId) ?? 0;
    let score = 8;

    if (this.runtime.areAllied?.(nationId, hostNationId)) score += 42;
    if (this.runtime.areAllied?.(nationId, threatNationId)) score -= 45;
    if (this.runtime.getDiplomacyState?.(nationId, threatNationId) === 'WAR') score += 25;
    if (this.runtime.getDiplomacyState?.(nationId, hostNationId) === 'WAR') score -= 55;
    if (this.runtime.hasOpenBorders?.(nationId, hostNationId)) score += 8;
    if (this.runtime.hasTradeRelations?.(nationId, hostNationId)) score += 8;
    if (this.runtime.isAtWarWithAnyone?.(nationId)) score -= 10;
    if (ownStrength > threatStrength * 0.5) score += 10;
    if (ownStrength > threatStrength) score += 8;
    if (ownStrength < threatStrength * 0.25) score -= 12;

    if (hostRelation) {
      score += (hostRelation.trust - 50) * 0.45;
      score += (hostRelation.affinity ?? 0) * 0.26;
      score -= hostRelation.hostility * 0.5;
      score -= (hostRelation.suspicion ?? 0) * 0.18;
    }
    if (threatRelation) {
      score += threatRelation.hostility * 0.36;
      score += (threatRelation.suspicion ?? 0) * 0.2;
      score += (threatRelation.fear ?? 0) * 0.12;
      score -= Math.max(0, threatRelation.trust - 50) * 0.25;
    }
    if (personality) {
      score += personality.diplomacyBias * 0.18;
      score += personality.peacePreference * 0.18;
      score -= personality.aggressionBias * 0.08;
      score -= Math.max(0, personality.warTolerance - 60) * 0.1;
    }
    return score;
  }

  private getCeasefirePressure(nationAId: string, nationBId: string, proposerNationId: string | undefined): number {
    const strengthA = this.runtime.getMilitaryStrength?.(nationAId) ?? 0;
    const strengthB = this.runtime.getMilitaryStrength?.(nationBId) ?? 0;
    const imbalance = Math.abs(strengthA - strengthB) / 20;
    const proposerInvolved = proposerNationId === nationAId || proposerNationId === nationBId ? 500 : 0;
    const relationAB = this.runtime.getRelationMemory?.(nationAId, nationBId);
    return proposerInvolved
      + imbalance
      + (relationAB?.hostility ?? 0) * 4
      + (relationAB?.suspicion ?? 0) * 2;
  }

  private getTargetPressure(targetNationId: string, proposerNationId: string | undefined): number {
    const availableInfluence = this.runtime.getAvailableInfluence?.(targetNationId) ?? 0;
    const militaryStrength = this.runtime.getMilitaryStrength?.(targetNationId) ?? 0;
    const proposerRelation = proposerNationId
      ? this.runtime.getRelationMemory?.(proposerNationId, targetNationId)
      : undefined;
    return availableInfluence
      + militaryStrength / 20
      + (proposerRelation?.hostility ?? 0) * 8
      + (proposerRelation?.suspicion ?? 0) * 5
      - (proposerRelation?.trust ?? 0) * 4;
  }
}

function requiresTarget(resolutionId: WorldCouncilResolutionId): boolean {
  return resolutionId === 'condemn_aggressive_war'
    || resolutionId === 'international_sanctions'
    || resolutionId === 'international_embargo'
    || resolutionId === 'ceasefire_resolution'
    || resolutionId === 'un_peacekeeping_mission';
}

function isNegativeResolution(resolutionId: WorldCouncilResolutionId): boolean {
  return resolutionId === 'condemn_aggressive_war'
    || resolutionId === 'international_sanctions'
    || resolutionId === 'international_embargo';
}

function summarizeInfluenceVotes(votes: readonly WorldCouncilResolutionVote[]): WorldCouncilResolutionVoteSummary {
  const supportInfluence = votes
    .filter((vote) => vote.support)
    .reduce((sum, vote) => sum + vote.influence, 0);
  const opposeInfluence = votes
    .filter((vote) => !vote.support)
    .reduce((sum, vote) => sum + vote.influence, 0);
  const abstentions = votes.filter((vote) => vote.influence <= 0).length;
  return {
    supportInfluence,
    opposeInfluence,
    abstentions,
    margin: Math.abs(supportInfluence - opposeInfluence),
    outcome: supportInfluence > opposeInfluence ? 'passed' : 'failed',
  };
}

function toPublicDefinition(definition: ResolutionDefinitionConfig): WorldCouncilResolutionDefinition {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    votingType: definition.votingType,
  };
}

function uniqueNationIds(nationIds: readonly string[] | undefined): string[] {
  return Array.from(new Set(nationIds ?? []));
}

function formatNationList(nationIds: readonly string[]): string {
  if (nationIds.length === 0) return 'no members';
  if (nationIds.length === 1) return nationIds[0];
  if (nationIds.length === 2) return `${nationIds[0]} and ${nationIds[1]}`;
  return `${nationIds.slice(0, -1).join(', ')}, and ${nationIds[nationIds.length - 1]}`;
}

function formatDefenseSupportOutcome(
  recipientNationId: string,
  aggressorNationId: string,
  donations: readonly WorldCouncilResolutionDonation[],
  totalGoldDonated: number,
  nationName: (nationId: string) => string,
): string {
  const lines = [
    'Defense Support Resolution',
    '',
    `${nationName(recipientNationId)} requested international assistance after being attacked by ${nationName(aggressorNationId)}.`,
    '',
  ];
  for (const donation of donations) {
    if (donation.nationId === recipientNationId) continue;
    lines.push(donation.gold > 0
      ? `${nationName(donation.nationId)} donated ${donation.gold} Gold.`
      : `${nationName(donation.nationId)} chose not to contribute.`);
  }
  lines.push('', 'Total international aid:', `${totalGoldDonated} Gold.`);
  return lines.join('\n');
}

function formatGlobalInfrastructureOutcome(
  donations: readonly WorldCouncilResolutionDonation[],
  distributions: readonly WorldCouncilResolutionDistribution[],
  totalGoldDonated: number,
  nationName: (nationId: string) => string,
): string {
  const lines = [
    'Global Infrastructure Initiative adopted.',
    '',
    'Contributors:',
    '',
  ];
  const contributors = donations.filter((donation) => donation.gold > 0);
  if (contributors.length === 0) {
    lines.push('No member contributed Gold.');
  } else {
    for (const donation of contributors) {
      lines.push(`${nationName(donation.nationId)} contributed ${donation.gold} Gold.`);
    }
  }
  lines.push('', 'Global Infrastructure Fund:', `${totalGoldDonated} Gold.`, '', 'Recipients:', '');
  if (distributions.length === 0) {
    lines.push('No eligible recipient received funding.');
  } else {
    for (const distribution of distributions) {
      lines.push(`${nationName(distribution.nationId)} received ${distribution.gold} Gold.`);
    }
  }
  return lines.join('\n');
}

function formatInfluenceOutcome(
  definition: ResolutionDefinitionConfig,
  passed: boolean,
  support: number,
  oppose: number,
  targetNationId: string | undefined,
  secondaryTargetNationId?: string,
  participantNationIds: readonly string[] | undefined = undefined,
  nationName: (nationId: string) => string = (nationId) => nationId,
): string {
  if (definition.id === 'ceasefire_resolution') {
    if (!targetNationId || !secondaryTargetNationId) return 'No active war between UN members could be targeted.';
    return passed
      ? `United Nations enforced a ceasefire between ${targetNationId} and ${secondaryTargetNationId} for ${definition.durationTurns ?? 30} turns by Influence (${support}-${oppose}).`
      : `Ceasefire between ${targetNationId} and ${secondaryTargetNationId} failed by Influence (${support}-${oppose}).`;
  }
  if (definition.id === 'un_peacekeeping_mission') {
    if (!targetNationId || !secondaryTargetNationId) return 'No eligible Peacekeeping Mission host and threat could be targeted.';
    if (!passed) {
      return `UN Peacekeeping Mission for ${nationName(targetNationId)} against ${nationName(secondaryTargetNationId)} failed by Influence (${support}-${oppose}).`;
    }
    const participants = participantNationIds && participantNationIds.length > 0
      ? participantNationIds.map(nationName).join(', ')
      : 'no participating nations';
    return `UN Peacekeeping Mission approved for ${nationName(targetNationId)} against ${nationName(secondaryTargetNationId)} for ${definition.durationTurns ?? 30} turns by Influence (${support}-${oppose}). Participants: ${participants}.`;
  }
  if (
    passed
    && (definition.id === 'international_sanctions' || definition.id === 'international_embargo')
    && targetNationId
  ) {
    return `${definition.title} imposed against ${targetNationId} for ${definition.durationTurns ?? 30} turns by Influence (${support}-${oppose}).`;
  }
  return passed
    ? `Passed by Influence (${support}-${oppose}).`
    : `Failed by Influence (${support}-${oppose}).`;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampWhole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeDefenseSupportDonation(value: number, treasury: number): number {
  const clamped = clampWhole(value, 0, treasury);
  if (clamped <= 0) return 0;
  return Math.min(treasury, Math.max(clamped, Math.floor(treasury * 0.1)));
}
