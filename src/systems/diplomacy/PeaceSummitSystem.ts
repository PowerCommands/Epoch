import type { City } from '../../entities/City';
import type { CityManager } from '../CityManager';
import type { DiplomacyManager, PeaceProposal } from '../DiplomacyManager';
import type { NationManager } from '../NationManager';
import type { PeaceTreatySystem } from '../PeaceTreatySystem';

/**
 * PeaceSummitSystem — the ceremonial process that now surrounds the existing
 * peace-resolution mechanics.
 *
 * A war no longer ends the instant a nation "wants peace". Instead a nation
 * proposes a Peace Summit (a city + a meeting turn); the other side may accept,
 * reject, or counter-propose a different (preferably neutral) location. Once both
 * sides agree, a ceasefire begins immediately while the nations remain FORMALLY
 * AT WAR — combat is suppressed through {@link DiplomacyManager.canAttack} — and a
 * countdown runs to the agreed summit turn. When the summit turn arrives the
 * existing peace negotiation runs unchanged: success ends the war, failure lifts
 * the ceasefire, resumes the war, and starts a cooldown before another summit.
 *
 * The system deliberately reuses the existing peace framework:
 *  - eligibility uses the scenario "minimum turns before peace negotiation";
 *  - the actual negotiation at the summit goes through
 *    {@link DiplomacyManager.proposePeace} / PeaceTreatySystem exactly as before;
 *  - outcomes are observed through the existing peace accepted/declined events.
 *
 * It owns only the new state: the summit records, the ceasefire flag (derived
 * from a record), and the per-pair failed-negotiation cooldown. It contains no
 * UI; every human decision is surfaced as an event for GameScene to present.
 */

/** Turns after acceptance before the summit takes place (inclusive range). */
export const SUMMIT_MIN_DELAY_TURNS = 3;
export const SUMMIT_MAX_DELAY_TURNS = 6;

/**
 * Recipient war-pressure at/above which an AI is considered "interested" in
 * peace talks. Below it (and not otherwise seeking peace) the AI usually refuses.
 * Reuses the same 0..1 pressure scale produced by PeaceTreatySystem.
 */
const AI_SUMMIT_INTEREST_PRESSURE = 0.35;

// Deliberately simple, centralized response weights (see task: "A modest
// randomized decision between accepting, counterproposing and rejecting is
// sufficient"). Values are cumulative thresholds against a deterministic roll.
const AI_INTERESTED_ACCEPT_CHANCE = 0.55;
const AI_INTERESTED_COUNTER_CHANCE = 0.85; // accept < 0.55 <= counter < 0.85 <= reject
const AI_UNINTERESTED_COUNTER_CHANCE = 0.15; // otherwise reject
/** Chance the original initiator (who wanted peace) accepts a counterproposal. */
const AI_COUNTER_ACCEPT_CHANCE = 0.8;

export type PeaceSummitPhase = 'awaitingResponse' | 'ceasefire' | 'negotiating';

export interface PeaceSummitRecord {
  /** Nation that first called for the summit (kept stable across a counter). */
  initiatorNationId: string;
  /** Owner of the offer currently on the table (flips to the counter-proposer). */
  proposerNationId: string;
  /** Nation that must respond to the current offer. */
  recipientNationId: string;
  /** City where the summit is proposed/agreed to take place. */
  cityId: string;
  /** Owner of the summit city; may be a neutral third nation. */
  cityOwnerNationId: string;
  /** Absolute turn the summit is (proposed to be) held. */
  summitTurn: number;
  phase: PeaceSummitPhase;
  /** Bounds the exchange: at most one counterproposal per summit. */
  counterproposed: boolean;
}

/** Serializable snapshot of all live summit state. */
export interface SavedPeaceSummitState {
  summits: PeaceSummitRecord[];
  failedNegotiations: { nationA: string; nationB: string; turn: number }[];
}

export type PeaceSummitEvent =
  | { kind: 'proposed'; record: PeaceSummitRecord; needsHumanResponse: boolean }
  | { kind: 'counterproposed'; record: PeaceSummitRecord; needsHumanResponse: boolean }
  | { kind: 'rejected'; proposerNationId: string; recipientNationId: string; cityId: string }
  | { kind: 'agreed'; record: PeaceSummitRecord }
  | { kind: 'summitReached'; record: PeaceSummitRecord; humanMustOffer: boolean }
  | { kind: 'negotiationsFailed'; nationA: string; nationB: string }
  | { kind: 'peaceReached'; nationA: string; nationB: string };

type PeaceSummitListener = (event: PeaceSummitEvent) => void;

export interface PeaceSummitDeps {
  diplomacyManager: DiplomacyManager;
  nationManager: NationManager;
  cityManager: CityManager;
  peaceTreatySystem: PeaceTreatySystem;
  getCurrentTurn: () => number;
  isHuman: (nationId: string) => boolean;
  /** Injectable deterministic roll for tests; production hashes turn/ids/salt. */
  roll?: (seed: string) => number;
}

export class PeaceSummitSystem {
  private readonly summits = new Map<string, PeaceSummitRecord>();
  private readonly failedNegotiationTurn = new Map<string, number>();
  private readonly listeners: PeaceSummitListener[] = [];
  private readonly roll: (seed: string) => number;

  constructor(private readonly deps: PeaceSummitDeps) {
    this.roll = deps.roll ?? hashToUnit;
  }

  /** Combat suppressor registered on DiplomacyManager: true while a ceasefire holds. */
  isCombatSuppressed = (a: string, b: string): boolean => this.isCeasefireActive(a, b);

  onSummitEvent(listener: PeaceSummitListener): void {
    this.listeners.push(listener);
  }

  private emit(event: PeaceSummitEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join('|');
  }

  getSummit(a: string, b: string): PeaceSummitRecord | null {
    return this.summits.get(this.pairKey(a, b)) ?? null;
  }

  /** True while an agreed (or in-negotiation) summit ceasefire suppresses combat. */
  isCeasefireActive(a: string, b: string): boolean {
    const record = this.summits.get(this.pairKey(a, b));
    return record !== undefined && (record.phase === 'ceasefire' || record.phase === 'negotiating');
  }

  /** Remaining turns until the agreed summit, or 0 when none/awaiting response. */
  getSummitCountdown(a: string, b: string): number {
    const record = this.summits.get(this.pairKey(a, b));
    if (!record) return 0;
    return Math.max(0, record.summitTurn - this.deps.getCurrentTurn());
  }

  /** Turns left on the post-failure cooldown before a new summit may be proposed. */
  getSummitCooldownRemaining(a: string, b: string, currentTurn: number): number {
    const failed = this.failedNegotiationTurn.get(this.pairKey(a, b));
    if (failed === undefined) return 0;
    const cooldownEnds = failed + this.deps.diplomacyManager.getMinPeaceNegotiationTurns();
    return Math.max(0, cooldownEnds - currentTurn);
  }

  /**
   * Whether `a` may propose a peace summit to `b` right now: the pair must be at
   * war long enough (scenario minimum), have no active summit, and be past any
   * failed-negotiation cooldown.
   */
  canInitiateSummit(a: string, b: string, currentTurn: number): boolean {
    if (a === b) return false;
    if (this.summits.has(this.pairKey(a, b))) return false;
    if (!this.deps.diplomacyManager.canProposePeace(a, b, currentTurn)) return false;
    return this.getSummitCooldownRemaining(a, b, currentTurn) === 0;
  }

  /**
   * Begin a peace summit from `fromId` to `toId`. The initiator normally proposes
   * one of its own cities (its capital when available). An AI recipient responds
   * synchronously; a human recipient's decision is surfaced as an event.
   */
  initiateSummit(fromId: string, toId: string, cityOverride?: { cityId: string; cityOwnerNationId: string }): PeaceSummitRecord | null {
    const currentTurn = this.deps.getCurrentTurn();
    if (!this.canInitiateSummit(fromId, toId, currentTurn)) return null;

    const city = cityOverride
      ? { id: cityOverride.cityId, ownerNationId: cityOverride.cityOwnerNationId }
      : this.pickOwnSummitCity(fromId);
    if (!city) return null;

    const record: PeaceSummitRecord = {
      initiatorNationId: fromId,
      proposerNationId: fromId,
      recipientNationId: toId,
      cityId: city.id,
      cityOwnerNationId: city.ownerNationId,
      summitTurn: currentTurn + this.pickDelay(fromId, toId, currentTurn),
      phase: 'awaitingResponse',
      counterproposed: false,
    };
    this.summits.set(this.pairKey(fromId, toId), record);
    this.emit({ kind: 'proposed', record, needsHumanResponse: this.deps.isHuman(toId) });
    if (!this.deps.isHuman(toId)) this.resolveAIResponse(record);
    return record;
  }

  /**
   * Apply a human recipient's decision on the current offer. Humans choose only
   * Accept or Reject (v1 keeps the human off the counterproposal path).
   */
  respondAsHuman(a: string, b: string, accept: boolean): void {
    const record = this.summits.get(this.pairKey(a, b));
    if (!record || record.phase !== 'awaitingResponse') return;
    // Ignore stale/misdirected UI callbacks. Only the nation currently named as
    // recipient may decide the offer on the table.
    if (record.recipientNationId !== a) return;
    if (accept) this.agreeSummit(record);
    else this.rejectSummit(record);
  }

  /** AI decides accept / counter / reject on an incoming summit proposal. */
  private resolveAIResponse(record: PeaceSummitRecord): void {
    const currentTurn = this.deps.getCurrentTurn();
    const warDuration = this.deps.diplomacyManager.getWarDuration(
      record.recipientNationId,
      record.proposerNationId,
      currentTurn,
    );
    const seeking = this.deps.peaceTreatySystem.evaluateAIPeaceSeeking(
      record.recipientNationId,
      record.proposerNationId,
      warDuration,
    );
    const interested = seeking.shouldInitiate || seeking.warPressure >= AI_SUMMIT_INTEREST_PRESSURE;
    const r = this.roll(`summit-response|${record.proposerNationId}|${record.recipientNationId}|${currentTurn}`);

    // A counter is only available while the exchange is still unbounded.
    if (!interested) {
      if (!record.counterproposed && r < AI_UNINTERESTED_COUNTER_CHANCE) this.counterProposeAsAI(record);
      else this.rejectSummit(record);
      return;
    }
    if (r < AI_INTERESTED_ACCEPT_CHANCE) this.agreeSummit(record);
    else if (!record.counterproposed && r < AI_INTERESTED_COUNTER_CHANCE) this.counterProposeAsAI(record);
    else this.rejectSummit(record);
  }

  /** AI decides accept / reject on a counterproposal returned to it (no re-counter). */
  private resolveAIResponseToCounter(record: PeaceSummitRecord): void {
    const currentTurn = this.deps.getCurrentTurn();
    const warDuration = this.deps.diplomacyManager.getWarDuration(
      record.recipientNationId,
      record.proposerNationId,
      currentTurn,
    );
    const seeking = this.deps.peaceTreatySystem.evaluateAIPeaceSeeking(
      record.recipientNationId,
      record.proposerNationId,
      warDuration,
    );
    const interested = seeking.shouldInitiate || seeking.warPressure >= AI_SUMMIT_INTEREST_PRESSURE;
    const r = this.roll(`summit-counter-response|${record.proposerNationId}|${record.recipientNationId}|${currentTurn}`);
    if (interested && r < AI_COUNTER_ACCEPT_CHANCE) this.agreeSummit(record);
    else this.rejectSummit(record);
  }

  /**
   * Turn the offer around: keep the principle of peace but change the location
   * (to a neutral city when possible) and the meeting turn. The counter is
   * returned to the original party, which then accepts or rejects.
   */
  private counterProposeAsAI(record: PeaceSummitRecord): void {
    const currentTurn = this.deps.getCurrentTurn();
    const counterProposerId = record.recipientNationId; // the responder now proposes
    const counterRecipientId = record.proposerNationId; // original proposer must answer
    const city = this.pickNeutralSummitCity(counterProposerId, counterRecipientId)
      ?? this.pickOwnSummitCity(counterProposerId);
    if (!city) {
      // Nowhere to hold it — fall back to accepting the original terms.
      this.agreeSummit(record);
      return;
    }
    record.proposerNationId = counterProposerId;
    record.recipientNationId = counterRecipientId;
    record.cityId = city.id;
    record.cityOwnerNationId = city.ownerNationId;
    record.summitTurn = currentTurn + this.pickDelay(counterProposerId, counterRecipientId, currentTurn);
    record.counterproposed = true;
    this.emit({ kind: 'counterproposed', record, needsHumanResponse: this.deps.isHuman(counterRecipientId) });
    if (!this.deps.isHuman(counterRecipientId)) this.resolveAIResponseToCounter(record);
  }

  /** Lock in the summit: ceasefire begins immediately; countdown runs. */
  private agreeSummit(record: PeaceSummitRecord): void {
    // The proposal already contains the offered meeting turn. Acceptance locks
    // in those terms; it must not silently roll a different date.
    record.phase = 'ceasefire';
    this.emit({ kind: 'agreed', record });
  }

  private rejectSummit(record: PeaceSummitRecord): void {
    const key = this.pairKey(record.proposerNationId, record.recipientNationId);
    this.summits.delete(key);
    // A rejected call for peace paces the next attempt by the same minimum, so a
    // willing AI cannot re-propose a summit every single turn.
    this.failedNegotiationTurn.set(key, this.deps.getCurrentTurn());
    this.emit({
      kind: 'rejected',
      proposerNationId: record.proposerNationId,
      recipientNationId: record.recipientNationId,
      cityId: record.cityId,
    });
  }

  /** Advance ceasefires to their summits when the agreed turn arrives. */
  handleRoundStart(currentTurn: number): void {
    for (const record of [...this.summits.values()]) {
      if (record.phase === 'ceasefire' && currentTurn >= record.summitTurn) {
        this.conductSummit(record);
      }
    }
  }

  /**
   * Run the actual peace negotiation at the summit. The original initiator makes
   * the offer through the existing peace framework: an AI proposer builds and
   * submits a proposal here; a human proposer is prompted (via an event) to make
   * one. Success/failure is observed through the existing peace events, wired in
   * {@link handlePeaceAccepted} / {@link handlePeaceDeclined}.
   */
  private conductSummit(record: PeaceSummitRecord): void {
    const currentTurn = this.deps.getCurrentTurn();
    const proposerId = record.initiatorNationId;
    const recipientId = proposerId === record.proposerNationId
      ? record.recipientNationId
      : record.proposerNationId;
    // If the war is somehow no longer active, discard the summit silently.
    if (this.deps.diplomacyManager.getState(proposerId, recipientId) !== 'WAR') {
      this.summits.delete(this.pairKey(proposerId, recipientId));
      return;
    }
    record.phase = 'negotiating';
    const humanMustOffer = this.deps.isHuman(proposerId);
    this.emit({ kind: 'summitReached', record, humanMustOffer });
    if (humanMustOffer) return; // GameScene opens the human's terms dialog.

    const warDuration = this.deps.diplomacyManager.getWarDuration(proposerId, recipientId, currentTurn);
    const plan = this.deps.peaceTreatySystem.buildAIPeaceProposal(proposerId, recipientId, warDuration);
    this.deps.diplomacyManager.proposePeace(proposerId, recipientId, {
      offeredCityIds: plan.proposal.offeredCityIds,
      goldReparations: plan.proposal.goldReparations,
      ...(plan.proposal.offeredExploitationRights ? { offeredExploitationRights: true } : {}),
    });
    // The existing onPeaceProposed handler resolves this synchronously for an AI
    // recipient (fires accepted/declined below); a human recipient answers later.
  }

  /**
   * A human summit initiator walked away from the terms dialog without making an
   * offer. Treat it as a failed negotiation so the war resumes and the cooldown
   * starts, matching an outright rejected offer.
   */
  abandonNegotiation(a: string, b: string): void {
    const record = this.summits.get(this.pairKey(a, b));
    if (!record || record.phase !== 'negotiating') return;
    this.failNegotiation(a, b);
  }

  /** Observe an accepted peace: if it settled an active summit, clean it up. */
  handlePeaceAccepted(a: string, b: string): void {
    const record = this.summits.get(this.pairKey(a, b));
    if (!record) return;
    this.summits.delete(this.pairKey(a, b));
    this.failedNegotiationTurn.delete(this.pairKey(a, b));
    this.emit({ kind: 'peaceReached', nationA: a, nationB: b });
  }

  /**
   * Observe a declined peace: a rejection during an active summit negotiation is
   * a failed summit — lift the ceasefire, resume the war, and start the cooldown.
   */
  handlePeaceDeclined(a: string, b: string): void {
    const record = this.summits.get(this.pairKey(a, b));
    if (!record || record.phase !== 'negotiating') return;
    this.failNegotiation(a, b);
  }

  private failNegotiation(a: string, b: string): void {
    const key = this.pairKey(a, b);
    this.summits.delete(key);
    this.failedNegotiationTurn.set(key, this.deps.getCurrentTurn());
    this.emit({ kind: 'negotiationsFailed', nationA: a, nationB: b });
  }

  private pickDelay(a: string, b: string, currentTurn: number): number {
    const span = SUMMIT_MAX_DELAY_TURNS - SUMMIT_MIN_DELAY_TURNS + 1;
    const r = this.roll(`summit-delay|${a}|${b}|${currentTurn}`);
    return SUMMIT_MIN_DELAY_TURNS + Math.floor(r * span);
  }

  /** Prefer the nation's capital; otherwise its first city by stable order. */
  private pickOwnSummitCity(nationId: string): { id: string; ownerNationId: string } | null {
    const cities = this.deps.cityManager.getCitiesByOwner(nationId);
    if (cities.length === 0) return null;
    const capital = cities.find((c) => c.isCapital) ?? this.stableFirst(cities);
    return { id: capital.id, ownerNationId: nationId };
  }

  /**
   * A neutral summit host is a city owned by a third nation that is at peace with
   * both belligerents. Prefer a capital; fall back to any eligible city. Returns
   * null when no neutral host exists.
   */
  private pickNeutralSummitCity(
    belligerentA: string,
    belligerentB: string,
  ): { id: string; ownerNationId: string } | null {
    const dm = this.deps.diplomacyManager;
    const eligible = this.deps.cityManager.getAllCities().filter((city) => {
      const owner = city.ownerId;
      if (owner === belligerentA || owner === belligerentB) return false;
      if (dm.getState(owner, belligerentA) === 'WAR') return false;
      if (dm.getState(owner, belligerentB) === 'WAR') return false;
      return true;
    });
    if (eligible.length === 0) return null;
    const capital = eligible.find((c) => c.isCapital);
    const chosen = capital ?? this.stableFirst(eligible);
    return { id: chosen.id, ownerNationId: chosen.ownerId };
  }

  private stableFirst(cities: City[]): City {
    return [...cities].sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id))[0];
  }

  // --- Save / load -------------------------------------------------------

  serialize(): SavedPeaceSummitState {
    return {
      summits: [...this.summits.values()].map((record) => ({ ...record })),
      failedNegotiations: [...this.failedNegotiationTurn.entries()].map(([key, turn]) => {
        const [nationA, nationB] = key.split('|');
        return { nationA, nationB, turn };
      }),
    };
  }

  restore(state: SavedPeaceSummitState | undefined): void {
    this.summits.clear();
    this.failedNegotiationTurn.clear();
    if (!state) return;
    for (const record of state.summits ?? []) {
      this.summits.set(this.pairKey(record.proposerNationId, record.recipientNationId), { ...record });
    }
    for (const entry of state.failedNegotiations ?? []) {
      this.failedNegotiationTurn.set(this.pairKey(entry.nationA, entry.nationB), entry.turn);
    }

    // SaveLoadService restores after GameScene has registered its listeners.
    // Re-surface decisions that require the player; otherwise an awaiting offer
    // or a terms dialog reached immediately before saving would remain stuck.
    for (const record of this.summits.values()) {
      if (record.phase === 'awaitingResponse' && this.deps.isHuman(record.recipientNationId)) {
        this.emit({
          kind: record.counterproposed ? 'counterproposed' : 'proposed',
          record,
          needsHumanResponse: true,
        });
      } else if (record.phase === 'negotiating' && this.deps.isHuman(record.initiatorNationId)) {
        this.emit({ kind: 'summitReached', record, humanMustOffer: true });
      }
    }
  }
}

/** Deterministic string → [0,1) hash (FNV-1a based), matching AI roll style. */
function hashToUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned and normalize to [0,1).
  return (hash >>> 0) / 4294967296;
}
