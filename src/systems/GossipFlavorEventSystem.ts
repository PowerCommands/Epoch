import { GOSSIP_DEFINITIONS } from '../data/gossip';
import { getLeaderByNationId } from '../data/leaders';
import type { NationManager } from './NationManager';
import type { DiplomacyManager, DiplomacyRelation } from './DiplomacyManager';
import type { HistoricalTimelineService } from './HistoricalTimelineService';
import type { GossipDefinition, GossipFlavorContext } from '../types/gossip';
import type { GossipFlavorEventResult, SavedGossipFlavorState } from '../types/gossipFlavor';
import { formatGossipText } from '../utils/gossipText';
import { calculateThreatFearMultiplier } from './GossipSystem';

export const GOSSIP_FLAVOR_PAIR_COOLDOWN_ROUNDS = 25;
export const GOSSIP_FLAVOR_PERIODIC_INTERVAL_ROUNDS = 5;
export const GOSSIP_FLAVOR_EVENT_ICON = '💬';
export const GOSSIP_FLAVOR_EVENT_TYPE = 'leaderInsult' as const;

export const GOSSIP_FLAVOR_TRIGGER_PROBABILITIES: Readonly<Record<GossipFlavorContext, number>> = {
  war_declaration: 0.45,
  city_capture: 0.3,
  ongoing_war: 0.08,
  hostile_peacetime: 0.04,
};

const MAX_WEIGHT_BY_CONTEXT: Readonly<Record<GossipFlavorContext, number>> = {
  war_declaration: 2,
  city_capture: 1.4,
  ongoing_war: 2,
  hostile_peacetime: 1.6,
};

export interface GossipFlavorEventContext {
  readonly nationManager: NationManager;
  readonly diplomacyManager: DiplomacyManager;
  readonly historicalTimeline: HistoricalTimelineService;
  readonly getRound: () => number;
  readonly getMilitaryPower: (nationId: string) => number;
  readonly isNationActive: (nationId: string) => boolean;
  /**
   * Cultural Jealousy hook: whether `speakerId` currently resents `recipientId`
   * as its cultural-leader target. When set, a jealous nation preferentially
   * insults its target even before the relation is severely hostile, feeding the
   * agenda into this existing insult path. Defaults to never.
   */
  readonly isCulturalJealousyAggressor?: (speakerId: string, recipientId: string) => boolean;
  readonly randomSeed: string;
  /** Injectable deterministic roll for focused tests. */
  readonly roll?: (key: string) => number;
  readonly logGenerated?: (result: GossipFlavorEventResult) => void;
}

export interface GossipFlavorTriggerInput {
  readonly trigger: GossipFlavorContext;
  readonly speakerNationId: string;
  readonly recipientNationId: string;
  readonly cityName?: string;
  readonly round?: number;
}

/** A deliberately presentation-only layer. It never calls Gossip execution or diplomacy mutations. */
export class GossipFlavorEventSystem {
  private readonly pairCooldowns = new Map<string, number>();

  constructor(private readonly context: GossipFlavorEventContext) {}

  handleWarDeclared(speakerNationId: string, recipientNationId: string): GossipFlavorEventResult | undefined {
    return this.tryGenerate({ trigger: 'war_declaration', speakerNationId, recipientNationId });
  }

  handleCityCaptured(
    winnerNationId: string,
    loserNationId: string,
    cityName: string,
  ): GossipFlavorEventResult | undefined {
    return this.tryGenerate({
      trigger: 'city_capture', speakerNationId: winnerNationId, recipientNationId: loserNationId, cityName,
    });
  }

  /** Efficient round-level scan for the two rare ambient contexts. */
  handlePeriodicRound(round = this.context.getRound()): GossipFlavorEventResult[] {
    if (round % GOSSIP_FLAVOR_PERIODIC_INTERVAL_ROUNDS !== 0) return [];
    const nations = this.context.nationManager.getAllNations()
      .filter((nation) => this.context.isNationActive(nation.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    const generated: GossipFlavorEventResult[] = [];
    for (let firstIndex = 0; firstIndex < nations.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nations.length; secondIndex += 1) {
        const first = nations[firstIndex]!;
        const second = nations[secondIndex]!;
        if (first.isHuman && second.isHuman) continue;
        const atWar = this.context.diplomacyManager.getState(first.id, second.id) === 'WAR';
        const severelyHostile = isSeverelyHostileRelation(this.context.diplomacyManager.getRelation(first.id, second.id));
        // Cultural Jealousy makes a jealous nation preferentially taunt its
        // cultural-leader target; direction is forced jealous → target.
        const jealousDirection = this.getCulturalJealousyDirection(first.id, second.id);
        const trigger: GossipFlavorContext | undefined = atWar
          ? 'ongoing_war'
          : (severelyHostile || (!atWar && jealousDirection)) ? 'hostile_peacetime' : undefined;
        if (!trigger) continue;
        const [speaker, recipient] = (trigger === 'hostile_peacetime' && jealousDirection)
          ? jealousDirection
          : this.chooseAutomaticDirection(first.id, first.isHuman, second.id, second.isHuman, trigger, round);
        const result = this.tryGenerate({
          trigger, speakerNationId: speaker, recipientNationId: recipient, round,
        });
        if (result) generated.push(result);
      }
    }
    return generated;
  }

  tryGenerate(input: GossipFlavorTriggerInput): GossipFlavorEventResult | undefined {
    const round = input.round ?? this.context.getRound();
    const speaker = this.context.nationManager.getNation(input.speakerNationId);
    const recipient = this.context.nationManager.getNation(input.recipientNationId);
    if (!speaker || !recipient || speaker.id === recipient.id || speaker.isHuman) return undefined;
    if (!this.context.isNationActive(speaker.id) || !this.context.isNationActive(recipient.id)) return undefined;
    if (!this.isCurrentContextValid(input.trigger, speaker.id, recipient.id)) return undefined;
    const key = this.pairKey(speaker.id, recipient.id);
    if ((this.pairCooldowns.get(key) ?? 0) > round) return undefined;

    const baseKey = `${this.context.randomSeed}|${round}|${input.trigger}|${key}|${input.cityName ?? ''}`;
    if (this.roll(`${baseKey}|chance`) >= GOSSIP_FLAVOR_TRIGGER_PROBABILITIES[input.trigger]) return undefined;
    const eligible = this.getEligibleDefinitions(input.trigger, speaker.id, recipient.id);
    if (eligible.length === 0) return undefined;
    const selectedIndex = Math.min(eligible.length - 1, Math.floor(this.roll(`${baseKey}|selection`) * eligible.length));
    const definition = eligible[selectedIndex]!;
    const sourceLeader = getLeaderByNationId(speaker.id);
    const recipientLeader = getLeaderByNationId(recipient.id);
    const sourceLeaderName = sourceLeader?.name ?? speaker.name;
    const recipientLeaderName = recipientLeader?.name ?? recipient.name;
    const resolvedText = formatGossipText(definition.textTemplate, {
      sourceNationName: speaker.name,
      sourceLeaderName,
      recipientNationName: recipient.name,
      recipientLeaderName,
    });
    const verb = definition.insultSubtype === 'threat' ? 'warned' : 'taunted';
    const prefix = input.trigger === 'city_capture' && input.cityName
      ? `After the fall of ${input.cityName}, `
      : '';
    const historyText = `${prefix}${sourceLeaderName} of ${speaker.name} ${verb} ${recipientLeaderName} of ${recipient.name}: “${resolvedText}”`;
    const result: GossipFlavorEventResult = {
      trigger: input.trigger,
      round,
      speakerNationId: speaker.id,
      recipientNationId: recipient.id,
      insultId: definition.id,
      insultWeight: definition.insultWeight!,
      insultSubtype: definition.insultSubtype!,
      resolvedText,
      historyText,
      cityName: input.cityName,
      recipientIsHuman: recipient.isHuman,
    };
    this.context.historicalTimeline.record({
      type: GOSSIP_FLAVOR_EVENT_TYPE,
      icon: GOSSIP_FLAVOR_EVENT_ICON,
      text: historyText,
      eventNationIds: [speaker.id, recipient.id],
      metadata: {
        aggressorNationId: speaker.id,
        targetNationId: recipient.id,
        cityName: input.cityName,
        leaderInsultSubtype: definition.insultSubtype === 'threat' ? 'threat' : 'insult',
        leaderInsultText: resolvedText,
      },
    });
    this.pairCooldowns.set(key, round + GOSSIP_FLAVOR_PAIR_COOLDOWN_ROUNDS);
    this.context.logGenerated?.(result);
    return result;
  }

  getEligibleDefinitions(
    trigger: GossipFlavorContext,
    speakerNationId: string,
    recipientNationId: string,
  ): GossipDefinition[] {
    const fearMultiplier = calculateThreatFearMultiplier(
      this.context.getMilitaryPower(speakerNationId),
      this.context.getMilitaryPower(recipientNationId),
    );
    return GOSSIP_DEFINITIONS.filter((definition) => (
      definition.type === 'insult'
      && (definition.flavorContexts as readonly GossipFlavorContext[] | undefined)?.includes(trigger)
      && (definition.insultWeight ?? Number.POSITIVE_INFINITY) <= MAX_WEIGHT_BY_CONTEXT[trigger]
      && (definition.insultSubtype !== 'threat' || fearMultiplier > 0)
    ));
  }

  serialize(): SavedGossipFlavorState {
    return {
      pairCooldowns: Array.from(this.pairCooldowns, ([key, availableAtRound]) => {
        const [nationAId, nationBId] = key.split('|');
        return { nationAId: nationAId!, nationBId: nationBId!, availableAtRound };
      }),
    };
  }

  restore(state: SavedGossipFlavorState | undefined): void {
    this.pairCooldowns.clear();
    for (const entry of state?.pairCooldowns ?? []) {
      if (!Number.isFinite(entry.availableAtRound)) continue;
      this.pairCooldowns.set(
        this.pairKey(entry.nationAId, entry.nationBId),
        Math.max(0, Math.floor(entry.availableAtRound)),
      );
    }
  }

  private isCurrentContextValid(trigger: GossipFlavorContext, speakerNationId: string, recipientNationId: string): boolean {
    const atWar = this.context.diplomacyManager.getState(speakerNationId, recipientNationId) === 'WAR';
    if (trigger === 'war_declaration' || trigger === 'city_capture' || trigger === 'ongoing_war') return atWar;
    if (atWar) return false;
    return isSeverelyHostileRelation(this.context.diplomacyManager.getRelation(speakerNationId, recipientNationId))
      || (this.context.isCulturalJealousyAggressor?.(speakerNationId, recipientNationId) ?? false);
  }

  /**
   * The [jealousAggressor, target] direction for this pair, or undefined when
   * neither side holds a Cultural Jealousy agenda against the other.
   */
  private getCulturalJealousyDirection(firstId: string, secondId: string): [string, string] | undefined {
    const predicate = this.context.isCulturalJealousyAggressor;
    if (!predicate) return undefined;
    if (predicate(firstId, secondId)) return [firstId, secondId];
    if (predicate(secondId, firstId)) return [secondId, firstId];
    return undefined;
  }

  private chooseAutomaticDirection(
    firstId: string,
    firstIsHuman: boolean,
    secondId: string,
    secondIsHuman: boolean,
    trigger: GossipFlavorContext,
    round: number,
  ): [string, string] {
    if (firstIsHuman) return [secondId, firstId];
    if (secondIsHuman) return [firstId, secondId];
    return this.roll(`${this.context.randomSeed}|${round}|${trigger}|${this.pairKey(firstId, secondId)}|direction`) < 0.5
      ? [firstId, secondId]
      : [secondId, firstId];
  }

  private roll(key: string): number {
    const raw = this.context.roll?.(key) ?? deterministicFlavorRoll(key);
    return Math.max(0, Math.min(0.999999999, raw));
  }

  private pairKey(firstNationId: string, secondNationId: string): string {
    return firstNationId < secondNationId
      ? `${firstNationId}|${secondNationId}`
      : `${secondNationId}|${firstNationId}`;
  }
}

export function isSeverelyHostileRelation(relation: DiplomacyRelation): boolean {
  const tension = relation.hostility + relation.suspicion - relation.trust - relation.affinity;
  return relation.hostility >= 65 && tension >= 100;
}

/** Stable FNV-1a based unit value; independent of execution order and save/load. */
export function deterministicFlavorRoll(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}
