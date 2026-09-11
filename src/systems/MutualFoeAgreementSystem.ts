import { ALL_LEADERS, getLeaderByNationId, onActiveLeadersChanged } from '../data/leaders';
import type { MutualFoeAgreement, MutualFoeCrisis, MutualFoeGoldBreakdown } from '../types/mutualFoe';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import { validateMutualFoeAgreements } from './MutualFoeAgreementValidation';

export interface MutualFoeAnnouncement {
  kind: 'activated' | 'fulfilledByWar' | 'memberLeft' | 'ended';
  agreementId: string;
  agreementName: string;
  nationIds: string[];
  message: string;
}

export interface MutualFoeEconomy {
  /** Ordinary net income, before ANY Mutual Foe incoming or outgoing transfers. */
  normalGoldPerTurn(nationId: string): number;
  /** Canonical atomic, available-reserve-clamped transfer. Returns actual Gold transferred. */
  transferGold(from: string, to: string, amount: number): number;
}

interface Transfer { agreementId: string; donor: string; recipient: string; amount: number }
const positive = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Coordinates canonical diplomacy, leaders and economic accounts; never initiates war. */
export class MutualFoeAgreementSystem {
  private readonly agreements: MutualFoeAgreement[];
  private readonly crises = new Map<string, MutualFoeCrisis>();
  private readonly unsubscribers: (() => void)[];
  private readonly listeners = new Set<(event: MutualFoeAnnouncement) => void>();
  private readonly participating = new Map<string, Set<string>>();
  /** Event deduplication only; canonical diplomacy remains the authority on war state. */
  private readonly processedWarPairs = new Set<string>();
  private busy = false;
  private disposed = false;

  constructor(
    definitions: unknown,
    scenarioNations: readonly { id: string }[],
    private readonly nations: NationManager,
    private readonly diplomacy: DiplomacyManager,
    private readonly economy: MutualFoeEconomy,
    private readonly log: (message: string) => void = console.log,
  ) {
    const validated = validateMutualFoeAgreements(definitions, scenarioNations);
    this.agreements = validated.agreements.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (const error of validated.errors) this.log(`[MutualFoe] ${error}`);
    this.unsubscribers = [
      diplomacy.onWarDeclared((a, b) => this.warDeclared(a, b)),
      diplomacy.onWarEnded((a, b) => { this.processedWarPairs.delete(this.warPair(a, b)); this.refresh(); }),
      diplomacy.onDiplomacyChanged(() => this.refresh()),
      onActiveLeadersChanged(() => this.refresh()),
      nations.onNationRemoved(() => this.refresh()),
    ];
    this.rememberCurrentWars();
    // Existing wars are remembered only to reject event replay, never for activation.
  }

  getDefinitions(): MutualFoeAgreement[] { return clone(this.agreements); }
  getCrises(): MutualFoeCrisis[] { return clone([...this.crises.values()]); }
  serialize(): MutualFoeCrisis[] { this.refresh(); return this.getCrises(); }
  onAnnouncement(listener: (event: MutualFoeAnnouncement) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private leaderNation(leaderId: string): string | undefined {
    return ALL_LEADERS.find(leader => leader.id === leaderId)?.nationId;
  }
  private active(leaderId: string): boolean {
    const nationId = this.leaderNation(leaderId);
    return nationId !== undefined && this.nations.getNation(nationId) !== undefined
      && getLeaderByNationId(nationId)?.id === leaderId;
  }
  private name(nationId: string): string { return this.nations.getNation(nationId)?.name ?? nationId; }
  private leaderName(leaderId: string): string { return ALL_LEADERS.find(l => l.id === leaderId)?.name ?? leaderId; }

  private announce(kind: MutualFoeAnnouncement['kind'], a: MutualFoeAgreement, c: MutualFoeCrisis, message: string, extra: string[] = []): void {
    this.updateDisplayedEconomy();
    this.log(`[MutualFoe] ${kind} agreement=${a.id} defended=${c.defendedNationId}: ${message}`);
    const nationIds = [...new Set([c.antagonistNationId, c.defendedNationId, ...extra])];
    for (const listener of this.listeners) listener({ kind, agreementId: a.id, agreementName: a.name, nationIds, message });
  }

  private warPair(a: string, b: string): string { return JSON.stringify([a, b].sort()); }

  private rememberCurrentWars(): void {
    this.processedWarPairs.clear();
    for (const { keys: [a, b], relation } of this.diplomacy.getAllStates()) {
      if (relation.state === 'WAR') this.processedWarPairs.add(this.warPair(a, b));
    }
  }

  private warDeclared(aggressor: string, target: string): void {
    const pair = this.warPair(aggressor, target);
    if (this.disposed || this.processedWarPairs.has(pair)) return;
    this.processedWarPairs.add(pair);
    // Any legitimate war entry fulfills an existing obligation, regardless of direction/source.
    this.refresh();
    if (this.diplomacy.getAggressorNationId(aggressor, target) !== aggressor) return;
    for (const a of this.agreements) {
      if (a.antagonistNationId !== aggressor || this.crises.has(a.id)) continue;
      const defendedLeaderId = a.memberLeaderIds.find(id => this.leaderNation(id) === target && this.active(id));
      if (!defendedLeaderId || this.diplomacy.getState(aggressor, target) !== 'WAR' || !this.nations.getNation(aggressor)) continue;
      this.activate(a, target, defendedLeaderId);
    }
    this.refresh();
  }

  private activate(a: MutualFoeAgreement, defendedNationId: string, defendedLeaderId: string): void {
    const c: MutualFoeCrisis = {
      agreementId: a.id, antagonistNationId: a.antagonistNationId, defendedNationId, defendedLeaderId,
      warStartedRound: this.diplomacy.getRelation(a.antagonistNationId, defendedNationId).lastWarDeclarationTurn,
      initialContributors: [], fulfilledByWarLeaderIds: [], lastContributionRoundByNation: {},
    };
    // Install before canonical reconciliation callbacks can re-enter us.
    this.crises.set(a.id, c);
    this.busy = true;
    try {
      const activeLeaders = a.memberLeaderIds.filter(id => this.active(id));
      const memberNations = activeLeaders.map(id => this.leaderNation(id)!);
      for (let i = 0; i < memberNations.length; i++) {
        for (let j = i + 1; j < memberNations.length; j++) this.diplomacy.reconcileWar(memberNations[i], memberNations[j]);
      }
      for (const { hostNationId, vassalNationId } of this.diplomacy.getAllVassalRelationships()) {
        if (memberNations.includes(hostNationId) && memberNations.includes(vassalNationId)) {
          this.diplomacy.terminateVassalage(hostNationId, vassalNationId);
        }
      }
      const supporters: string[] = [];
      for (const leaderId of activeLeaders) {
        if (leaderId === defendedLeaderId) continue;
        const donor = this.leaderNation(leaderId)!;
        if (this.diplomacy.getState(donor, a.antagonistNationId) === 'WAR') {
          c.fulfilledByWarLeaderIds.push(leaderId);
          continue;
        }
        // Mark before transfer/notifications. Initial contributions are NEVER replayed by refresh or restore.
        c.initialContributors.push(leaderId);
        const requested = Math.floor(positive(this.nations.getResources(donor).gold) * a.supportPercent / 100);
        const paid = this.economy.transferGold(donor, defendedNationId, requested);
        this.log(`[MutualFoe] initial agreement=${a.id} donor=${donor} recipient=${defendedNationId} gold=${paid}`);
        supporters.push(donor);
      }
      this.participating.set(a.id, new Set(activeLeaders));
      this.announce('activated', a, c,
        `${this.name(a.antagonistNationId)} has declared war on ${this.name(defendedNationId)}. The active signatories of ${a.name} have closed ranks in support of ${this.leaderName(defendedLeaderId)}'s government. `
        + (supporters.length ? `${supporters.map(id => this.name(id)).join(', ')} provide ${a.supportPercent}% economic support.` : 'No signatory government is currently eligible to provide economic support.'), memberNations);
    } finally { this.busy = false; }
  }

  /** Re-evaluate eligibility; only historical fulfillment and crisis lifetime are mutated. */
  refresh(silent = false): void {
    if (this.disposed || this.busy || this.agreements.length === 0) return;
    this.busy = true;
    try {
      for (const a of this.agreements) {
        const c = this.crises.get(a.id);
        if (!c) continue;
        const relation = this.diplomacy.getRelation(c.antagonistNationId, c.defendedNationId);
        const reason = !this.nations.getNation(c.defendedNationId) || !this.nations.getNation(c.antagonistNationId)
          ? 'A nation in the triggering conflict is no longer an active participant.'
          : !this.active(c.defendedLeaderId)
            ? `${this.leaderName(c.defendedLeaderId)} no longer leads ${this.name(c.defendedNationId)}.`
            : relation.state !== 'WAR' || relation.lastWarDeclarationTurn !== c.warStartedRound
              ? `The war between ${this.name(c.antagonistNationId)} and ${this.name(c.defendedNationId)} has ended.` : undefined;
        if (reason) {
          this.crises.delete(a.id); this.participating.delete(a.id);
          if (!silent) this.announce('ended', a, c, `${reason} Emergency support under ${a.name} has concluded.`, a.memberLeaderIds.map(id => this.leaderNation(id)!));
          continue;
        }
        const previouslyActive = this.participating.get(a.id) ?? new Set<string>();
        const currentlyActive = new Set(a.memberLeaderIds.filter(id => this.active(id)));
        for (const leaderId of a.memberLeaderIds) {
          if (leaderId === c.defendedLeaderId) continue;
          const donor = this.leaderNation(leaderId)!;
          if (!currentlyActive.has(leaderId)) {
            if (!silent && previouslyActive.has(leaderId) && !c.fulfilledByWarLeaderIds.includes(leaderId)) {
              this.announce('memberLeft', a, c, `${this.leaderName(leaderId)} no longer leads an active ${this.name(donor)} government. Its economic support under ${a.name} has ended.`, [donor]);
            }
            continue;
          }
          if (!c.fulfilledByWarLeaderIds.includes(leaderId) && this.diplomacy.getState(donor, c.antagonistNationId) === 'WAR') {
            c.fulfilledByWarLeaderIds.push(leaderId);
            if (!silent) this.announce('fulfilledByWar', a, c, `${this.name(donor)} has entered the war against ${this.name(c.antagonistNationId)} and fulfilled its obligations under ${a.name}. Its economic support to ${this.name(c.defendedNationId)} has ended.`, [donor]);
          }
        }
        this.participating.set(a.id, currentlyActive);
      }
      this.updateDisplayedEconomy();
    } finally { this.busy = false; }
  }

  /** Each agreement uses the same unmodified basis; aggregate commitments never exceed positive income. */
  private plan(): Transfer[] {
    const result: Transfer[] = [];
    const bases = new Map<string, number>();
    const remaining = new Map<string, number>();
    for (const a of this.agreements) {
      const c = this.crises.get(a.id);
      if (!c) continue;
      for (const id of a.memberLeaderIds) {
        if (id === c.defendedLeaderId || !this.active(id) || c.fulfilledByWarLeaderIds.includes(id)) continue;
        const donor = this.leaderNation(id)!;
        if (this.diplomacy.getState(donor, c.antagonistNationId) === 'WAR') continue;
        if (!bases.has(donor)) {
          const base = positive(this.economy.normalGoldPerTurn(donor));
          bases.set(donor, base); remaining.set(donor, base);
        }
        const amount = Math.min(remaining.get(donor)!, Math.floor(bases.get(donor)! * a.supportPercent / 100));
        remaining.set(donor, remaining.get(donor)! - amount);
        result.push({ agreementId: a.id, donor, recipient: c.defendedNationId, amount });
      }
    }
    return result;
  }

  private updateDisplayedEconomy(): void {
    for (const n of this.nations.getAllNations()) {
      const r = this.nations.getResources(n.id);
      r.mutualFoeGoldIncomingPerTurn = 0; r.mutualFoeGoldOutgoingPerTurn = 0;
    }
    for (const t of this.plan()) {
      this.nations.getResources(t.donor).mutualFoeGoldOutgoingPerTurn += t.amount;
      this.nations.getResources(t.recipient).mutualFoeGoldIncomingPerTurn += t.amount;
    }
  }

  getGoldBreakdown(nationId: string): MutualFoeGoldBreakdown {
    this.refresh();
    const resources = this.nations.getNation(nationId) && this.nations.getResources(nationId);
    return { outgoing: resources?.mutualFoeGoldOutgoingPerTurn ?? 0, incoming: resources?.mutualFoeGoldIncomingPerTurn ?? 0 };
  }

  /** Called once after the donor's ordinary income is credited; recipients do not mint an income copy. */
  settleIncome(nationId: string, round: number): void {
    this.refresh();
    if (this.disposed || this.busy) return;
    const transfers = this.plan().filter(t => t.donor === nationId);
    this.busy = true;
    try {
      for (const t of transfers) {
        const c = this.crises.get(t.agreementId)!;
        if ((c.lastContributionRoundByNation[nationId] ?? -1) >= round) continue;
        c.lastContributionRoundByNation[nationId] = round;
        this.economy.transferGold(t.donor, t.recipient, t.amount);
      }
    } finally { this.busy = false; }
  }

  /** Quiet restoration: neither reconciliation, activation announcements nor treasury transfers run. */
  restore(input: unknown): void {
    this.crises.clear(); this.participating.clear();
    this.rememberCurrentWars();
    if (Array.isArray(input)) for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const c = item as MutualFoeCrisis;
      const a = this.agreements.find(a => a.id === c.agreementId);
      if (!a || this.crises.has(a.id) || c.antagonistNationId !== a.antagonistNationId
        || !a.memberLeaderIds.includes(c.defendedLeaderId) || this.leaderNation(c.defendedLeaderId) !== c.defendedNationId
        || !(c.warStartedRound === null || (Number.isSafeInteger(c.warStartedRound) && c.warStartedRound >= 0))) continue;
      const validIds = (ids: unknown): string[] => Array.isArray(ids)
        ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && id !== c.defendedLeaderId && a.memberLeaderIds.includes(id)))] : [];
      const rounds: Record<string, number> = {};
      if (c.lastContributionRoundByNation && typeof c.lastContributionRoundByNation === 'object') {
        for (const [id, round] of Object.entries(c.lastContributionRoundByNation)) {
          if (a.memberLeaderIds.some(l => this.leaderNation(l) === id) && Number.isSafeInteger(round) && round >= 0) rounds[id] = round;
        }
      }
      this.crises.set(a.id, {
        agreementId: a.id, antagonistNationId: a.antagonistNationId,
        defendedNationId: c.defendedNationId, defendedLeaderId: c.defendedLeaderId, warStartedRound: c.warStartedRound,
        initialContributors: validIds(c.initialContributors), fulfilledByWarLeaderIds: validIds(c.fulfilledByWarLeaderIds),
        lastContributionRoundByNation: rounds,
      });
    }
    this.refresh(true);
  }

  shutdown(): void {
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.listeners.clear(); this.crises.clear(); this.participating.clear(); this.processedWarPairs.clear();
    this.updateDisplayedEconomy();
  }
}
