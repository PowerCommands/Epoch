import type { NationManager } from '../NationManager';
import type { DiplomacyManager } from '../DiplomacyManager';

/**
 * Cultural Jealousy — a small geopolitical agenda layered onto the existing
 * diplomacy systems (relations, tariffs, Gossip/Insults, war).
 *
 * From calendar year 1500 onward the two culturally weakest living AI nations
 * grow jealous of the culturally strongest nation. Their mutual relationship
 * warms (shared-rival cooperation) while their relationship toward the leader
 * sours. The agenda never scripts a war: it only feeds increasingly hostile
 * relationship values plus preferential tariff/insult targeting into the
 * existing AI decision systems, which decide for themselves whether war follows.
 *
 * An agenda terminates the moment its jealous nation is at war with its target
 * (its purpose is then served); from there normal war/diplomacy takes over. For
 * V1 stability a jealous nation keeps its assigned target until termination, and
 * a fresh pair is only selected once no agenda is active.
 *
 * Cultural Jealousy is a one-time historical turning point: it may successfully
 * fire at most once per game. Selecting a valid pair permanently consumes the
 * trigger; the individual agendas then live and die on their own (war, peace,
 * elimination) without ever reopening the turning point. A round on which no
 * valid pair can be found does NOT consume the event — it simply retries later.
 *
 * State is intentionally tiny and deterministic: each jealous nation stores its
 * target on `Nation.culturalJealousyTargetId`, and the consumed flag persists on
 * the turning point itself — both survive save/load.
 */
export const CULTURAL_JEALOUSY_ACTIVATION_YEAR = 1500;

/** Persistent turning-point state (survives save/load). */
export interface SavedCulturalJealousyTurningPointState {
  /** True once a valid jealous pair has been selected and applied — never re-fires. */
  consumed: boolean;
}

/** Need at least this many living nations for a distinct leader + two resenters. */
const MIN_LIVING_NATIONS = 3;

// One-time activation relationship swing, applied once when a pair is selected.
// Toward the target (each jealous nation → leader): resentment.
const ACTIVATION_TARGET_HOSTILITY_GAIN = 45;
const ACTIVATION_TARGET_SUSPICION_GAIN = 30;
const ACTIVATION_TARGET_TRUST_LOSS = 25;
const ACTIVATION_TARGET_AFFINITY_LOSS = 25;
// Between the two jealous nations (shared-rival warmth).
const ACTIVATION_PEER_AFFINITY_GAIN = 35;
const ACTIVATION_PEER_TRUST_GAIN = 20;
const ACTIVATION_PEER_HOSTILITY_LOSS = 30;
const ACTIVATION_PEER_SUSPICION_LOSS = 20;

// Bounded per-round reinforcement while the agenda is active. Each value drifts
// toward its ceiling by at most one step, so tension keeps rising (eventually
// crossing the existing "severely hostile" bar that lets insults fire) without
// snapping instantly or overshooting.
const REINFORCE_TARGET_HOSTILITY_CEILING = 90;
const REINFORCE_TARGET_HOSTILITY_STEP = 4;
const REINFORCE_TARGET_SUSPICION_CEILING = 75;
const REINFORCE_TARGET_SUSPICION_STEP = 3;
const REINFORCE_TARGET_TRUST_FLOOR = 5;
const REINFORCE_TARGET_TRUST_STEP = 3;
const REINFORCE_TARGET_AFFINITY_FLOOR = 0;
const REINFORCE_TARGET_AFFINITY_STEP = 3;
const REINFORCE_PEER_AFFINITY_CEILING = 80;
const REINFORCE_PEER_AFFINITY_STEP = 3;
const REINFORCE_PEER_TRUST_CEILING = 75;
const REINFORCE_PEER_TRUST_STEP = 2;
const REINFORCE_PEER_HOSTILITY_FLOOR = 0;
const REINFORCE_PEER_HOSTILITY_STEP = 3;

const MIN_MEMORY_VALUE = 0;
const MAX_MEMORY_VALUE = 100;

function clampMemory(value: number): number {
  return Math.max(MIN_MEMORY_VALUE, Math.min(MAX_MEMORY_VALUE, value));
}

/** Move `current` up toward `ceiling` by at most `step` (never past it). */
function riseToward(current: number, ceiling: number, step: number): number {
  if (current >= ceiling) return current;
  return Math.min(ceiling, current + step);
}

/** Move `current` down toward `floor` by at most `step` (never past it). */
function fallToward(current: number, floor: number, step: number): number {
  if (current <= floor) return current;
  return Math.max(floor, current - step);
}

interface MemoryDelta {
  trust?: number;
  hostility?: number;
  affinity?: number;
  suspicion?: number;
}

export interface CulturalJealousyContext {
  readonly nationManager: NationManager;
  readonly diplomacyManager: DiplomacyManager;
  readonly getGlobalYear: () => number;
  readonly isNationLiving: (nationId: string) => boolean;
  readonly getCultureScore: (nationId: string) => number;
  readonly getNationName: (nationId: string) => string;
  readonly log?: (message: string) => void;
}

export class CulturalJealousySystem {
  /** Whether the one-time turning point has already fired this game. */
  private consumed = false;

  constructor(private readonly context: CulturalJealousyContext) {}

  /**
   * Main entry, wired to `roundStart`. Terminates finished agendas, reinforces
   * active ones, and (only when none are active and the turning point has not
   * yet fired) selects a fresh jealous pair.
   */
  handleRoundStart(_round?: number): void {
    if (this.context.getGlobalYear() < CULTURAL_JEALOUSY_ACTIVATION_YEAR) return;

    this.terminateFinishedAgendas();
    const activeJealousIds = this.getActiveJealousNationIds();
    if (activeJealousIds.length === 0) {
      // The turning point may only ever fire once. Terminated agendas must not
      // reopen it, so a fresh pair is selected only while it is still unconsumed.
      if (!this.consumed) this.activateNewPair();
      return;
    }
    this.reinforceActiveAgendas(activeJealousIds);
  }

  /** Serialize the one-time turning-point state for the save file. */
  serialize(): SavedCulturalJealousyTurningPointState {
    return { consumed: this.consumed };
  }

  /** Restore the one-time turning-point state from a save file. */
  restore(saved: SavedCulturalJealousyTurningPointState | undefined): void {
    this.consumed = saved?.consumed === true;
  }

  /** The target a jealous nation currently resents, or undefined. */
  getJealousyTargetId(nationId: string): string | undefined {
    return this.context.nationManager.getNation(nationId)?.culturalJealousyTargetId;
  }

  /** Whether `sourceId` is culturally jealous of `targetId` right now. */
  isJealousyTargeting(sourceId: string, targetId: string): boolean {
    return this.getJealousyTargetId(sourceId) === targetId;
  }

  /** All nations with an active Cultural Jealousy agenda (deterministic order). */
  getActiveJealousNationIds(): string[] {
    return this.context.nationManager.getAllNations()
      .filter((nation) => nation.culturalJealousyTargetId !== undefined)
      .map((nation) => nation.id)
      .sort((a, b) => a.localeCompare(b));
  }

  private terminateFinishedAgendas(): void {
    for (const jealousId of this.getActiveJealousNationIds()) {
      const targetId = this.getJealousyTargetId(jealousId);
      if (!targetId) continue;
      const atWar = this.context.diplomacyManager.getState(jealousId, targetId) === 'WAR';
      const targetGone = !this.context.isNationLiving(targetId);
      const selfGone = !this.context.isNationLiving(jealousId);
      if (!atWar && !targetGone && !selfGone) continue;

      this.clearAgenda(jealousId);
      if (atWar) {
        this.log(
          `CULTURAL JEALOUSY: ${this.name(jealousId)} is now at war with ${this.name(targetId)} — `
          + 'jealousy agenda fulfilled and terminated; normal war/diplomacy now governs.',
        );
      } else {
        const reason = targetGone ? `${this.name(targetId)} is no longer a living power` : `${this.name(jealousId)} has fallen`;
        this.log(`CULTURAL JEALOUSY: ${this.name(jealousId)}'s jealousy agenda ended (${reason}).`);
      }
    }
  }

  private reinforceActiveAgendas(activeJealousIds: readonly string[]): void {
    // Peer warmth only reinforces when both weak powers still share their agenda.
    if (activeJealousIds.length >= 2) {
      const [first, second] = activeJealousIds;
      if (first && second && this.getJealousyTargetId(first) === this.getJealousyTargetId(second)
        && this.context.diplomacyManager.getState(first, second) !== 'WAR') {
        this.reinforcePeer(first, second);
      }
    }
    for (const jealousId of activeJealousIds) {
      const targetId = this.getJealousyTargetId(jealousId);
      if (!targetId) continue;
      if (this.context.diplomacyManager.getState(jealousId, targetId) === 'WAR') continue;
      this.reinforceTowardTarget(jealousId, targetId);
    }
  }

  private activateNewPair(): void {
    const living = this.context.nationManager.getAllNations()
      .filter((nation) => this.context.isNationLiving(nation.id));
    if (living.length < MIN_LIVING_NATIONS) return;

    const withScores = living.map((nation) => ({
      id: nation.id,
      isHuman: nation.isHuman,
      score: this.context.getCultureScore(nation.id),
    }));

    // Cultural leader: highest Culture Score (deterministic id tie-break).
    const leader = withScores.reduce((best, candidate) =>
      candidate.score > best.score || (candidate.score === best.score && candidate.id < best.id)
        ? candidate
        : best,
    );

    // The two culturally weakest living AI nations, excluding the leader and any
    // nation already at war with it (a jealousy agenda toward an existing enemy
    // is pointless and would only churn — its purpose is already served).
    const jealousCandidates = withScores
      .filter((candidate) => candidate.id !== leader.id
        && !candidate.isHuman
        && this.context.diplomacyManager.getState(candidate.id, leader.id) !== 'WAR')
      .sort((a, b) => (a.score - b.score) || a.id.localeCompare(b.id))
      .slice(0, 2);
    if (jealousCandidates.length < 2) return;

    const [firstJealous, secondJealous] = jealousCandidates;
    if (!firstJealous || !secondJealous) return;

    // Valid participants found — permanently consume the turning point before any
    // agenda is applied, so it can never fire a second time (even after these
    // agendas later terminate on war/peace/elimination). A failed search above
    // returns early and leaves the trigger available to retry.
    this.consumed = true;

    this.setAgenda(firstJealous.id, leader.id);
    this.setAgenda(secondJealous.id, leader.id);
    this.applyActivationTargetSwing(firstJealous.id, leader.id);
    this.applyActivationTargetSwing(secondJealous.id, leader.id);
    this.applyActivationPeerSwing(firstJealous.id, secondJealous.id);

    this.log(
      `CULTURAL JEALOUSY: ${this.name(firstJealous.id)} (${Math.round(firstJealous.score)}) and `
      + `${this.name(secondJealous.id)} (${Math.round(secondJealous.score)}) resent `
      + `${this.name(leader.id)} (${Math.round(leader.score)}).`,
    );
    this.logRelationState(firstJealous.id, secondJealous.id, leader.id);
  }

  private applyActivationTargetSwing(jealousId: string, targetId: string): void {
    this.applyDelta(jealousId, targetId, {
      hostility: ACTIVATION_TARGET_HOSTILITY_GAIN,
      suspicion: ACTIVATION_TARGET_SUSPICION_GAIN,
      trust: -ACTIVATION_TARGET_TRUST_LOSS,
      affinity: -ACTIVATION_TARGET_AFFINITY_LOSS,
    });
  }

  private applyActivationPeerSwing(firstId: string, secondId: string): void {
    this.applyDelta(firstId, secondId, {
      affinity: ACTIVATION_PEER_AFFINITY_GAIN,
      trust: ACTIVATION_PEER_TRUST_GAIN,
      hostility: -ACTIVATION_PEER_HOSTILITY_LOSS,
      suspicion: -ACTIVATION_PEER_SUSPICION_LOSS,
    });
  }

  private reinforceTowardTarget(jealousId: string, targetId: string): void {
    const relation = this.context.diplomacyManager.getRelation(jealousId, targetId);
    this.context.diplomacyManager.setMemoryValues(jealousId, targetId, {
      trust: fallToward(relation.trust, REINFORCE_TARGET_TRUST_FLOOR, REINFORCE_TARGET_TRUST_STEP),
      fear: relation.fear,
      hostility: riseToward(relation.hostility, REINFORCE_TARGET_HOSTILITY_CEILING, REINFORCE_TARGET_HOSTILITY_STEP),
      affinity: fallToward(relation.affinity, REINFORCE_TARGET_AFFINITY_FLOOR, REINFORCE_TARGET_AFFINITY_STEP),
      suspicion: riseToward(relation.suspicion, REINFORCE_TARGET_SUSPICION_CEILING, REINFORCE_TARGET_SUSPICION_STEP),
    });
  }

  private reinforcePeer(firstId: string, secondId: string): void {
    const relation = this.context.diplomacyManager.getRelation(firstId, secondId);
    this.context.diplomacyManager.setMemoryValues(firstId, secondId, {
      trust: riseToward(relation.trust, REINFORCE_PEER_TRUST_CEILING, REINFORCE_PEER_TRUST_STEP),
      fear: relation.fear,
      hostility: fallToward(relation.hostility, REINFORCE_PEER_HOSTILITY_FLOOR, REINFORCE_PEER_HOSTILITY_STEP),
      affinity: riseToward(relation.affinity, REINFORCE_PEER_AFFINITY_CEILING, REINFORCE_PEER_AFFINITY_STEP),
      suspicion: relation.suspicion,
    });
  }

  private applyDelta(a: string, b: string, delta: MemoryDelta): void {
    const relation = this.context.diplomacyManager.getRelation(a, b);
    this.context.diplomacyManager.setMemoryValues(a, b, {
      trust: clampMemory(relation.trust + (delta.trust ?? 0)),
      fear: relation.fear,
      hostility: clampMemory(relation.hostility + (delta.hostility ?? 0)),
      affinity: clampMemory(relation.affinity + (delta.affinity ?? 0)),
      suspicion: clampMemory(relation.suspicion + (delta.suspicion ?? 0)),
    });
  }

  private setAgenda(nationId: string, targetId: string): void {
    const nation = this.context.nationManager.getNation(nationId);
    if (nation) nation.culturalJealousyTargetId = targetId;
  }

  private clearAgenda(nationId: string): void {
    const nation = this.context.nationManager.getNation(nationId);
    if (nation) nation.culturalJealousyTargetId = undefined;
  }

  private logRelationState(firstId: string, secondId: string, targetId: string): void {
    const peer = this.context.diplomacyManager.getRelation(firstId, secondId);
    const firstToTarget = this.context.diplomacyManager.getRelation(firstId, targetId);
    this.log(
      `CULTURAL JEALOUSY: relations shifted — ${this.name(firstId)}<->${this.name(secondId)} `
      + `affinity ${Math.round(peer.affinity)} hostility ${Math.round(peer.hostility)}; `
      + `toward ${this.name(targetId)} hostility ${Math.round(firstToTarget.hostility)} suspicion ${Math.round(firstToTarget.suspicion)}.`,
    );
  }

  private name(nationId: string): string {
    return this.context.getNationName(nationId);
  }

  private log(message: string): void {
    this.context.log?.(message);
  }
}
