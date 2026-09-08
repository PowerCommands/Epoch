import type { Era } from '../../data/technologies';
import { getEraRank } from '../EraSystem';
import type { DiplomacyManager, DiplomacyRelation, EconomicPressureChangedEvent } from '../DiplomacyManager';
import type { EconomicPressureType } from '../../data/economicPressure';
import { ECONOMIC_PRESSURE_ESCALATION_COOLDOWN, ECONOMIC_PRESSURE_LEVEL } from '../../data/economicPressure';
import type { HistoricalEvent } from '../../types/historicalTimeline';
import type { LeaderStatement } from '../../types/leaderStatement';
import type { LeaderStatementSystem } from '../LeaderStatementSystem';

export function getBullyIntensity(era: Era): number {
  return [0.15, 0.30, 0.50, 0.75, 0.90, 1][Math.min(5, Math.max(0, getEraRank(era)))]!;
}
export const BULLY_CADENCE = 5;
export const BULLY_GRIEVANCE_DURATION = 15;
export interface BullyGrievance {
  actorId: string; targetId: string; reason: string; createdRound: number; expiresRound: number; severity: number;
}
interface BullyMemory {
  id: string; nextRound: number; nextActionRound: number;
  grievance?: BullyGrievance;
  rhetoric?: { context: 'fake_news' | 'retreat'; expiresRound: number; subjectNationId?: string };
}
export interface SavedImpulsiveBullyState { leaders: BullyMemory[]; pendingResponses?: LeaderStatement[] }
export interface ImpulsiveBullyContext {
  statements: LeaderStatementSystem;
  diplomacy: Pick<DiplomacyManager, 'getRelation' | 'getEconomicPressureRecord' | 'canImposeEconomicPressure' | 'liftEconomicPressure'>;
  era: (id: string) => Era;
  isAI: (id: string) => boolean;
  outburst: (a: string, b: string, threatening: boolean) => boolean;
  applyPressure: (a: string, b: string, type: EconomicPressureType) => boolean;
  /** Canonical military threat evaluation supplies immediate strategic restraint. */
  endangered: (a: string, b: string) => boolean;
  economicDistress?: (id: string) => boolean;
}
/** One short grievance per leader; emotion supplies motives, never declares war. */
export class ImpulsiveBullySystem {
  private leaders = new Map<string, BullyMemory>();
  private pendingResponses: LeaderStatement[] = [];
  constructor(private readonly context: ImpulsiveBullyContext) {
    context.statements.onStatement(s => {
      if (!s.responseTo) this.pendingResponses.push(s);
      if (s.tone === 'threatening') for (const observer of s.observerIds)
        this.perceive(observer, s.speakerId, 'a hostile public statement');
    });
  }
  private get c() { return this.context.statements.context; }
  private enabled(id: string): boolean { return this.c.isBully(id) && this.context.isAI(id) && this.c.active(id); }
  private memory(id: string): BullyMemory {
    let m = this.leaders.get(id);
    if (!m) { m = { id, nextRound: 0, nextActionRound: 0 }; this.leaders.set(id, m); }
    return m;
  }
  private roll(key: string): number { return this.context.statements.roll(`bully|${this.c.round()}|${key}`); }
  private log(ids: string[], text: string): void { this.c.log(ids, `[ImpulsiveBully] ${text}`); }
  /** Hooks only observe actual events; retaliation is intentionally easier to take personally. */
  perceive(actorId: string, targetId: string, reason: string, retaliation = false): boolean {
    if (!this.enabled(actorId) || actorId === targetId || !this.c.active(targetId) || !this.c.haveMet(actorId, targetId)) return false;
    const round = this.c.round(), m = this.memory(actorId);
    if (m.grievance?.createdRound === round) return false;
    const intensity = getBullyIntensity(this.context.era(actorId));
    if (this.roll(`grievance|${actorId}|${targetId}|${reason}`) >= intensity * (retaliation ? 0.9 : 0.55)) return false;
    const severity = this.roll(`severity|${actorId}|${targetId}|${reason}`) < intensity * 0.35 ? 3
      : this.roll(`severity2|${actorId}|${targetId}|${reason}`) < intensity * 0.65 ? 2 : 1;
    m.grievance = { actorId, targetId, reason, createdRound: round, expiresRound: round + BULLY_GRIEVANCE_DURATION, severity };
    this.log([actorId, targetId], `perceived grievance: ${reason}; severity=${severity}, expires=${round + BULLY_GRIEVANCE_DURATION}.`);
    return true;
  }
  grievance(id: string): BullyGrievance | undefined {
    const m = this.leaders.get(id);
    if (m?.grievance && (m.grievance.expiresRound <= this.c.round() || !this.c.active(m.grievance.targetId))) {
      this.log([id, m.grievance.targetId], `grievance expired: ${m.grievance.reason}.`);
      m.grievance = undefined;
    }
    return this.enabled(id) ? m?.grievance : undefined;
  }
  influence(a: string, b: string, relation: DiplomacyRelation): DiplomacyRelation {
    const grievance = this.grievance(a);
    const tension = grievance?.targetId === b ? grievance.severity * 8 : 0;
    const predisposition = this.c.isBully(a) && this.c.isBully(b) ? 4 : 0;
    if (!tension && !predisposition) return relation;
    return { ...relation, affinity: Math.max(-100, Math.min(100, relation.affinity + predisposition - tension / 2)),
      hostility: Math.min(100, relation.hostility + tension) };
  }
  recordWarContribution(a: string, b: string, bonus: number, declared = false): void {
    this.log([a, b], `${declared ? 'war declared' : 'normal war evaluation'}: grievance=${this.grievance(a)?.reason ?? 'expired'}, bonus=${bonus.toFixed(2)}; existing war safeguards retained.`);
  }
  warBonus(a: string, b: string): number {
    const g = this.grievance(a);
    return g?.targetId === b && g.severity >= 2 && this.c.round() > g.createdRound ? 0.15 * g.severity : 0;
  }
  private rhetoric(id: string, context: 'fake_news' | 'retreat', subjectNationId?: string): void {
    if (!this.enabled(id)) return;
    this.memory(id).rhetoric = { context, expiresRound: this.c.round() + BULLY_GRIEVANCE_DURATION, subjectNationId };
  }
  handlePressure(event: EconomicPressureChangedEvent): void {
    if (event.type) {
      this.rhetoric(event.targetNationId, 'fake_news', event.sourceNationId);
      const retaliation = !!this.context.diplomacy.getEconomicPressureRecord(event.targetNationId, event.sourceNationId);
      this.perceive(event.targetNationId, event.sourceNationId,
        retaliation ? 'their hostile retaliation: an unprovoked attack on our economy' : `${event.type} imposed against us`, retaliation);
    } else if (event.previousType) {
      // War automatically clears sanctions; do not call that a successful retreat.
      if (this.context.diplomacy.getRelation(event.sourceNationId, event.targetNationId).state === 'PEACE')
        this.retreat(event.sourceNationId, event.targetNationId);
    }
  }
  retreat(id: string, targetId: string): void {
    if (!this.enabled(id)) return;
    const m = this.memory(id);
    if (m.rhetoric?.context === 'retreat' && m.nextActionRound === this.c.round() + 10) return;
    if (m.grievance?.targetId === targetId) m.grievance = undefined;
    m.nextActionRound = this.c.round() + 10;
    this.rhetoric(id, 'retreat');
    this.log([id, targetId], 'de-escalation; victory rhetoric queued, canonical outcome retained.');
  }
  reportDefeat(loser: string, winner: string): void {
    if (!this.c.haveMet(loser, winner)) return;
    this.perceive(loser, winner, 'reports of a military defeat');
    this.rhetoric(loser, 'fake_news', winner);
  }
  handleHistory(event: HistoricalEvent): void {
    const meta = event.metadata;
    if (event.type === 'leaderStatement') return;
    if (event.type === 'leaderInsult' && meta?.aggressorNationId && meta.targetNationId) {
      this.perceive(meta.targetNationId, meta.aggressorNationId, 'a public insult');
      this.rhetoric(meta.targetNationId, 'fake_news', meta.aggressorNationId);
    }
    if ((event.type === 'cityCaptured' || event.type === 'capitalCaptured') && meta?.targetNationId && meta.aggressorNationId) {
      this.perceive(meta.targetNationId, meta.aggressorNationId, 'reports of a military defeat');
      this.rhetoric(meta.targetNationId, 'fake_news', meta.aggressorNationId);
    }
    if (event.type === 'wonderBuilt' || event.type === 'gamesGold' || event.type === 'gamesCompleted') {
      const winner = meta?.gamesWinnerNationId ?? event.eventNationIds[0];
      if (winner) for (const id of this.c.nationIds().slice().sort()) {
        if (this.perceive(id, winner, event.type === 'wonderBuilt' ? 'conspicuous foreign prestige' : 'the Games results')) this.rhetoric(id, 'fake_news', winner);
      }
    }
    if (event.type === 'worldCouncilResolution' && meta?.targetNationId && meta.aggressorNationId) {
      this.perceive(meta.targetNationId, meta.aggressorNationId, 'a World Council decision concerning us');
      this.rhetoric(meta.targetNationId, 'fake_news', meta.aggressorNationId);
    }
    if (event.type === 'peaceSummitRejected' && meta?.summitProposerNationId && meta.summitRecipientNationId)
      this.perceive(meta.summitProposerNationId, meta.summitRecipientNationId, 'a rejected peace summit');
  }
  /** Called once per AI turn; nation-wide cadence bounds output regardless of rival count. */
  runTurn(id: string): void {
    this.respond();
    if (!this.enabled(id)) return;
    const m = this.memory(id), round = this.c.round();
    this.grievance(id);
    if (round < m.nextRound) return;
    m.nextRound = round + BULLY_CADENCE;
    const intensity = getBullyIntensity(this.context.era(id));
    const targets = this.c.nationIds().filter(t => t !== id && this.c.active(t) && this.c.haveMet(id, t)).sort();
    if (this.context.economicDistress?.(id) && m.rhetoric?.context !== 'retreat') this.rhetoric(id, 'fake_news');
    // Strategic retreat also works after the original grievance has expired.
    if (round >= m.nextActionRound) for (const target of targets) {
      if (!this.context.diplomacy.getEconomicPressureRecord(id, target)) continue;
      if (!(this.context.endangered(id, target) || this.context.economicDistress?.(id))) continue;
      if (this.roll(`retreat|${id}|${target}`) < 0.6 && this.context.diplomacy.liftEconomicPressure(id, target)) {
        this.retreat(id, target);
        break;
      }
    }
    if (!m.grievance && targets.length && this.roll(`spontaneous|${id}`) < intensity * 0.3) {
      const target = targets[Math.floor(this.roll(`target|${id}`) * targets.length)]!;
      const reasons = ['no discernible reason', 'heard disturbing reports', 'an anonymous source claimed disrespect', 'a dubious public claim'];
      const reason = reasons[Math.floor(this.roll(`reason|${id}`) * reasons.length)]!;
      this.perceive(id, target, reason, true);
    }
    const g = this.grievance(id);
    if (g && round >= m.nextActionRound) {
      if (this.roll(`outburst|${id}`) < intensity * 0.65) {
        const threat = this.roll(`threat|${id}`) < intensity * 0.45;
        if (this.context.outburst(id, g.targetId, threat)) {
          this.context.statements.react(id, g.targetId, { hostility: 6, suspicion: 4, trust: -3, affinity: -4,
            fear: threat ? 5 * this.context.statements.credibility(id, g.targetId) : 0 });
          this.log([id, g.targetId], `${threat ? 'threat' : 'insult'} over ${g.reason}.`);
        }
      }
    }
    const queued = m.rhetoric;
    if (queued && queued.expiresRound < round) m.rhetoric = undefined;
    if (this.roll(`speech|${id}`) < intensity * (m.rhetoric ? 0.9 : 0.5)) {
      const context = m.rhetoric?.context ?? 'general';
      const tone = this.roll(`tone|${id}`) < intensity * 0.3 ? 'threatening'
        : this.roll(`bizarre|${id}`) < intensity * 0.45 ? 'bizarre' : 'grandiose';
      if (this.context.statements.issue(id, l => l.context === context && (context !== 'general' || l.tone === tone), undefined, m.rhetoric?.subjectNationId)) m.rhetoric = undefined;
    }
    this.respond();
  }
  /** Uses canonical eligibility and the same applier as routine AI pressure. */
  considerRetaliation(a: string, b: string): boolean {
    const g = this.grievance(a), m = this.leaders.get(a), round = this.c.round();
    if (!g || g.targetId !== b || !m || round < m.nextActionRound
      || this.context.diplomacy.getRelation(a, b).state !== 'PEACE') return false;
    const current = this.context.diplomacy.getEconomicPressureRecord(a, b);
    if (current && round - current.imposedTurn < ECONOMIC_PRESSURE_ESCALATION_COOLDOWN) return false;
    // One attempt per cadence even if all capabilities are unavailable.
    m.nextActionRound = round + BULLY_CADENCE;
    const intensity = getBullyIntensity(this.context.era(a));
    const candidates: Array<[EconomicPressureType, number]> = [
      ['embargo', g.severity >= 3 ? intensity * 0.12 : 0],
      ['boycott', g.severity >= 2 ? intensity * 0.28 : 0], ['tariffs', intensity * 0.65],
    ];
    for (const [type, chance] of candidates) {
      if (!chance || (current && ECONOMIC_PRESSURE_LEVEL[current.type] >= ECONOMIC_PRESSURE_LEVEL[type])) continue;
      const legal = this.context.diplomacy.canImposeEconomicPressure(a, b, type);
      if (!legal.ok) { this.log([a, b], `${type} unavailable: ${legal.reason ?? 'canonical eligibility rejected'}.`); continue; }
      if (this.roll(`pressure|${a}|${b}|${type}`) >= chance) continue;
      if (this.context.applyPressure(a, b, type)) {
        this.log([a, b], `${type} retaliation over ${g.reason}; canonical eligibility passed.`);
        return true;
      }
    }
    return false;
  }
  private respond(): void {
    const pending = this.pendingResponses.splice(0);
    for (const s of pending) {
      if (!this.c.isBully(s.speakerId) || !['grandiose', 'bizarre', 'threatening'].includes(s.tone)) continue;
      for (const id of s.observerIds) {
        if (!this.enabled(id)) continue;
        const relation = this.context.diplomacy.getRelation(id, s.speakerId);
        if (relation.state === 'WAR' || relation.hostility >= 65 || this.grievance(id)?.targetId === s.speakerId) continue;
        if (this.roll(`support|${s.id}|${id}`) >= getBullyIntensity(this.context.era(id)) * 0.4) continue;
        const defense = s.context === 'fake_news' && s.subjectNationId && s.subjectNationId !== id && this.c.haveMet(id, s.subjectNationId);
        const response = this.context.statements.issue(id, l => l.context === (defense ? 'defense' : 'endorsement'), s);
        if (response) {
          if (defense) this.context.statements.react(id, s.subjectNationId!, { hostility: 3, suspicion: 2 });
          this.log([id, s.speakerId], `public support of ${s.id}; no diplomatic or military commitment.`);
          break; // At most one public response to any statement.
        }
      }
    }
  }
  serialize(): SavedImpulsiveBullyState { return { leaders: [...this.leaders.values()].map(m => structuredClone(m)), pendingResponses: structuredClone(this.pendingResponses) }; }
  restore(state?: SavedImpulsiveBullyState): void {
    this.leaders.clear(); this.pendingResponses = (state?.pendingResponses ?? []).filter(s => !s.responseTo && typeof s.id === 'string' && Array.isArray(s.observerIds)).map(s => structuredClone(s));
    for (const m of state?.leaders ?? []) {
      if (typeof m.id !== 'string' || ![m.nextRound, m.nextActionRound].every(Number.isFinite)) continue;
      const saved = structuredClone(m), g = saved.grievance;
      if (g && (g.actorId !== m.id || g.targetId === m.id || typeof g.targetId !== 'string'
        || typeof g.reason !== 'string' || ![g.createdRound, g.expiresRound, g.severity].every(Number.isFinite)
        || g.expiresRound <= g.createdRound || ![1, 2, 3].includes(g.severity))) saved.grievance = undefined;
      if (saved.rhetoric && (!['fake_news', 'retreat'].includes(saved.rhetoric.context) || !Number.isFinite(saved.rhetoric.expiresRound))) saved.rhetoric = undefined;
      this.leaders.set(m.id, saved);
    }
  }
}
