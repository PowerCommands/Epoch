import { getGossipDefinition } from '../data/gossip';
import { getAIStrategyById } from '../data/aiStrategies';
import { getCultureNodeById } from '../data/cultureTree';
import { getGamesSportById } from '../data/gamesOfNationsSports';
import {
  getLeaderByNationId,
  getLeaderIdeologyByNationId,
  getLeaderPersonalityByNationId,
} from '../data/leaders';
import type { Nation } from '../entities/Nation';
import type { Era } from '../data/technologies';
import type { NationManager } from './NationManager';
import type { DiplomacyManager, DiplomacyRelation } from './DiplomacyManager';
import type {
  GossipDefinition,
  GossipExecutionInput,
  GossipExecutionResult,
  GossipFailureReason,
  GossipItemAvailability,
  GossipManipulationStatus,
  GossipManipulationCost,
  GossipInsultStatus,
  GossipDiplomaticEffect,
  GossipInsultEffectConfig,
  KnownSportsPreferences,
  SavedGossipState,
} from '../types/gossip';
import { formatGossipText, type GossipTextContext } from '../utils/gossipText';
import {
  MEANINGFUL_RIVALRY_SCORE,
  MEANINGFUL_WAR_RISK_SCORE,
  calculateGossipRivalryScore,
  calculateGossipWarRiskScore,
  describeGossipAgenda,
} from './gossip/GossipInformationResolver';

export const MANIPULATION_COOLDOWN_ROUNDS = 10;
export const MANIPULATION_ACCEPTANCE_SCORE_THRESHOLD = -25;
export const INSULT_COOLDOWN_ROUNDS = 5;

export const THREAT_WEAK_RATIO = 0.75;
export const THREAT_FULL_CREDIBILITY_RATIO = 1.25;
export const THREAT_OVERWHELMING_RATIO = 2;
export const THREAT_COMPARABLE_FEAR_MULTIPLIER = 0.75;
export const THREAT_FULL_FEAR_MULTIPLIER = 1;
export const THREAT_OVERWHELMING_FEAR_MULTIPLIER = 1.25;

export const GOSSIP_MANIPULATION_ERA_MULTIPLIERS: Readonly<Record<Era, number>> = {
  ancient: 1,
  classical: 1.15,
  medieval: 1.3,
  renaissance: 1.5,
  industrial: 1.75,
  modern: 2,
  atomic: 2.25,
  information: 2.5,
  future: 2.75,
};

export interface GossipInfluenceGateway {
  spendInfluence(nationId: string, amount: number): number;
}

export interface GossipKnowledgeGateway {
  hasMet(observerNationId: string, otherNationId: string): boolean;
  isGamesOfNationsFounded?: () => boolean;
}

const SPORTS_PREFERENCE_RESPONSE_TEMPLATES = [
  "I've always had a fondness for {traditionalSport}. And among the newer events, nothing compares to {additionalSport}.",
  '{traditionalSport} has always been close to my heart, though I have a particular weakness for {additionalSport}.',
  'Give me {traditionalSport} any day. Although I would never miss a good {additionalSport} contest.',
  'I have always enjoyed {traditionalSport}, though I would love to see more of {additionalSport}.',
] as const;

export function calculateThreatFearMultiplier(sourcePower: number, recipientPower: number): number {
  const safeSourcePower = Math.max(0, sourcePower);
  const safeRecipientPower = Math.max(0, recipientPower);
  const ratio = safeRecipientPower === 0
    ? safeSourcePower > 0 ? Number.POSITIVE_INFINITY : 1
    : safeSourcePower / safeRecipientPower;
  if (ratio < THREAT_WEAK_RATIO) return 0;
  if (ratio < THREAT_FULL_CREDIBILITY_RATIO) return THREAT_COMPARABLE_FEAR_MULTIPLIER;
  if (ratio <= THREAT_OVERWHELMING_RATIO) return THREAT_FULL_FEAR_MULTIPLIER;
  return THREAT_OVERWHELMING_FEAR_MULTIPLIER;
}

export interface ManipulationAvailability {
  readonly allowed: boolean;
  readonly remainingRounds: number;
}

function clampRelation(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function relationAcceptanceScore(relation: DiplomacyRelation): number {
  return relation.trust + relation.affinity - relation.hostility - relation.suspicion;
}

function opinionResponse(targetLeaderName: string, relation: DiplomacyRelation): string {
  const score = relation.trust + relation.affinity - relation.hostility - relation.suspicion;
  if (relation.state === 'WAR' || score <= -50) return `${targetLeaderName} is an enemy I will not trust.`;
  if (score < 10) return `I have serious doubts about ${targetLeaderName}.`;
  if (score < 60) return `I remain cautious about ${targetLeaderName}.`;
  return `I consider ${targetLeaderName} a trusted friend.`;
}

export class GossipSystem {
  private readonly manipulationCooldowns = new Map<string, number>();
  private readonly insultCooldowns = new Map<string, number>();
  private readonly discoveredSportsPreferences = new Set<string>();

  constructor(
    private readonly nationManager: NationManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly influenceGateway: GossipInfluenceGateway,
    private readonly getCurrentRound: () => number,
    private readonly knowledgeGateway: GossipKnowledgeGateway = { hasMet: () => true },
    private readonly getSourceEra: (nationId: string) => Era = () => 'ancient',
    private readonly getMilitaryPower: (nationId: string) => number = () => 0,
  ) {}

  /** Authoritative preview; execution uses this same calculation and rounds upward. */
  getManipulationCost(
    itemId: string,
    sourceNationId: string,
    selectedInfluenceTier: number,
  ): GossipManipulationCost | undefined {
    const definition = getGossipDefinition(itemId);
    const source = this.nationManager.getNation(sourceNationId);
    if (definition?.type !== 'manipulation' || !source?.isHuman
      || !Number.isFinite(selectedInfluenceTier) || !Number.isInteger(selectedInfluenceTier)
      || selectedInfluenceTier <= 0) return undefined;
    const sourceEra = this.getSourceEra(sourceNationId);
    const eraMultiplier = GOSSIP_MANIPULATION_ERA_MULTIPLIERS[sourceEra];
    const itemWeight = definition.manipulationWeight ?? 1;
    return {
      itemId,
      sourceNationId,
      selectedInfluenceTier,
      sourceEra,
      eraMultiplier,
      itemWeight,
      actualCost: Math.ceil(selectedInfluenceTier * eraMultiplier * itemWeight),
    };
  }

  getItemAvailability(sourceNationId: string, itemId: string, recipientNationId?: string): GossipItemAvailability {
    const definition = getGossipDefinition(itemId);
    if (!definition) return { available: false, failureReason: 'unknown_item' };
    const source = this.nationManager.getNation(sourceNationId);
    if (!source?.isHuman) return { available: false, failureReason: 'invalid_source' };
    if (definition.requiresGamesOfNationsFounded) {
      if (this.knowledgeGateway.isGamesOfNationsFounded?.() !== true) {
        return { available: false, visible: false, failureReason: 'games_not_founded' };
      }
      const recipient = recipientNationId ? this.nationManager.getNation(recipientNationId) : undefined;
      if (!recipient || recipient.isHuman || !this.knowledgeGateway.hasMet(sourceNationId, recipient.id)) {
        return { available: false, visible: false, failureReason: 'invalid_recipient' };
      }
      if (this.hasDiscoveredSportsPreferences(sourceNationId, recipient.id)) {
        return { available: false, visible: false, failureReason: 'already_discovered' };
      }
    }
    const requiredCultureNodeId = definition.requiredCultureNodeId;
    if (!requiredCultureNodeId) return { available: true };
    const requiredCultureNodeName = getCultureNodeById(requiredCultureNodeId)?.name ?? requiredCultureNodeId;
    if (!source.unlockedCultureNodeIds.includes(requiredCultureNodeId)) {
      return {
        available: false,
        failureReason: 'culture_locked',
        requiredCultureNodeId,
        requiredCultureNodeName,
      };
    }
    return { available: true, requiredCultureNodeId, requiredCultureNodeName };
  }

  canManipulate(sourceNationId: string, recipientNationId: string, currentRound = this.getCurrentRound()): ManipulationAvailability {
    const availableAt = this.manipulationCooldowns.get(this.cooldownKey(sourceNationId, recipientNationId)) ?? currentRound;
    const remainingRounds = Math.max(0, availableAt - currentRound);
    return { allowed: remainingRounds === 0, remainingRounds };
  }

  /** Read-only eligibility used by presentation code; never spends Influence. */
  getManipulationStatus(
    sourceNationId: string,
    recipientNationId: string,
    currentRound = this.getCurrentRound(),
  ): GossipManipulationStatus {
    const source = this.nationManager.getNation(sourceNationId);
    if (!source?.isHuman) return { allowed: false, remainingRounds: 0, failureReason: 'invalid_source' };
    const recipient = this.nationManager.getNation(recipientNationId);
    if (!recipient || recipient.isHuman) {
      return { allowed: false, remainingRounds: 0, failureReason: 'invalid_recipient' };
    }
    const cooldown = this.canManipulate(sourceNationId, recipientNationId, currentRound);
    if (!cooldown.allowed) {
      return { allowed: false, remainingRounds: cooldown.remainingRounds, failureReason: 'cooldown_active' };
    }
    const relation = this.diplomacyManager.getRelation(recipientNationId, sourceNationId);
    if (relationAcceptanceScore(relation) < MANIPULATION_ACCEPTANCE_SCORE_THRESHOLD) {
      return { allowed: false, remainingRounds: 0, failureReason: 'recipient_rejects' };
    }
    return { allowed: true, remainingRounds: 0 };
  }

  /** Insult eligibility is independent from Manipulation acceptance/cooldown. */
  getInsultStatus(
    sourceNationId: string,
    recipientNationId: string,
    currentRound = this.getCurrentRound(),
  ): GossipInsultStatus {
    const source = this.nationManager.getNation(sourceNationId);
    if (!source?.isHuman) return { allowed: false, remainingRounds: 0, failureReason: 'invalid_source' };
    const recipient = this.nationManager.getNation(recipientNationId);
    if (!recipient || recipient.isHuman) {
      return { allowed: false, remainingRounds: 0, failureReason: 'invalid_recipient' };
    }
    const availableAt = this.insultCooldowns.get(this.cooldownKey(sourceNationId, recipientNationId)) ?? currentRound;
    const remainingRounds = Math.max(0, availableAt - currentRound);
    return remainingRounds > 0
      ? { allowed: false, remainingRounds, failureReason: 'insult_cooldown_active' }
      : { allowed: true, remainingRounds: 0 };
  }

  /** Resolve a statement for previews without executing or mutating anything. */
  resolveText(input: GossipExecutionInput): string | undefined {
    const definition = getGossipDefinition(input.itemId);
    if (!definition || this.validateNations(definition, input)) return undefined;
    return formatGossipText(definition.textTemplate, this.createTextContext(input));
  }

  recordSuccessfulManipulation(sourceNationId: string, recipientNationId: string, currentRound = this.getCurrentRound()): void {
    this.manipulationCooldowns.set(
      this.cooldownKey(sourceNationId, recipientNationId),
      currentRound + MANIPULATION_COOLDOWN_ROUNDS,
    );
  }

  execute(input: GossipExecutionInput): GossipExecutionResult {
    const definition = getGossipDefinition(input.itemId);
    const currentRound = input.currentRound ?? this.getCurrentRound();
    if (!definition) return this.failure(input.itemId, undefined, 'unknown_item', 0);

    const validationFailure = this.validateNations(definition, input);
    if (validationFailure) return this.failure(input.itemId, definition, validationFailure, 0);
    const availability = this.getItemAvailability(input.sourceNationId, input.itemId, input.recipientNationId);
    if (!availability.available) {
      return this.failure(input.itemId, definition, availability.failureReason ?? 'culture_locked', 0);
    }

    const context = this.createTextContext(input);
    const resolvedText = formatGossipText(definition.textTemplate, context);

    if (definition.type === 'information') {
      const information = this.resolveInformation(definition, input, context);
      if (definition.responseKind === 'sports_preferences') {
        this.discoveredSportsPreferences.add(this.discoveryKey(input.sourceNationId, input.recipientNationId));
      }
      return {
        success: true,
        itemId: definition.id,
        type: definition.type,
        resolvedText,
        responseText: information.responseText,
        influenceSpent: 0,
        cooldownRemainingRounds: 0,
        ...this.subjectResult(information.subject),
      };
    }

    if (definition.type === 'insult') {
      const status = this.getInsultStatus(input.sourceNationId, input.recipientNationId, currentRound);
      if (!status.allowed) {
        return this.failure(input.itemId, definition, status.failureReason!, status.remainingRounds);
      }
      const insultEffect = definition.insultEffect!;
      const fearMultiplier = definition.insultSubtype === 'threat'
        ? calculateThreatFearMultiplier(
          this.getMilitaryPower(input.sourceNationId),
          this.getMilitaryPower(input.recipientNationId),
        )
        : 0;
      const diplomaticEffect = this.applyInsultEffect(
        input.recipientNationId,
        input.sourceNationId,
        insultEffect,
        fearMultiplier,
      );
      this.insultCooldowns.set(
        this.cooldownKey(input.sourceNationId, input.recipientNationId),
        currentRound + INSULT_COOLDOWN_ROUNDS,
      );
      return {
        success: true,
        itemId: definition.id,
        type: definition.type,
        resolvedText,
        responseText: this.resolveInsultResponse(definition, input, fearMultiplier),
        influenceSpent: 0,
        diplomaticEffect,
        cooldownRemainingRounds: INSULT_COOLDOWN_ROUNDS,
        sourceNationId: input.sourceNationId,
        recipientNationId: input.recipientNationId,
        insultWeight: definition.insultWeight,
        insultSubtype: definition.insultSubtype,
        threatCredible: definition.insultSubtype === 'threat' ? fearMultiplier > 0 : undefined,
        fearMultiplier: definition.insultSubtype === 'threat' ? fearMultiplier : undefined,
      };
    }

    const influence = input.influence;
    const cost = this.getManipulationCost(input.itemId, input.sourceNationId, influence ?? Number.NaN);
    if (!cost) {
      return this.failure(input.itemId, definition, 'influence_required', 0);
    }
    const status = this.getManipulationStatus(input.sourceNationId, input.recipientNationId, currentRound);
    if (!status.allowed) {
      return this.failure(input.itemId, definition, status.failureReason!, status.remainingRounds);
    }
    const availableInfluence = this.nationManager.getResources(input.sourceNationId).influence;
    if (availableInfluence < cost.actualCost) {
      return this.failure(input.itemId, definition, 'insufficient_influence', 0);
    }

    const spent = this.influenceGateway.spendInfluence(input.sourceNationId, cost.actualCost);
    if (spent !== cost.actualCost) {
      return this.failure(input.itemId, definition, 'insufficient_influence', 0);
    }

    const before = this.diplomacyManager.getRelation(input.recipientNationId, input.targetNationId!);
    const effect = definition.effect!;
    // The selected base tier scales effects; era and weight only determine price.
    const trustAfter = clampRelation(before.trust + cost.selectedInfluenceTier * effect.trustPerInfluence);
    const suspicionAfter = clampRelation(before.suspicion + cost.selectedInfluenceTier * effect.suspicionPerInfluence);
    const hostilityAfter = clampRelation(before.hostility + cost.selectedInfluenceTier * effect.hostilityPerInfluence);
    const affinityAfter = clampRelation(before.affinity + cost.selectedInfluenceTier * effect.affinityPerInfluence);
    const fearAfter = clampRelation(before.fear + cost.selectedInfluenceTier * effect.fearPerInfluence);
    this.diplomacyManager.setMemoryValues(input.recipientNationId, input.targetNationId!, {
      trust: trustAfter,
      fear: fearAfter,
      hostility: hostilityAfter,
      affinity: affinityAfter,
      suspicion: suspicionAfter,
    });
    this.recordSuccessfulManipulation(input.sourceNationId, input.recipientNationId, currentRound);

    return {
      success: true,
      itemId: definition.id,
      type: definition.type,
      resolvedText,
      influenceSpent: spent,
      sourceNationId: input.sourceNationId,
      recipientNationId: input.recipientNationId,
      targetNationId: input.targetNationId!,
      selectedInfluenceTier: cost.selectedInfluenceTier,
      manipulationWeight: cost.itemWeight,
      eraMultiplier: cost.eraMultiplier,
      diplomaticEffect: {
        fromNationId: input.recipientNationId,
        towardNationId: input.targetNationId!,
        trustDelta: trustAfter - before.trust,
        suspicionDelta: suspicionAfter - before.suspicion,
        hostilityDelta: hostilityAfter - before.hostility,
        affinityDelta: affinityAfter - before.affinity,
        fearDelta: fearAfter - before.fear,
        trustAfter,
        suspicionAfter,
        hostilityAfter,
        affinityAfter,
        fearAfter,
      },
      cooldownRemainingRounds: MANIPULATION_COOLDOWN_ROUNDS,
    };
  }

  serialize(): SavedGossipState {
    return {
      manipulationCooldowns: Array.from(this.manipulationCooldowns, ([key, availableAtRound]) => {
        const [sourceNationId, recipientNationId] = key.split('->');
        return { sourceNationId: sourceNationId!, recipientNationId: recipientNationId!, availableAtRound };
      }),
      insultCooldowns: Array.from(this.insultCooldowns, ([key, availableAtRound]) => {
        const [sourceNationId, recipientNationId] = key.split('->');
        return { sourceNationId: sourceNationId!, recipientNationId: recipientNationId!, availableAtRound };
      }),
      discoveredSportsPreferences: Array.from(this.discoveredSportsPreferences, (key) => {
        const [sourceNationId, recipientNationId] = key.split('->');
        return { sourceNationId: sourceNationId!, recipientNationId: recipientNationId! };
      }),
    };
  }

  restore(state: SavedGossipState | undefined): void {
    this.manipulationCooldowns.clear();
    this.insultCooldowns.clear();
    this.discoveredSportsPreferences.clear();
    for (const entry of state?.manipulationCooldowns ?? []) {
      if (!Number.isFinite(entry.availableAtRound)) continue;
      this.manipulationCooldowns.set(
        this.cooldownKey(entry.sourceNationId, entry.recipientNationId),
        Math.max(0, Math.floor(entry.availableAtRound)),
      );
    }
    for (const entry of state?.insultCooldowns ?? []) {
      if (!Number.isFinite(entry.availableAtRound)) continue;
      this.insultCooldowns.set(
        this.cooldownKey(entry.sourceNationId, entry.recipientNationId),
        Math.max(0, Math.floor(entry.availableAtRound)),
      );
    }
    for (const entry of state?.discoveredSportsPreferences ?? []) {
      if (!this.nationManager.getNation(entry.sourceNationId)?.isHuman) continue;
      if (!this.nationManager.getNation(entry.recipientNationId)) continue;
      this.discoveredSportsPreferences.add(this.discoveryKey(entry.sourceNationId, entry.recipientNationId));
    }
  }

  hasDiscoveredSportsPreferences(sourceNationId: string, recipientNationId: string): boolean {
    return this.discoveredSportsPreferences.has(this.discoveryKey(sourceNationId, recipientNationId));
  }

  getKnownSportsPreferences(sourceNationId: string, recipientNationId: string): KnownSportsPreferences | null {
    if (!this.hasDiscoveredSportsPreferences(sourceNationId, recipientNationId)) return null;
    const preferences = getLeaderByNationId(recipientNationId)?.gamesOfNationsPreferences;
    if (!preferences) return null;
    return {
      traditionalSport: getGamesSportById(preferences.traditionalFavourite).name,
      additionalSport: getGamesSportById(preferences.additionalFavourite).name,
    };
  }

  private applyInsultEffect(
    fromNationId: string,
    towardNationId: string,
    effect: GossipInsultEffectConfig,
    fearMultiplier: number,
  ): GossipDiplomaticEffect {
    const before = this.diplomacyManager.getRelation(fromNationId, towardNationId);
    const trustAfter = clampRelation(before.trust + effect.trust);
    const suspicionAfter = clampRelation(before.suspicion + effect.suspicion);
    const hostilityAfter = clampRelation(before.hostility + effect.hostility);
    const affinityAfter = clampRelation(before.affinity + effect.affinity);
    const fearAfter = clampRelation(before.fear + effect.fear * fearMultiplier);
    this.diplomacyManager.setMemoryValues(fromNationId, towardNationId, {
      trust: trustAfter,
      suspicion: suspicionAfter,
      hostility: hostilityAfter,
      affinity: affinityAfter,
      fear: fearAfter,
    });
    return {
      fromNationId,
      towardNationId,
      trustDelta: trustAfter - before.trust,
      suspicionDelta: suspicionAfter - before.suspicion,
      hostilityDelta: hostilityAfter - before.hostility,
      affinityDelta: affinityAfter - before.affinity,
      fearDelta: fearAfter - before.fear,
      trustAfter,
      suspicionAfter,
      hostilityAfter,
      affinityAfter,
      fearAfter,
    };
  }

  private resolveInsultResponse(
    definition: GossipDefinition,
    input: GossipExecutionInput,
    fearMultiplier: number,
  ): string {
    const context = this.createTextContext(input);
    const pool = definition.insultSubtype !== 'threat'
      ? [
        'Your contempt has been noted, {sourceLeaderName}.',
        'Mind your words. I will remember them.',
        'A poor attempt at wit from {sourceNationName}.',
      ]
      : fearMultiplier === 0
        ? [
          'An impressive threat, considering the state of your army.',
          'Your army? I assumed those were farmers.',
          'You may wish to count your soldiers before threatening mine.',
        ]
        : fearMultiplier > THREAT_FULL_FEAR_MULTIPLIER
          ? [
            'I understand the danger, but do not mistake caution for surrender.',
            'Your strength is plain. So is the risk of using it.',
          ]
          : [
            'I will keep that warning in mind.',
            'Threats are dangerous things, {sourceLeaderName}.',
          ];
    const seed = `${definition.id}|${input.sourceNationId}|${input.recipientNationId}`
      .split('')
      .reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return formatGossipText(pool[seed % pool.length]!, context);
  }

  private validateNations(definition: GossipDefinition, input: GossipExecutionInput): GossipFailureReason | undefined {
    const source = this.nationManager.getNation(input.sourceNationId);
    if (!source?.isHuman) return 'invalid_source';
    const recipient = this.nationManager.getNation(input.recipientNationId);
    if (!recipient || recipient.isHuman) return 'invalid_recipient';
    if (source.id === recipient.id) return 'invalid_combination';
    if (!definition.requiresTarget) return undefined;
    const target = input.targetNationId ? this.nationManager.getNation(input.targetNationId) : undefined;
    if (!target) return 'invalid_target';
    if (target.id === source.id || target.id === recipient.id) return 'invalid_combination';
    if (!this.knowledgeGateway.hasMet(source.id, target.id)) return 'invalid_target';
    return undefined;
  }

  private resolveInformation(
    definition: GossipDefinition,
    input: GossipExecutionInput,
    context: GossipTextContext,
  ): { responseText: string; subject?: Nation } {
    const recipient = this.nationManager.getNation(input.recipientNationId)!;
    if (definition.responseKind === 'opinion') {
      const subject = this.nationManager.getNation(input.targetNationId!);
      if (!subject) return { responseText: 'I have no strong opinion on that.' };
      const relation = this.diplomacyManager.getRelation(recipient.id, subject.id);
      return { responseText: opinionResponse(context.targetLeaderName ?? subject.name, relation), subject };
    }
    if (definition.responseKind === 'agenda') {
      return { responseText: describeGossipAgenda(recipient.aiStrategyId, recipient.aiNationalAgendaId) };
    }
    if (definition.responseKind === 'sports_preferences') {
      const preferences = getLeaderByNationId(recipient.id)?.gamesOfNationsPreferences;
      if (!preferences) return { responseText: 'I have not settled on any particular events.' };
      const traditionalSport = getGamesSportById(preferences.traditionalFavourite).name;
      const additionalSport = getGamesSportById(preferences.additionalFavourite).name;
      const seed = `${recipient.id}|sports-preferences`.split('')
        .reduce((sum, character) => sum + character.charCodeAt(0), 0);
      return {
        responseText: SPORTS_PREFERENCE_RESPONSE_TEMPLATES[seed % SPORTS_PREFERENCE_RESPONSE_TEMPLATES.length]!
          .split('{traditionalSport}').join(traditionalSport)
          .split('{additionalSport}').join(additionalSport),
      };
    }

    const candidates = this.getAutomaticCandidates(recipient.id);
    if (candidates.length === 0) {
      return { responseText: "I don't have enough dealings with the others to answer that." };
    }

    if (definition.responseKind === 'most_trusted') {
      const subject = this.selectCandidate(candidates, (candidate) => (
        this.diplomacyManager.getRelation(recipient.id, candidate.id).trust
      ), 'highest');
      return { responseText: this.subjectResponse('I trust {targetLeaderName} more than the others.', subject), subject };
    }
    if (definition.responseKind === 'least_trusted') {
      const subject = this.selectCandidate(candidates, (candidate) => (
        this.diplomacyManager.getRelation(recipient.id, candidate.id).trust
      ), 'lowest');
      return { responseText: this.subjectResponse('{targetLeaderName} has given me very little reason to trust them.', subject), subject };
    }
    if (definition.responseKind === 'most_feared') {
      const subject = this.selectCandidate(candidates, (candidate) => (
        this.diplomacyManager.getRelation(recipient.id, candidate.id).fear
      ), 'highest');
      const fear = this.diplomacyManager.getRelation(recipient.id, subject.id).fear;
      if (fear <= 0) return { responseText: 'At the moment, no one particularly frightens me.' };
      return { responseText: this.subjectResponse('{targetLeaderName} concerns me more than anyone else.', subject), subject };
    }
    if (definition.responseKind === 'greatest_rival') {
      const subject = this.selectCandidate(candidates, (candidate) => (
        calculateGossipRivalryScore(this.diplomacyManager.getRelation(recipient.id, candidate.id))
      ), 'highest');
      const score = calculateGossipRivalryScore(this.diplomacyManager.getRelation(recipient.id, subject.id));
      if (score <= MEANINGFUL_RIVALRY_SCORE) return { responseText: 'I have no strong rival at the moment.' };
      return { responseText: this.subjectResponse('{targetLeaderName} is the power I watch most carefully.', subject), subject };
    }
    if (definition.responseKind === 'war_risk') {
      const scoreCandidate = (candidate: Nation): number => calculateGossipWarRiskScore({
        relation: this.diplomacyManager.getRelation(recipient.id, candidate.id),
        leaderAggressionBias: getLeaderPersonalityByNationId(candidate.id).aggressionBias,
        ideologyWarBias: getLeaderIdeologyByNationId(candidate.id).warBias,
        strategyAggression: getAIStrategyById(candidate.aiStrategyId).military.aggression,
      });
      const subject = this.selectCandidate(candidates, scoreCandidate, 'highest');
      if (scoreCandidate(subject) <= MEANINGFUL_WAR_RISK_SCORE) {
        return { responseText: 'No one appears eager to start a war at the moment.' };
      }
      return {
        responseText: this.subjectResponse('{targetLeaderName} worries me. They seem far too comfortable with the idea of war.', subject),
        subject,
      };
    }
    return { responseText: 'I have no strong opinion on that.' };
  }

  private getAutomaticCandidates(recipientNationId: string): Nation[] {
    return this.nationManager.getAllNations()
      .filter((nation) => nation.id !== recipientNationId && this.knowledgeGateway.hasMet(recipientNationId, nation.id))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  private selectCandidate(
    candidates: readonly Nation[],
    score: (candidate: Nation) => number,
    direction: 'highest' | 'lowest',
  ): Nation {
    let selected = candidates[0]!;
    let selectedScore = score(selected);
    for (const candidate of candidates.slice(1)) {
      const candidateScore = score(candidate);
      if ((direction === 'highest' && candidateScore > selectedScore)
        || (direction === 'lowest' && candidateScore < selectedScore)) {
        selected = candidate;
        selectedScore = candidateScore;
      }
    }
    return selected;
  }

  private subjectResponse(template: string, subject: Nation): string {
    const leader = getLeaderByNationId(subject.id);
    return formatGossipText(template, {
      targetNationName: subject.name,
      targetLeaderName: leader?.name ?? subject.name,
    });
  }

  private subjectResult(subject: Nation | undefined): {
    resolvedSubjectNationId?: string;
    resolvedSubjectNationName?: string;
    resolvedSubjectLeaderId?: string;
    resolvedSubjectLeaderName?: string;
  } {
    if (!subject) return {};
    const leader = getLeaderByNationId(subject.id);
    return {
      resolvedSubjectNationId: subject.id,
      resolvedSubjectNationName: subject.name,
      resolvedSubjectLeaderId: leader?.id,
      resolvedSubjectLeaderName: leader?.name ?? subject.name,
    };
  }

  private createTextContext(input: GossipExecutionInput): GossipTextContext {
    const source = this.nationManager.getNation(input.sourceNationId)!;
    const recipient = this.nationManager.getNation(input.recipientNationId)!;
    const target = input.targetNationId ? this.nationManager.getNation(input.targetNationId) : undefined;
    return {
      sourceNationName: source.name,
      sourceLeaderName: getLeaderByNationId(source.id)?.name ?? source.name,
      recipientNationName: recipient.name,
      recipientLeaderName: getLeaderByNationId(recipient.id)?.name ?? recipient.name,
      targetNationName: target?.name,
      targetLeaderName: target ? getLeaderByNationId(target.id)?.name ?? target.name : undefined,
    };
  }

  private failure(
    itemId: string,
    definition: GossipDefinition | undefined,
    failureReason: GossipFailureReason,
    cooldownRemainingRounds: number,
  ): GossipExecutionResult {
    return {
      success: false,
      itemId,
      type: definition?.type,
      failureReason,
      influenceSpent: 0,
      cooldownRemainingRounds,
    };
  }

  private cooldownKey(sourceNationId: string, recipientNationId: string): string {
    return `${sourceNationId}->${recipientNationId}`;
  }

  private discoveryKey(sourceNationId: string, recipientNationId: string): string {
    return `${sourceNationId}->${recipientNationId}`;
  }
}
