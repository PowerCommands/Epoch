import { getLeaderByNationId } from '../../data/leaders';
import type { DiplomacyManager, DiplomacyRelation } from '../DiplomacyManager';
import type { AIMilitaryEvaluationSystem } from './AIMilitaryEvaluationSystem';
import type { ThreatLevel } from './AIMilitaryThreatEvaluationSystem';
import type { GossipFlavorContext } from '../../types/gossip';

export const OPPORTUNISM_CADENCE = 5;
const PRESSURE_CAPS = [0, 12, 32, 60] as const;
const PRESSURE_STEPS = [0, 6, 10, 15] as const;
function severityForRatio(ratio: number): number {
  return ratio >= 4 ? 3 : ratio >= 2.5 ? 2 : ratio >= 1.75 ? 1 : 0;
}
export interface OpportunityMemory {
  actorId: string;
  targetId: string;
  evaluatedRound: number;
  pressure: number;
  severity: number;
  ratio: number;
}
export interface SavedOpportunismState { pairs: OpportunityMemory[] }
export interface OpportunismContext {
  military: Pick<AIMilitaryEvaluationSystem, 'getMilitaryStrength' | 'getDefensiveWarPowerAgainst' | 'isNationActive'>;
  diplomacy: Pick<DiplomacyManager, 'getRelation' | 'canDeclareWar' | 'isAtWarWithAnyNation'>;
  haveMet: (a: string, b: string) => boolean;
  canProjectForce: (a: string, b: string) => boolean;
  threat: (a: string, b: string) => ThreatLevel;
  minimumReadiness: (id: string) => number;
  remark: (a: string, b: string, context: GossipFlavorContext) => boolean;
  log: (actorId: string, targetId: string, message: string) => void;
  /** Production resolves the selected leader, including scenario overrides. */
  enabled?: (id: string) => boolean;
}

/** Small directional memory layer. No military formula, diplomacy mutation, or war declaration. */
export class OpportunismSystem {
  private readonly pairs = new Map<string, OpportunityMemory>();
  constructor(private readonly context: OpportunismContext) {}

  evaluate(actorId: string, targetId: string, round: number): void {
    const key = `${actorId}|${targetId}`;
    const previous = this.pairs.get(key);
    const enabled = this.context.enabled?.(actorId) ?? getLeaderByNationId(actorId)?.opportunism === true;
    if (!enabled && !previous) return;
    if (previous && round < previous.evaluatedRound + OPPORTUNISM_CADENCE) return;
    const relation = this.context.diplomacy.getRelation(actorId, targetId);
    let severity = 0;
    let ratio = 0;
    let reason = 'military recovery or strategic restraint';
    if (enabled && actorId !== targetId && this.context.haveMet(actorId, targetId)
      && this.context.military.isNationActive(actorId) && this.context.military.isNationActive(targetId)
      && relation.state === 'PEACE' && this.context.diplomacy.canDeclareWar(actorId, targetId)
      && !this.context.diplomacy.isAtWarWithAnyNation(actorId)
      && relation.fear < 50 && !(relation.trust >= 70 && relation.affinity >= 10)
      && this.context.threat(actorId, targetId) !== 'high') {
      const own = this.context.military.getMilitaryStrength(actorId);
      const defense = this.context.military.getDefensiveWarPowerAgainst(actorId, targetId);
      ratio = own.totalStrength / Math.max(1, defense);
      // City defenses alone cannot supply an invasion force. Use the same canonical
      // unit-strength component and the existing era readiness ratio.
      const ready = own.unitStrength / Math.max(1, defense) >= Math.max(1, this.context.minimumReadiness(actorId));
      const candidateSeverity = severityForRatio(ratio);
      if (candidateSeverity > 0 && ready && this.context.canProjectForce(actorId, targetId)) {
        severity = candidateSeverity;
        reason = `vulnerable rival: own=${own.totalStrength.toFixed(1)}, units=${own.unitStrength.toFixed(1)}, defensive coalition=${defense.toFixed(1)}`;
      }
    }
    const cap = PRESSURE_CAPS[severity];
    // A smaller advantage immediately lowers the ceiling. Recovery removes the
    // entire temporary influence, without undoing unrelated diplomatic history.
    const pressure = Math.min(cap, (previous?.pressure ?? 0) + PRESSURE_STEPS[severity]);
    const state = { actorId, targetId, evaluatedRound: round, pressure, severity, ratio };
    this.pairs.set(key, state);
    if ((previous?.severity ?? 0) !== severity || (previous?.pressure ?? 0) !== pressure) {
      this.context.log(actorId, targetId, `[Opportunism] ${severity ? reason : 'opportunity no longer significant: ' + reason}; ratio=${ratio.toFixed(2)}, tension=${pressure}/60 (was ${previous?.pressure ?? 0}).`);
    }
    if (severity > 0) {
      const trigger: GossipFlavorContext = pressure >= 45 ? 'opportunity_military'
        : pressure >= 30 ? 'opportunity_territorial' : pressure >= 15 ? 'opportunity_intimidation' : 'opportunity_mockery';
      if (this.context.remark(actorId, targetId, trigger)) this.context.log(actorId, targetId, `[Opportunism] ${trigger} remark generated; ratio=${ratio.toFixed(2)}, tension=${pressure}.`);
    }
  }

  /** Shared with passive diplomatic evaluation, so Audience attitudes reflect tension. */
  influence(actorId: string, targetId: string, relation: DiplomacyRelation): DiplomacyRelation {
    const pressure = this.getPressure(actorId, targetId);
    if (!pressure || relation.state !== 'PEACE') return relation;
    return { ...relation, hostility: Math.min(100, relation.hostility + pressure),
      affinity: Math.max(-100, relation.affinity - pressure / 3) };
  }

  getPressure(actorId: string, targetId: string): number {
    const enabled = this.context.enabled?.(actorId) ?? getLeaderByNationId(actorId)?.opportunism === true;
    if (!enabled || !this.context.haveMet(actorId, targetId)
      || !this.context.diplomacy.canDeclareWar(actorId, targetId)
      || this.context.diplomacy.isAtWarWithAnyNation(actorId)) return 0;
    const stored = this.pairs.get(`${actorId}|${targetId}`)?.pressure ?? 0;
    if (!stored) return 0;
    const relation = this.context.diplomacy.getRelation(actorId, targetId);
    if (relation.fear >= 50 || (relation.trust >= 70 && relation.affinity >= 10)
      || this.context.threat(actorId, targetId) === 'high'
      || !this.context.military.isNationActive(targetId)) return 0;
    // Deterrence is immediate even between the five-round pressure updates.
    const own = this.context.military.getMilitaryStrength(actorId);
    const defense = Math.max(1, this.context.military.getDefensiveWarPowerAgainst(actorId, targetId));
    if (own.unitStrength / defense < Math.max(1, this.context.minimumReadiness(actorId))) return 0;
    const ratio = own.totalStrength / defense;
    return Math.min(stored, PRESSURE_CAPS[severityForRatio(ratio)]);
  }

  /** Only sustained, overwhelming weakness opens an extra route into normal war evaluation. */
  warBonus(actorId: string, targetId: string): number {
    const pressure = this.getPressure(actorId, targetId);
    return pressure >= 45 ? 0.6 * pressure / 60 : 0;
  }

  serialize(): SavedOpportunismState { return { pairs: [...this.pairs.values()].map(p => ({ ...p })) }; }
  restore(state?: SavedOpportunismState): void {
    this.pairs.clear();
    for (const p of state?.pairs ?? []) {
      if (typeof p.actorId !== 'string' || typeof p.targetId !== 'string' || p.actorId === p.targetId
        || ![p.evaluatedRound, p.pressure, p.severity, p.ratio].every(Number.isFinite)
        || p.pressure < 0 || p.pressure > 60 || !Number.isInteger(p.severity) || p.severity < 0 || p.severity > 3
        || !Number.isInteger(p.evaluatedRound) || p.evaluatedRound < 0) continue;
      this.pairs.set(`${p.actorId}|${p.targetId}`, { ...p });
    }
  }
}
