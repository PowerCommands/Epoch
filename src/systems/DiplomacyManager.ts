import type { TurnManager } from './TurnManager';
import { isBarbarianNation } from '../data/barbarians';
import { COLONIALISM_CULTURE_NODE_ID } from '../data/cultureTree';
import {
  ECONOMIC_PRESSURE_DIPLOMATIC_MODIFIER,
  ECONOMIC_PRESSURE_LABEL,
  ECONOMIC_PRESSURE_LEVEL,
  ECONOMIC_PRESSURE_PREREQUISITES,
  strongerEconomicPressure,
  type EconomicPressureType,
} from '../data/economicPressure';
import { logEconomicPressureLifted, logRetaliatoryTariffImposed } from './diplomacy/economicPressureLog';

export type DiplomacyState = 'WAR' | 'PEACE';

/** A single directional Economic Pressure measure (source pressuring target). */
export interface EconomicPressureRecord {
  readonly sourceNationId: string;
  readonly targetNationId: string;
  readonly type: EconomicPressureType;
  readonly imposedTurn: number;
  /** Whether the one-time AI payment offer for this exact sanction instance was shown. */
  readonly removalOfferPresented: boolean;
}

/** Blocked/allowed result with a reason, following existing eligibility patterns. */
export interface EconomicPressureEligibility {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface EconomicPressureChangedEvent {
  readonly sourceNationId: string;
  readonly targetNationId: string;
  readonly previousType: EconomicPressureType | null;
  readonly type: EconomicPressureType | null;
  readonly imposedTurn: number | null;
}

type EconomicPressureChangedListener = (event: EconomicPressureChangedEvent) => void;

/**
 * Open borders are now directional.
 * A allowing B does not imply B allows A.
 *
 * The trust/fear/hostility/affinity numbers and last*Turn timestamps are
 * groundwork for future diplomatic memory and AI strategy. They do not
 * affect gameplay yet — movement still cares only about state and the
 * directional border grants.
 */
export interface DiplomacyRelation {
  state: DiplomacyState;

  // Directional grants. The "A" / "B" labels follow pairKey's sorted order:
  // pairKey([a, b]) sorts a < b, so `openBordersFromAToB` is the grant from
  // the alphabetically-first nation to the second.
  openBordersFromAToB: boolean;
  openBordersFromBToA: boolean;
  exploitationRightsFromAToB: boolean;
  exploitationRightsFromBToA: boolean;
  embassyFromAToB: boolean;
  embassyFromBToA: boolean;
  tradeRelations: boolean;

  // Directional Economic Pressure. A/B follow the sorted pairKey order (same as
  // the other directional grants). Each side holds only its current effective
  // measure (None → Tariffs → Boycott → Embargo) plus the turn it was imposed;
  // the two directions are fully independent. null = no active pressure.
  economicPressureFromAToB: EconomicPressureType | null;
  economicPressureFromAToBTurn: number | null;
  economicPressureFromAToBRemovalOfferPresented: boolean;
  economicPressureFromBToA: EconomicPressureType | null;
  economicPressureFromBToATurn: number | null;
  economicPressureFromBToARemovalOfferPresented: boolean;

  trust: number;
  fear: number;
  hostility: number;
  affinity: number;
  // Distrust / suspected hostile intent, independent of open war. Symmetric like
  // the other memory values (one value per pair). Decays slowly each round.
  suspicion: number;

  // Cooldowns prevent AI from making rapid contradictory diplomatic decisions.
  // This stabilizes diplomacy behavior without changing core rules.
  lastWarDeclarationTurn: number | null;
  lastPeaceProposalTurn: number | null;
  lastOpenBordersChangeTurn: number | null;
  lastEmbassyChangeTurn: number | null;
  lastTradeRelationsChangeTurn: number | null;

  // Set when war is declared; preserved through the peace transition for treaty logic.
  aggressorNationId?: string;

  // While set, neither side may declare war until the current turn reaches this value.
  peaceTreatyUntilTurn?: number | null;
  // UN-enforced temporary ceasefire. Separate from ordinary peace treaties so
  // UI/logging can explain the source of the war block.
  ceasefireUntilTurn?: number | null;

  // Per-war loss counters. Reset each time war is declared. A/B follow the
  // alphabetical pairKey ordering (same as openBordersFromAToB etc.).
  militaryUnitsLostA: number;
  militaryUnitsLostB: number;
  citiesLostA: number;
  citiesLostB: number;
  // Snapshot of each side's total military strength when this war started.
  // 0 means no snapshot was taken yet (e.g. loaded from an older save).
  militaryStrengthAtWarStartA: number;
  militaryStrengthAtWarStartB: number;
}

/**
 * Input shape used by save-load and other callers that may still carry the
 * legacy symmetric `openBorders` boolean or the older turn-stamp field
 * names. Internal code should use `DiplomacyRelation` directly.
 */
export interface PartialDiplomacyRelationInput extends Partial<DiplomacyRelation> {
  /** @deprecated symmetric flag from older saves. Use directional grants. */
  openBorders?: boolean;
  /** @deprecated renamed to lastWarDeclarationTurn. */
  lastWarTurn?: number | null;
  /** @deprecated renamed to lastPeaceProposalTurn. */
  lastPeaceTurn?: number | null;
  aggressorNationId?: string;
}

export interface DiplomacyAgreementValidationContext {
  haveMet(a: string, b: string): boolean;
  hasTechnology(nationId: string, techId: string): boolean;
  /** True when the nation has unlocked the given culture node. */
  hasCulture(nationId: string, cultureId: string): boolean;
}

export interface DiplomacyAgreementValidationResult {
  ok: boolean;
  reason?: string;
}

export interface PeaceProposal {
  fromNationId: string;
  toNationId: string;
  /** @deprecated single-city legacy field; prefer offeredCityIds. Still honored. */
  offeredCityId?: string;
  /** Cities the proposer offers to cede. Capital and non-owned cities are rejected at settlement. */
  offeredCityIds?: string[];
  /** Gold the proposer offers (their treasury caps it at settlement). */
  goldReparations?: number;
  /**
   * When true, the proposer also grants the recipient the right to exploit
   * natural resources in the proposer's own territory. Committed only after the
   * war transitions to PEACE (see PeaceTreatySystem.settleAcceptedPeace).
   */
  offeredExploitationRights?: boolean;
  /**
   * Post-war exploitation *holdings* terms (Step 6), independent of the future
   * exploitation-right term above:
   *  - removeProposerHoldings: the proposer gives up its own surviving holdings in
   *    the recipient's territory (a concession offered to the recipient).
   *  - removeRecipientHoldings: the proposer demands removal of the recipient's
   *    surviving holdings in the proposer's territory (a demand on the recipient).
   * When neither is set, surviving holdings remain (the wartime status quo).
   */
  removeProposerHoldings?: boolean;
  removeRecipientHoldings?: boolean;
  warDuration: number;
}

/** One active bilateral war, as reported by {@link DiplomacyManager.getActiveWars}. */
export interface ActiveWarSummary {
  nationA: string;
  nationB: string;
  /** Original declarer of this war, stamped at declaration. Undefined if unknown. */
  aggressorNationId: string | undefined;
  /** Turn this specific bilateral war was declared. Null if never stamped. */
  declarationTurn: number | null;
}

type PeaceProposedListener = (proposal: PeaceProposal) => void;
type PeaceAcceptedListener = (nationA: string, nationB: string) => void;
type PeaceDeclinedListener = (nationA: string, nationB: string) => void;
export type WarDeclarationSource = 'standard' | 'scenarioHistoricalEvent' | 'vassalObligation';
export interface WarDeclarationMetadata {
  source: WarDeclarationSource;
}
type WarDeclaredListener = (
  aggressorId: string,
  targetId: string,
  metadata: WarDeclarationMetadata,
) => void;
type DiplomacyPairListener = (nationA: string, nationB: string) => void;
type DiplomacyChangedListener = (nationA: string, nationB: string, relation: DiplomacyRelation) => void;
/** Fired whenever a WAR between two nations transitions to PEACE (any mechanism). */
type WarEndedListener = (nationA: string, nationB: string) => void;
type VassalReleasedListener = (result: VassalReleaseResult) => void;

/**
 * Negotiation context in which an exploitation right was created, carried only so
 * History/Chronicle can weight the event. Optional — direct/programmatic grants
 * leave it undefined.
 */
export type ExploitationGrantContext = 'trade' | 'joinWar' | 'peace' | 'capitulation';

export interface ExploitationRightsGrantedEvent {
  readonly grantorNationId: string;
  readonly beneficiaryNationId: string;
  readonly context?: ExploitationGrantContext;
}

/** Why an active exploitation right ended. Currently only war clears rights. */
export type ExploitationEndReason = 'war';

export interface ExploitationRightsEndedEvent {
  readonly grantorNationId: string;
  readonly beneficiaryNationId: string;
  readonly reason: ExploitationEndReason;
}

type ExploitationRightsGrantedListener = (event: ExploitationRightsGrantedEvent) => void;
type ExploitationRightsEndedListener = (event: ExploitationRightsEndedEvent) => void;

/**
 * Hook surface used by DiplomaticMemorySystem. The manager invokes these on
 * relevant transitions so the memory system can update trust/fear/etc.
 * Declared as an interface so the manager has no compile-time dependency
 * on the memory system implementation (which itself depends on the manager).
 */
export interface DiplomaticMemoryHook {
  onDeclareWar(a: string, b: string): void;
  onMakePeace(a: string, b: string): void;
  onOpenBorders(from: string, to: string): void;
  onCancelOpenBorders(from: string, to: string): void;
  onCityCaptured(attacker: string, defender: string): void;
  onGoldGift(from: string, to: string, amount: number): void;
  onUnitGift(from: string, to: string, unitCount: number, powerValue?: number): void;
  onCityGift(from: string, to: string, cityId: string): void;
  onSymbolicGift(from: string, to: string): void;
  onExchangeMaps(a: string, b: string): void;
  onFormAlliance(a: string, b: string): void;
  onJointWarAgreement(a: string, b: string): void;
  onAllianceDeparture(a: string, b: string): void;
  onProposalApproved(a: string, b: string): void;
  onProposalRejected(a: string, b: string): void;
}

export interface DiplomaticMemoryValues {
  trust: number;
  fear: number;
  hostility: number;
  affinity: number;
  suspicion: number;
}

/** Persistent directional geopolitical relationship: one vassal, one host. */
export interface VassalRelationship {
  readonly vassalNationId: string;
  readonly hostNationId: string;
}

export interface VassalReleaseResult extends VassalRelationship {
  readonly previousAffinity: number;
  readonly affinity: number;
}

export interface AmicableRelationshipResetResult {
  readonly previousAffinity: number;
  readonly affinity: number;
}

export const DEFAULT_TRUST = 50;
export const DEFAULT_FEAR = 0;
export const DEFAULT_HOSTILITY = 0;
export const DEFAULT_AFFINITY = 0;
export const DEFAULT_SUSPICION = 0;
export const MIN_SUSPICION = 0;
export const MAX_SUSPICION = 100;
/** Passive suspicion decay applied to every tracked relation each round. */
export const SUSPICION_DECAY_PER_ROUND = 1;
/** Negative-memory cooling applied once for each configured Peace Treaty turn. */
export const PEACE_TREATY_COOLING_PER_ROUND = 2;
export const MIN_WAR_TURNS_FOR_PEACE = 15;
/**
 * Default turns two nations cannot re-declare war after making peace. Overridable
 * per scenario via ScenarioMeta.peaceTreatyCooldownTurns. Duplicated as a literal
 * in the standalone editor (public/editor.html), which cannot import this module.
 */
export const DEFAULT_PEACE_TREATY_COOLDOWN_TURNS = 10;

/**
 * Resolve the scenario-authored Peace Treaty cooldown, falling back to
 * {@link DEFAULT_PEACE_TREATY_COOLDOWN_TURNS} when absent or invalid.
 */
export function resolvePeaceTreatyCooldownTurns(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  return DEFAULT_PEACE_TREATY_COOLDOWN_TURNS;
}

/** Clamp a suspicion value to its valid 0–100 range. */
export function clampSuspicion(value: number): number {
  return Math.max(MIN_SUSPICION, Math.min(MAX_SUSPICION, Math.round(value)));
}

function clampDiplomacyValue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createDefaultRelation(): DiplomacyRelation {
  return {
    state: 'PEACE',
    openBordersFromAToB: false,
    openBordersFromBToA: false,
    exploitationRightsFromAToB: false,
    exploitationRightsFromBToA: false,
    embassyFromAToB: false,
    embassyFromBToA: false,
    tradeRelations: false,
    economicPressureFromAToB: null,
    economicPressureFromAToBTurn: null,
    economicPressureFromAToBRemovalOfferPresented: false,
    economicPressureFromBToA: null,
    economicPressureFromBToATurn: null,
    economicPressureFromBToARemovalOfferPresented: false,
    trust: DEFAULT_TRUST,
    fear: DEFAULT_FEAR,
    hostility: DEFAULT_HOSTILITY,
    affinity: DEFAULT_AFFINITY,
    suspicion: DEFAULT_SUSPICION,
    lastWarDeclarationTurn: null,
    lastPeaceProposalTurn: null,
    lastOpenBordersChangeTurn: null,
    lastEmbassyChangeTurn: null,
    lastTradeRelationsChangeTurn: null,
    peaceTreatyUntilTurn: null,
    ceasefireUntilTurn: null,
    militaryUnitsLostA: 0,
    militaryUnitsLostB: 0,
    citiesLostA: 0,
    citiesLostB: 0,
    militaryStrengthAtWarStartA: 0,
    militaryStrengthAtWarStartB: 0,
  };
}

/**
 * Fill in missing fields on a partially-known relation. Used by save-load
 * to migrate older payloads. If the legacy symmetric `openBorders` flag is
 * present and the directional grants are not, both directions inherit it
 * so old saves keep their previous behavior.
 */
export function normalizeRelation(partial: PartialDiplomacyRelationInput): DiplomacyRelation {
  const base = createDefaultRelation();
  const legacyBoth = partial.openBorders;
  const state = partial.state ?? base.state;
  return {
    state,
    openBordersFromAToB: partial.openBordersFromAToB ?? legacyBoth ?? base.openBordersFromAToB,
    openBordersFromBToA: partial.openBordersFromBToA ?? legacyBoth ?? base.openBordersFromBToA,
    // A loaded WAR is restored quietly, but must still satisfy the invariant
    // that belligerents cannot hold exploitation rights against one another.
    exploitationRightsFromAToB:
      state === 'WAR' ? false : partial.exploitationRightsFromAToB === true,
    exploitationRightsFromBToA:
      state === 'WAR' ? false : partial.exploitationRightsFromBToA === true,
    embassyFromAToB: partial.embassyFromAToB ?? base.embassyFromAToB,
    embassyFromBToA: partial.embassyFromBToA ?? base.embassyFromBToA,
    tradeRelations: partial.tradeRelations ?? base.tradeRelations,
    // Economic Pressure and war are mutually exclusive (war already severs the
    // trade it would restrict), so a loaded WAR drops any stored pressure. Older
    // saves without these fields default to no pressure.
    economicPressureFromAToB: state === 'WAR' ? null : partial.economicPressureFromAToB ?? base.economicPressureFromAToB,
    economicPressureFromAToBTurn: state === 'WAR' ? null : partial.economicPressureFromAToBTurn ?? base.economicPressureFromAToBTurn,
    economicPressureFromAToBRemovalOfferPresented: state === 'WAR'
      ? false
      : partial.economicPressureFromAToB !== undefined
        && partial.economicPressureFromAToB !== null
        && partial.economicPressureFromAToBRemovalOfferPresented === true,
    economicPressureFromBToA: state === 'WAR' ? null : partial.economicPressureFromBToA ?? base.economicPressureFromBToA,
    economicPressureFromBToATurn: state === 'WAR' ? null : partial.economicPressureFromBToATurn ?? base.economicPressureFromBToATurn,
    economicPressureFromBToARemovalOfferPresented: state === 'WAR'
      ? false
      : partial.economicPressureFromBToA !== undefined
        && partial.economicPressureFromBToA !== null
        && partial.economicPressureFromBToARemovalOfferPresented === true,
    trust: partial.trust ?? base.trust,
    fear: partial.fear ?? base.fear,
    hostility: partial.hostility ?? base.hostility,
    affinity: partial.affinity ?? base.affinity,
    // Older saves/scenarios predate suspicion → default to 0. Clamp to 0–100.
    suspicion: partial.suspicion === undefined ? base.suspicion : clampSuspicion(partial.suspicion),
    lastWarDeclarationTurn:
      partial.lastWarDeclarationTurn
      ?? partial.lastWarTurn
      ?? (partial.state === 'WAR' ? 0 : base.lastWarDeclarationTurn),
    lastPeaceProposalTurn:
      partial.lastPeaceProposalTurn ?? partial.lastPeaceTurn ?? base.lastPeaceProposalTurn,
    lastOpenBordersChangeTurn:
      partial.lastOpenBordersChangeTurn ?? base.lastOpenBordersChangeTurn,
    lastEmbassyChangeTurn:
      partial.lastEmbassyChangeTurn ?? base.lastEmbassyChangeTurn,
    lastTradeRelationsChangeTurn:
      partial.lastTradeRelationsChangeTurn ?? base.lastTradeRelationsChangeTurn,
    aggressorNationId: partial.aggressorNationId,
    peaceTreatyUntilTurn: partial.peaceTreatyUntilTurn ?? base.peaceTreatyUntilTurn,
    ceasefireUntilTurn: partial.ceasefireUntilTurn ?? base.ceasefireUntilTurn,
    militaryUnitsLostA: partial.militaryUnitsLostA ?? base.militaryUnitsLostA,
    militaryUnitsLostB: partial.militaryUnitsLostB ?? base.militaryUnitsLostB,
    citiesLostA: partial.citiesLostA ?? base.citiesLostA,
    citiesLostB: partial.citiesLostB ?? base.citiesLostB,
    militaryStrengthAtWarStartA: partial.militaryStrengthAtWarStartA ?? base.militaryStrengthAtWarStartA,
    militaryStrengthAtWarStartB: partial.militaryStrengthAtWarStartB ?? base.militaryStrengthAtWarStartB,
  };
}

const PAIR_KEY_SEPARATOR = '|';

/**
 * DiplomacyManager — tracks diplomatic state between nation pairs.
 * Default state is PEACE. Supports war declaration, peace proposals,
 * responses, and directional open-borders grants.
 */
export class DiplomacyManager {
  private readonly relations = new Map<string, DiplomacyRelation>();
  /** vassal nation id -> host nation id. Kept separate from bilateral memory. */
  private readonly vassalHosts = new Map<string, string>();
  private readonly pendingProposals = new Map<string, PeaceProposal>();
  private readonly proposedListeners: PeaceProposedListener[] = [];
  private readonly acceptedListeners: PeaceAcceptedListener[] = [];
  private readonly declinedListeners: PeaceDeclinedListener[] = [];
  private readonly warDeclaredListeners: WarDeclaredListener[] = [];
  private readonly embassyEstablishedListeners: DiplomacyPairListener[] = [];
  private readonly tradeRelationsEstablishedListeners: DiplomacyPairListener[] = [];
  private readonly allianceFormedListeners: DiplomacyPairListener[] = [];
  private readonly jointWarAgreementListeners: DiplomacyPairListener[] = [];
  private readonly exploitationRightsGrantedListeners: ExploitationRightsGrantedListener[] = [];
  private readonly exploitationRightsEndedListeners: ExploitationRightsEndedListener[] = [];
  private readonly economicPressureChangedListeners: EconomicPressureChangedListener[] = [];
  private readonly changedListeners: DiplomacyChangedListener[] = [];
  private readonly warEndedListeners: WarEndedListener[] = [];
  private readonly vassalReleasedListeners: VassalReleasedListener[] = [];
  private memoryHook: DiplomaticMemoryHook | null = null;
  private allianceGuard: ((aggressorId: string, targetId: string) => boolean) | null = null;
  /** Resolves nation ids to display names for autorun/debug logging. Identity by default. */
  private resolveNationName: (nationId: string) => string = (nationId) => nationId;

  // Optional so older callers/tests still work; when present, war/peace
  // transitions get stamped with the current round. The peace-treaty cooldown
  // is scenario-configured; it defaults to DEFAULT_PEACE_TREATY_COOLDOWN_TURNS.
  constructor(
    private readonly turnManager?: TurnManager,
    private peaceTreatyCooldownTurns: number = DEFAULT_PEACE_TREATY_COOLDOWN_TURNS,
    private readonly hasCultureUnlock: (nationId: string, cultureNodeId: string) => boolean = () => false,
  ) {}

  /** The bilateral Peace Treaty cooldown length applied when a war ends in peace. */
  getPeaceTreatyCooldownTurns(): number {
    return this.peaceTreatyCooldownTurns;
  }

  /** Changes only the duration stamped onto future peace treaties. */
  setPeaceTreatyCooldownTurns(turns: number): void {
    if (Number.isInteger(turns) && turns >= 0) this.peaceTreatyCooldownTurns = turns;
  }

  /**
   * Register a predicate that blocks war declarations between two nations
   * (e.g. alliance partners). Centralizes the rule so every caller — human and
   * AI — is covered without UI-level checks. Returns true to block.
   */
  setAllianceGuard(guard: (aggressorId: string, targetId: string) => boolean): void {
    this.allianceGuard = guard;
  }

  /**
   * Attach the memory system that mirrors transitions onto trust/fear/etc.
   * Done after construction to avoid the circular dep (memory needs the
   * manager, manager calls into memory).
   */
  attachMemoryHook(hook: DiplomaticMemoryHook): void {
    this.memoryHook = hook;
  }

  /**
   * Subscribe to war→peace transitions (ordinary peace, ceasefire, capitulation).
   * Fired after the relation has been committed to PEACE.
   */
  onWarEnded(listener: WarEndedListener): void {
    this.warEndedListeners.push(listener);
  }

  private notifyWarEnded(a: string, b: string): void {
    for (const cb of this.warEndedListeners) cb(a, b);
  }

  private sortedPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private pairKey(a: string, b: string): string {
    const [first, second] = this.sortedPair(a, b);
    return `${first}${PAIR_KEY_SEPARATOR}${second}`;
  }

  getState(a: string, b: string): DiplomacyState {
    return this.getRelation(a, b).state;
  }

  isVassal(nationId: string): boolean {
    return this.vassalHosts.has(nationId);
  }

  getVassalHost(nationId: string): string | undefined {
    return this.vassalHosts.get(nationId);
  }

  /** Concise alias for callers displaying a vassal's overlord. */
  getHost(nationId: string): string | undefined {
    return this.getVassalHost(nationId);
  }

  getVassals(hostNationId: string): string[] {
    return [...this.vassalHosts.entries()]
      .filter(([, hostId]) => hostId === hostNationId)
      .map(([vassalId]) => vassalId)
      .sort((a, b) => a.localeCompare(b));
  }

  getAllVassalRelationships(): VassalRelationship[] {
    return [...this.vassalHosts.entries()]
      .map(([vassalNationId, hostNationId]) => ({ vassalNationId, hostNationId }))
      .sort((a, b) => a.vassalNationId.localeCompare(b.vassalNationId));
  }

  areHostAndVassal(a: string, b: string): boolean {
    return this.vassalHosts.get(a) === b || this.vassalHosts.get(b) === a;
  }

  /** Establish or transfer a nation's single authoritative host. */
  establishVassal(vassalNationId: string, hostNationId: string): boolean {
    if (!this.canEstablishVassal(vassalNationId, hostNationId)) return false;
    if (this.vassalHosts.get(vassalNationId) === hostNationId) return false;
    this.vassalHosts.set(vassalNationId, hostNationId);
    this.notifyChanged(vassalNationId, hostNationId);
    return true;
  }

  /** Step 2 deliberately supports direct relationships only, never chains. */
  canEstablishVassal(vassalNationId: string, hostNationId: string): boolean {
    if (vassalNationId === hostNationId) return false;
    if (this.isVassal(hostNationId)) return false;
    if (this.getVassals(vassalNationId).length > 0) return false;
    return true;
  }

  /**
   * Host-only peaceful release. The former vassal has no API that can release
   * itself; successful release also applies the Reconciliation goodwill reset.
   */
  releaseVassal(hostNationId: string, vassalNationId: string): VassalReleaseResult | null {
    if (this.vassalHosts.get(vassalNationId) !== hostNationId) return null;
    this.vassalHosts.delete(vassalNationId);
    const reset = this.applyAmicableRelationshipReset(hostNationId, vassalNationId);
    const result = {
      hostNationId,
      vassalNationId,
      ...reset,
    };
    for (const listener of this.vassalReleasedListeners) listener(result);
    return result;
  }

  /** Remove a verified host/vassal relationship without changing diplomatic memory. */
  terminateVassalage(hostNationId: string, vassalNationId: string): boolean {
    if (this.vassalHosts.get(vassalNationId) !== hostNationId) return false;
    this.vassalHosts.delete(vassalNationId);
    this.notifyChanged(hostNationId, vassalNationId);
    return true;
  }

  /** Subscribe to every successful host-initiated release, including future AI callers. */
  onVassalReleased(listener: VassalReleasedListener): void {
    this.vassalReleasedListeners.push(listener);
  }

  /** Shared Reconciliation reset used by turning points and peaceful release. */
  applyAmicableRelationshipReset(a: string, b: string): AmicableRelationshipResetResult {
    const relation = this.getRelation(a, b);
    const affinity = Math.max(relation.affinity, 50);
    this.setMemoryValues(a, b, {
      trust: 0,
      fear: 0,
      suspicion: 0,
      hostility: 0,
      affinity,
    });
    this.notifyChanged(a, b);
    return {
      previousAffinity: relation.affinity,
      affinity,
    };
  }

  /** Quiet save-load restoration; malformed/self relationships are ignored. */
  restoreVassalRelationships(relationships: readonly VassalRelationship[] | undefined): void {
    this.vassalHosts.clear();
    const ordered = [...(relationships ?? [])]
      .sort((a, b) => String(a?.vassalNationId).localeCompare(String(b?.vassalNationId)));
    for (const relationship of ordered) {
      if (!relationship
        || typeof relationship.vassalNationId !== 'string'
        || typeof relationship.hostNationId !== 'string'
        || relationship.vassalNationId === relationship.hostNationId) continue;
      if (!this.canEstablishVassal(relationship.vassalNationId, relationship.hostNationId)) continue;
      this.vassalHosts.set(relationship.vassalNationId, relationship.hostNationId);
    }
  }

  /** Authoritative check for any active diplomatic WAR involving a nation. */
  isAtWarWithAnyNation(nationId: string): boolean {
    for (const [key, relation] of this.relations) {
      if (relation.state !== 'WAR') continue;
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === nationId || b === nationId) return true;
    }
    return false;
  }

  /** Every nation `nationId` is currently at WAR with. Used to weigh multi-front strain. */
  getWarringNationIds(nationId: string): string[] {
    const opponents: string[] = [];
    for (const [key, relation] of this.relations) {
      if (relation.state !== 'WAR') continue;
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === nationId) opponents.push(b);
      else if (b === nationId) opponents.push(a);
    }
    return opponents;
  }

  /**
   * True if `nationId` is the recorded aggressor in at least one currently
   * active WAR. Uses the canonical `aggressorNationId` stamped at declaration;
   * never infers aggression from strength, territory, or momentum.
   */
  isActiveWarAggressor(nationId: string): boolean {
    for (const [key, relation] of this.relations) {
      if (relation.state !== 'WAR' || relation.aggressorNationId !== nationId) continue;
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === nationId || b === nationId) return true;
    }
    return false;
  }

  /**
   * Snapshot of every active bilateral WAR, each with its recorded original
   * aggressor and the turn it was declared. Each pair appears exactly once
   * (canonical pair key), and each war keeps its own declaration turn — a later
   * war or Join War never rewrites another pair's entry.
   */
  getActiveWars(): ActiveWarSummary[] {
    const wars: ActiveWarSummary[] = [];
    for (const [key, relation] of this.relations) {
      if (relation.state !== 'WAR') continue;
      const [nationA, nationB] = key.split(PAIR_KEY_SEPARATOR);
      wars.push({
        nationA,
        nationB,
        aggressorNationId: relation.aggressorNationId,
        declarationTurn: relation.lastWarDeclarationTurn,
      });
    }
    return wars;
  }

  getRelation(a: string, b: string): DiplomacyRelation {
    return { ...(this.relations.get(this.pairKey(a, b)) ?? createDefaultRelation()) };
  }

  canAttack(a: string, b: string): boolean {
    // Barbarians have no diplomacy: they are permanently hostile to everyone and
    // everyone may attack them without a declaration of war.
    if (isBarbarianNation(a) || isBarbarianNation(b)) return true;
    return this.getState(a, b) === 'WAR';
  }

  /**
   * True if `visitorNationId` is allowed to enter `territoryOwnerId`'s tiles.
   * War always allows entry (so the player/AI can attack); otherwise the
   * territory owner must have granted open borders to the visitor.
   */
  canEnterTerritory(visitorNationId: string, territoryOwnerId: string): boolean {
    if (visitorNationId === territoryOwnerId) return true;
    const relation = this.relations.get(this.pairKey(visitorNationId, territoryOwnerId))
      ?? createDefaultRelation();
    if (relation.state === 'WAR') return true;
    return this.readDirectionalGrant(territoryOwnerId, visitorNationId, relation);
  }

  /** Has `fromNationId` granted open borders to `toNationId`? */
  isOpenBorderGrantedFrom(fromNationId: string, toNationId: string): boolean {
    if (fromNationId === toNationId) return true;
    const relation = this.relations.get(this.pairKey(fromNationId, toNationId))
      ?? createDefaultRelation();
    return this.readDirectionalGrant(fromNationId, toNationId, relation);
  }

  /** Whether a nation has unlocked the culture capability used by future negotiations. */
  canUseExploitationRights(nationId: string): boolean {
    return this.hasCultureUnlock(nationId, COLONIALISM_CULTURE_NODE_ID);
  }

  /**
   * Grantor owns the territory; beneficiary receives the right to exploit it.
   * The optional `context` is the negotiation the grant came from; it is passed
   * to `onExploitationRightsGranted` listeners only so History/Chronicle can
   * weight the event, and never affects the stored right.
   */
  grantExploitationRights(
    grantorNationId: string,
    beneficiaryNationId: string,
    context?: ExploitationGrantContext,
  ): boolean {
    if (grantorNationId === beneficiaryNationId) return false;
    const key = this.pairKey(grantorNationId, beneficiaryNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (current.state === 'WAR'
      || this.readExploitationRightsGrant(grantorNationId, beneficiaryNationId, current)) return false;
    const next = { ...current };
    this.writeExploitationRightsGrant(grantorNationId, beneficiaryNationId, next, true);
    this.relations.set(key, next);
    this.notifyChanged(grantorNationId, beneficiaryNationId);
    for (const cb of this.exploitationRightsGrantedListeners) {
      cb({ grantorNationId, beneficiaryNationId, context });
    }
    return true;
  }

  /** Remove one directional grant. Missing grants and self-references are harmless. */
  revokeExploitationRights(grantorNationId: string, beneficiaryNationId: string): boolean {
    if (grantorNationId === beneficiaryNationId) return false;
    const key = this.pairKey(grantorNationId, beneficiaryNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (!this.readExploitationRightsGrant(grantorNationId, beneficiaryNationId, current)) return false;
    const next = { ...current };
    this.writeExploitationRightsGrant(grantorNationId, beneficiaryNationId, next, false);
    this.relations.set(key, next);
    this.notifyChanged(grantorNationId, beneficiaryNationId);
    return true;
  }

  /** Does beneficiary have exploitation rights inside grantor's territory? */
  hasExploitationRights(beneficiaryNationId: string, grantorNationId: string): boolean {
    if (beneficiaryNationId === grantorNationId) return false;
    const relation = this.relations.get(this.pairKey(grantorNationId, beneficiaryNationId))
      ?? createDefaultRelation();
    return relation.state !== 'WAR'
      && this.readExploitationRightsGrant(grantorNationId, beneficiaryNationId, relation);
  }

  /** Enumerate active directional grants in stable pair/direction order. */
  getAllExploitationRights(): Array<{ grantorNationId: string; beneficiaryNationId: string }> {
    const rights: Array<{ grantorNationId: string; beneficiaryNationId: string }> = [];
    for (const { keys: [a, b], relation } of this.getAllStates()) {
      if (relation.state === 'WAR') continue;
      if (relation.exploitationRightsFromAToB) rights.push({ grantorNationId: a, beneficiaryNationId: b });
      if (relation.exploitationRightsFromBToA) rights.push({ grantorNationId: b, beneficiaryNationId: a });
    }
    return rights;
  }

  // ─── Economic Pressure ─────────────────────────────────────────────────────
  // Directional, bilateral, escalating measures (None → Tariffs → Boycott →
  // Embargo). State lives on the relation; economic systems consult it rather
  // than having pressure permanently mutate their data.

  /** Injected prerequisite check; wired to the research system by GameScene. */
  private isTechnologyResearched: (nationId: string, techId: string) => boolean = () => true;

  setEconomicPressureTechnologyChecker(fn: (nationId: string, techId: string) => boolean): void {
    this.isTechnologyResearched = fn;
  }

  /** Provide a nation-id → display-name resolver used only for `[DIPLOMACY]` logs. */
  setNationNameResolver(fn: (nationId: string) => string): void {
    this.resolveNationName = fn;
  }

  /** Display name for a nation id, for logging. Falls back to the id. */
  getNationDisplayName(nationId: string): string {
    return this.resolveNationName(nationId);
  }

  /** Whether `source` may currently impose `type` on `target`, with a reason if not. */
  canImposeEconomicPressure(
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
  ): EconomicPressureEligibility {
    if (sourceNationId === targetNationId) return { ok: false, reason: 'Cannot pressure your own nation' };
    if (isBarbarianNation(sourceNationId) || isBarbarianNation(targetNationId)) {
      return { ok: false, reason: 'Barbarians have no economy to pressure' };
    }
    if (this.getState(sourceNationId, targetNationId) === 'WAR') {
      return { ok: false, reason: 'Cannot impose Economic Pressure during war' };
    }
    const prerequisite = ECONOMIC_PRESSURE_PREREQUISITES[type];
    const unlocked = prerequisite.kind === 'culture'
      ? this.hasCultureUnlock(sourceNationId, prerequisite.id)
      : this.isTechnologyResearched(sourceNationId, prerequisite.id);
    if (!unlocked) {
      return { ok: false, reason: `Requires ${ECONOMIC_PRESSURE_LABEL[type]} prerequisite (${prerequisite.id})` };
    }
    return { ok: true };
  }

  /**
   * Set the current effective measure `source` imposes on `target` to `type`.
   * This replaces any existing measure in that direction (escalating or lowering)
   * — a single effective level per directional pair, never stacked. Re-imposing
   * the same measure is a harmless no-op. Returns false if ineligible or a no-op.
   */
  imposeEconomicPressure(
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
  ): boolean {
    if (!this.canImposeEconomicPressure(sourceNationId, targetNationId, type).ok) return false;
    const key = this.pairKey(sourceNationId, targetNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    const existing = this.readEconomicPressure(sourceNationId, targetNationId, current);
    if (existing === type) return false; // already at this exact measure
    const next = { ...current };
    const turn = this.turnManager?.getCurrentRound() ?? 0;
    this.writeEconomicPressure(sourceNationId, targetNationId, next, type, turn);
    this.relations.set(key, next);
    const verb = existing === null
      ? 'imposed'
      : ECONOMIC_PRESSURE_LEVEL[type] > ECONOMIC_PRESSURE_LEVEL[existing] ? 'escalated to' : 'lowered to';
    this.logEconomicPressure(`${sourceNationId} ${verb} ${ECONOMIC_PRESSURE_LABEL[type]} on ${targetNationId}`, turn);
    this.emitEconomicPressureChanged(sourceNationId, targetNationId, existing, type, turn);
    this.notifyChanged(sourceNationId, targetNationId);
    return true;
  }

  /** Canonical action application, including the one-hop Tariff retaliation rule. */
  imposeEconomicPressureAction(
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
  ): { imposed: boolean; reciprocalTariffsCreated: boolean } {
    const imposed = this.imposeEconomicPressure(sourceNationId, targetNationId, type);
    const reciprocalTariffsCreated = imposed && type === 'tariffs'
      ? this.imposeReciprocalTariffs(targetNationId, sourceNationId)
      : false;
    return { imposed, reciprocalTariffsCreated };
  }

  /**
   * Automatic, non-strategic Tariff retaliation used by Human Audience actions.
   * It bypasses the retaliator's technology prerequisite, never replaces an
   * existing (possibly stronger) reverse sanction, and still uses canonical
   * directional state plus diagnostics.
   */
  imposeReciprocalTariffs(sourceNationId: string, targetNationId: string): boolean {
    if (
      sourceNationId === targetNationId
      || isBarbarianNation(sourceNationId)
      || isBarbarianNation(targetNationId)
      || this.getState(sourceNationId, targetNationId) === 'WAR'
    ) return false;
    const key = this.pairKey(sourceNationId, targetNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (this.readEconomicPressure(sourceNationId, targetNationId, current) !== null) return false;
    const next = { ...current };
    const turn = this.turnManager?.getCurrentRound() ?? 0;
    this.writeEconomicPressure(sourceNationId, targetNationId, next, 'tariffs', turn);
    this.relations.set(key, next);
    this.logEconomicPressure(`${sourceNationId} automatically retaliated with Tariffs on ${targetNationId}`, turn);
    logRetaliatoryTariffImposed(this.getNationDisplayName(sourceNationId), this.getNationDisplayName(targetNationId));
    this.emitEconomicPressureChanged(sourceNationId, targetNationId, null, 'tariffs', turn);
    this.notifyChanged(sourceNationId, targetNationId);
    return true;
  }

  /** Remove the measure `source` imposes on `target`. Missing measures are harmless. */
  liftEconomicPressure(sourceNationId: string, targetNationId: string): boolean {
    if (sourceNationId === targetNationId) return false;
    const key = this.pairKey(sourceNationId, targetNationId);
    const current = this.relations.get(key);
    if (!current) return false;
    const existing = this.readEconomicPressure(sourceNationId, targetNationId, current);
    if (existing === null) return false;
    const next = { ...current };
    this.writeEconomicPressure(sourceNationId, targetNationId, next, null, null);
    this.relations.set(key, next);
    const turn = this.turnManager?.getCurrentRound() ?? 0;
    this.logEconomicPressure(`${sourceNationId} lifted ${ECONOMIC_PRESSURE_LABEL[existing]} on ${targetNationId}`, turn);
    logEconomicPressureLifted(this.getNationDisplayName(sourceNationId), this.getNationDisplayName(targetNationId), existing);
    this.emitEconomicPressureChanged(sourceNationId, targetNationId, existing, null, null);
    this.notifyChanged(sourceNationId, targetNationId);
    return true;
  }

  /** The measure `source` currently imposes on `target`, or null. */
  getEconomicPressure(sourceNationId: string, targetNationId: string): EconomicPressureType | null {
    if (sourceNationId === targetNationId) return null;
    const relation = this.relations.get(this.pairKey(sourceNationId, targetNationId));
    return relation ? this.readEconomicPressure(sourceNationId, targetNationId, relation) : null;
  }

  /** Full record (with imposed turn) for the measure `source` imposes on `target`. */
  getEconomicPressureRecord(sourceNationId: string, targetNationId: string): EconomicPressureRecord | null {
    if (sourceNationId === targetNationId) return null;
    const relation = this.relations.get(this.pairKey(sourceNationId, targetNationId));
    if (!relation) return null;
    const type = this.readEconomicPressure(sourceNationId, targetNationId, relation);
    if (type === null) return null;
    return {
      sourceNationId,
      targetNationId,
      type,
      imposedTurn: this.readEconomicPressureTurn(sourceNationId, targetNationId, relation) ?? 0,
      removalOfferPresented: this.readEconomicPressureRemovalOfferPresented(
        sourceNationId,
        targetNationId,
        relation,
      ),
    };
  }

  /** Mark the one automatic removal offer for an unchanged sanction instance as presented. */
  markEconomicPressureRemovalOfferPresented(
    sourceNationId: string,
    targetNationId: string,
    type: EconomicPressureType,
    imposedTurn: number,
  ): boolean {
    const key = this.pairKey(sourceNationId, targetNationId);
    const current = this.relations.get(key);
    if (!current
      || this.readEconomicPressure(sourceNationId, targetNationId, current) !== type
      || this.readEconomicPressureTurn(sourceNationId, targetNationId, current) !== imposedTurn
      || this.readEconomicPressureRemovalOfferPresented(sourceNationId, targetNationId, current)) return false;
    const next = { ...current };
    this.writeEconomicPressureRemovalOfferPresented(sourceNationId, targetNationId, next, true);
    this.relations.set(key, next);
    this.notifyChanged(sourceNationId, targetNationId);
    return true;
  }

  /** True if `source` imposes any pressure on `target`, or exactly `type` when given. */
  hasEconomicPressure(sourceNationId: string, targetNationId: string, type?: EconomicPressureType): boolean {
    const current = this.getEconomicPressure(sourceNationId, targetNationId);
    return type === undefined ? current !== null : current === type;
  }

  /** Every measure `sourceNationId` imposes on other nations. */
  getEconomicPressureAgainst(sourceNationId: string): EconomicPressureRecord[] {
    const records: EconomicPressureRecord[] = [];
    for (const { keys: [a, b] } of this.getAllStates()) {
      const other = sourceNationId === a ? b : sourceNationId === b ? a : null;
      if (other === null) continue;
      const record = this.getEconomicPressureRecord(sourceNationId, other);
      if (record) records.push(record);
    }
    return records;
  }

  /** Every measure imposed on `targetNationId` by other nations. */
  getEconomicPressureTargeting(targetNationId: string): EconomicPressureRecord[] {
    const records: EconomicPressureRecord[] = [];
    for (const { keys: [a, b] } of this.getAllStates()) {
      const other = targetNationId === a ? b : targetNationId === b ? a : null;
      if (other === null) continue;
      const record = this.getEconomicPressureRecord(other, targetNationId);
      if (record) records.push(record);
    }
    return records;
  }

  /**
   * The strongest measure in either direction. Used for pair-level display,
   * diplomatic modifiers, and the bilateral Embargo rule. Directional Boycott
   * enforcement intentionally consults each direction separately.
   */
  getEffectiveEconomicPressure(a: string, b: string): EconomicPressureType | null {
    return strongerEconomicPressure(this.getEconomicPressure(a, b), this.getEconomicPressure(b, a));
  }

  /**
   * Compatibility query for economic consumers. Sanctions alter which deals
   * may exist, never the value of a surviving deal; Tariffs are symbolic.
   */
  getEconomicPressureTradeValueMultiplier(a: string, b: string): number {
    void a;
    void b;
    return 1;
  }

  /**
   * Whether `buyer` may import from `seller`. A Boycott is directional: only
   * the boycotting nation's purchases are blocked. An Embargo blocks both
   * directions if either nation imposed it. Tariffs never block exchange.
   */
  isEconomicExchangeBlocked(buyer: string, seller: string, resourceCategory: string): boolean {
    void resourceCategory; // all natural and manufactured resource paths obey the same rule
    const buyerPressure = this.getEconomicPressure(buyer, seller);
    const sellerPressure = this.getEconomicPressure(seller, buyer);
    return buyerPressure === 'boycott'
      || buyerPressure === 'embargo'
      || sellerPressure === 'embargo';
  }

  /** The single strongest active sanction modifier between this pair. */
  getEconomicPressureDiplomaticModifier(a: string, b: string): { hostility: number; affinity: number } {
    const level = this.getEffectiveEconomicPressure(a, b);
    return level === null
      ? { hostility: 0, affinity: 0 }
      : ECONOMIC_PRESSURE_DIPLOMATIC_MODIFIER[level];
  }

  private readEconomicPressure(
    sourceNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
  ): EconomicPressureType | null {
    const [a, b] = this.sortedPair(sourceNationId, targetNationId);
    if (sourceNationId === a && targetNationId === b) return relation.economicPressureFromAToB;
    if (sourceNationId === b && targetNationId === a) return relation.economicPressureFromBToA;
    return null;
  }

  private readEconomicPressureTurn(
    sourceNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
  ): number | null {
    const [a, b] = this.sortedPair(sourceNationId, targetNationId);
    if (sourceNationId === a && targetNationId === b) return relation.economicPressureFromAToBTurn;
    if (sourceNationId === b && targetNationId === a) return relation.economicPressureFromBToATurn;
    return null;
  }

  private writeEconomicPressure(
    sourceNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
    type: EconomicPressureType | null,
    turn: number | null,
  ): void {
    const [a, b] = this.sortedPair(sourceNationId, targetNationId);
    if (sourceNationId === a && targetNationId === b) {
      relation.economicPressureFromAToB = type;
      relation.economicPressureFromAToBTurn = type === null ? null : turn;
      relation.economicPressureFromAToBRemovalOfferPresented = false;
    } else if (sourceNationId === b && targetNationId === a) {
      relation.economicPressureFromBToA = type;
      relation.economicPressureFromBToATurn = type === null ? null : turn;
      relation.economicPressureFromBToARemovalOfferPresented = false;
    }
  }

  private readEconomicPressureRemovalOfferPresented(
    sourceNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
  ): boolean {
    const [a, b] = this.sortedPair(sourceNationId, targetNationId);
    if (sourceNationId === a && targetNationId === b) {
      return relation.economicPressureFromAToBRemovalOfferPresented;
    }
    if (sourceNationId === b && targetNationId === a) {
      return relation.economicPressureFromBToARemovalOfferPresented;
    }
    return false;
  }

  private writeEconomicPressureRemovalOfferPresented(
    sourceNationId: string,
    targetNationId: string,
    relation: DiplomacyRelation,
    presented: boolean,
  ): void {
    const [a, b] = this.sortedPair(sourceNationId, targetNationId);
    if (sourceNationId === a && targetNationId === b) {
      relation.economicPressureFromAToBRemovalOfferPresented = presented;
    } else if (sourceNationId === b && targetNationId === a) {
      relation.economicPressureFromBToARemovalOfferPresented = presented;
    }
  }

  private logEconomicPressureClearedByWar(a: string, b: string, previous: DiplomacyRelation): void {
    const turn = this.turnManager?.getCurrentRound() ?? 0;
    if (previous.economicPressureFromAToB !== null) {
      const [x, y] = this.sortedPair(a, b);
      this.logEconomicPressure(`${x}'s ${ECONOMIC_PRESSURE_LABEL[previous.economicPressureFromAToB]} on ${y} removed by war`, turn);
    }
    if (previous.economicPressureFromBToA !== null) {
      const [x, y] = this.sortedPair(a, b);
      this.logEconomicPressure(`${y}'s ${ECONOMIC_PRESSURE_LABEL[previous.economicPressureFromBToA]} on ${x} removed by war`, turn);
    }
  }

  private logEconomicPressure(message: string, turn: number): void {
    console.debug(`[EconomicPressure] ${message} (turn ${turn})`);
  }

  private emitEconomicPressureChanged(
    sourceNationId: string,
    targetNationId: string,
    previousType: EconomicPressureType | null,
    type: EconomicPressureType | null,
    imposedTurn: number | null,
  ): void {
    const event = { sourceNationId, targetNationId, previousType, type, imposedTurn };
    for (const listener of this.economicPressureChangedListeners) listener(event);
  }

  declareWar(aggressorId: string, targetId: string): boolean {
    return this.transitionToWar(aggressorId, targetId, false, { source: 'standard' });
  }

  /** Whether the canonical non-forced war transition is currently legal. */
  canDeclareWar(aggressorId: string, targetId: string): boolean {
    if (aggressorId === targetId) return false;
    if (this.isVassal(aggressorId)) return false;
    if (this.areHostAndVassal(aggressorId, targetId)) return false;
    const key = this.pairKey(aggressorId, targetId);
    if (this.relations.get(key)?.state === 'WAR') return false;
    if (this.allianceGuard?.(aggressorId, targetId)) return false;
    const currentTurn = this.turnManager?.getCurrentRound() ?? 0;
    if (this.isPeaceTreatyActive(aggressorId, targetId, currentTurn)) return false;
    if (this.isCeasefireActive(aggressorId, targetId, currentTurn)) return false;
    return true;
  }

  /**
   * Enter war through the canonical transition while bypassing diplomatic
   * permission checks. Intended for explicit scenario/system rules, not AI.
   */
  forceDeclareWar(
    aggressorId: string,
    targetId: string,
    metadata: WarDeclarationMetadata = { source: 'scenarioHistoricalEvent' },
  ): boolean {
    return this.transitionToWar(aggressorId, targetId, true, metadata);
  }

  /**
   * Narrow system path for a direct vassal following its host into an existing
   * war. It cannot be used to originate an independent vassal war.
   */
  joinWarForHost(vassalNationId: string, hostNationId: string, enemyNationId: string): boolean {
    if (this.getVassalHost(vassalNationId) !== hostNationId) return false;
    if (this.getState(hostNationId, enemyNationId) !== 'WAR') return false;
    return this.transitionToWar(
      vassalNationId,
      enemyNationId,
      true,
      { source: 'vassalObligation' },
      true,
    );
  }

  /** Host acceptance path after its direct vassal has been attacked. */
  joinWarToDefendVassal(hostNationId: string, vassalNationId: string, attackerNationId: string): boolean {
    if (this.getVassalHost(vassalNationId) !== hostNationId) return false;
    if (this.getState(vassalNationId, attackerNationId) !== 'WAR') return false;
    return this.transitionToWar(
      hostNationId,
      attackerNationId,
      true,
      { source: 'vassalObligation' },
    );
  }

  private transitionToWar(
    aggressorId: string,
    targetId: string,
    bypassRestrictions: boolean,
    metadata: WarDeclarationMetadata,
    allowVassalObligation = false,
  ): boolean {
    if (aggressorId === targetId) return false;
    if (this.areHostAndVassal(aggressorId, targetId)) return false;
    // Only the validated obligation entry point above may pull a vassal into war.
    if (this.isVassal(aggressorId) && !allowVassalObligation) return false;
    const key = this.pairKey(aggressorId, targetId);
    if (this.relations.get(key)?.state === 'WAR') return false;
    // Alliance, peace-treaty, and ceasefire checks share the same authoritative
    // query used by proposal systems; forced scenario transitions bypass them.
    if (!bypassRestrictions && !this.canDeclareWar(aggressorId, targetId)) return false;
    const previous = this.relations.get(key);
    const next = normalizeRelation({
      ...previous,
      state: 'WAR',
      // War clears any active border grants in both directions.
      openBordersFromAToB: false,
      openBordersFromBToA: false,
      exploitationRightsFromAToB: false,
      exploitationRightsFromBToA: false,
      embassyFromAToB: false,
      embassyFromBToA: false,
      tradeRelations: false,
      // War supersedes Economic Pressure: the blocked trade is already gone, so
      // clear both directions rather than leaving contradictory stale records.
      economicPressureFromAToB: null,
      economicPressureFromAToBTurn: null,
      economicPressureFromAToBRemovalOfferPresented: false,
      economicPressureFromBToA: null,
      economicPressureFromBToATurn: null,
      economicPressureFromBToARemovalOfferPresented: false,
      // If TurnManager is unavailable, normalizeRelation falls back to turn 0
      // for WAR so peace-duration logic still advances instead of freezing.
      lastWarDeclarationTurn:
        this.turnManager?.getCurrentRound() ?? previous?.lastWarDeclarationTurn ?? null,
      aggressorNationId: aggressorId,
      // A forced declaration supersedes blockers which would contradict WAR.
      peaceTreatyUntilTurn: bypassRestrictions ? null : previous?.peaceTreatyUntilTurn,
      ceasefireUntilTurn: bypassRestrictions ? null : previous?.ceasefireUntilTurn,
      // Reset per-war loss counters for the new conflict.
      militaryUnitsLostA: 0,
      militaryUnitsLostB: 0,
      citiesLostA: 0,
      citiesLostB: 0,
      militaryStrengthAtWarStartA: 0,
      militaryStrengthAtWarStartB: 0,
    });
    this.relations.set(key, next);
    // Clear any pending peace proposal between these nations
    this.pendingProposals.delete(aggressorId);
    this.pendingProposals.delete(targetId);
    // War just cleared any active exploitation rights above; announce the ones
    // that were actually live so History/Chronicle can record the termination.
    // (Save restoration never runs through here, so it never emits these.)
    if (previous) this.emitExploitationRightsEndedByWar(aggressorId, targetId, previous);
    if (previous) this.logEconomicPressureClearedByWar(aggressorId, targetId, previous);
    for (const cb of this.warDeclaredListeners) cb(aggressorId, targetId, metadata);
    this.memoryHook?.onDeclareWar(aggressorId, targetId);
    this.notifyChanged(aggressorId, targetId);
    return true;
  }

  proposePeace(
    fromId: string,
    toId: string,
    terms: {
      offeredCityId?: string;
      offeredCityIds?: string[];
      goldReparations?: number;
      offeredExploitationRights?: boolean;
      removeProposerHoldings?: boolean;
      removeRecipientHoldings?: boolean;
    } = {},
  ): void {
    if (this.getState(fromId, toId) !== 'WAR') return;
    const currentTurn = this.turnManager?.getCurrentRound() ?? 0;
    const warDuration = this.getWarDuration(fromId, toId, currentTurn);
    const proposal: PeaceProposal = {
      fromNationId: fromId,
      toNationId: toId,
      warDuration,
      ...terms,
    };
    // The proposal itself starts the pacing cooldown, whether accepted or
    // rejected. This bilateral timestamp is already part of diplomacy save/load.
    const key = this.pairKey(fromId, toId);
    const relation = this.relations.get(key) ?? createDefaultRelation();
    this.relations.set(key, normalizeRelation({
      ...relation,
      lastPeaceProposalTurn: currentTurn,
    }));
    this.pendingProposals.set(toId, proposal);
    for (const cb of this.proposedListeners) cb(proposal);
  }

  getWarDuration(a: string, b: string, currentTurn: number): number {
    const relation = this.getRelation(a, b);
    if (relation.state !== 'WAR' || relation.lastWarDeclarationTurn === null) return 0;
    return currentTurn - relation.lastWarDeclarationTurn;
  }

  canProposePeace(a: string, b: string, currentTurn: number): boolean {
    if (this.getState(a, b) !== 'WAR') return false;
    return this.getWarDuration(a, b, currentTurn) >= MIN_WAR_TURNS_FOR_PEACE;
  }

  recordWarUnitLoss(nationId: string, opposingNationId: string): void {
    const key = this.pairKey(nationId, opposingNationId);
    const current = this.relations.get(key);
    if (!current || current.state !== 'WAR') return;
    const [a] = this.sortedPair(nationId, opposingNationId);
    const isA = nationId === a;
    this.relations.set(key, {
      ...current,
      militaryUnitsLostA: isA ? current.militaryUnitsLostA + 1 : current.militaryUnitsLostA,
      militaryUnitsLostB: isA ? current.militaryUnitsLostB : current.militaryUnitsLostB + 1,
    });
  }

  recordWarCityLoss(losingNationId: string, opposingNationId: string): void {
    const key = this.pairKey(losingNationId, opposingNationId);
    const current = this.relations.get(key);
    if (!current || current.state !== 'WAR') return;
    const [a] = this.sortedPair(losingNationId, opposingNationId);
    const isA = losingNationId === a;
    this.relations.set(key, {
      ...current,
      citiesLostA: isA ? current.citiesLostA + 1 : current.citiesLostA,
      citiesLostB: isA ? current.citiesLostB : current.citiesLostB + 1,
    });
  }

  snapshotWarStartStrength(nationId: string, opposingNationId: string, strength: number): void {
    const key = this.pairKey(nationId, opposingNationId);
    const current = this.relations.get(key);
    if (!current) return;
    const [a] = this.sortedPair(nationId, opposingNationId);
    const isA = nationId === a;
    this.relations.set(key, {
      ...current,
      militaryStrengthAtWarStartA: isA ? strength : current.militaryStrengthAtWarStartA,
      militaryStrengthAtWarStartB: isA ? current.militaryStrengthAtWarStartB : strength,
    });
  }

  getWarExhaustion(nationId: string, opposingNationId: string): { unitsLost: number; citiesLost: number; startStrength: number } {
    const key = this.pairKey(nationId, opposingNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    const [a] = this.sortedPair(nationId, opposingNationId);
    const isA = nationId === a;
    return {
      unitsLost: isA ? current.militaryUnitsLostA : current.militaryUnitsLostB,
      citiesLost: isA ? current.citiesLostA : current.citiesLostB,
      startStrength: isA ? current.militaryStrengthAtWarStartA : current.militaryStrengthAtWarStartB,
    };
  }

  isPeaceTreatyActive(a: string, b: string, currentTurn: number): boolean {
    const untilTurn = this.getRelation(a, b).peaceTreatyUntilTurn;
    return untilTurn !== undefined && untilTurn !== null && currentTurn < untilTurn;
  }

  isCeasefireActive(a: string, b: string, currentTurn: number): boolean {
    const untilTurn = this.getRelation(a, b).ceasefireUntilTurn;
    return untilTurn !== undefined && untilTurn !== null && currentTurn < untilTurn;
  }

  getPeaceTreatyRemainingTurns(a: string, b: string, currentTurn: number): number {
    const untilTurn = this.getRelation(a, b).peaceTreatyUntilTurn;
    if (untilTurn === undefined || untilTurn === null) return 0;
    return Math.max(0, untilTurn - currentTurn);
  }

  getCeasefireRemainingTurns(a: string, b: string, currentTurn: number): number {
    const untilTurn = this.getRelation(a, b).ceasefireUntilTurn;
    if (untilTurn === undefined || untilTurn === null) return 0;
    return Math.max(0, untilTurn - currentTurn);
  }

  enforceCeasefire(a: string, b: string, durationTurns: number, currentTurn?: number): boolean {
    if (a === b || this.getState(a, b) !== 'WAR') return false;
    const key = this.pairKey(a, b);
    const previous = this.relations.get(key);
    const turn = currentTurn ?? this.turnManager?.getCurrentRound() ?? previous?.lastPeaceProposalTurn ?? 0;
    const next = normalizeRelation({
      ...previous,
      state: 'PEACE',
      openBordersFromAToB: false,
      openBordersFromBToA: false,
      tradeRelations: false,
      lastPeaceProposalTurn: turn,
      ceasefireUntilTurn: turn + Math.max(0, Math.floor(durationTurns)),
    });
    this.relations.set(key, next);
    this.pendingProposals.delete(a);
    this.pendingProposals.delete(b);
    this.memoryHook?.onMakePeace(a, b);
    this.notifyChanged(a, b);
    this.notifyWarEnded(a, b);
    return true;
  }

  getAggressorNationId(a: string, b: string): string | undefined {
    return this.relations.get(this.pairKey(a, b))?.aggressorNationId;
  }

  respondToPeace(fromId: string, toId: string, accept: boolean): void {
    this.pendingProposals.delete(toId);
    if (accept) {
      const key = this.pairKey(fromId, toId);
      const previous = this.relations.get(key);
      const wasAtWar = previous?.state === 'WAR';
      const currentTurn = this.turnManager?.getCurrentRound() ?? previous?.lastPeaceProposalTurn ?? 0;
      const next = normalizeRelation({
        ...previous,
        state: 'PEACE',
        // Peace also clears any leftover grants — both sides reset.
        openBordersFromAToB: false,
        openBordersFromBToA: false,
        tradeRelations: false,
        // TODO: same as declareWar — stamp explicitly when the manager
        // doesn't have access to a TurnManager.
        lastPeaceProposalTurn: currentTurn,
        peaceTreatyUntilTurn: currentTurn + this.peaceTreatyCooldownTurns,
      });
      this.relations.set(key, next);
      for (const cb of this.acceptedListeners) cb(fromId, toId);
      this.memoryHook?.onMakePeace(fromId, toId);
      this.notifyChanged(fromId, toId);
      if (wasAtWar) this.notifyWarEnded(fromId, toId);
    } else {
      for (const cb of this.declinedListeners) cb(fromId, toId);
    }
  }

  /**
   * Toggle the directional grant from `fromNationId` to `toNationId`.
   * Only the from-side's permission flips — the other direction is left
   * untouched. Returns the new grant value for the from→to direction.
   */
  toggleOpenBorders(fromNationId: string, toNationId: string): boolean {
    const key = this.pairKey(fromNationId, toNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    const next: DiplomacyRelation = { ...current };
    const newGrant = !this.readDirectionalGrant(fromNationId, toNationId, current);
    this.writeDirectionalGrant(fromNationId, toNationId, next, newGrant);
    next.lastOpenBordersChangeTurn =
      this.turnManager?.getCurrentRound() ?? current.lastOpenBordersChangeTurn ?? null;
    this.relations.set(key, next);
    if (this.memoryHook) {
      if (newGrant) this.memoryHook.onOpenBorders(fromNationId, toNationId);
      else this.memoryHook.onCancelOpenBorders(fromNationId, toNationId);
    }
    this.notifyChanged(fromNationId, toNationId);
    return newGrant;
  }

  hasEmbassy(fromNationId: string, toNationId: string): boolean {
    if (fromNationId === toNationId) return true;
    const relation = this.relations.get(this.pairKey(fromNationId, toNationId))
      ?? createDefaultRelation();
    return this.readEmbassyGrant(fromNationId, toNationId, relation);
  }

  hasMutualEmbassies(nationAId: string, nationBId: string): boolean {
    return this.hasEmbassy(nationAId, nationBId) && this.hasEmbassy(nationBId, nationAId);
  }

  canEstablishEmbassy(
    fromNationId: string,
    toNationId: string,
    context: DiplomacyAgreementValidationContext,
  ): DiplomacyAgreementValidationResult {
    if (fromNationId === toNationId) return { ok: false, reason: 'Cannot establish an embassy with yourself.' };
    if (!context.haveMet(fromNationId, toNationId)) return { ok: false, reason: 'You have not met this nation.' };
    if (!context.hasTechnology(fromNationId, 'writing') || !context.hasTechnology(toNationId, 'writing')) {
      return { ok: false, reason: 'Requires both nations to know Writing.' };
    }
    if (this.getState(fromNationId, toNationId) === 'WAR') return { ok: false, reason: 'Unavailable during war.' };
    if (this.hasEmbassy(fromNationId, toNationId)) return { ok: false, reason: 'Embassy already established.' };
    return { ok: true };
  }

  establishEmbassy(fromNationId: string, toNationId: string): boolean {
    if (fromNationId === toNationId) return false;
    const key = this.pairKey(fromNationId, toNationId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (current.state === 'WAR' || this.readEmbassyGrant(fromNationId, toNationId, current)) return false;
    const next: DiplomacyRelation = { ...current };
    this.writeEmbassyGrant(fromNationId, toNationId, next, true);
    next.lastEmbassyChangeTurn =
      this.turnManager?.getCurrentRound() ?? current.lastEmbassyChangeTurn ?? null;
    this.relations.set(key, next);
    for (const cb of this.embassyEstablishedListeners) cb(fromNationId, toNationId);
    this.notifyChanged(fromNationId, toNationId);
    return true;
  }

  canEstablishTradeRelations(
    nationAId: string,
    nationBId: string,
    context: DiplomacyAgreementValidationContext,
  ): DiplomacyAgreementValidationResult {
    if (nationAId === nationBId) return { ok: false, reason: 'Cannot trade with yourself.' };
    if (!context.haveMet(nationAId, nationBId)) return { ok: false, reason: 'You have not met this nation.' };
    // Trade Relations are a diplomatic/cultural permission: both nations need
    // the culture node Foreign Trade (NOT the technology Trade Networks).
    if (!context.hasCulture(nationAId, 'foreign_trade') || !context.hasCulture(nationBId, 'foreign_trade')) {
      return { ok: false, reason: 'Requires both nations to have Foreign Trade culture.' };
    }
    if (this.getState(nationAId, nationBId) === 'WAR') return { ok: false, reason: 'Unavailable during war.' };
    if (this.getEffectiveEconomicPressure(nationAId, nationBId) === 'embargo') {
      return { ok: false, reason: 'Unavailable while an Embargo is active.' };
    }
    if (!this.hasMutualEmbassies(nationAId, nationBId)) return { ok: false, reason: 'Requires mutual embassies.' };
    if (this.hasTradeRelations(nationAId, nationBId)) return { ok: false, reason: 'Trade Relations already active.' };
    return { ok: true };
  }

  establishTradeRelations(nationAId: string, nationBId: string): boolean {
    if (nationAId === nationBId) return false;
    const key = this.pairKey(nationAId, nationBId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (
      current.state === 'WAR'
      || current.tradeRelations
      || !this.hasMutualEmbassies(nationAId, nationBId)
      || this.getEffectiveEconomicPressure(nationAId, nationBId) === 'embargo'
    ) return false;
    const next: DiplomacyRelation = {
      ...current,
      tradeRelations: true,
      lastTradeRelationsChangeTurn:
        this.turnManager?.getCurrentRound() ?? current.lastTradeRelationsChangeTurn ?? null,
    };
    this.relations.set(key, next);
    for (const cb of this.tradeRelationsEstablishedListeners) cb(nationAId, nationBId);
    this.notifyChanged(nationAId, nationBId);
    return true;
  }

  cancelTradeRelations(nationAId: string, nationBId: string): boolean {
    if (nationAId === nationBId) return false;
    const key = this.pairKey(nationAId, nationBId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (!current.tradeRelations) return false;
    const next: DiplomacyRelation = {
      ...current,
      tradeRelations: false,
      lastTradeRelationsChangeTurn:
        this.turnManager?.getCurrentRound() ?? current.lastTradeRelationsChangeTurn ?? null,
    };
    this.relations.set(key, next);
    this.notifyChanged(nationAId, nationBId);
    return true;
  }

  hasTradeRelations(nationAId: string, nationBId: string): boolean {
    return this.getRelation(nationAId, nationBId).tradeRelations;
  }

  getPendingProposal(toId: string): PeaceProposal | null {
    const proposal = this.pendingProposals.get(toId);
    return proposal ? this.clonePeaceProposal(proposal) : null;
  }

  getPendingPeaceProposals(): PeaceProposal[] {
    return [...this.pendingProposals.values()].map((proposal) => this.clonePeaceProposal(proposal));
  }

  /** Restore pending offers after relations; listeners re-present them to Human or AI. */
  restorePendingPeaceProposals(proposals: readonly PeaceProposal[] | undefined): void {
    this.pendingProposals.clear();
    for (const candidate of proposals ?? []) {
      if (!candidate || typeof candidate.fromNationId !== 'string' || typeof candidate.toNationId !== 'string') continue;
      if (candidate.fromNationId === candidate.toNationId) continue;
      if (this.getState(candidate.fromNationId, candidate.toNationId) !== 'WAR') continue;
      const proposal: PeaceProposal = {
        fromNationId: candidate.fromNationId,
        toNationId: candidate.toNationId,
        warDuration: Math.max(0, Math.floor(candidate.warDuration ?? 0)),
        ...(candidate.offeredCityId ? { offeredCityId: candidate.offeredCityId } : {}),
        ...(Array.isArray(candidate.offeredCityIds) ? { offeredCityIds: [...candidate.offeredCityIds] } : {}),
        ...(Number.isFinite(candidate.goldReparations) ? { goldReparations: candidate.goldReparations } : {}),
        ...(candidate.offeredExploitationRights === true ? { offeredExploitationRights: true } : {}),
        ...(candidate.removeProposerHoldings === true ? { removeProposerHoldings: true } : {}),
        ...(candidate.removeRecipientHoldings === true ? { removeRecipientHoldings: true } : {}),
      };
      this.pendingProposals.set(proposal.toNationId, proposal);
    }
    for (const proposal of this.pendingProposals.values()) {
      for (const cb of this.proposedListeners) cb(this.clonePeaceProposal(proposal));
    }
  }

  onPeaceProposed(callback: PeaceProposedListener): void {
    this.proposedListeners.push(callback);
  }

  onPeaceAccepted(callback: PeaceAcceptedListener): void {
    this.acceptedListeners.push(callback);
  }

  onPeaceDeclined(callback: PeaceDeclinedListener): void {
    this.declinedListeners.push(callback);
  }

  onWarDeclared(callback: WarDeclaredListener): void {
    this.warDeclaredListeners.push(callback);
  }

  /** Fired for explicit directional sanction changes (not passive save restore). */
  onEconomicPressureChanged(callback: EconomicPressureChangedListener): void {
    this.economicPressureChangedListeners.push(callback);
  }

  /** Fired whenever a new directional exploitation right is granted (any source). */
  onExploitationRightsGranted(callback: ExploitationRightsGrantedListener): void {
    this.exploitationRightsGrantedListeners.push(callback);
  }

  /** Fired for each active directional right cleared by an event (currently war). */
  onExploitationRightsEnded(callback: ExploitationRightsEndedListener): void {
    this.exploitationRightsEndedListeners.push(callback);
  }

  /** Announce the directional rights that were live between the two nations before war cleared them. */
  private emitExploitationRightsEndedByWar(a: string, b: string, previous: DiplomacyRelation): void {
    if (this.exploitationRightsEndedListeners.length === 0) return;
    const [first, second] = this.sortedPair(a, b);
    const ended: Array<{ grantorNationId: string; beneficiaryNationId: string }> = [];
    if (previous.exploitationRightsFromAToB) ended.push({ grantorNationId: first, beneficiaryNationId: second });
    if (previous.exploitationRightsFromBToA) ended.push({ grantorNationId: second, beneficiaryNationId: first });
    for (const { grantorNationId, beneficiaryNationId } of ended) {
      for (const cb of this.exploitationRightsEndedListeners) {
        cb({ grantorNationId, beneficiaryNationId, reason: 'war' });
      }
    }
  }

  onEmbassyEstablished(callback: DiplomacyPairListener): void {
    this.embassyEstablishedListeners.push(callback);
  }

  onTradeRelationsEstablished(callback: DiplomacyPairListener): void {
    this.tradeRelationsEstablishedListeners.push(callback);
  }

  onAllianceFormed(callback: DiplomacyPairListener): void {
    this.allianceFormedListeners.push(callback);
  }

  onJointWarAgreement(callback: DiplomacyPairListener): void {
    this.jointWarAgreementListeners.push(callback);
  }

  onDiplomacyChanged(callback: DiplomacyChangedListener): void {
    this.changedListeners.push(callback);
  }

  private clonePeaceProposal(proposal: PeaceProposal): PeaceProposal {
    return {
      fromNationId: proposal.fromNationId,
      toNationId: proposal.toNationId,
      warDuration: proposal.warDuration,
      ...(proposal.offeredCityId ? { offeredCityId: proposal.offeredCityId } : {}),
      ...(proposal.offeredCityIds ? { offeredCityIds: [...proposal.offeredCityIds] } : {}),
      ...(proposal.goldReparations !== undefined ? { goldReparations: proposal.goldReparations } : {}),
      ...(proposal.offeredExploitationRights ? { offeredExploitationRights: true } : {}),
      ...(proposal.removeProposerHoldings ? { removeProposerHoldings: true } : {}),
      ...(proposal.removeRecipientHoldings ? { removeRecipientHoldings: true } : {}),
    };
  }

  /**
   * Return every nation-pair whose diplomatic state differs from defaults.
   * Used by save-load serialization.
   */
  getAllStates(): { keys: [string, string]; relation: DiplomacyRelation }[] {
    const out: { keys: [string, string]; relation: DiplomacyRelation }[] = [];
    const defaults = createDefaultRelation();
    for (const [key, relation] of this.relations) {
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === undefined || b === undefined) continue;
      if (
        relation.state === defaults.state &&
        relation.openBordersFromAToB === defaults.openBordersFromAToB &&
        relation.openBordersFromBToA === defaults.openBordersFromBToA &&
        relation.exploitationRightsFromAToB === defaults.exploitationRightsFromAToB &&
        relation.exploitationRightsFromBToA === defaults.exploitationRightsFromBToA &&
        relation.embassyFromAToB === defaults.embassyFromAToB &&
        relation.embassyFromBToA === defaults.embassyFromBToA &&
        relation.tradeRelations === defaults.tradeRelations &&
        relation.economicPressureFromAToB === defaults.economicPressureFromAToB &&
        relation.economicPressureFromAToBRemovalOfferPresented === defaults.economicPressureFromAToBRemovalOfferPresented &&
        relation.economicPressureFromBToA === defaults.economicPressureFromBToA &&
        relation.economicPressureFromBToARemovalOfferPresented === defaults.economicPressureFromBToARemovalOfferPresented &&
        relation.trust === defaults.trust &&
        relation.fear === defaults.fear &&
        relation.hostility === defaults.hostility &&
        relation.affinity === defaults.affinity &&
        relation.suspicion === defaults.suspicion &&
        relation.lastWarDeclarationTurn === defaults.lastWarDeclarationTurn &&
        relation.lastPeaceProposalTurn === defaults.lastPeaceProposalTurn &&
        relation.lastOpenBordersChangeTurn === defaults.lastOpenBordersChangeTurn &&
        relation.lastEmbassyChangeTurn === defaults.lastEmbassyChangeTurn &&
        relation.lastTradeRelationsChangeTurn === defaults.lastTradeRelationsChangeTurn &&
        relation.peaceTreatyUntilTurn === defaults.peaceTreatyUntilTurn &&
        relation.ceasefireUntilTurn === defaults.ceasefireUntilTurn
      ) {
        continue;
      }
      out.push({ keys: [a, b], relation: { ...relation } });
    }
    return out;
  }

  /**
   * Silently overwrite the state between two nations. Does not fire
   * listeners. Used by save-load restoration.
   */
  restoreState(a: string, b: string, partial: PartialDiplomacyRelationInput): void {
    if (a === b) return;
    this.relations.set(this.pairKey(a, b), normalizeRelation(partial));
  }

  /**
   * Persist the four memory values (trust/fear/hostility/affinity) for the
   * given pair. Quiet — no listeners fire. The memory system clamps before
   * calling so the manager only stores valid 0–100 values.
   */
  /**
   * Record a successful map exchange as a friendly diplomatic gesture. Applies
   * the relationship bonus via the memory system and notifies listeners so the
   * diplomacy UI refreshes. Does not change relation state (PEACE/WAR).
   */
  recordMapExchange(a: string, b: string): void {
    this.memoryHook?.onExchangeMaps(a, b);
    this.notifyChanged(a, b);
  }

  /**
   * Record a newly formed alliance as a friendly diplomatic milestone. Applies
   * the relationship bonus via the memory system and notifies listeners so the
   * diplomacy UI refreshes. Alliance membership itself lives in AllianceManager;
   * this only updates the shared relation values.
   */
  recordAllianceFormed(a: string, b: string): void {
    this.memoryHook?.onFormAlliance(a, b);
    for (const cb of this.allianceFormedListeners) cb(a, b);
    this.notifyChanged(a, b);
  }

  /**
   * Record that two nations agreed to a joint war — a friendly act of military
   * cooperation that moderately improves their relation. War declarations
   * against the shared target are handled separately by the caller.
   */
  recordJointWarAgreement(a: string, b: string): void {
    this.memoryHook?.onJointWarAgreement(a, b);
    for (const cb of this.jointWarAgreementListeners) cb(a, b);
    this.notifyChanged(a, b);
  }

  recordGoldGift(fromNationId: string, toNationId: string, amount: number): void {
    if (fromNationId === toNationId || amount <= 0) return;
    this.memoryHook?.onGoldGift(fromNationId, toNationId, amount);
    this.notifyChanged(fromNationId, toNationId);
  }

  recordUnitGift(fromNationId: string, toNationId: string, unitCount: number, powerValue?: number): void {
    if (fromNationId === toNationId || unitCount <= 0) return;
    this.memoryHook?.onUnitGift(fromNationId, toNationId, unitCount, powerValue);
    this.notifyChanged(fromNationId, toNationId);
  }

  recordCityGift(fromNationId: string, toNationId: string, cityId: string): void {
    if (fromNationId === toNationId || cityId.length === 0) return;
    this.memoryHook?.onCityGift(fromNationId, toNationId, cityId);
    this.notifyChanged(fromNationId, toNationId);
  }

  /**
   * Record a "symbolic gift of gesture" — a formal, no-value courtesy that
   * costs the giver but transfers no resources. Applies a modest goodwill
   * boost; the one-time-only rule lives with the caller (SymbolicGiftRegistry).
   */
  recordSymbolicGift(fromNationId: string, toNationId: string): void {
    if (fromNationId === toNationId) return;
    this.memoryHook?.onSymbolicGift(fromNationId, toNationId);
    this.notifyChanged(fromNationId, toNationId);
  }

  /**
   * Record that one nation left a shared alliance — a moderate relationship
   * penalty. Relations are symmetric in this model, so a single write covers
   * both directions between the departing nation and a remaining member.
   */
  recordAllianceDeparture(a: string, b: string): void {
    this.memoryHook?.onAllianceDeparture(a, b);
    this.notifyChanged(a, b);
  }

  /** Small positive bump when a member approves another's council proposal. */
  recordProposalApproved(a: string, b: string): void {
    this.memoryHook?.onProposalApproved(a, b);
    this.notifyChanged(a, b);
  }

  /** Small friction when a member vetoes another's council proposal. */
  recordProposalRejected(a: string, b: string): void {
    this.memoryHook?.onProposalRejected(a, b);
    this.notifyChanged(a, b);
  }

  /** Diplomatic penalty applied by a passed condemnation resolution. */
  recordWorldCouncilCondemnation(memberNationId: string, condemnedNationId: string): void {
    if (memberNationId === condemnedNationId) return;
    const relation = this.getRelation(memberNationId, condemnedNationId);
    this.setMemoryValues(memberNationId, condemnedNationId, {
      trust: clampDiplomacyValue(relation.trust - 15),
      fear: clampDiplomacyValue(relation.fear + 5),
      hostility: clampDiplomacyValue(relation.hostility + 15),
      affinity: relation.affinity,
      suspicion: relation.suspicion,
    });
    this.notifyChanged(memberNationId, condemnedNationId);
  }

  setMemoryValues(a: string, b: string, values: DiplomaticMemoryValues): void {
    const key = this.pairKey(a, b);
    const current = this.relations.get(key) ?? createDefaultRelation();
    this.relations.set(key, {
      ...current,
      trust: values.trust,
      fear: values.fear,
      hostility: values.hostility,
      affinity: values.affinity,
      suspicion: values.suspicion,
    });
  }

  /** Current suspicion (0–100) for a pair. Symmetric, like trust/fear/etc. */
  getSuspicion(a: string, b: string): number {
    return this.getRelation(a, b).suspicion;
  }

  /**
   * Set this pair's suspicion directly (clamped 0–100). Quiet — fires no
   * listeners — mirroring setMemoryValues; callers refresh UI if needed.
   */
  setSuspicion(a: string, b: string, value: number): void {
    const key = this.pairKey(a, b);
    const current = this.relations.get(key) ?? createDefaultRelation();
    this.relations.set(key, { ...current, suspicion: clampSuspicion(value) });
  }

  /** Add `delta` to this pair's suspicion (clamped 0–100). Returns the new value. */
  addSuspicion(a: string, b: string, delta: number): number {
    const next = clampSuspicion(this.getSuspicion(a, b) + delta);
    this.setSuspicion(a, b, next);
    return next;
  }

  /**
   * Passively decay suspicion toward 0 by `amount` for every tracked relation
   * (clamped at 0). Only stored relations are touched; never-interacted pairs
   * default to 0 already. Returns the pairs that actually changed so callers can
   * log meaningful drift without per-nation spam.
   */
  decaySuspicion(amount = SUSPICION_DECAY_PER_ROUND): Array<{ a: string; b: string; from: number; to: number }> {
    if (amount <= 0) return [];
    const changed: Array<{ a: string; b: string; from: number; to: number }> = [];
    for (const [key, relation] of this.relations) {
      if (relation.suspicion <= MIN_SUSPICION) continue;
      const from = relation.suspicion;
      const to = Math.max(MIN_SUSPICION, from - amount);
      if (to === from) continue;
      relation.suspicion = to;
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a !== undefined && b !== undefined) changed.push({ a, b, from, to });
    }
    return changed;
  }

  /**
   * Authoritative once-per-round diplomatic upkeep.
   *
   * A Peace Treaty accepted on round N with duration D blocks declarations on
   * rounds N..N+D-1. Round-start processing therefore cools on N+1..N+D: the
   * last step happens as the restriction expires, immediately before normal
   * diplomacy resumes that round. This provides exactly D cooling steps without
   * applying a partial step at the instant peace is signed.
   *
   * Suspicion already has a global -1 drift. Treaty pairs receive the treaty's
   * exact -2 instead of stacking both effects into an unintended -3.
   */
  processDiplomaticUpkeep(currentTurn: number): void {
    for (const [key, relation] of this.relations) {
      const treatyStartTurn = relation.lastPeaceProposalTurn;
      const treatyUntilTurn = relation.peaceTreatyUntilTurn;
      const isTreatyCoolingTurn = relation.state === 'PEACE'
        && typeof treatyUntilTurn === 'number'
        // Known start turns prevent a same-round step if another roundStart
        // listener happened to accept peace before upkeep. Older saves without
        // the start stamp still cool safely from their authoritative until-turn.
        && (typeof treatyStartTurn !== 'number' || currentTurn > treatyStartTurn)
        && currentTurn <= treatyUntilTurn;
      const suspicionDecrease = isTreatyCoolingTurn
        ? PEACE_TREATY_COOLING_PER_ROUND
        : SUSPICION_DECAY_PER_ROUND;
      const nextSuspicion = Math.max(MIN_SUSPICION, relation.suspicion - suspicionDecrease);
      const nextHostility = isTreatyCoolingTurn
        ? Math.max(0, relation.hostility - PEACE_TREATY_COOLING_PER_ROUND)
        : relation.hostility;
      const nextFear = isTreatyCoolingTurn
        ? Math.max(0, relation.fear - PEACE_TREATY_COOLING_PER_ROUND)
        : relation.fear;
      if (
        nextSuspicion === relation.suspicion
        && nextHostility === relation.hostility
        && nextFear === relation.fear
      ) continue;
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a === undefined || b === undefined) continue;
      this.setMemoryValues(a, b, {
        trust: relation.trust,
        fear: nextFear,
        hostility: nextHostility,
        affinity: relation.affinity,
        suspicion: nextSuspicion,
      });
    }
  }

  /** Reset all diplomacy state. Used before applying a loaded save. */
  resetAll(): void {
    this.relations.clear();
    this.pendingProposals.clear();
    this.vassalHosts.clear();
  }

  removeNationRelations(nationId: string): number {
    let removed = 0;
    for (const key of Array.from(this.relations.keys())) {
      const [a, b] = key.split(PAIR_KEY_SEPARATOR);
      if (a !== nationId && b !== nationId) continue;
      this.relations.delete(key);
      removed++;
    }
    this.pendingProposals.delete(nationId);
    this.vassalHosts.delete(nationId);
    for (const [vassalId, hostId] of Array.from(this.vassalHosts.entries())) {
      if (hostId === nationId) this.vassalHosts.delete(vassalId);
    }
    for (const [toId, proposal] of Array.from(this.pendingProposals.entries())) {
      if (proposal.fromNationId !== nationId && proposal.toNationId !== nationId) continue;
      this.pendingProposals.delete(toId);
    }
    return removed;
  }

  private notifyChanged(a: string, b: string): void {
    const relation = this.getRelation(a, b);
    for (const cb of this.changedListeners) cb(a, b, relation);
  }

  private readDirectionalGrant(
    fromId: string,
    toId: string,
    relation: DiplomacyRelation,
  ): boolean {
    const [a, b] = this.sortedPair(fromId, toId);
    if (fromId === a && toId === b) return relation.openBordersFromAToB;
    if (fromId === b && toId === a) return relation.openBordersFromBToA;
    return false;
  }

  private writeDirectionalGrant(
    fromId: string,
    toId: string,
    relation: DiplomacyRelation,
    value: boolean,
  ): void {
    const [a, b] = this.sortedPair(fromId, toId);
    if (fromId === a && toId === b) {
      relation.openBordersFromAToB = value;
    } else if (fromId === b && toId === a) {
      relation.openBordersFromBToA = value;
    }
  }

  private readExploitationRightsGrant(
    grantorNationId: string,
    beneficiaryNationId: string,
    relation: DiplomacyRelation,
  ): boolean {
    const [a, b] = this.sortedPair(grantorNationId, beneficiaryNationId);
    if (grantorNationId === a && beneficiaryNationId === b) return relation.exploitationRightsFromAToB;
    if (grantorNationId === b && beneficiaryNationId === a) return relation.exploitationRightsFromBToA;
    return false;
  }

  private writeExploitationRightsGrant(
    grantorNationId: string,
    beneficiaryNationId: string,
    relation: DiplomacyRelation,
    value: boolean,
  ): void {
    const [a, b] = this.sortedPair(grantorNationId, beneficiaryNationId);
    if (grantorNationId === a && beneficiaryNationId === b) {
      relation.exploitationRightsFromAToB = value;
    } else if (grantorNationId === b && beneficiaryNationId === a) {
      relation.exploitationRightsFromBToA = value;
    }
  }

  private readEmbassyGrant(
    fromId: string,
    toId: string,
    relation: DiplomacyRelation,
  ): boolean {
    const [a, b] = this.sortedPair(fromId, toId);
    if (fromId === a && toId === b) return relation.embassyFromAToB;
    if (fromId === b && toId === a) return relation.embassyFromBToA;
    return false;
  }

  private writeEmbassyGrant(
    fromId: string,
    toId: string,
    relation: DiplomacyRelation,
    value: boolean,
  ): void {
    const [a, b] = this.sortedPair(fromId, toId);
    if (fromId === a && toId === b) {
      relation.embassyFromAToB = value;
    } else if (fromId === b && toId === a) {
      relation.embassyFromBToA = value;
    }
  }
}
