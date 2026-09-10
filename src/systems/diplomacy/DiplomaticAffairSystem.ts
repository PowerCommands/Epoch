import type { DiplomaticProposal } from './DiplomaticProposal';

export const SETTLEMENT_COMPLAINT_RADIUS = 6;
export const SETTLEMENT_PROMISE_TURNS = 20;
export const AFFAIR_RESPONSE_TURNS = 5;
export const AFFAIR_COOLDOWN_TURNS = 20;
const INCIDENT_TURNS = 10;

interface Point { x: number; y: number }
export interface AffairCity { id: string; name: string; ownerId: string; tileX: number; tileY: number; isOriginalCapital?: boolean }
export interface DiplomaticAffair {
  id: string;
  kind: 'settlement' | 'money';
  from: string;
  to: string;
  created: number;
  expires: number;
  status: 'pending' | 'promised' | 'kept' | 'broken' | 'paid' | 'rejected' | 'expired' | 'cancelled';
  amount: number;
  cityId?: string;
  cityName?: string;
  anchors: Point[];
  promiseUntil?: number;
  line: number;
}
interface Incident { cityId: string; owner: string; neighbor: string; round: number; anchors: Point[]; used: boolean }
export interface SavedDiplomaticAffairs {
  nextId: number;
  affairs: DiplomaticAffair[];
  incidents: Incident[];
  cooldowns: [string, number][];
  lastMoneyRound: number;
}
export interface AffairContext {
  round(): number;
  nations(): string[];
  name(id: string): string;
  isHuman(id: string): boolean;
  interactive(): boolean;
  active(id: string): boolean;
  haveMet(a: string, b: string): boolean;
  atWar(a: string, b: string): boolean;
  cities(): AffairCity[];
  knowsCity(observer: string, city: AffairCity): boolean;
  distance(a: Point, b: Point): number;
  gold(id: string): number;
  addGold(id: string, amount: number): void;
  relation(a: string, b: string): { trust: number; hostility: number };
  diplomacyBias(id: string): number;
  changeRelation(a: string, b: string, trust: number, hostility: number): void;
  record(a: string, b: string, text: string): void;
  present(proposal: DiplomaticProposal): void;
  dismiss(id: string): void;
  notify?(speaker: string, text: string): void;
}
const MONEY_LINES = [
  'Could you lend us {amount} gold? Our treasury appears to have taken a holiday. An indefinite one.',
  'Might we borrow {amount} gold? Our finance minister promises to remember your generosity. Repayment was not mentioned.',
  'A small favour: {amount} gold. We would return it, but our accountants have advised us against making promises.',
  'Could you spare {amount} gold? We checked behind the throne. Just crumbs.',
];

/** Owns requests and promises; all effects are applied once through resolve/update. */
export class DiplomaticAffairSystem {
  private nextId = 1;
  private affairs: DiplomaticAffair[] = [];
  private incidents: Incident[] = [];
  private cooldowns = new Map<string, number>();
  private lastMoneyRound = -100;
  constructor(private readonly c: AffairContext) {}

  private eligible(a: string, b: string): boolean {
    return a !== b && this.c.active(a) && this.c.active(b) && this.c.haveMet(a, b) && !this.c.atWar(a, b);
  }
  private key(a: string, b: string, kind: string): string { return `${kind}|${a}|${b}`; }
  private available(a: string, b: string, kind: string): boolean {
    return this.eligible(a, b) && this.c.round() >= (this.cooldowns.get(this.key(a, b, kind)) ?? 0)
      && !this.affairs.some(v => v.from === a && v.to === b && v.kind === kind && ['pending', 'promised'].includes(v.status));
  }
  private near(p: Point, anchors: Point[]): boolean {
    return anchors.some(a => this.c.distance(p, a) <= SETTLEMENT_COMPLAINT_RADIUS);
  }
  private record(v: DiplomaticAffair, text: string): void { this.c.record(v.from, v.to, text); }
  private followup(v: DiplomaticAffair, text: string): void {
    this.record(v, text);
    if (this.c.interactive() && (this.c.isHuman(v.from) || this.c.isHuman(v.to))) {
      this.c.notify?.(this.c.isHuman(v.from) ? v.to : v.from, text);
    }
  }
  private names(v: DiplomaticAffair): [string, string] { return [this.c.name(v.from), this.c.name(v.to)]; }

  onCityFounded(city: AffairCity): void {
    const p = { x: city.tileX, y: city.tileY };
    const brokenPairs = new Set<string>();
    for (const v of this.affairs) {
      if (v.status !== 'promised' || v.to !== city.ownerId || this.c.round() >= v.promiseUntil!) continue;
      if (!this.eligible(v.from, v.to) || !this.near(p, v.anchors)) continue;
      v.status = 'broken';
      brokenPairs.add(v.from);
      this.c.changeRelation(v.from, v.to, -15, 12);
      this.followup(v, `${this.c.name(v.to)} broke its settlement promise to ${this.c.name(v.from)} by founding ${city.name}. Trust -15, hostility +12.`);
    }
    // Starting capitals and scenario-loaded cities never create complaints.
    if (city.isOriginalCapital) return;
    for (const neighbor of this.c.nations()) {
      if (!this.eligible(neighbor, city.ownerId) || brokenPairs.has(neighbor)) continue;
      const anchors = this.c.cities().filter(c => c.ownerId === neighbor)
        .map(c => ({ x: c.tileX, y: c.tileY })).filter(a => this.near(p, [a]));
      if (!anchors.length) continue;
      this.incidents.push({ cityId: city.id, owner: city.ownerId, neighbor, round: this.c.round(), anchors, used: false });
    }
    this.processComplaints();
  }

  complaintReason(from: string, to: string): string | undefined {
    if (!this.available(from, to, 'settlement')) return 'A request or promise is already active, relations are unavailable, or the 20-round cooldown has not ended.';
    if (!this.findIncident(from, to)) return 'No known city founded within 6 tiles of your cities in the last 10 rounds.';
    return undefined;
  }
  private findIncident(from: string, to: string): Incident | undefined {
    return [...this.incidents].reverse().find(i => i.neighbor === from && i.owner === to && !i.used
      && this.c.round() - i.round < INCIDENT_TURNS && this.c.cities().some(c => c.id === i.cityId && c.ownerId === to && this.c.knowsCity(from, c)));
  }
  complain(from: string, to: string): DiplomaticAffair | undefined {
    if (this.complaintReason(from, to)) return;
    const i = this.findIncident(from, to)!;
    const city = this.c.cities().find(c => c.id === i.cityId)!;
    i.used = true;
    const v = this.create('settlement', from, to);
    v.cityId = city.id; v.cityName = city.name; v.anchors = i.anchors.map(a => ({ ...a }));
    // BorderPressureSystem owns ongoing proximity penalties. This request adds
    // consequences only for the response and the subsequent promise.
    this.record(v, `${this.c.name(from)} protested the founding of ${city.name} and requested a ${SETTLEMENT_PROMISE_TURNS}-round pause in nearby settlement.`);
    this.deliver(v);
    return v;
  }
  moneyReason(from: string, to: string): string | undefined {
    if (!this.available(from, to, 'money')) return 'Money requests require peace, contact, and 20 rounds between requests.';
    if (this.c.gold(to) < this.moneyAmount(from)) return 'This nation cannot afford the requested amount.';
    return undefined;
  }
  moneyAmount(from: string): number { return Math.max(25, Math.min(100, Math.ceil(Math.max(0, 100 - this.c.gold(from)) / 5) * 5)); }
  requestMoney(from: string, to: string): DiplomaticAffair | undefined {
    if (this.moneyReason(from, to)) return;
    const v = this.create('money', from, to);
    v.amount = this.moneyAmount(from);
    this.record(v, `${this.c.name(from)} asked ${this.c.name(to)} for ${v.amount} gold, with no repayment obligation.`);
    this.deliver(v);
    return v;
  }
  private create(kind: DiplomaticAffair['kind'], from: string, to: string): DiplomaticAffair {
    const n = this.nextId++;
    const v: DiplomaticAffair = { id: `affair_${n}`, kind, from, to, created: this.c.round(), expires: this.c.round() + AFFAIR_RESPONSE_TURNS,
      status: 'pending', amount: 50, anchors: [], line: (n - 1) % MONEY_LINES.length };
    this.affairs.push(v);
    this.cooldowns.set(this.key(from, to, kind), this.c.round() + AFFAIR_COOLDOWN_TURNS);
    return v;
  }
  private deliver(v: DiplomaticAffair): void {
    if (this.c.isHuman(v.to) && this.c.interactive()) this.c.present(this.proposal(v));
    else this.respondAI(v);
  }
  private respondAI(v: DiplomaticAffair): void {
    const r = this.c.relation(v.to, v.from);
    const willing = r.trust + this.c.diplomacyBias(v.to) - r.hostility;
    const choice = v.kind === 'money'
      ? (willing >= 45 && this.c.gold(v.to) >= v.amount * 3 ? 'accept' : 'reject')
      : willing >= 35 ? 'accept' : willing >= 10 && this.c.gold(v.to) >= v.amount * 2 ? 'compromise' : 'reject';
    this.resolve(v.id, choice);
  }
  private requestStillRelevant(v: DiplomaticAffair): boolean {
    return v.kind !== 'settlement' || this.c.cities().some(city => city.id === v.cityId && city.ownerId === v.to);
  }
  resolve(id: string, choice: 'accept' | 'reject' | 'compromise'): boolean {
    const v = this.affairs.find(a => a.id === id);
    if (!v || v.status !== 'pending') return true;
    if (!this.eligible(v.from, v.to) || !this.requestStillRelevant(v) || this.c.round() >= v.expires) { this.close(v, 'cancelled'); return true; }
    if (choice === 'compromise' && v.kind !== 'settlement') return false;
    const [from, to] = this.names(v);
    if (choice === 'reject') {
      v.status = 'rejected';
      if (v.kind === 'settlement') this.c.changeRelation(v.from, v.to, -2, 4);
      this.record(v, `${to} declined ${from}'s ${v.kind === 'money' ? 'request for money. No relation penalty.' : 'settlement complaint. Trust -2, hostility +4.'}`);
    } else if (v.kind === 'money' || choice === 'compromise') {
      if (this.c.gold(v.to) < v.amount) return false;
      this.c.addGold(v.to, -v.amount); this.c.addGold(v.from, v.amount);
      v.status = 'paid';
      this.c.changeRelation(v.from, v.to, v.kind === 'money' ? 3 : 0, v.kind === 'settlement' ? -2 : 0);
      this.record(v, v.kind === 'money' ? `${to} gave ${from} ${v.amount} gold. No debt was created. Trust +3.`
        : `${to} paid ${from} ${v.amount} gold to settle the complaint over ${v.cityName}. No settlement promise was made. Hostility -2.`);
    } else {
      v.status = 'promised'; v.promiseUntil = this.c.round() + SETTLEMENT_PROMISE_TURNS;
      this.record(v, `${to} promised ${from} not to found another city within ${SETTLEMENT_COMPLAINT_RADIUS} tiles of the affected cities until round ${v.promiseUntil}.`);
    }
    this.c.dismiss(v.id);
    return true;
  }
  private close(v: DiplomaticAffair, status: 'cancelled' | 'expired'): void {
    v.status = status; this.c.dismiss(v.id);
    this.record(v, `${this.c.name(v.from)}–${this.c.name(v.to)}: ${v.kind === 'settlement' ? 'settlement request or promise' : 'money request'} ${status}.`);
  }
  private processComplaints(): void {
    for (const i of this.incidents) {
      if (this.c.isHuman(i.neighbor)) continue;
      this.complain(i.neighbor, i.owner);
    }
  }
  update(): void {
    for (const v of this.affairs) {
      if (!['pending', 'promised'].includes(v.status)) continue;
      if (!this.eligible(v.from, v.to)) { this.close(v, 'cancelled'); continue; }
      if (v.status === 'pending' && !this.requestStillRelevant(v)) { this.close(v, 'cancelled'); continue; }
      if (v.status === 'pending' && this.c.round() >= v.expires) { this.close(v, 'expired'); continue; }
      if (v.status === 'pending' && !this.c.interactive()) { this.respondAI(v); continue; }
      if (v.status === 'promised' && this.c.round() >= v.promiseUntil!) {
        v.status = 'kept'; this.c.changeRelation(v.from, v.to, 5, -3);
        this.followup(v, `${this.c.name(v.to)} kept its settlement promise to ${this.c.name(v.from)}. Trust +5, hostility -3.`);
      }
    }
    this.incidents = this.incidents.filter(i => this.c.round() - i.round < INCIDENT_TURNS);
    this.processComplaints();
    // One unsolicited request globally every ten rounds, only for real need.
    if (this.c.round() - this.lastMoneyRound < 10) return;
    for (const from of this.c.nations()) {
      if (this.c.isHuman(from) || !this.c.active(from) || this.c.gold(from) >= 50) continue;
      const to = this.c.nations().filter(id => this.eligible(from, id) && this.c.gold(id) >= 150
        && this.c.relation(from, id).trust >= 40 && !this.affairs.some(v => v.to === id && v.status === 'pending'))
        .sort((a, b) => Number(this.c.isHuman(b)) - Number(this.c.isHuman(a)) || a.localeCompare(b))
        .find(id => !this.moneyReason(from, id));
      if (to && this.requestMoney(from, to)) { this.lastMoneyRound = this.c.round(); break; }
    }
  }
  canAISettle(nation: string, x: number, y: number): boolean {
    return !this.affairs.some(v => v.status === 'promised' && v.to === nation && this.c.round() < v.promiseUntil!
      && this.eligible(v.from, v.to) && this.near({ x, y }, v.anchors));
  }
  summary(from: string, to: string): string[] {
    return this.affairs.filter(v => (v.from === from && v.to === to || v.from === to && v.to === from)
      && ['pending', 'promised'].includes(v.status)).map(v => v.status === 'promised'
      ? `${this.c.name(v.to)}: no new cities within 6 tiles of the affected cities near ${v.cityName} until round ${v.promiseUntil}.`
      : `${this.c.name(v.from)} awaits a reply about ${v.kind === 'money' ? `${v.amount} gold` : v.cityName} (round ${v.expires}).`);
  }
  proposal(v: DiplomaticAffair): DiplomaticProposal {
    return { id: v.id, fromNationId: v.from, toNationId: v.to, kind: 'diplomatic_affair', createdTurn: v.created, expiresTurn: v.expires, status: 'pending',
      payload: { kind: 'diplomatic_affair', body: v.kind === 'money'
        ? `${MONEY_LINES[v.line % MONEY_LINES.length]!.replace('{amount}', String(v.amount))}\n\nSend ${v.amount} gold permanently. No repayment. Trust +3; declining has no penalty.`
        : `Your new city, ${v.cityName}, is uncomfortably close. Give our frontier some breathing room.\n\nPromise: for 20 rounds, found no new cities within 6 tiles of our affected cities. Existing cities stay.\nKept: trust +5, hostility -3. Broken: trust -15, hostility +12.\nDecline: trust -2, hostility +4.\nAlternatively pay ${v.amount} gold to settle this complaint, with no promise (hostility -2).`,
        acceptLabel: v.kind === 'money' ? `Send ${v.amount} gold` : 'Promise (20 rounds)',
        compromiseLabel: v.kind === 'settlement' ? `Settle: ${v.amount} gold` : undefined } };
  }
  serialize(): SavedDiplomaticAffairs {
    return structuredClone({ nextId: this.nextId, affairs: this.affairs, incidents: this.incidents, cooldowns: [...this.cooldowns], lastMoneyRound: this.lastMoneyRound });
  }
  restore(state?: SavedDiplomaticAffairs): void {
    for (const v of this.affairs) if (v.status === 'pending') this.c.dismiss(v.id);
    const saved = state ? structuredClone(state) : undefined;
    this.affairs = saved?.affairs ?? []; this.incidents = saved?.incidents ?? [];
    this.nextId = saved?.nextId ?? 1; this.cooldowns = new Map(saved?.cooldowns ?? []); this.lastMoneyRound = saved?.lastMoneyRound ?? -100;
    // Restore UI only. No turns, transfers or relationship effects are replayed.
    for (const v of this.affairs) if (v.status === 'pending' && this.c.isHuman(v.to) && this.c.interactive()) this.c.present(this.proposal(v));
  }
}
