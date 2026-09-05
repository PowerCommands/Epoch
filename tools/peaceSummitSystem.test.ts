import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PeaceSummitSystem,
  SUMMIT_MIN_DELAY_TURNS,
  type PeaceSummitDeps,
  type PeaceSummitEvent,
} from '../src/systems/diplomacy/PeaceSummitSystem.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { PeaceTreatySystem } from '../src/systems/PeaceTreatySystem.ts';

interface FakeCity { id: string; name: string; ownerId: string; isCapital: boolean }

const CITIES: FakeCity[] = [
  { id: 'eng_cap', name: 'London', ownerId: 'ENG', isCapital: true },
  { id: 'fra_cap', name: 'Paris', ownerId: 'FRA', isCapital: true },
  { id: 'swe_cap', name: 'Stockholm', ownerId: 'SWE', isCapital: true },
];

class FakeDiplomacy {
  private state = new Map<string, 'WAR' | 'PEACE'>();
  private warStart = new Map<string, number>();
  minTurns = 15;
  proposed: { from: string; to: string; terms: unknown }[] = [];
  private key(a: string, b: string): string { return [a, b].sort().join('|'); }
  setWar(a: string, b: string, turn: number): void {
    this.state.set(this.key(a, b), 'WAR');
    this.warStart.set(this.key(a, b), turn);
  }
  makePeace(a: string, b: string): void { this.state.set(this.key(a, b), 'PEACE'); }
  getState(a: string, b: string): 'WAR' | 'PEACE' { return this.state.get(this.key(a, b)) ?? 'PEACE'; }
  getMinPeaceNegotiationTurns(): number { return this.minTurns; }
  getWarDuration(a: string, b: string, turn: number): number {
    if (this.getState(a, b) !== 'WAR') return 0;
    return turn - (this.warStart.get(this.key(a, b)) ?? turn);
  }
  canProposePeace(a: string, b: string, turn: number): boolean {
    return this.getState(a, b) === 'WAR' && this.getWarDuration(a, b, turn) >= this.minTurns;
  }
  proposePeace(from: string, to: string, terms: unknown): void { this.proposed.push({ from, to, terms }); }
}

/** interestedRecipients: nations whose war pressure is high enough to negotiate. */
function makeSystem(opts: {
  turn: { value: number };
  humans?: Set<string>;
  interested?: Set<string>;
  rollValues?: Record<string, number>;
  onEvent?: (e: PeaceSummitEvent) => void;
}): { system: PeaceSummitSystem; diplomacy: FakeDiplomacy } {
  const diplomacy = new FakeDiplomacy();
  const cityManager = {
    getCitiesByOwner: (id: string) => CITIES.filter((c) => c.ownerId === id),
    getAllCities: () => CITIES,
    getCity: (id: string) => CITIES.find((c) => c.id === id),
  } as unknown as CityManager;
  const interested = opts.interested ?? new Set<string>();
  const peaceTreatySystem = {
    evaluateAIPeaceSeeking: (recipient: string) => ({
      shouldInitiate: false,
      warPressure: interested.has(recipient) ? 0.9 : 0.05,
      strategicDisadvantage: 0,
      factors: {},
    }),
    buildAIPeaceProposal: (from: string, to: string, warDuration: number) => ({
      proposal: { fromNationId: from, toNationId: to, warDuration, goldReparations: 10 },
      seeking: { shouldInitiate: true, warPressure: 0.9, strategicDisadvantage: 0, factors: {} },
      intendedSettlementValue: 0,
      recipientAcceptanceThreshold: 0,
    }),
  } as unknown as PeaceTreatySystem;
  const deps: PeaceSummitDeps = {
    diplomacyManager: diplomacy as unknown as DiplomacyManager,
    nationManager: {} as unknown as NationManager,
    cityManager,
    peaceTreatySystem,
    getCurrentTurn: () => opts.turn.value,
    isHuman: (id) => opts.humans?.has(id) ?? false,
    roll: (seed) => {
      for (const [prefix, value] of Object.entries(opts.rollValues ?? {})) {
        if (seed.startsWith(prefix)) return value;
      }
      return 0; // default → min delay, and "accept" for interested responders
    },
  };
  const system = new PeaceSummitSystem(deps);
  if (opts.onEvent) system.onSummitEvent(opts.onEvent);
  return { system, diplomacy };
}

test('eligibility respects the scenario minimum war duration', () => {
  const turn = { value: 10 };
  const { system, diplomacy } = makeSystem({ turn });
  diplomacy.setWar('ENG', 'FRA', 0);
  assert.equal(system.canInitiateSummit('ENG', 'FRA', 10), false); // only 10 < 15 turns
  turn.value = 15;
  assert.equal(system.canInitiateSummit('ENG', 'FRA', 15), true);
});

test('accepted proposal starts a ceasefire that suppresses combat but keeps war', () => {
  const turn = { value: 20 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set(['FRA']),
    rollValues: { 'summit-response': 0.1 /* accept */ },
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  const record = system.initiateSummit('ENG', 'FRA');
  assert.ok(record);
  assert.equal(system.isCeasefireActive('ENG', 'FRA'), true);
  assert.equal(system.isCombatSuppressed('ENG', 'FRA'), true);
  assert.equal(diplomacy.getState('ENG', 'FRA'), 'WAR'); // still formally at war
  assert.deepEqual(events.map((e) => e.kind), ['proposed', 'agreed']);
  const agreed = system.getSummit('ENG', 'FRA');
  assert.equal(agreed?.summitTurn, turn.value + SUMMIT_MIN_DELAY_TURNS);
});

test('summit reached at the agreed turn conducts an AI peace offer', () => {
  const turn = { value: 20 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set(['FRA']),
    rollValues: { 'summit-response': 0.1 },
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const summitTurn = system.getSummit('ENG', 'FRA')!.summitTurn;

  turn.value = summitTurn - 1;
  system.handleRoundStart(turn.value);
  assert.equal(diplomacy.proposed.length, 0); // not yet

  turn.value = summitTurn;
  system.handleRoundStart(turn.value);
  assert.equal(diplomacy.proposed.length, 1); // existing peace framework invoked
  assert.equal(diplomacy.proposed[0].from, 'ENG');

  // GameScene would settle the accepted peace; simulate the resulting event.
  diplomacy.makePeace('ENG', 'FRA');
  system.handlePeaceAccepted('ENG', 'FRA');
  assert.equal(system.getSummit('ENG', 'FRA'), null);
  assert.ok(events.some((e) => e.kind === 'peaceReached'));
});

test('failed negotiation lifts the ceasefire and starts the cooldown', () => {
  const turn = { value: 20 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set(['FRA']),
    rollValues: { 'summit-response': 0.1 },
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const summitTurn = system.getSummit('ENG', 'FRA')!.summitTurn;
  turn.value = summitTurn;
  system.handleRoundStart(turn.value);
  // Recipient rejects the offer at the summit.
  system.handlePeaceDeclined('ENG', 'FRA');

  assert.equal(system.isCeasefireActive('ENG', 'FRA'), false);
  assert.equal(diplomacy.getState('ENG', 'FRA'), 'WAR'); // war resumes
  assert.ok(events.some((e) => e.kind === 'negotiationsFailed'));
  // Cooldown = minTurns from the failure turn.
  assert.equal(system.canInitiateSummit('ENG', 'FRA', turn.value), false);
  assert.equal(system.canInitiateSummit('ENG', 'FRA', turn.value + 15), true);
});

test('AI counterproposal prefers a neutral city and returns to the initiator', () => {
  const turn = { value: 30 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set(['FRA', 'ENG']),
    // FRA (recipient) counters; ENG (initiator) then accepts the counter.
    rollValues: { 'summit-response': 0.7 /* counter */, 'summit-counter-response': 0.1 /* accept */ },
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const kinds = events.map((e) => e.kind);
  assert.deepEqual(kinds, ['proposed', 'counterproposed', 'agreed']);
  const record = system.getSummit('ENG', 'FRA')!;
  assert.equal(record.cityId, 'swe_cap'); // neutral Stockholm
  assert.equal(record.cityOwnerNationId, 'SWE');
  assert.equal(record.counterproposed, true);
  assert.equal(system.isCeasefireActive('ENG', 'FRA'), true);
});

test('rejected proposal ends the summit and paces the next attempt', () => {
  const turn = { value: 30 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set<string>(), // FRA not interested → rejects
    rollValues: { 'summit-response': 0.9 },
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  assert.ok(events.some((e) => e.kind === 'rejected'));
  assert.equal(system.getSummit('ENG', 'FRA'), null);
  assert.equal(system.canInitiateSummit('ENG', 'FRA', turn.value), false); // cooldown
});

test('human recipient decision is deferred, not auto-resolved', () => {
  const turn = { value: 20 };
  const events: PeaceSummitEvent[] = [];
  const { system, diplomacy } = makeSystem({
    turn,
    humans: new Set(['FRA']),
    onEvent: (e) => events.push(e),
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const proposed = events.find((e) => e.kind === 'proposed');
  assert.ok(proposed && proposed.kind === 'proposed' && proposed.needsHumanResponse);
  assert.equal(system.getSummit('ENG', 'FRA')?.phase, 'awaitingResponse'); // waiting on human
  system.respondAsHuman('FRA', 'ENG', true);
  assert.equal(system.isCeasefireActive('ENG', 'FRA'), true);
});

test('acceptance preserves the city and meeting turn that were proposed', () => {
  const turn = { value: 20 };
  const { system, diplomacy } = makeSystem({
    turn,
    humans: new Set(['FRA']),
    // A second delay roll at acceptance would move the meeting from +3 to +6.
    rollValues: { 'summit-delay': 0 },
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  const proposed = system.initiateSummit('ENG', 'FRA')!;
  const proposedTurn = proposed.summitTurn;
  const proposedCity = proposed.cityId;

  turn.value += 1;
  system.respondAsHuman('FRA', 'ENG', true);

  const agreed = system.getSummit('ENG', 'FRA')!;
  assert.equal(agreed.summitTurn, proposedTurn);
  assert.equal(agreed.cityId, proposedCity);
});

test('only the current recipient may answer a summit proposal', () => {
  const turn = { value: 20 };
  const { system, diplomacy } = makeSystem({ turn, humans: new Set(['FRA']) });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');

  system.respondAsHuman('ENG', 'FRA', true);
  assert.equal(system.getSummit('ENG', 'FRA')?.phase, 'awaitingResponse');

  system.respondAsHuman('FRA', 'ENG', true);
  assert.equal(system.getSummit('ENG', 'FRA')?.phase, 'ceasefire');
});

test('save/load round-trips active summits, ceasefires and cooldowns', () => {
  const turn = { value: 20 };
  const { system, diplomacy } = makeSystem({
    turn,
    interested: new Set(['FRA']),
    rollValues: { 'summit-response': 0.1 },
  });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const snapshot = JSON.parse(JSON.stringify(system.serialize()));

  const restoredTurn = { value: 20 };
  const { system: restored } = makeSystem({ turn: restoredTurn, interested: new Set(['FRA']) });
  restored.restore(snapshot);
  assert.equal(restored.isCeasefireActive('ENG', 'FRA'), true);
  const before = system.getSummit('ENG', 'FRA');
  const after = restored.getSummit('ENG', 'FRA');
  assert.equal(after?.summitTurn, before?.summitTurn);
  assert.equal(after?.cityId, before?.cityId);
});

test('save/load re-surfaces an awaiting human response', () => {
  const turn = { value: 20 };
  const { system, diplomacy } = makeSystem({ turn, humans: new Set(['FRA']) });
  diplomacy.setWar('ENG', 'FRA', 0);
  system.initiateSummit('ENG', 'FRA');
  const snapshot = system.serialize();

  const restoredEvents: PeaceSummitEvent[] = [];
  const { system: restored } = makeSystem({
    turn,
    humans: new Set(['FRA']),
    onEvent: (event) => restoredEvents.push(event),
  });
  restored.restore(snapshot);

  const proposed = restoredEvents.find((event) => event.kind === 'proposed');
  assert.ok(proposed && proposed.needsHumanResponse);
  restored.respondAsHuman('FRA', 'ENG', true);
  assert.equal(restored.isCeasefireActive('ENG', 'FRA'), true);
});

test('old saves without summit state load cleanly', () => {
  const turn = { value: 5 };
  const { system } = makeSystem({ turn });
  system.restore(undefined);
  assert.equal(system.getSummit('ENG', 'FRA'), null);
});
