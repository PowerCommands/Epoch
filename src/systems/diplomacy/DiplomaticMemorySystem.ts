import type {
  DiplomacyManager,
  DiplomacyRelation,
  DiplomaticMemoryHook,
} from '../DiplomacyManager';
import {
  AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS,
  AGGRESSION_MEMORY_DECAY_STEP,
  AGGRESSION_MEMORY_LOG_PREFIX,
  OBSERVER_AGGRESSION_DELTAS,
  type AggressionEventType,
} from '../../data/multilateralAggression';

// DiplomaticMemorySystem updates relationship values based on events.
// These values are not yet used for AI decisions, but form the basis for
// future diplomacy logic.

type MemoryField = 'trust' | 'fear' | 'hostility' | 'affinity' | 'suspicion';
type MemoryDelta = Partial<Pick<DiplomacyRelation, MemoryField>>;

const MIN_VALUE = 0;
const MAX_VALUE = 100;

function clamp(value: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, value));
}

const DELTA_DECLARE_WAR: MemoryDelta = {
  hostility: 30,
  trust: -25,
  fear: 10,
};

const DELTA_MAKE_PEACE: MemoryDelta = {
  hostility: -10,
  trust: 5,
};

const DELTA_OPEN_BORDERS: MemoryDelta = {
  trust: 5,
  affinity: 2,
};

const DELTA_CANCEL_OPEN_BORDERS: MemoryDelta = {
  trust: -3,
};

const DELTA_CITY_CAPTURED: MemoryDelta = {
  hostility: 40,
  fear: 20,
  trust: -20,
};

function goldGiftDelta(amount: number): MemoryDelta {
  const scaled = Math.min(1, Math.max(0, Math.log1p(amount) / Math.log1p(120)));
  return {
    trust: Math.round(2 + scaled * 16),
    affinity: Math.round(1 + scaled * 12),
    hostility: -Math.round(1 + scaled * 6),
  };
}

function unitGiftDelta(unitCount: number, powerValue = 0): MemoryDelta {
  const countScore = Math.min(18, unitCount * 7);
  const powerScore = Math.min(14, Math.floor(powerValue / 18));
  return {
    trust: 8 + countScore + Math.floor(powerScore / 2),
    affinity: 6 + Math.floor(countScore * 0.75) + Math.floor(powerScore / 2),
    hostility: -Math.min(16, 4 + unitCount * 3 + Math.floor(powerScore / 3)),
  };
}

const DELTA_CITY_GIFT: MemoryDelta = {
  trust: 35,
  affinity: 30,
  hostility: -28,
};

// A symbolic gift of gesture: a formal courtesy that costs the giver gold but
// transfers no value to the recipient. Its goodwill is worth a touch more than
// it costs — it lands the same relationship boost as gifting this much gold
// outright (a little value for the money), without the recipient receiving any.
const SYMBOLIC_GIFT_GOLD_EQUIVALENT = 120;

// A friendly intelligence-sharing gesture. Smaller than major agreements but
// enough to matter, and stacks modestly across repeated exchanges.
const DELTA_EXCHANGE_MAPS: MemoryDelta = {
  trust: 5,
  affinity: 2,
};

// Forming a formal alliance is a significant friendly milestone — a moderate
// mutual boost to trust and affinity.
const DELTA_FORM_ALLIANCE: MemoryDelta = {
  trust: 10,
  affinity: 8,
};

// Agreeing to a joint war is a moderate act of military cooperation between
// the proposer and receiver (the relation hit toward the shared target comes
// from the war declaration itself).
const DELTA_JOINT_WAR: MemoryDelta = {
  trust: 8,
  affinity: 6,
};

// Leaving a shared alliance is a moderate slight to the remaining member.
const DELTA_ALLIANCE_DEPARTURE: MemoryDelta = {
  trust: -10,
  affinity: -8,
  hostility: 6,
};

// Council proposal politics — small, deliberately mild so friction builds
// without tearing alliances apart.
const DELTA_PROPOSAL_APPROVED: MemoryDelta = {
  trust: 3,
  affinity: 2,
};

const DELTA_PROPOSAL_REJECTED: MemoryDelta = {
  trust: -4,
  affinity: -2,
  hostility: 2,
};

/**
 * World knowledge the multilateral path needs. Injected rather than imported so
 * the memory system keeps its single dependency (DiplomacyManager) and stays
 * trivially testable. Supplied by GameScene from the existing discovery and
 * city-ownership models — this system invents no new information propagation.
 */
export interface MultilateralAggressionContext {
  /** Every nation id currently in the game (including the aggressor/victim). */
  getAllNationIds(): readonly string[];
  /** Existing contact model — DiscoverySystem.hasMet. */
  haveMet(a: string, b: string): boolean;
  /** Still in the game; city ownership is the survival condition. */
  isNationActive(nationId: string): boolean;
  /** Optional sink for the diagnostic lines; defaults to console.log. */
  log?(line: string): void;
}

/** Details of the aggressive act being reported to observers. */
export interface AggressionEvent {
  readonly type: AggressionEventType;
  readonly aggressorNationId: string;
  readonly victimNationId: string;
  readonly round: number;
  /** Captured city name, for the log line only. */
  readonly cityName?: string;
}

/**
 * How much of a pair's fear/hostility/trust movement this system is responsible
 * for. Decay is bounded by these numbers so it can only ever unwind observer
 * reactions — never the bilateral memory a nation earned from its own wars.
 */
interface ObserverAggressionLedgerEntry {
  trustLost: number;
  fearGained: number;
  hostilityGained: number;
}

const LEDGER_KEY_SEPARATOR = '|';

export class DiplomaticMemorySystem implements DiplomaticMemoryHook {
  private multilateralContext: MultilateralAggressionContext | null = null;

  /** Keyed `observerId|aggressorId` — directed, unlike the relation itself. */
  private readonly observerLedger = new Map<string, ObserverAggressionLedgerEntry>();

  constructor(private readonly diplomacyManager: DiplomacyManager) {}

  /**
   * Enable the multilateral (third-party observer) aggression path. Without a
   * context the system behaves exactly as before — bilateral memory only.
   */
  setMultilateralAggressionContext(context: MultilateralAggressionContext | null): void {
    this.multilateralContext = context;
  }

  /**
   * Propagate an act of aggression to every qualifying third-party observer.
   *
   * The aggressor and the direct victim are excluded here: the victim's
   * reaction is already covered by the bilateral deltas (onDeclareWar /
   * onCityCaptured), and mixing the two paths would double-count.
   */
  recordAggressionForObservers(event: AggressionEvent): void {
    const context = this.multilateralContext;
    if (!context) return;

    const { type, aggressorNationId, victimNationId, round } = event;
    if (aggressorNationId === victimNationId) return;

    const delta = OBSERVER_AGGRESSION_DELTAS[type];
    for (const observerId of context.getAllNationIds()) {
      if (!this.isEligibleObserver(observerId, aggressorNationId, victimNationId, context)) continue;
      this.applyObserverDelta(observerId, event, delta, round, context);
    }
  }

  /**
   * Observer eligibility. A nation reacts only to aggression it could plausibly
   * know about, between civilizations it has actually discovered.
   */
  private isEligibleObserver(
    observerId: string,
    aggressorNationId: string,
    victimNationId: string,
    context: MultilateralAggressionContext,
  ): boolean {
    if (observerId === aggressorNationId) return false;      // no self-reaction
    if (observerId === victimNationId) return false;         // bilateral path owns the victim
    if (!context.isNationActive(observerId)) return false;    // eliminated nations do not react
    if (!context.haveMet(observerId, aggressorNationId)) return false;
    if (!context.haveMet(observerId, victimNationId)) return false;
    return true;
  }

  private applyObserverDelta(
    observerId: string,
    event: AggressionEvent,
    delta: { trust: number; fear: number; hostility: number },
    round: number,
    context: MultilateralAggressionContext,
  ): void {
    const aggressorId = event.aggressorNationId;
    const before = this.diplomacyManager.getRelation(observerId, aggressorId);

    const trust = clamp(before.trust + delta.trust);
    const fear = clamp(before.fear + delta.fear);
    const hostility = clamp(before.hostility + delta.hostility);

    this.diplomacyManager.setMemoryValues(observerId, aggressorId, {
      trust,
      fear,
      hostility,
      affinity: before.affinity,
      suspicion: before.suspicion,
    });

    // Record only the movement that actually landed after clamping, so decay
    // can never give back more than this system took.
    const entry = this.getLedgerEntry(observerId, aggressorId);
    entry.trustLost += before.trust - trust;
    entry.fearGained += fear - before.fear;
    entry.hostilityGained += hostility - before.hostility;

    const log = context.log ?? ((line: string) => console.log(line));
    const city = event.cityName ? ` city=${event.cityName}` : '';
    log(
      `${AGGRESSION_MEMORY_LOG_PREFIX} r${round} event=${event.type} `
      + `aggressor=${aggressorId} victim=${event.victimNationId} observer=${observerId}${city} `
      + `trust ${Math.round(before.trust)}->${Math.round(trust)} (${formatDelta(trust - before.trust)}) `
      + `fear ${Math.round(before.fear)}->${Math.round(fear)} (${formatDelta(fear - before.fear)}) `
      + `hostility ${Math.round(before.hostility)}->${Math.round(hostility)} (${formatDelta(hostility - before.hostility)})`,
    );
  }

  /**
   * Release accumulated observer aggression memory over time.
   *
   * Called every round; acts only on the decay cadence. Strictly bounded by the
   * ledger, so a nation's fear of someone who actually attacked *it* is never
   * touched — only the portion this system contributed as a bystander.
   *
   * Intentionally quiet: decay is a slow background drift and logging it per
   * pair per round would drown the aggression events it is meant to complement.
   */
  decayObserverAggressionMemory(round: number): void {
    if (!this.multilateralContext) return;
    if (round % AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS !== 0) return;

    const step = AGGRESSION_MEMORY_DECAY_STEP;
    for (const [key, entry] of this.observerLedger) {
      if (entry.trustLost <= 0 && entry.fearGained <= 0 && entry.hostilityGained <= 0) {
        this.observerLedger.delete(key);
        continue;
      }
      const [observerId, aggressorId] = key.split(LEDGER_KEY_SEPARATOR);
      if (observerId === undefined || aggressorId === undefined) continue;

      const trustBack = Math.min(step, entry.trustLost);
      const fearBack = Math.min(step, entry.fearGained);
      const hostilityBack = Math.min(step, entry.hostilityGained);

      const relation = this.diplomacyManager.getRelation(observerId, aggressorId);
      this.diplomacyManager.setMemoryValues(observerId, aggressorId, {
        trust: clamp(relation.trust + trustBack),
        fear: clamp(relation.fear - fearBack),
        hostility: clamp(relation.hostility - hostilityBack),
        affinity: relation.affinity,
        suspicion: relation.suspicion,
      });

      entry.trustLost -= trustBack;
      entry.fearGained -= fearBack;
      entry.hostilityGained -= hostilityBack;
    }
  }

  /** Accumulated observer-derived movement for a pair. Diagnostics and tests. */
  getObserverAggressionLedger(observerId: string, aggressorId: string): ObserverAggressionLedgerEntry {
    return { ...this.getLedgerEntry(observerId, aggressorId) };
  }

  private getLedgerEntry(observerId: string, aggressorId: string): ObserverAggressionLedgerEntry {
    const key = `${observerId}${LEDGER_KEY_SEPARATOR}${aggressorId}`;
    let entry = this.observerLedger.get(key);
    if (!entry) {
      entry = { trustLost: 0, fearGained: 0, hostilityGained: 0 };
      this.observerLedger.set(key, entry);
    }
    return entry;
  }

  onDeclareWar(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_DECLARE_WAR);
  }

  onMakePeace(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_MAKE_PEACE);
  }

  onOpenBorders(from: string, to: string): void {
    this.adjustRelation(from, to, DELTA_OPEN_BORDERS);
  }

  onCancelOpenBorders(from: string, to: string): void {
    this.adjustRelation(from, to, DELTA_CANCEL_OPEN_BORDERS);
  }

  onCityCaptured(attacker: string, defender: string): void {
    this.adjustRelation(attacker, defender, DELTA_CITY_CAPTURED);
  }

  onGoldGift(from: string, to: string, amount: number): void {
    this.adjustRelation(from, to, goldGiftDelta(amount));
  }

  onUnitGift(from: string, to: string, unitCount: number, powerValue?: number): void {
    this.adjustRelation(from, to, unitGiftDelta(unitCount, powerValue));
  }

  onCityGift(from: string, to: string, _cityId: string): void {
    this.adjustRelation(from, to, DELTA_CITY_GIFT);
  }

  onSymbolicGift(from: string, to: string): void {
    this.adjustRelation(from, to, goldGiftDelta(SYMBOLIC_GIFT_GOLD_EQUIVALENT));
  }

  onExchangeMaps(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_EXCHANGE_MAPS);
  }

  onFormAlliance(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_FORM_ALLIANCE);
  }

  onJointWarAgreement(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_JOINT_WAR);
  }

  onAllianceDeparture(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_ALLIANCE_DEPARTURE);
  }

  onProposalApproved(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_PROPOSAL_APPROVED);
  }

  onProposalRejected(a: string, b: string): void {
    this.adjustRelation(a, b, DELTA_PROPOSAL_REJECTED);
  }

  /**
   * Read the current relation, apply per-field deltas, clamp to 0–100, and
   * persist. Effects are symmetric in this first version — both directions
   * share one stored relation, so a single write covers A↔B.
   */
  private adjustRelation(a: string, b: string, delta: MemoryDelta): void {
    const relation = this.diplomacyManager.getRelation(a, b);
    this.diplomacyManager.setMemoryValues(a, b, {
      trust: clamp(relation.trust + (delta.trust ?? 0)),
      fear: clamp(relation.fear + (delta.fear ?? 0)),
      hostility: clamp(relation.hostility + (delta.hostility ?? 0)),
      affinity: clamp(relation.affinity + (delta.affinity ?? 0)),
      // Existing events don't move suspicion (no delta.suspicion) — it is carried
      // through unchanged here and only changes via decay / editor / future logic.
      suspicion: clamp(relation.suspicion + (delta.suspicion ?? 0)),
    });
  }
}

function formatDelta(value: number): string {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}
