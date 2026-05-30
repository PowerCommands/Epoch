import type { TurnManager } from './TurnManager';

export type DiplomacyState = 'WAR' | 'PEACE';

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
  embassyFromAToB: boolean;
  embassyFromBToA: boolean;
  tradeRelations: boolean;

  trust: number;
  fear: number;
  hostility: number;
  affinity: number;

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
  offeredCityId?: string;
  goldReparations?: number;
  warDuration: number;
}

type PeaceProposedListener = (proposal: PeaceProposal) => void;
type PeaceAcceptedListener = (nationA: string, nationB: string) => void;
type PeaceDeclinedListener = (nationA: string, nationB: string) => void;
type WarDeclaredListener = (aggressorId: string, targetId: string) => void;
type DiplomacyChangedListener = (nationA: string, nationB: string, relation: DiplomacyRelation) => void;

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
}

export const DEFAULT_TRUST = 50;
export const DEFAULT_FEAR = 0;
export const DEFAULT_HOSTILITY = 0;
export const DEFAULT_AFFINITY = 0;
export const MIN_WAR_TURNS_FOR_PEACE = 15;
export const PEACE_TREATY_COOLDOWN_TURNS = 20;

export function createDefaultRelation(): DiplomacyRelation {
  return {
    state: 'PEACE',
    openBordersFromAToB: false,
    openBordersFromBToA: false,
    embassyFromAToB: false,
    embassyFromBToA: false,
    tradeRelations: false,
    trust: DEFAULT_TRUST,
    fear: DEFAULT_FEAR,
    hostility: DEFAULT_HOSTILITY,
    affinity: DEFAULT_AFFINITY,
    lastWarDeclarationTurn: null,
    lastPeaceProposalTurn: null,
    lastOpenBordersChangeTurn: null,
    lastEmbassyChangeTurn: null,
    lastTradeRelationsChangeTurn: null,
    peaceTreatyUntilTurn: null,
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
  return {
    state: partial.state ?? base.state,
    openBordersFromAToB: partial.openBordersFromAToB ?? legacyBoth ?? base.openBordersFromAToB,
    openBordersFromBToA: partial.openBordersFromBToA ?? legacyBoth ?? base.openBordersFromBToA,
    embassyFromAToB: partial.embassyFromAToB ?? base.embassyFromAToB,
    embassyFromBToA: partial.embassyFromBToA ?? base.embassyFromBToA,
    tradeRelations: partial.tradeRelations ?? base.tradeRelations,
    trust: partial.trust ?? base.trust,
    fear: partial.fear ?? base.fear,
    hostility: partial.hostility ?? base.hostility,
    affinity: partial.affinity ?? base.affinity,
    lastWarDeclarationTurn:
      partial.lastWarDeclarationTurn ?? partial.lastWarTurn ?? base.lastWarDeclarationTurn,
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
  private readonly pendingProposals = new Map<string, PeaceProposal>();
  private readonly proposedListeners: PeaceProposedListener[] = [];
  private readonly acceptedListeners: PeaceAcceptedListener[] = [];
  private readonly declinedListeners: PeaceDeclinedListener[] = [];
  private readonly warDeclaredListeners: WarDeclaredListener[] = [];
  private readonly changedListeners: DiplomacyChangedListener[] = [];
  private memoryHook: DiplomaticMemoryHook | null = null;
  private allianceGuard: ((aggressorId: string, targetId: string) => boolean) | null = null;

  // Optional so older callers/tests still work; when present, war/peace
  // transitions get stamped with the current round.
  constructor(private readonly turnManager?: TurnManager) {}

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

  getRelation(a: string, b: string): DiplomacyRelation {
    return { ...(this.relations.get(this.pairKey(a, b)) ?? createDefaultRelation()) };
  }

  canAttack(a: string, b: string): boolean {
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

  declareWar(aggressorId: string, targetId: string): boolean {
    if (aggressorId === targetId) return false;
    const key = this.pairKey(aggressorId, targetId);
    if (this.relations.get(key)?.state === 'WAR') return false;
    // Alliance partners cannot declare war on each other (covers human + AI).
    if (this.allianceGuard?.(aggressorId, targetId)) return false;
    const currentTurn = this.turnManager?.getCurrentRound() ?? 0;
    if (this.isPeaceTreatyActive(aggressorId, targetId, currentTurn)) return false;
    const previous = this.relations.get(key);
    const next = normalizeRelation({
      ...previous,
      state: 'WAR',
      // War clears any active border grants in both directions.
      openBordersFromAToB: false,
      openBordersFromBToA: false,
      embassyFromAToB: false,
      embassyFromBToA: false,
      tradeRelations: false,
      // TODO: when TurnManager is unavailable the stamp stays null — future
      // sources (events, AI, replays) should pass an explicit turn instead.
      lastWarDeclarationTurn:
        this.turnManager?.getCurrentRound() ?? previous?.lastWarDeclarationTurn ?? null,
      aggressorNationId: aggressorId,
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
    for (const cb of this.warDeclaredListeners) cb(aggressorId, targetId);
    this.memoryHook?.onDeclareWar(aggressorId, targetId);
    this.notifyChanged(aggressorId, targetId);
    return true;
  }

  proposePeace(
    fromId: string,
    toId: string,
    terms: { offeredCityId?: string; goldReparations?: number } = {},
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

  getPeaceTreatyRemainingTurns(a: string, b: string, currentTurn: number): number {
    const untilTurn = this.getRelation(a, b).peaceTreatyUntilTurn;
    if (untilTurn === undefined || untilTurn === null) return 0;
    return Math.max(0, untilTurn - currentTurn);
  }

  getAggressorNationId(a: string, b: string): string | undefined {
    return this.relations.get(this.pairKey(a, b))?.aggressorNationId;
  }

  respondToPeace(fromId: string, toId: string, accept: boolean): void {
    this.pendingProposals.delete(toId);
    if (accept) {
      const key = this.pairKey(fromId, toId);
      const previous = this.relations.get(key);
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
        peaceTreatyUntilTurn: currentTurn + PEACE_TREATY_COOLDOWN_TURNS,
      });
      this.relations.set(key, next);
      for (const cb of this.acceptedListeners) cb(fromId, toId);
      this.memoryHook?.onMakePeace(fromId, toId);
      this.notifyChanged(fromId, toId);
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
    if (!this.hasMutualEmbassies(nationAId, nationBId)) return { ok: false, reason: 'Requires mutual embassies.' };
    if (this.hasTradeRelations(nationAId, nationBId)) return { ok: false, reason: 'Trade Relations already active.' };
    return { ok: true };
  }

  establishTradeRelations(nationAId: string, nationBId: string): boolean {
    if (nationAId === nationBId) return false;
    const key = this.pairKey(nationAId, nationBId);
    const current = this.relations.get(key) ?? createDefaultRelation();
    if (current.state === 'WAR' || current.tradeRelations || !this.hasMutualEmbassies(nationAId, nationBId)) return false;
    const next: DiplomacyRelation = {
      ...current,
      tradeRelations: true,
      lastTradeRelationsChangeTurn:
        this.turnManager?.getCurrentRound() ?? current.lastTradeRelationsChangeTurn ?? null,
    };
    this.relations.set(key, next);
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
    return this.pendingProposals.get(toId) ?? null;
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

  onDiplomacyChanged(callback: DiplomacyChangedListener): void {
    this.changedListeners.push(callback);
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
        relation.embassyFromAToB === defaults.embassyFromAToB &&
        relation.embassyFromBToA === defaults.embassyFromBToA &&
        relation.tradeRelations === defaults.tradeRelations &&
        relation.trust === defaults.trust &&
        relation.fear === defaults.fear &&
        relation.hostility === defaults.hostility &&
        relation.affinity === defaults.affinity &&
        relation.lastWarDeclarationTurn === defaults.lastWarDeclarationTurn &&
        relation.lastPeaceProposalTurn === defaults.lastPeaceProposalTurn &&
        relation.lastOpenBordersChangeTurn === defaults.lastOpenBordersChangeTurn &&
        relation.lastEmbassyChangeTurn === defaults.lastEmbassyChangeTurn &&
        relation.lastTradeRelationsChangeTurn === defaults.lastTradeRelationsChangeTurn &&
        relation.peaceTreatyUntilTurn === defaults.peaceTreatyUntilTurn
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
    this.notifyChanged(a, b);
  }

  /**
   * Record that two nations agreed to a joint war — a friendly act of military
   * cooperation that moderately improves their relation. War declarations
   * against the shared target are handled separately by the caller.
   */
  recordJointWarAgreement(a: string, b: string): void {
    this.memoryHook?.onJointWarAgreement(a, b);
    this.notifyChanged(a, b);
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

  setMemoryValues(a: string, b: string, values: DiplomaticMemoryValues): void {
    const key = this.pairKey(a, b);
    const current = this.relations.get(key) ?? createDefaultRelation();
    this.relations.set(key, {
      ...current,
      trust: values.trust,
      fear: values.fear,
      hostility: values.hostility,
      affinity: values.affinity,
    });
  }

  /** Reset all diplomacy state. Used before applying a loaded save. */
  resetAll(): void {
    this.relations.clear();
    this.pendingProposals.clear();
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
