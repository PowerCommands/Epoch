import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { OpportunismSystem } from '../src/systems/ai/OpportunismSystem';
import { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem';
import { AIDiplomacySystem } from '../src/systems/ai/AIDiplomacySystem';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import { Nation } from '../src/entities/Nation';
import { GossipFlavorEventSystem } from '../src/systems/GossipFlavorEventSystem';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { getLeaderByNationId, getLeaderById, setActiveLeaderSelections } from '../src/data/leaders';
import { setLeaderConfiguration } from '../src/data/leaderConfiguration';
import { deserializeConfiguration, effectiveLeader, serializeConfiguration, validateConfiguration } from '../src/editor/leaderEditorModel';
import type { AIDiplomacyDecisionReason } from '../src/types/aiDiplomacy';
import { OPPORTUNISTIC_GOSSIP } from '../src/data/opportunisticGossip';

const A = 'nation_england', B = 'nation_india', C = 'nation_france';
afterEach(() => { setLeaderConfiguration(); setActiveLeaderSelections(undefined); });
function harness() {
  let round = 0;
  let met = true, reachable = true, threat: 'none' | 'high' = 'none', allied = false;
  const nations = new NationManager();
  for (const [id, isHuman] of [[A, false], [B, true], [C, false]] as const) nations.addNation(new Nation({ id, name: id, isHuman, color: 0 }));
  const turns = { getCurrentRound: () => round } as any;
  const diplomacy = new DiplomacyManager(turns);
  // Keep ideology neutral for tests isolating the new motive.
  setLeaderConfiguration({ version: 1, leaders: { leader_henry_v: { ideologyId: 'liberalism' } } });
  const units = [A, B, C].map((id, i) => ({ id, ownerId: id, health: 100, unitType: { baseHealth: 100, baseStrength: i === 0 ? 500 : 100 } }));
  const cities = [A, B, C].map(id => ({ id, ownerId: id, health: 0 }));
  const military = new AIMilitaryEvaluationSystem({
    getAllUnits: () => units, getUnitsByOwner: (id: string) => units.filter(u => u.ownerId === id), onUnitChanged: () => {},
  } as any, { getCitiesByOwner: (id: string) => cities.filter(c => c.ownerId === id), onCityChanged: () => {} } as any,
  { getAllyNationId: (id: string) => allied && id === B ? C : null, getAllianceForNation: () => ({ name: 'Defensive pact' }) } as any, diplomacy);
  const timeline = new HistoricalTimelineService(() => round, () => '1000 AD');
  const logs: string[] = [];
  let opportunity: OpportunismSystem;
  const flavor = new GossipFlavorEventSystem({ nationManager: nations, diplomacyManager: diplomacy, historicalTimeline: timeline,
    getRound: () => round, getMilitaryPower: id => military.getMilitaryStrength(id).totalStrength,
    isNationActive: id => military.isNationActive(id), opportunismPressure: (a, b) => opportunity.getPressure(a, b),
    randomSeed: 'opportunism-test', roll: key => key.endsWith('|chance') ? 0 : 0.5 });
  opportunity = new OpportunismSystem({ military, diplomacy, haveMet: () => met,
    canProjectForce: () => reachable, threat: () => threat, minimumReadiness: () => 1,
    remark: (speakerNationId, recipientNationId, trigger) => !!flavor.tryGenerate({ speakerNationId, recipientNationId, trigger }),
    log: (_a, _b, text) => logs.push(text) });
  const evaluation = new DiplomaticEvaluationSystem(diplomacy);
  const ai = new AIDiplomacySystem(diplomacy, evaluation, nations, turns, military,
    { getThreatLevel: () => threat } as any, (a, b) => met && a === A && b === B);
  ai.setOpportunismSystem(opportunity);
  const decisions: AIDiplomacyDecisionReason[] = []; ai.onDecision(d => decisions.push(d));
  return { opportunity, diplomacy, military, evaluation, ai, timeline, flavor, logs, decisions, nations,
    at: (value: number) => { round = value; },
    power: (id: string, value: number) => { units.find(u => u.ownerId === id)!.unitType.baseStrength = value; military.invalidate(); },
    damage: (id: string, health: number) => { units.find(u => u.ownerId === id)!.health = health; military.invalidate(); },
    met: (value: boolean) => { met = value; }, reachable: (value: boolean) => { reachable = value; },
    threat: (value: 'none' | 'high') => { threat = value; }, allied: (value: boolean) => { allied = value; },
    evaluate: (value: number) => { round = value; opportunity.evaluate(A, B, round); },
  };
}

test('missing or disabled flag produces no opportunity, pressure, remark or war', () => {
  const h = harness(); setLeaderConfiguration({ version: 1, leaders: { leader_henry_v: { opportunism: false } } });
  for (const r of [0, 5, 10, 30]) { h.at(r); h.ai.runTurn(A); }
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  assert.equal(h.opportunity.getPressure(A, B), 0);
  assert.deepEqual(h.logs, []); assert.equal(h.timeline.getEvents().length, 0);
  assert.equal(getLeaderById('leader_mahatma-gandhi')?.opportunism, undefined);
  assert.equal(effectiveLeader({ version: 1 }, 'leader_mahatma-gandhi').opportunism, false);
});

test('similar strength has no reaction; clear and overwhelming imbalances create increasing pressure', () => {
  const h = harness(); h.power(A, 120); h.evaluate(0);
  assert.equal(h.opportunity.getPressure(A, B), 0);
  h.power(A, 200); h.evaluate(5); assert.equal(h.opportunity.getPressure(A, B), 6);
  h.power(A, 300); h.evaluate(10); assert.equal(h.opportunity.getPressure(A, B), 16);
  h.power(A, 500); h.evaluate(15); assert.equal(h.opportunity.getPressure(A, B), 31);
  assert.match(h.logs.join('\n'), /ratio=5.00/);
  assert.equal(h.diplomacy.getRelation(A, B).hostility, 0, 'temporary pressure must not mutate permanent memory');
});

test('military recovery deters immediately, clears temporary attitude and logs cooling at cadence', () => {
  const h = harness(); for (const r of [0, 5, 10, 15]) h.evaluate(r);
  assert.equal(h.opportunity.getPressure(A, B), 60);
  assert.equal(h.evaluation.evaluateAttitude(A, B), 'hostile');
  h.power(B, 500); h.at(16);
  assert.equal(h.opportunity.warBonus(A, B), 0);
  assert.equal(h.opportunity.getPressure(A, B), 0);
  assert.equal(h.evaluation.evaluateAttitude(A, B), 'neutral');
  h.ai.runTurn(A); assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  h.evaluate(20); assert.match(h.logs.join('\n'), /no longer significant/);
  assert.equal(h.opportunity.serialize().pairs[0].pressure, 0);
});

test('cadence and shared Gossip cooldown prevent repeated remarks, survive save/restore', () => {
  const h = harness(); h.evaluate(0);
  assert.equal(h.timeline.getEvents().length, 1);
  const before = JSON.stringify(h.opportunity.serialize()); h.evaluate(1); assert.equal(JSON.stringify(h.opportunity.serialize()), before);
  const saved = JSON.parse(JSON.stringify({ opportunity: h.opportunity.serialize(), flavor: h.flavor.serialize() }));
  const resumed = harness(); resumed.at(1); resumed.opportunity.restore(saved.opportunity); resumed.flavor.restore(saved.flavor);
  for (let r = 1; r < 25; r++) resumed.evaluate(r);
  assert.equal(resumed.timeline.getEvents().length, 0);
  resumed.evaluate(25); assert.equal(resumed.timeline.getEvents().length, 1);
  assert.match(resumed.timeline.getEvents()[0].text, /warned/);
  assert.ok(resumed.logs.some(l => l.includes('opportunity_military')));
});

test('weakness alone does not bypass eligibility, contact, alliance power, reach, readiness or existing wars', () => {
  for (const restraint of ['unmet', 'unreachable', 'danger', 'alliance', 'peace', 'busy', 'warm', 'damaged'] as const) {
    const h = harness();
    if (restraint === 'unmet') h.met(false);
    if (restraint === 'unreachable') h.reachable(false);
    if (restraint === 'danger') h.threat('high');
    if (restraint === 'alliance') { h.allied(true); h.power(C, 1000); }
    if (restraint === 'peace') h.diplomacy.setAllianceGuard(() => true);
    if (restraint === 'busy') h.diplomacy.declareWar(A, C);
    if (restraint === 'warm') h.diplomacy.setMemoryValues(A, B, { trust: 90, affinity: 30, hostility: 0, fear: 0, suspicion: 0 });
    if (restraint === 'damaged') h.damage(A, 10);
    for (const r of [0, 5, 10]) h.evaluate(r);
    assert.equal(h.opportunity.getPressure(A, B), 0, restraint);
    assert.equal(h.opportunity.warBonus(A, B), 0, restraint);
    assert.equal(h.timeline.getEvents().length, 0, restraint);
  }
});

test('sustained weakness feeds the normal war decision, records motive and uses conquest flavor', () => {
  const h = harness();
  h.at(0); h.ai.runTurn(A); assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  h.at(5); h.ai.runTurn(A); assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  h.at(10); h.ai.runTurn(A); assert.equal(h.diplomacy.getState(A, B), 'WAR');
  const decision = h.decisions.find(d => d.action === 'declareWar')!;
  assert.equal(decision.opportunisticOpportunity, true);
  assert.equal(decision.warDeclarationReason, 'conquest');
  assert.match(decision.reasonText, /military weakness/);
  assert.ok(h.timeline.getEvents().length > 0, 'human receives a warning through History before war');
});

test('normal declaration rejection still blocks an accumulated opportunity', () => {
  const h = harness(); for (const r of [0, 5, 10]) h.evaluate(r);
  let declarations = 0;
  h.diplomacy.declareWar = () => { declarations++; return false; };
  h.at(10); h.ai.runTurn(A);
  assert.equal(declarations, 1);
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  assert.equal(h.decisions.some(d => d.action === 'declareWar'), false);
});

test('scenario serialization preserves true and false and alternative leaders resolve their own trait', () => {
  const config = { version: 1 as const, leaders: { leader_winston_churchill: { opportunism: true }, leader_henry_v: { opportunism: false } } };
  assert.deepEqual(deserializeConfiguration(serializeConfiguration(config)), config);
  setLeaderConfiguration(config); setActiveLeaderSelections({ [A]: 'leader_winston_churchill' });
  assert.equal(getLeaderByNationId(A)?.opportunism, true);
  setActiveLeaderSelections(undefined); assert.equal(getLeaderByNationId(A)?.opportunism, false);
  assert.ok(validateConfiguration({ version: 1, leaders: { leader_henry_v: { opportunism: 'yes' } } } as any).some(e => e.includes('opportunism')));
});

test('all four contextual remark stages have varied definitions and no ambient triggers', () => {
  assert.equal(new Set(OPPORTUNISTIC_GOSSIP.map(d => d.id)).size, 16);
  assert.equal(OPPORTUNISTIC_GOSSIP.filter(d => d.insultSubtype === 'provocation').length, 4);
  for (const d of OPPORTUNISTIC_GOSSIP) assert.ok(d.flavorContexts!.every(c => c.startsWith('opportunity_')));
});


test('opportunistic attitude escalation is attributed even before the separate war bonus activates', () => {
  const h = harness(); setLeaderConfiguration(); // Henry V and Gandhi have incompatible ideologies.
  h.at(0); h.ai.runTurn(A);
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  h.at(5); h.ai.runTurn(A);
  const war = h.decisions.find(d => d.action === 'declareWar');
  assert.ok(war);
  assert.equal(war.opportunisticOpportunity, true);
});

test('actual ceasefire eligibility suppresses escalation, including already hostile relations', () => {
  const h = harness();
  h.diplomacy.declareWar(A, B);
  h.diplomacy.enforceCeasefire(A, B, 30, 0);
  for (const r of [0, 5, 10, 20]) { h.at(r); h.ai.runTurn(A); }
  assert.equal(h.opportunity.getPressure(A, B), 0);
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  assert.equal(h.decisions.some(d => d.action === 'declareWar'), false);
});

test('saturated pressure is bounded and does not emit an evaluation log on every cadence', () => {
  const h = harness(); for (const r of [0, 5, 10, 15]) h.evaluate(r);
  const count = h.logs.length;
  h.evaluate(20);
  assert.equal(h.logs.length, count);
  assert.equal(h.opportunity.getPressure(A, B), 60);
  assert.equal(h.diplomacy.getRelation(A, B).hostility, 0);
});
