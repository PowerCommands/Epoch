export type GossipCategory = 'information' | 'manipulation' | 'insult';

export interface GossipRelationEffectConfig {
  readonly trustPerInfluence: number;
  readonly suspicionPerInfluence: number;
  readonly hostilityPerInfluence: number;
  readonly affinityPerInfluence: number;
  readonly fearPerInfluence: number;
}

export type GossipInsultSubtype = 'provocation' | 'threat';
export type GossipFlavorContext = 'war_declaration' | 'city_capture' | 'ongoing_war' | 'hostile_peacetime';

export interface GossipInsultEffectConfig {
  readonly trust: number;
  readonly suspicion: number;
  readonly hostility: number;
  readonly affinity: number;
  readonly fear: number;
}

export interface GossipDefinition {
  readonly id: string;
  readonly type: GossipCategory;
  readonly textTemplate: string;
  readonly requiresTarget: boolean;
  readonly requiredCultureNodeId?: string;
  readonly manipulationWeight?: number;
  readonly insultWeight?: number;
  readonly insultSubtype?: GossipInsultSubtype;
  readonly flavorContexts?: readonly GossipFlavorContext[];
  readonly effect?: GossipRelationEffectConfig;
  readonly insultEffect?: GossipInsultEffectConfig;
  readonly responseKind?: GossipInformationResponseKind;
}

export type GossipInformationResponseKind =
  | 'opinion'
  | 'agenda'
  | 'most_trusted'
  | 'least_trusted'
  | 'most_feared'
  | 'greatest_rival'
  | 'war_risk';

export interface GossipExecutionInput {
  readonly itemId: string;
  readonly sourceNationId: string;
  readonly recipientNationId: string;
  readonly targetNationId?: string;
  readonly influence?: number;
  /** Defaults to the round provider supplied to GossipSystem. */
  readonly currentRound?: number;
}

export interface GossipDiplomaticEffect {
  readonly fromNationId: string;
  readonly towardNationId: string;
  readonly trustDelta: number;
  readonly suspicionDelta: number;
  readonly hostilityDelta: number;
  readonly affinityDelta: number;
  readonly fearDelta: number;
  readonly trustAfter: number;
  readonly suspicionAfter: number;
  readonly hostilityAfter: number;
  readonly affinityAfter: number;
  readonly fearAfter: number;
}

export interface GossipManipulationCost {
  readonly itemId: string;
  readonly sourceNationId: string;
  readonly selectedInfluenceTier: number;
  readonly sourceEra: import('../data/technologies').Era;
  readonly eraMultiplier: number;
  readonly itemWeight: number;
  /** Rounded up after multiplying the base tier, source-era multiplier and item weight. */
  readonly actualCost: number;
}

export type GossipFailureReason =
  | 'unknown_item'
  | 'invalid_source'
  | 'invalid_recipient'
  | 'invalid_target'
  | 'invalid_combination'
  | 'influence_required'
  | 'insufficient_influence'
  | 'recipient_rejects'
  | 'cooldown_active'
  | 'insult_cooldown_active'
  | 'culture_locked';

export interface GossipSuccessResult {
  readonly success: true;
  readonly itemId: string;
  readonly type: GossipCategory;
  readonly resolvedText: string;
  readonly responseText?: string;
  readonly influenceSpent: number;
  readonly diplomaticEffect?: GossipDiplomaticEffect;
  readonly cooldownRemainingRounds: number;
  readonly sourceNationId?: string;
  readonly recipientNationId?: string;
  readonly targetNationId?: string;
  readonly selectedInfluenceTier?: number;
  readonly manipulationWeight?: number;
  readonly eraMultiplier?: number;
  readonly insultWeight?: number;
  readonly insultSubtype?: GossipInsultSubtype;
  readonly threatCredible?: boolean;
  readonly fearMultiplier?: number;
  readonly resolvedSubjectNationId?: string;
  readonly resolvedSubjectNationName?: string;
  readonly resolvedSubjectLeaderId?: string;
  readonly resolvedSubjectLeaderName?: string;
}

export interface GossipFailureResult {
  readonly success: false;
  readonly itemId: string;
  readonly type?: GossipCategory;
  readonly failureReason: GossipFailureReason;
  readonly influenceSpent: 0;
  readonly cooldownRemainingRounds: number;
}

export type GossipExecutionResult = GossipSuccessResult | GossipFailureResult;

export interface GossipItemAvailability {
  readonly available: boolean;
  readonly requiredCultureNodeId?: string;
  readonly requiredCultureNodeName?: string;
  readonly failureReason?: Extract<GossipFailureReason, 'unknown_item' | 'invalid_source' | 'culture_locked'>;
}

export interface SavedGossipManipulationCooldown {
  readonly sourceNationId: string;
  readonly recipientNationId: string;
  /** First round on which manipulation is allowed again. */
  readonly availableAtRound: number;
}

export interface SavedGossipState {
  readonly manipulationCooldowns: SavedGossipManipulationCooldown[];
  readonly insultCooldowns?: SavedGossipManipulationCooldown[];
}

export interface GossipManipulationStatus {
  readonly allowed: boolean;
  readonly remainingRounds: number;
  readonly failureReason?: Extract<
    GossipFailureReason,
    'invalid_source' | 'invalid_recipient' | 'recipient_rejects' | 'cooldown_active'
  >;
}

export interface GossipInsultStatus {
  readonly allowed: boolean;
  readonly remainingRounds: number;
  readonly failureReason?: Extract<
    GossipFailureReason,
    'invalid_source' | 'invalid_recipient' | 'insult_cooldown_active'
  >;
}
