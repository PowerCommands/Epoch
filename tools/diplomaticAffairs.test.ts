import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiplomaticAffairSystem, type AffairCity, type AffairContext } from '../src/systems/diplomacy/DiplomaticAffairSystem';
import type { DiplomaticProposal } from '../src/systems/diplomacy/DiplomaticProposal';

function fixture() {
  const state = { round: 50, interactive: true, war: false, trust: 60, hostility: 0, bias: 0, known: true, eliminated: false };
  const cities: AffairCity[] = [{ id: 'a-cap', name: 'Oldport', ownerId: 'a', tileX: 0, tileY: 0, isOriginalCapital: true },
    { id: 'h-cap', name: 'Home', ownerId: 'h', tileX: 15, tileY: 0, isOriginalCapital: true }];
  const gold: Record<string, number> = { a: 500, h: 500 };
  const records: string[] = [], changes: number[][] = [], shown: DiplomaticProposal[] = [], dismissed: string[] = [];
  const context: AffairContext = {
    round: () => state.round, nations: () => ['a', 'h'], name: id => id,
    isHuman: id => id === 'h', interactive: () => state.interactive,
    active: () => !state.eliminated, haveMet: () => true, atWar: () => state.war,
    cities: () => cities, knowsCity: () => state.known,
    distance: (a, b) => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.x+a.y-b.x-b.y)),
    gold: id => gold[id]!, addGold: (id, amount) => { gold[id]! += amount; },
    relation: () => ({ trust: state.trust, hostility: state.hostility }), diplomacyBias: () => state.bias,
    changeRelation: (_a, _b, t, h) => { changes.push([t, h]); },
    record: (_a, _b, text) => { records.push(text); }, present: p => { shown.push(p); }, dismiss: id => { dismissed.push(id); },
  };
  const system = new DiplomaticAffairSystem(context);
  let id = 0;
  const found = (owner = 'h', x = 5, y = 0) => {
    const city: AffairCity = { id: `new-${id++}`, name: `New City ${id}`, ownerId: owner, tileX: x, tileY: y };
    cities.push(city); system.onCityFounded(city); return city;
  };
  return { state, cities, gold, records, changes, shown, dismissed, context, system, found };
}

test('nearby founding produces a meaningful human request; distant cities and capitals do not', () => {
  const f = fixture();
  f.system.onCityFounded(f.cities[0]!); f.found('h', 30); assert.equal(f.shown.length, 0);
  f.found(); assert.equal(f.shown.length, 1);
  const p = f.shown[0]!; assert.equal(p.payload.kind, 'diplomatic_affair');
  if (p.payload.kind === 'diplomatic_affair') assert.match(p.payload.body, /20 rounds/);
  assert.deepEqual(f.changes, []); // Existing border pressure owns proximity penalties.
});

test('promise is directional, regional, expires exactly, and rewards only once', () => {
  const f = fixture(); f.found(); f.system.resolve(f.shown[0]!.id, 'accept');
  assert.equal(f.system.canAISettle('h', 6, 0), false);
  assert.equal(f.system.canAISettle('h', 7, 0), true);
  assert.equal(f.system.canAISettle('a', 5, 0), true);
  f.state.round = 69; f.system.update(); assert.deepEqual(f.changes, []);
  f.state.round = 70; f.system.update(); f.system.update();
  assert.deepEqual(f.changes, [[5, -3]]);
  assert.equal(f.system.canAISettle('h', 6, 0), true);
});

test('new cities elsewhere do not break a promise; nearby founding breaks it once', () => {
  const f = fixture(); f.found(); f.system.resolve(f.shown[0]!.id, 'accept');
  f.found('h', 30); assert.deepEqual(f.changes, []);
  f.found('h', 4); f.found('h', 3);
  assert.deepEqual(f.changes, [[-15, 12]]);
  f.state.round = 70; f.system.update(); assert.equal(f.changes.length, 1);
});

test('human can complain to AI about a recent known city and AI honors its accepted promise', () => {
  const f = fixture(); f.found('a', 10);
  const v = f.system.complain('h', 'a'); assert.equal(v?.status, 'promised');
  assert.equal(f.system.canAISettle('a', 11, 0), false);
  assert.equal(f.system.canAISettle('a', -10, 0), true);
  assert.ok(f.system.complaintReason('h', 'a'));
});

test('unknown, old or captured cities cannot be used for a complaint', () => {
  const f = fixture(); const city = f.found('a', 10); f.state.known = false;
  assert.equal(f.system.complain('h', 'a'), undefined);
  f.state.known = true; city.ownerId = 'h'; assert.equal(f.system.complain('h', 'a'), undefined);
  city.ownerId = 'a'; f.state.round = 60; assert.equal(f.system.complain('h', 'a'), undefined);
});

test('AI may decline or pay compensation according to disposition and reserves', () => {
  const f = fixture(); f.state.trust = 20; f.found('a', 10);
  assert.equal(f.system.complain('h', 'a')?.status, 'paid');
  assert.equal(f.gold.a, 450); assert.equal(f.gold.h, 550);
  const g = fixture(); g.state.trust = 5; g.found('a', 10);
  assert.equal(g.system.complain('h', 'a')?.status, 'rejected');
  assert.deepEqual(g.changes, [[-2, 4]]);
});

test('compensation is an atomic one-time transfer and creates no promise', () => {
  const f = fixture(); f.found(); const id = f.shown[0]!.id;
  f.gold.h = 49; assert.equal(f.system.resolve(id, 'compromise'), false); assert.equal(f.gold.a, 500);
  assert.equal(f.system.serialize().affairs[0]!.status, 'pending');
  f.gold.h = 100; assert.equal(f.system.resolve(id, 'compromise'), true);
  f.system.resolve(id, 'compromise'); assert.equal(f.gold.a, 550); assert.equal(f.gold.h, 50);
  assert.equal(f.system.canAISettle('h', 5, 0), true);
});

test('money is transferred from recipient to requester with no repayment and a rejection is harmless', () => {
  const f = fixture(); f.gold.a = 10;
  const v = f.system.requestMoney('a', 'h')!;
  assert.equal(v.amount, 90); f.system.resolve(v.id, 'accept');
  assert.equal(f.gold.a, 100); assert.equal(f.gold.h, 410);
  assert.equal(f.system.requestMoney('a', 'h'), undefined);
  assert.deepEqual(f.changes, [[3, 0]]);
  const g = fixture(); const r = g.system.requestMoney('a', 'h')!;
  g.system.resolve(r.id, 'reject'); assert.deepEqual(g.changes, []); assert.equal(g.gold.h, 500);
});

test('human money request uses AI affordability and friendship, in the same transfer direction', () => {
  const f = fixture(); f.gold.h = 0;
  assert.equal(f.system.requestMoney('h', 'a')?.status, 'paid');
  assert.equal(f.gold.h, 100); assert.equal(f.gold.a, 400);
});

test('war or elimination voids requests and promises without rewards or charges', () => {
  for (const cancelledBy of ['war', 'eliminated'] as const) {
    const f = fixture(); f.found(); f.system.resolve(f.shown[0]!.id, 'accept');
    f.state[cancelledBy] = true; f.state.round = 70; f.system.update();
    assert.deepEqual(f.changes, []); assert.equal(f.system.serialize().affairs[0]!.status, 'cancelled');
  }
  const f = fixture(); f.found(); f.state.war = true;
  f.system.resolve(f.shown[0]!.id, 'compromise'); assert.equal(f.gold.h, 500);
});

test('expired requests cannot transfer money and expire quietly without relation penalties', () => {
  const f = fixture(); f.found(); f.state.round = 55; f.system.update();
  f.system.resolve(f.shown[0]!.id, 'compromise'); assert.equal(f.gold.h, 500); assert.deepEqual(f.changes, []);
  assert.equal(f.system.serialize().affairs[0]!.status, 'expired');
});

test('save/load restores pending UI and cooldowns, preserves promise geometry, and replays no effects', () => {
  const f = fixture(); f.found(); const save = f.system.serialize();
  const loaded = new DiplomaticAffairSystem(f.context); loaded.restore(save);
  assert.equal(f.shown.length, 2); assert.deepEqual(f.changes, []);
  loaded.resolve(f.shown[0]!.id, 'accept'); const promised = loaded.serialize();
  const again = new DiplomaticAffairSystem(f.context); again.restore(promised);
  assert.equal(again.canAISettle('h', 5, 0), false); assert.equal(f.shown.length, 2);
  f.state.round = 70; again.update(); const kept = again.serialize();
  again.restore(kept); again.update(); assert.deepEqual(f.changes, [[5, -3]]);
  again.restore(); assert.equal(again.canAISettle('h', 5, 0), true);
});

test('snapshot and restore do not share mutable promise state', () => {
  const f = fixture(); f.found(); const save = f.system.serialize();
  save.affairs[0]!.status = 'paid'; assert.equal(f.system.serialize().affairs[0]!.status, 'pending');
  const fresh = new DiplomaticAffairSystem(f.context); fresh.restore(save); save.affairs[0]!.status = 'broken';
  assert.equal(fresh.serialize().affairs[0]!.status, 'paid');
});

test('autoplay resolves requests without leaving an unanswered human modal', () => {
  const f = fixture(); f.state.interactive = false; f.found();
  assert.equal(f.shown.length, 0); assert.equal(f.system.serialize().affairs[0]!.status, 'promised');
});

test('unsolicited money requests require need, are spaced globally, and never stack on a pending complaint', () => {
  const f = fixture(); f.gold.a = 10; f.system.update(); f.system.update();
  assert.equal(f.shown.length, 1); assert.equal(f.system.serialize().affairs[0]!.kind, 'money');
  const g = fixture(); g.gold.a = 10; g.found(); g.system.update();
  assert.equal(g.shown.length, 1); assert.equal(g.system.serialize().affairs[0]!.kind, 'settlement');
});

test('a razed or transferred disputed city cancels an unanswered request', () => {
  const f = fixture(); const city = f.found(); city.ownerId = 'a';
  f.system.resolve(f.shown[0]!.id, 'compromise');
  assert.equal(f.gold.h, 500); assert.equal(f.system.serialize().affairs[0]!.status, 'cancelled');
});
