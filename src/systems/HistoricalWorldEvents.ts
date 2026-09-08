import type { ScenarioTimedHistoricalEvent, ScenarioWorldEventType } from '../types/scenario';
import type { ScenarioHistoricalEventRuntimeState } from './ScenarioHistoricalEventSystem';
import type { CityEconomySummary } from './CityEconomy';
import { SeededRandom } from './procedural/SeededRandom';

export const ENERGY_RESOURCE_IDS = ['coal', 'natural_gas', 'oil', 'uranium'] as const;
export const WORLD_EVENT_DEFINITIONS = {
  stockMarketCrash: { name: 'Stock Market Crash', image: 'stock-market-crash.png', duration: 25, goldReductionPercent: 50, happinessPenalty: -20 },
  famine: { name: 'Famine', image: 'famine.png', duration: 25, foodReductionPercent: 50, diplomaticScoreReward: 100 },
  pandemic: { name: 'Pandemic', image: 'pandemic.png', duration: 25, happinessPenalty: -20 },
  energyCrisis: { name: 'Global Energy Crisis', image: 'energy-crisis.png', duration: 25, energyPriceIncreasePercent: 25 },
} as const;
export function isWorldEvent(type: string): type is ScenarioWorldEventType {
  return Object.prototype.hasOwnProperty.call(WORLD_EVENT_DEFINITIONS, type);
}
export interface HumanitarianEmergency {
  commitments: Record<string, number>;
  contributed: Record<string, number>;
  rewarded: Record<string, number>;
  /** Food needed to replace the recipient's initial lost production over the event. */
  requiredFood: number;
}
export interface WorldEventState extends ScenarioHistoricalEventRuntimeState {
  type: ScenarioWorldEventType;
  parameters: ScenarioTimedHistoricalEvent;
  targets: string[];
  origin?: string;
  endRound: number;
  emergency?: HumanitarianEmergency;
}
export interface SavedWorldEvents {
  events: WorldEventState[];
  energyMultipliers: Record<string, number>;
  foodInTransit: Record<string, number>;
  accountedRound: Record<string, number>;
}
export interface HistoricalWorldEventContext {
  seed: string;
  nations(): string[];
  strongestCurrencies(): string[];
  population(nationId: string): number;
  foodSituation(nationId: string): { production: number; consumption: number };
  embassy(a: string, b: string): boolean;
  cancelTrade(targets: string[], resources?: readonly string[]): number;
  cancelBorders(targets: string[]): number;
  councilExists(): boolean;
  createEmergency(target: string): void;
  awardScore(nationId: string, amount: number): boolean | void;
  chooseAid(nationId: string, recipient: string, affordablePercent: number): number;
  requestHumanAid?(eventId: string, recipient: string): void;
  humanNationId?: string;
  article(event: WorldEventState, phase: 'started' | 'ended' | 'aid'): void;
  changed(): void;
  log(message: string): void;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;

/** Timed effects owned by the scenario historical-event coordinator. No parallel economy. */
export class HistoricalWorldEvents {
  private states: WorldEventState[] = [];
  private energyMultipliers: Record<string, number> = {};
  private foodInTransit: Record<string, number> = {};
  private accountedRound: Record<string, number> = {};
  constructor(private readonly context: HistoricalWorldEventContext) {}
  getStates(): WorldEventState[] { return clone(this.states); }
  hasTriggered(id: string): boolean { return this.states.some(s => s.eventId === id); }
  start(definition: ScenarioTimedHistoricalEvent, round: number, date: ScenarioHistoricalEventRuntimeState['triggeredDate']): void {
    if (this.hasTriggered(definition.id)) return;
    const p = { ...WORLD_EVENT_DEFINITIONS[definition.type], ...definition };
    p.duration = Math.floor(bounded(p.duration, 25, 1, 100000));
    p.goldReductionPercent = bounded(p.goldReductionPercent, 50, 0, 100);
    p.foodReductionPercent = bounded(p.foodReductionPercent, 50, 0, 100);
    p.happinessPenalty = bounded(p.happinessPenalty, -20, -10000, 0);
    p.diplomaticScoreReward = bounded(p.diplomaticScoreReward, 100, 0, 100000);
    p.energyPriceIncreasePercent = bounded(p.energyPriceIncreasePercent, 25, 0, 10000);
    const nations = [...this.context.nations()].sort();
    let targets: string[] = [];
    let origin: string | undefined;
    switch (p.type) {
      case 'stockMarketCrash': targets = this.context.strongestCurrencies().filter(id => nations.includes(id)).slice(0, 2); break;
      case 'famine': targets = [...nations].sort((a,b) => this.context.population(b) - this.context.population(a) || a.localeCompare(b)).slice(0,1); break;
      case 'pandemic':
        if (nations.length) {
          origin = new SeededRandom(`${this.context.seed}|${p.id}|${round}`).pick(nations);
          targets = nations.filter(id => id === origin || this.context.embassy(origin!, id) || this.context.embassy(id, origin!));
        }
        break;
      case 'energyCrisis': targets = nations; break;
    }
    const initialFood = p.type === 'famine' && targets.length ? this.context.foodSituation(targets[0]).production * this.foodMultiplier(targets[0]) : 0;
    const state: WorldEventState = { eventId: p.id, type: p.type, parameters: p, status: 'active', targets, origin,
      triggeredRound: round, triggeredDate: date, endRound: round + p.duration - 1 };
    this.states.push(state);
    if (!targets.length) {
      state.status = 'completed'; state.completedRound = round; state.completedDate = date;
      this.log(`${p.id}/${p.type} skipped: no eligible active nations`); return;
    }
    this.log(`started ${p.id}/${p.type} parameters=${JSON.stringify(p)} targets=${targets.join(',')} origin=${origin ?? '-'} spread=${targets.join(',')}`);
    if (p.type === 'pandemic' || p.type === 'energyCrisis') {
      const contracts = this.context.cancelTrade(targets, p.type === 'energyCrisis' ? ENERGY_RESOURCE_IDS : undefined);
      const borders = p.type === 'pandemic' ? this.context.cancelBorders(targets) : 0;
      this.log(`${p.id} contracts cancelled=${contracts} Open Borders cancelled=${borders}`);
    }
    this.context.article(state, 'started');
    if (p.type === 'famine' && this.context.councilExists()) {
      const target = targets[0];
      state.emergency = { commitments: {}, contributed: {}, rewarded: {}, requiredFood: Math.max(1,
        initialFood * p.foodReductionPercent / 100 * p.duration) };
      this.context.createEmergency(target);
      this.log(`${p.id} humanitarian emergency created recipient=${target}`);
      for (const id of nations.filter(id => id !== target && id !== this.context.humanNationId)) {
        const food = this.context.foodSituation(id);
        food.production *= this.foodMultiplier(id);
        const alreadyCommitted = this.states.reduce((sum, other) => sum + (other.status === 'active' ? other.emergency?.commitments[id] ?? 0 : 0), 0);
        const affordable = food.production > 0 ? Math.max(0, (food.production - food.consumption) / food.production * 100 - alreadyCommitted) : 0;
        this.setDonation(p.id, id, Math.min(affordable, this.context.chooseAid(id, target, affordable)));
      }
      this.context.article(state, 'aid');
      this.context.requestHumanAid?.(p.id, target);
    }
    this.context.changed();
  }
  endRound(round: number, date: ScenarioHistoricalEventRuntimeState['completedDate']): void {
    for (const s of this.states) {
      if (s.status !== 'active' || round < s.endRound) continue;
      s.status = 'completed'; s.completedRound = round; s.completedDate = date;
      if (s.type === 'energyCrisis') {
        for (const id of ENERGY_RESOURCE_IDS) this.energyMultipliers[id] = this.priceMultiplier(id) * (1 + s.parameters.energyPriceIncreasePercent! / 100);
        this.log(`${s.eventId} persistent consequence applied energy multipliers=${JSON.stringify(this.energyMultipliers)}`);
      }
      this.context.article(s, 'ended');
      this.log(`ended ${s.eventId}/${s.type}`);
      this.context.changed();
    }
  }
  happiness(nation: string): number {
    return this.activeFor(nation).reduce((sum,s) => sum + (s.type === 'stockMarketCrash' || s.type === 'pandemic' ? s.parameters.happinessPenalty! : 0), 0);
  }
  gold(nation: string, income: number): number {
    return income <= 0 ? income : this.activeFor(nation).reduce((value,s) => s.type === 'stockMarketCrash' ? value * (1-s.parameters.goldReductionPercent!/100) : value, income);
  }
  foodMultiplier(nation: string): number {
    return this.activeFor(nation).reduce((value, event) => event.type === 'famine'
      ? value * (1-event.parameters.foodReductionPercent!/100) : value, 1);
  }
  priceMultiplier(resource: string): number { return this.energyMultipliers[resource] ?? 1; }
  setDonation(eventId: string, nation: string, percent: number): boolean {
    const s = this.states.find(s => s.eventId === eventId && s.status === 'active');
    if (!s?.emergency || s.targets.includes(nation) || !this.context.nations().includes(nation)) return false;
    const other = this.states.reduce((sum, e) => sum + (e !== s && e.status === 'active' ? e.emergency?.commitments[nation] ?? 0 : 0), 0);
    s.emergency.commitments[nation] = bounded(percent, 0, 0, Math.max(0, 100-other));
    this.context.changed();
    return true;
  }
  /** Pure previews; committed turn settlement debits production before consumption and queues identical aid. */
  processFood(nation: string, economies: CityEconomySummary[], round: number, commit: boolean): void {
    const multiplier = this.foodMultiplier(nation);
    const aid = this.context.councilExists() ? this.states.filter(s => s.status === 'active' && s.emergency && this.context.nations().includes(s.targets[0])) : [];
    const fresh = this.accountedRound[nation] !== round;
    const incoming = !commit || fresh ? this.foodInTransit[nation] ?? 0 : 0;
    if (commit && fresh && economies.length) this.foodInTransit[nation] = 0;
    const total = economies.reduce((sum,e) => sum + Math.max(0,e.food)*multiplier,0);
    const donated = aid.reduce((sum,s) => sum + (s.emergency!.commitments[nation] ?? 0)/100,0);
    for (const e of economies) {
      e.food = Math.min(0,e.food) + Math.max(0,e.food)*multiplier*(1-donated) + incoming/Math.max(1,economies.length);
      e.netFood = e.food-e.foodConsumption;
    }
    if (!commit || !fresh || !economies.length) return;
    this.accountedRound[nation] = round;
    for (const s of aid) {
      const emergency = s.emergency!;
      const amount = total*(emergency.commitments[nation] ?? 0)/100;
      if (amount <= 0) continue;
      const recipient = s.targets[0];
      this.foodInTransit[recipient] = (this.foodInTransit[recipient] ?? 0)+amount;
      emergency.contributed[nation] = (emergency.contributed[nation] ?? 0)+amount;
      const earned = Math.floor(s.parameters.diplomaticScoreReward! * Math.min(1, emergency.contributed[nation]/emergency.requiredFood));
      const previous = emergency.rewarded[nation] ?? 0;
      if (earned > previous && this.context.awardScore(nation, earned-previous) !== false) {
        emergency.rewarded[nation] = earned;
      }
      if (previous === 0 && earned > 0) this.log(`${s.eventId} meaningful Food donation nation=${nation} cumulative=${emergency.contributed[nation]} score=${earned}`);
    }
  }
  serialize(): SavedWorldEvents { return clone({ events:this.states, energyMultipliers:this.energyMultipliers, foodInTransit:this.foodInTransit, accountedRound:this.accountedRound }); }
  restore(saved?: SavedWorldEvents): void {
    const data = saved ? clone(saved) : undefined;
    this.states = data?.events ?? []; this.energyMultipliers = data?.energyMultipliers ?? {};
    this.foodInTransit = data?.foodInTransit ?? {}; this.accountedRound = data?.accountedRound ?? {};
    this.context.changed();
  }
  private activeFor(nation: string): WorldEventState[] { return this.states.filter(s => s.status === 'active' && s.targets.includes(nation)); }
  private log(message: string): void { this.context.log(`[HistoricalEvent] ${message}`); }
}
