import type { DiplomacyManager } from '../DiplomacyManager';
import type { TurnManager } from './../TurnManager';
import { isBarbarianNation } from '../../data/barbarians';
import type { CovertPersonality } from '../../types/covertPersonality';
import { getCovertPersonalityById } from '../../data/covertPersonalities';

/**
 * CovertSuspicionSystem — turns covert actions (spying, sabotage, partisan/rebel
 * raids, privateer raids) into Suspicion on the victim, with a deliberately
 * simple, deterministic three-outcome detection model:
 *
 *   undetected → no suspicion, victim unaware
 *   suspected  → small/moderate suspicion, attacker NOT revealed
 *   exposed    → large suspicion, attacker revealed
 *
 * Repeat offenders are tracked per (attacker→victim) ordered pair: each detected
 * incident makes the next one harder to hide (more exposure, more suspicion).
 *
 * Single responsibility: convert covert events into suspicion + logs. It does
 * not run combat, sabotage, or detection itself — the covert systems call
 * {@link reportIncident}. Suspicion itself is symmetric (stored once per pair,
 * see DiplomacyManager), matching the existing memory-value model.
 */

export type CovertActionKind =
  | 'spyIntel'
  | 'agentSabotage'
  | 'partisanRaid'
  | 'rebelActivity'
  | 'privateerRaid'
  | 'insurgentExposed';

export type CovertDetectionOutcome = 'undetected' | 'suspected' | 'exposed';

interface CovertActionProfile {
  /** Player-facing description of the activity (attacker hidden unless exposed). */
  readonly label: string;
  /** Base detection split (must sum to ~1). Repeat offenders shift it toward exposure. */
  readonly pUndetected: number;
  readonly pExposed: number;
  /** Suspicion ranges per detected outcome. */
  readonly suspectedMin: number;
  readonly suspectedMax: number;
  readonly exposedMin: number;
  readonly exposedMax: number;
}

const PROFILES: Record<CovertActionKind, CovertActionProfile> = {
  // Spying is usually quiet; exposure is rare but stings.
  spyIntel: { label: 'espionage activity', pUndetected: 0.6, pExposed: 0.1, suspectedMin: 5, suspectedMax: 10, exposedMin: 20, exposedMax: 30 },
  // Sabotage is noisier and more provocative than spying.
  agentSabotage: { label: 'sabotage', pUndetected: 0.25, pExposed: 0.3, suspectedMin: 10, suspectedMax: 20, exposedMin: 25, exposedMax: 40 },
  // Partisan attacks/pillaging are overt violence with deniable backing.
  partisanRaid: { label: 'partisan forces', pUndetected: 0.2, pExposed: 0.2, suspectedMin: 5, suspectedMax: 10, exposedMin: 20, exposedMax: 30 },
  // Rebel unrest is politically sensitive — easy to suspect foreign support.
  rebelActivity: { label: 'rebel forces', pUndetected: 0.3, pExposed: 0.15, suspectedMin: 5, suspectedMax: 12, exposedMin: 30, exposedMax: 50 },
  // Sea raiding is deniable; exposure at sea is harder than on land.
  privateerRaid: { label: 'privateer raiding', pUndetected: 0.45, pExposed: 0.1, suspectedMin: 5, suspectedMax: 15, exposedMin: 20, exposedMax: 35 },
  // A covert unit caught/destroyed in the open is always conclusive exposure.
  insurgentExposed: { label: 'foreign-backed insurgents', pUndetected: 0, pExposed: 1, suspectedMin: 0, suspectedMax: 0, exposedMin: 30, exposedMax: 50 },
};

/** Extra exposure probability per prior detected incident (capped). */
const REPEAT_EXPOSURE_STEP = 0.08;
const REPEAT_EXPOSURE_CAP = 0.4;
/** Extra suspicion per prior detected incident (capped) — repeat offenders sting more. */
const REPEAT_SUSPICION_STEP = 5;
const REPEAT_SUSPICION_CAP = 25;

export interface CovertIncidentInput {
  readonly attackerNationId: string;
  readonly victimNationId: string;
  readonly action: CovertActionKind;
  /** When the action destroyed/affected something valuable, bias suspicion higher. */
  readonly valuable?: boolean;
}

export interface CovertIncidentResult {
  readonly outcome: CovertDetectionOutcome;
  readonly suspicionAdded: number;
  readonly newSuspicion: number;
}

/** Player-facing log (attacker hidden unless exposed). */
export type CovertPlayerLogger = (nationId: string, message: string) => void;
/** Balancing/autorun-only debug log (may reveal attacker). */
export type CovertDebugLogger = (message: string) => void;

export class CovertSuspicionSystem {
  /** Detected incidents per ordered "attacker>victim" pair (repeat-offender memory). */
  private readonly offenseCounts = new Map<string, number>();

  constructor(
    private readonly diplomacyManager: DiplomacyManager,
    private readonly turnManager: TurnManager,
    private readonly nationName: (nationId: string) => string,
    private readonly logPlayer: CovertPlayerLogger = () => {},
    private readonly logDebug: CovertDebugLogger = () => {},
    /** Resolves a nation's covert personality (victim sensitivity scales suspicion). */
    private readonly getPersonality: (nationId: string) => CovertPersonality =
      () => getCovertPersonalityById(undefined),
  ) {}

  /**
   * Report a covert action and apply its suspicion consequence. Returns the
   * outcome (or undefined when the incident is ignored, e.g. self/barbarian).
   */
  reportIncident(input: CovertIncidentInput): CovertIncidentResult | undefined {
    const { attackerNationId, victimNationId, action, valuable } = input;
    if (attackerNationId === victimNationId) return undefined;
    if (isBarbarianNation(attackerNationId) || isBarbarianNation(victimNationId)) return undefined;

    const profile = PROFILES[action];
    const key = this.offenseKey(attackerNationId, victimNationId);
    const priorCount = this.offenseCounts.get(key) ?? 0;
    const round = this.turnManager.getCurrentRound();

    const outcome = this.detect(profile, priorCount, attackerNationId, victimNationId, action, round);
    if (outcome === 'undetected') {
      // Victim never notices — no suspicion, no repeat-offender credit, no log.
      return { outcome, suspicionAdded: 0, newSuspicion: this.diplomacyManager.getSuspicion(attackerNationId, victimNationId) };
    }

    const repeatSuspicion = Math.min(REPEAT_SUSPICION_CAP, priorCount * REPEAT_SUSPICION_STEP);
    const base = this.rollSuspicion(profile, outcome, valuable === true, attackerNationId, victimNationId, action, round);
    // The victim's covert personality scales how much suspicion it actually
    // gains: paranoid nations grow suspicious far faster than, say, a merchant.
    const victimPersonality = this.getPersonality(victimNationId);
    const suspicionAdded = Math.max(1, Math.round((base + repeatSuspicion) * victimPersonality.suspicionSensitivity));
    const newSuspicion = this.diplomacyManager.addSuspicion(victimNationId, attackerNationId, suspicionAdded);

    this.offenseCounts.set(key, priorCount + 1);
    this.emitLogs(input, profile, outcome, suspicionAdded, priorCount + 1, victimPersonality);

    return { outcome, suspicionAdded, newSuspicion };
  }

  // ── Detection ──────────────────────────────────────────────────────────

  private detect(
    profile: CovertActionProfile,
    priorCount: number,
    attacker: string,
    victim: string,
    action: CovertActionKind,
    round: number,
  ): CovertDetectionOutcome {
    const exposureBoost = Math.min(REPEAT_EXPOSURE_CAP, priorCount * REPEAT_EXPOSURE_STEP);
    const pUndetected = Math.max(0, profile.pUndetected - exposureBoost);
    const pExposed = Math.min(1, profile.pExposed + exposureBoost);
    const roll = hashToUnit(`detect|${attacker}|${victim}|${action}|${round}|${priorCount}`);
    if (roll < pUndetected) return 'undetected';
    if (roll >= 1 - pExposed) return 'exposed';
    return 'suspected';
  }

  private rollSuspicion(
    profile: CovertActionProfile,
    outcome: 'suspected' | 'exposed',
    valuable: boolean,
    attacker: string,
    victim: string,
    action: CovertActionKind,
    round: number,
  ): number {
    const min = outcome === 'exposed' ? profile.exposedMin : profile.suspectedMin;
    const max = outcome === 'exposed' ? profile.exposedMax : profile.suspectedMax;
    if (max <= min) return min;
    // Valuable targets bias to the top of the range; otherwise spread the band.
    const t = valuable ? 0.85 : hashToUnit(`amt|${attacker}|${victim}|${action}|${round}|${outcome}`);
    return Math.round(min + t * (max - min));
  }

  // ── Logging ────────────────────────────────────────────────────────────

  private emitLogs(
    input: CovertIncidentInput,
    profile: CovertActionProfile,
    outcome: CovertDetectionOutcome,
    suspicionAdded: number,
    totalIncidents: number,
    victimPersonality: CovertPersonality,
  ): void {
    const victimName = this.nationName(input.victimNationId);
    const attackerName = this.nationName(input.attackerNationId);

    // Player-facing: never reveal the attacker unless the incident was exposed.
    const playerMessage = outcome === 'exposed'
      ? `${victimName} exposed ${profile.label} believed to be operating for ${attackerName}.`
      : `${victimName} suspects foreign ${profile.label}.`;
    this.logPlayer(input.victimNationId, playerMessage);

    // Balancing/autorun debug — always full information, regardless of outcome.
    const amplified = victimPersonality.suspicionSensitivity > 1
      ? ` | Suspicion escalation amplified by ${victimPersonality.name} personality`
      : '';
    this.logDebug(
      `[DEBUG] Suspicion +${suspicionAdded} | Victim: ${victimName} (${victimPersonality.name}) | Source: ${input.action} | Attacker: ${attackerName} | Outcome: ${outcome} | Incident #${totalIncidents}${amplified}`,
    );
  }

  // ── Save / load ──────────────────────────────────────────────────────────

  getOffenseRecords(): Array<{ attacker: string; victim: string; count: number }> {
    const out: Array<{ attacker: string; victim: string; count: number }> = [];
    for (const [key, count] of this.offenseCounts) {
      const [attacker, victim] = key.split('>');
      if (attacker && victim) out.push({ attacker, victim, count });
    }
    return out;
  }

  restoreOffenseRecords(records: ReadonlyArray<{ attacker: string; victim: string; count: number }> | undefined): void {
    this.offenseCounts.clear();
    for (const record of records ?? []) {
      if (record.count > 0) this.offenseCounts.set(this.offenseKey(record.attacker, record.victim), record.count);
    }
  }

  private offenseKey(attacker: string, victim: string): string {
    return `${attacker}>${victim}`;
  }
}

/** Deterministic FNV-1a hash of `seed` mapped to [0, 1). */
function hashToUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
