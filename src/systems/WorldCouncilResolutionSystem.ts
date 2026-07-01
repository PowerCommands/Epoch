import type {
  WorldCouncilEnactedResolution,
  WorldCouncilMeeting,
  WorldCouncilMember,
  WorldCouncilResolutionDefinition,
  WorldCouncilResolutionId,
  WorldCouncilOrganizationKind,
  WorldCouncilResolutionProposal,
  WorldCouncilResolutionVote,
} from '../types/worldCouncil';

export interface WorldCouncilResolutionContext {
  readonly meetingId: number;
  readonly turn: number;
  readonly proposerNationId?: string;
  readonly memberNationIds: string[];
  readonly participantNationIds?: string[];
  readonly targetNationId?: string;
}

export interface WorldCouncilResolutionRuntime {
  readonly getDiplomacyState?: (nationAId: string, nationBId: string) => 'WAR' | 'PEACE';
  readonly getRelationMemory?: (nationAId: string, nationBId: string) => {
    readonly trust: number;
    readonly hostility: number;
  };
  readonly shareMaps?: (memberNationIds: readonly string[]) => void;
  readonly setWorldHeritageProtection?: (active: boolean) => void;
  readonly condemnAggressiveWar?: (targetNationId: string, memberNationIds: readonly string[]) => void;
  readonly applyTradeRestrictions?: (resolutionId: WorldCouncilResolutionId, targetNationId: string) => void;
}

export interface WorldCouncilResolutionResolveContext {
  readonly meeting: WorldCouncilMeeting;
  readonly turn: number;
  readonly members: readonly WorldCouncilMember[];
  readonly previousEmergencyMeetings: readonly WorldCouncilMeeting[];
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
  readonly organizationKind: WorldCouncilOrganizationKind;
  readonly supportsRepeal?: boolean;
  readonly durationTurns?: number;
  readonly execute: (context: ResolutionExecutionContext) => void;
}

const UN_SANCTION_DURATION_TURNS = 30;

const RESOLUTIONS: readonly ResolutionDefinitionConfig[] = [
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
    description: 'Attempt to enforce a ceasefire between two nations currently at war. (Not yet implemented.)',
    icon: '🕊',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
  {
    id: 'nuclear_non_proliferation_treaty',
    title: 'Nuclear Non-Proliferation Treaty',
    description: 'Member nations agree to prohibit further nuclear weapons development. (Not yet implemented.)',
    icon: '☢',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
  {
    id: 'global_infrastructure_initiative',
    title: 'Global Infrastructure Initiative',
    description: 'Coordinate international investment in civilian infrastructure. (Not yet implemented.)',
    icon: '👷',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
    execute: () => {},
  },
  {
    id: 'un_peacekeeping_mission',
    title: 'UN Peacekeeping Mission',
    description: 'Deploy international peacekeeping forces to stabilize an active conflict. (Not yet implemented.)',
    icon: '🕊',
    votingType: 'influence',
    organizationKind: 'un',
    supportsRepeal: true,
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
      .filter((definition) => organizationKind === undefined || definition.organizationKind === organizationKind)
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
    const definitions = this.getDefinitions(organizationKind);
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
    const definitions = this.getDefinitions(organizationKind);
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

    if (proposal.resolutionId === 'global_free_trade_agreement') {
      return this.resolveFreeTradeAgreement(proposal, context);
    }

    const targetNationId = this.chooseTargetNation(proposal.resolutionId, context);
    if (requiresTarget(proposal.resolutionId) && !targetNationId) {
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

    const votes = context.members.map((member) =>
      this.createInfluenceVote(member, proposal.resolutionId, targetNationId));
    const support = votes.filter((vote) => vote.support).reduce((sum, vote) => sum + vote.influence, 0);
    const oppose = votes.filter((vote) => !vote.support).reduce((sum, vote) => sum + vote.influence, 0);
    const passed = support > oppose;
    const resolved: WorldCouncilResolutionProposal = {
      ...proposal,
      targetNationId,
      votes,
      passed,
      resolved: true,
      outcomeText: formatInfluenceOutcome(definition, passed, support, oppose, targetNationId),
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

  private resolveRepealProposal(
    proposal: WorldCouncilResolutionProposal,
    context: WorldCouncilResolutionResolveContext,
    definition: ResolutionDefinitionConfig,
  ): WorldCouncilResolutionResolveResult {
    const votes = context.members.map((member) =>
      this.createInfluenceVote(member, proposal.resolutionId, undefined));
    const support = votes.filter((vote) => vote.support).reduce((sum, vote) => sum + vote.influence, 0);
    const oppose = votes.filter((vote) => !vote.support).reduce((sum, vote) => sum + vote.influence, 0);
    const passed = support > oppose;
    return {
      proposal: {
        ...proposal,
        votes,
        passed,
        resolved: true,
        outcomeText: passed
          ? `${definition.title} was repealed by Influence (${support}-${oppose}).`
          : `Repeal failed by Influence (${support}-${oppose}).`,
      },
    };
  }

  private createInfluenceVote(
    member: WorldCouncilMember,
    resolutionId: WorldCouncilResolutionId,
    targetNationId: string | undefined,
  ): WorldCouncilResolutionVote {
    const influence = Math.max(1, Math.floor(member.diplomacyScore));
    let support = true;
    if (resolutionId === 'condemn_aggressive_war') {
      support = member.nationId !== targetNationId;
    }
    return { nationId: member.nationId, support, influence };
  }

  private chooseCondemnationTarget(context: WorldCouncilResolutionResolveContext): string | undefined {
    const memberIds = new Set(context.members.map((member) => member.nationId));
    for (const meeting of [...context.previousEmergencyMeetings].reverse()) {
      const aggressorId = meeting.emergencyTrigger?.aggressorNationId;
      if (aggressorId && memberIds.has(aggressorId)) return aggressorId;
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
      expirationTurn: this.getDurationTurns(proposal.resolutionId) !== undefined
        ? context.turn + this.getDurationTurns(proposal.resolutionId)!
        : undefined,
      active: true,
      repealed: false,
      expired: false,
    };
  }

  private chooseTargetNation(
    resolutionId: WorldCouncilResolutionId,
    context: WorldCouncilResolutionResolveContext,
  ): string | undefined {
    if (resolutionId === 'condemn_aggressive_war') return this.chooseCondemnationTarget(context);
    if (resolutionId === 'international_sanctions' || resolutionId === 'international_embargo') {
      return [...context.members]
        .sort((a, b) =>
          b.diplomacyScore - a.diplomacyScore
          || a.nationId.localeCompare(b.nationId))[0]?.nationId;
    }
    return undefined;
  }
}

function requiresTarget(resolutionId: WorldCouncilResolutionId): boolean {
  return resolutionId === 'condemn_aggressive_war'
    || resolutionId === 'international_sanctions'
    || resolutionId === 'international_embargo';
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

function formatInfluenceOutcome(
  definition: ResolutionDefinitionConfig,
  passed: boolean,
  support: number,
  oppose: number,
  targetNationId: string | undefined,
): string {
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
