import { LEADER_STATEMENTS } from '../data/leaderStatements';
import type { LeaderStatement, LeaderStatementDefinition, SavedLeaderStatements } from '../types/leaderStatement';
import type { DiplomacyManager, DiplomaticMemoryValues } from './DiplomacyManager';
import type { HistoricalTimelineService } from './HistoricalTimelineService';
import { deterministicFlavorRoll } from './GossipFlavorEventSystem';
import { calculateThreatFearMultiplier } from './GossipSystem';

export const STATEMENT_COOLDOWN = 8;
export interface LeaderStatementContext {
  diplomacy: Pick<DiplomacyManager, 'getRelation' | 'setMemoryValues'>;
  history: HistoricalTimelineService;
  round: () => number;
  nationIds: () => string[];
  active: (id: string) => boolean;
  haveMet: (a: string, b: string) => boolean;
  leaderName: (id: string) => string;
  militaryPower: (id: string) => number;
  isBully: (id: string) => boolean;
  seed: string;
  log: (ids: string[], message: string) => void;
  roll?: (key: string) => number;
}
/** Public communication. Effects are fixed per tone, never scaled by era or personality. */
export class LeaderStatementSystem {
  private nextId = 1;
  private speakers = new Map<string, { nextRound: number; recent: string[] }>();
  private listeners: Array<(statement: LeaderStatement) => void> = [];
  private publishing = false;
  constructor(readonly context: LeaderStatementContext) {}
  onStatement(listener: (statement: LeaderStatement) => void): void { this.listeners.push(listener); }
  roll(key: string): number {
    return Math.max(0, Math.min(0.999999999, this.context.roll?.(key) ?? deterministicFlavorRoll(`${this.context.seed}|${key}`)));
  }
  available(id: string): boolean {
    return this.context.active(id) && this.context.round() >= (this.speakers.get(id)?.nextRound ?? 0);
  }
  /** Select from a reusable content pool; recent content is excluded across contexts. */
  issue(speakerId: string, predicate: (line: LeaderStatementDefinition) => boolean,
    responseTo?: LeaderStatement, subjectNationId?: string): LeaderStatement | undefined {
    // Listeners cannot publish recursively. Responses are explicitly emitted after issue returns.
    if (this.publishing || !this.available(speakerId) || responseTo?.responseTo) return undefined;
    if (responseTo && (responseTo.speakerId === speakerId || !responseTo.observerIds.includes(speakerId)
      || !this.context.active(responseTo.speakerId) || !this.context.haveMet(speakerId, responseTo.speakerId))) return undefined;
    const recent = this.speakers.get(speakerId)?.recent ?? [];
    const eligible = LEADER_STATEMENTS.filter(predicate);
    if (!eligible.length) return undefined;
    const fresh = eligible.filter(line => !recent.includes(line.id));
    // Small future content pools must not permanently silence a speaker.
    // When exhausted, reuse only the least recently spoken eligible line.
    const pool = fresh.length ? fresh : [eligible.reduce((oldest, line) =>
      recent.indexOf(line.id) < recent.indexOf(oldest.id) ? line : oldest)];
    const round = this.context.round();
    const line = pool[Math.floor(this.roll(`statement|${speakerId}|${round}|${this.nextId}`) * pool.length)]!;
    const observerIds = [...new Set(this.context.nationIds())].filter(id => id !== speakerId
      && this.context.active(id) && this.context.haveMet(id, speakerId)).sort();
    const statement: LeaderStatement = { id: `statement-${this.nextId++}`, speakerId, round,
      contentId: line.id, tone: line.tone, context: line.context, text: line.text, observerIds,
      responseTo: responseTo?.id, subjectNationId: subjectNationId ?? responseTo?.speakerId };
    this.speakers.set(speakerId, { nextRound: round + STATEMENT_COOLDOWN, recent: [...recent.filter(id => id !== line.id), line.id].slice(-6) });
    this.publishing = true;
    try {
      for (const observer of observerIds) {
        const solidarity = line.context === 'endorsement' || line.context === 'defense';
        const admires = this.context.isBully(observer) && this.context.isBully(speakerId)
          && ['grandiose', 'bizarre', 'threatening'].includes(line.tone);
        if (admires) this.react(observer, speakerId, { affinity: 2 });
        else if (line.tone === 'threatening') this.react(observer, speakerId, { trust: -2, hostility: 3, suspicion: 4,
          fear: 4 * this.credibility(speakerId, observer) });
        else if (line.tone === 'bizarre' || solidarity) this.react(observer, speakerId, { suspicion: 2 });
        else if (line.tone === 'grandiose') this.react(observer, speakerId, { suspicion: 1 });
        else if (line.tone === 'constructive') this.react(observer, speakerId, { trust: 1, affinity: 1 });
      }
      if (responseTo) this.react(speakerId, responseTo.speakerId, { affinity: 7, trust: 2 });
      this.context.history.record({ type: 'leaderStatement', icon: '💬',
        text: `${this.context.leaderName(speakerId)} addressed the world${responseTo ? ` in support of ${this.context.leaderName(responseTo.speakerId)}` : ''}: “${line.text}”`,
        eventNationIds: responseTo ? [speakerId, responseTo.speakerId] : [speakerId],
        visibleToNationIds: [speakerId, ...observerIds],
        metadata: { statementId: statement.id, statementTone: line.tone, statementText: line.text,
          statementResponseTo: responseTo?.id, statementSubjectNationId: statement.subjectNationId } });
      this.context.log([speakerId, ...(responseTo ? [responseTo.speakerId] : [])], `[LeaderStatement] ${statement.id} ${line.context}/${line.tone}: “${line.text}”`);
      for (const listener of this.listeners) listener(statement);
    } finally { this.publishing = false; }
    return statement;
  }
  credibility(source: string, target: string): number {
    return calculateThreatFearMultiplier(this.context.militaryPower(source), this.context.militaryPower(target));
  }
  /** Reuses the canonical bounded pair memory, including its symmetric semantics. */
  react(a: string, b: string, delta: Partial<DiplomaticMemoryValues>): void {
    const r = this.context.diplomacy.getRelation(a, b);
    const values = { trust: r.trust, fear: r.fear, hostility: r.hostility, affinity: r.affinity, suspicion: r.suspicion };
    for (const field of Object.keys(delta) as Array<keyof DiplomaticMemoryValues>) {
      values[field] = Math.max(0, Math.min(100, values[field] + (delta[field] ?? 0)));
    }
    this.context.diplomacy.setMemoryValues(a, b, values);
  }
  serialize(): SavedLeaderStatements {
    return { nextId: this.nextId, speakers: [...this.speakers].map(([id, s]) => ({ id, nextRound: s.nextRound, recent: [...s.recent] })) };
  }
  restore(state?: SavedLeaderStatements): void {
    this.nextId = Math.max(1, Number.isSafeInteger(state?.nextId) ? state!.nextId : 1);
    this.speakers.clear();
    for (const s of state?.speakers ?? []) if (typeof s.id === 'string' && Number.isFinite(s.nextRound))
      this.speakers.set(s.id, { nextRound: Math.max(0, s.nextRound), recent: (s.recent ?? []).filter(id => LEADER_STATEMENTS.some(l => l.id === id)).slice(-6) });
  }
}
