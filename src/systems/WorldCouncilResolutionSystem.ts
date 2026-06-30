import type {
  WorldCouncilEnactedResolution,
  WorldCouncilMeeting,
  WorldCouncilMember,
  WorldCouncilResolutionDefinition,
  WorldCouncilResolutionId,
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
  readonly execute: (context: ResolutionExecutionContext) => void;
}

const RESOLUTIONS: readonly ResolutionDefinitionConfig[] = [
  {
    id: 'global_free_trade_agreement',
    title: 'Global Free Trade Agreement',
    description: 'Signing members gain +1 trade capacity with every other signing member.',
    icon: '🤝',
    votingType: 'optionalParticipation',
    execute: () => {},
  },
  {
    id: 'shared_cartography',
    title: 'Shared Cartography',
    description: 'If passed, all World Council members share maps.',
    icon: '🗺',
    votingType: 'influence',
    execute: (context) => context.runtime?.shareMaps?.(context.memberNationIds),
  },
  {
    id: 'protect_world_heritage',
    title: 'Protect World Heritage',
    description: 'If passed, all World Wonders receive a defensive bonus.',
    icon: '🏛',
    votingType: 'influence',
    execute: (context) => context.runtime?.setWorldHeritageProtection?.(true),
  },
  {
    id: 'condemn_aggressive_war',
    title: 'Condemn Aggressive War',
    description: 'If passed, members apply a diplomatic penalty toward the condemned Council member.',
    icon: '⚖',
    votingType: 'influence',
    execute: (context) => {
      if (!context.targetNationId) return;
      context.runtime?.condemnAggressiveWar?.(context.targetNationId, context.memberNationIds);
    },
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

  getDefinitions(): WorldCouncilResolutionDefinition[] {
    return RESOLUTIONS.map(toPublicDefinition);
  }

  getDefinition(id: WorldCouncilResolutionId): WorldCouncilResolutionDefinition | undefined {
    const definition = this.definitions.get(id);
    return definition ? toPublicDefinition(definition) : undefined;
  }

  chooseHostProposal(hostNationId: string | undefined): WorldCouncilResolutionProposal {
    const definitions = this.getDefinitions();
    const index = hostNationId
      ? stableHash(hostNationId) % definitions.length
      : 0;
    return {
      slot: 'host',
      proposerNationId: hostNationId,
      resolutionId: definitions[index].id,
    };
  }

  chooseRandomProposal(seed: number, excludedResolutionId?: WorldCouncilResolutionId): WorldCouncilResolutionProposal {
    const definitions = this.getDefinitions();
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

    if (proposal.resolutionId === 'global_free_trade_agreement') {
      return this.resolveFreeTradeAgreement(proposal, context);
    }

    const targetNationId = proposal.resolutionId === 'condemn_aggressive_war'
      ? this.chooseCondemnationTarget(context)
      : undefined;
    if (proposal.resolutionId === 'condemn_aggressive_war' && !targetNationId) {
      return {
        proposal: {
          ...proposal,
          resolved: true,
          passed: false,
          votes: [],
          outcomeText: 'No eligible World Council member could be targeted.',
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
      outcomeText: passed
        ? `Passed by Influence (${support}-${oppose}).`
        : `Failed by Influence (${support}-${oppose}).`,
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
    const participantNationIds = context.members
      .filter((member) => this.shouldSignFreeTrade(member.nationId, context.members))
      .map((member) => member.nationId);
    const passed = participantNationIds.length >= 2;
    const resolved: WorldCouncilResolutionProposal = {
      ...proposal,
      participantNationIds,
      passed,
      resolved: true,
      outcomeText: passed
        ? `${participantNationIds.length} members signed.`
        : 'Fewer than two members signed.',
    };
    return {
      proposal: resolved,
      enacted: passed ? this.createEnactedResolution(resolved, context) : undefined,
    };
  }

  private shouldSignFreeTrade(nationId: string, members: readonly WorldCouncilMember[]): boolean {
    for (const member of members) {
      if (member.nationId === nationId) continue;
      if (this.runtime.getDiplomacyState?.(nationId, member.nationId) === 'WAR') return false;
      const memory = this.runtime.getRelationMemory?.(nationId, member.nationId);
      if (memory && relationScore(memory) < -25) return false;
    }
    return true;
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
      turn: context.turn,
      participantNationIds: proposal.participantNationIds ? [...proposal.participantNationIds] : undefined,
      targetNationId: proposal.targetNationId,
    };
  }
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

function relationScore(memory: { readonly trust: number; readonly hostility: number } | undefined): number {
  if (!memory) return 0;
  return memory.trust - memory.hostility;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
