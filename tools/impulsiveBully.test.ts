import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { getBullyIntensity, ImpulsiveBullySystem } from '../src/systems/ai/ImpulsiveBullySystem';
import { LeaderStatementSystem } from '../src/systems/LeaderStatementSystem';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { GossipFlavorEventSystem } from '../src/systems/GossipFlavorEventSystem';
import { NationManager } from '../src/systems/NationManager';
import { Nation } from '../src/entities/Nation';
import { AIDiplomacySystem } from '../src/systems/ai/AIDiplomacySystem';
import { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem';
import { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService';
import { CityManager } from '../src/systems/CityManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType } from '../src/types/map';
import { setLeaderConfiguration } from '../src/data/leaderConfiguration';
import { getLeaderById, getLeaderByNationId, setActiveLeaderSelections } from '../src/data/leaders';
import { effectiveLeader, serializeConfiguration, deserializeConfiguration, validateConfiguration } from '../src/editor/leaderEditorModel';
import { NewspaperSystem } from '../src/systems/NewspaperSystem';
import type { Era } from '../src/data/technologies';
import { LEADER_STATEMENTS } from '../src/data/leaderStatements';

const A = 'nation_england', B = 'nation_india', C = 'nation_france';
afterEach(() => { setLeaderConfiguration(); setActiveLeaderSelections(undefined); });
function harness(initialRoll: number | undefined = 0) {
  let round = 0, era: Era = 'modern', roll = initialRoll, met = true, active = true, endangered = false, distress = false;
  const logs: string[] = [], powers = new Map([[A, 200], [B, 100], [C, 100]]);
  const bullies = new Set([A]);
  setLeaderConfiguration({ version: 1, leaders: { leader_henry_v: { impulsiveBully: true, opportunism: false, ideologyId: 'liberalism' } } });
  const nations = new NationManager();
  for (const id of [A, B, C]) nations.addNation(new Nation({ id, name: id, isHuman: id === C, color: 0 }));
  const turns = { getCurrentRound: () => round, getCurrentTurnIndex: () => 0, getGlobalYear: () => 1900,
    restoreTurnState: (r: number) => { round = r; } } as any;
  const diplomacy = new DiplomacyManager(turns);
  const history = new HistoricalTimelineService(() => round, () => '1900', id => id, id => id);
  const statements = new LeaderStatementSystem({ diplomacy, history, round: () => round,
    nationIds: () => [C, B, A], active: () => active, haveMet: () => met, leaderName: id => id,
    militaryPower: id => powers.get(id) ?? 0, isBully: id => bullies.has(id), seed: 'bully-test',
    roll: key => roll, log: (_ids, text) => logs.push(text) } as any);
  const flavor = new GossipFlavorEventSystem({ nationManager: nations, diplomacyManager: diplomacy,
    historicalTimeline: history, getRound: () => round, getMilitaryPower: id => powers.get(id) ?? 0,
    isNationActive: () => active, randomSeed: 'bully-test', roll: () => 0 });
  const bully = new ImpulsiveBullySystem({ statements, diplomacy, era: () => era, isAI: id => id !== C,
    outburst: (speakerNationId, recipientNationId, threatening) => !!flavor.tryGenerate({ speakerNationId, recipientNationId,
      trigger: threatening ? 'bully_threat' : 'bully_insult' }),
    applyPressure: (a, b, type) => diplomacy.imposeEconomicPressureAction(a, b, type).imposed,
    endangered: () => endangered, economicDistress: () => distress });
  diplomacy.onEconomicPressureChanged(e => bully.handlePressure(e));
  diplomacy.onPerceivedSlight((a, b, reason) => bully.perceive(a, b, reason));
  diplomacy.onWarEnded((a, b) => { bully.retreat(a, b); bully.retreat(b, a); });
  history.onRecorded(e => bully.handleHistory(e));
  return { bully, statements, diplomacy, history, logs, powers, bullies, flavor, nations, turns,
    at: (r: number) => { round = r; }, era: (e: Era) => { era = e; }, roll: (r: number | undefined) => { roll = r; },
    met: (v: boolean) => { met = v; }, active: (v: boolean) => { active = v; },
    endangered: (v: boolean) => { endangered = v; }, distress: (v: boolean) => { distress = v; } };
}

test('explicit trait: built-in defaults, alternatives, scenario override, editor true/false round trip', () => {
  assert.equal(getLeaderById('leader_mad_jack')?.impulsiveBully, true);
  assert.equal(getLeaderById('leader_adolf_hitler')?.impulsiveBully, true);
  assert.equal(getLeaderById('leader_mahatma-gandhi')?.impulsiveBully, undefined);
  for (const value of [true, false]) {
    const config = { version: 1 as const, leaders: { leader_winston_churchill: { impulsiveBully: value } } };
    assert.deepEqual(validateConfiguration(config), []);
    const decoded = deserializeConfiguration(serializeConfiguration(config));
    assert.equal(effectiveLeader(decoded, 'leader_winston_churchill').impulsiveBully, value);
    setLeaderConfiguration(decoded); setActiveLeaderSelections({ [A]: 'leader_winston_churchill' });
    assert.equal(getLeaderByNationId(A)?.impulsiveBully, value);
  }
  assert.equal(effectiveLeader({ version: 1 }, 'leader_mahatma-gandhi').impulsiveBully, false);
  assert.match(validateConfiguration({ version: 1, leaders: { leader_henry_v: { impulsiveBully: 'yes' } } } as any).join(), /impulsiveBully/);
});

test('canonical era curve reaches one in Modern and stays there', () => {
  const eras: Era[] = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic', 'information', 'future'];
  assert.deepEqual(eras.map(getBullyIntensity), [.15, .30, .50, .75, .90, 1, 1, 1, 1]);
});

test('intensity changes grievance probability and severity, not the effects of a given statement', () => {
  const h = harness(.2);
  h.era('ancient'); assert.equal(h.bully.perceive(A, B, 'a vote'), false);
  h.era('modern'); assert.equal(h.bully.perceive(A, B, 'a vote'), true);
  assert.equal(h.bully.grievance(A)?.severity, 3);
  const effects = (era: Era) => {
    const world = harness(0); world.era(era);
    world.statements.issue(A, l => l.tone === 'threatening');
    return world.diplomacy.getRelation(A, B);
  };
  assert.deepEqual(effects('ancient'), effects('modern'));
});

test('disabled, human, unknown and eliminated actors do not acquire grievances', () => {
  const h = harness();
  assert.equal(h.bully.perceive(B, A, 'slight'), false);
  h.bullies.add(C); assert.equal(h.bully.perceive(C, A, 'slight'), false);
  h.met(false); assert.equal(h.bully.perceive(A, B, 'slight'), false);
  h.met(true); h.active(false); assert.equal(h.bully.perceive(A, B, 'slight'), false);
});

test('grievances are directional, expire, and spontaneous irritation can have no discernible reason', () => {
  const h = harness(); h.bully.runTurn(A);
  assert.equal(h.bully.grievance(A)?.reason, 'no discernible reason');
  assert.equal(h.bully.grievance(B), undefined);
  assert.equal(h.bully.perceive(A, B, 'another event in the same round'), false);
  h.at(15); assert.equal(h.bully.grievance(A), undefined);
  assert.match(h.logs.join('\n'), /expired/);
});

test('proposal rejection and retaliation produce grievances even between admiring Bullies', () => {
  const h = harness(.7); h.bullies.add(B);
  const baseline = h.diplomacy.getRelation(A, B);
  assert.equal(h.bully.influence(A, B, baseline).affinity, baseline.affinity + 4);
  assert.equal(h.bully.perceive(A, B, 'tariffs'), false);
  assert.equal(h.bully.perceive(A, B, 'retaliatory tariffs', true), true);
  assert.ok(h.bully.influence(A, B, baseline).affinity < baseline.affinity + 4);
  h.at(1); h.roll(0); h.diplomacy.recordProposalRejected(A, B);
  assert.match(h.bully.grievance(A)!.reason, /rejected proposal/);
});

test('Statement creation records immutable quote and met living observers; speaker cooldown is global', () => {
  const h = harness(); const s = h.statements.issue(A, l => l.tone === 'constructive')!;
  assert.deepEqual(s.observerIds, [C, B].sort());
  assert.equal(h.history.getEvents()[0].metadata?.statementText, s.text);
  assert.ok(h.diplomacy.getRelation(A, B).trust > 50);
  assert.equal(h.statements.issue(A, () => true), undefined);
  h.at(8); h.met(false); const next = h.statements.issue(A, l => l.tone === 'constructive')!;
  assert.deepEqual(next.observerIds, []);
  assert.notEqual(s.contentId, next.contentId);
});

test('weak absurd threats cause suspicion/hostility without Fear; strong threats are credible', () => {
  const weak = harness(); weak.powers.set(A, 1);
  weak.statements.issue(A, l => l.tone === 'threatening');
  assert.equal(weak.diplomacy.getRelation(A, B).fear, 0);
  assert.ok(weak.diplomacy.getRelation(A, B).hostility > 0);
  assert.ok(weak.diplomacy.getRelation(A, B).suspicion > 0);
  const strong = harness(); strong.powers.set(A, 1000);
  strong.statements.issue(A, l => l.tone === 'threatening');
  assert.ok(strong.diplomacy.getRelation(A, B).fear > 0);
});

test('targeted outbursts work at ordinary relations, carry consequences and share Gossip cooldown', () => {
  const h = harness(); h.powers.set(A, 1); h.bully.perceive(A, B, 'nothing'); h.bully.runTurn(A);
  const insults = () => h.history.getEvents().filter(e => e.type === 'leaderInsult');
  assert.equal(insults().length, 1); assert.equal(insults()[0].metadata?.leaderInsultSubtype, 'threat');
  assert.ok(h.diplomacy.getRelation(A, B).hostility >= 6);
  assert.equal(h.diplomacy.getRelation(A, B).fear, 0);
  h.at(5); h.bully.runTurn(A); assert.equal(insults().length, 1);
  const saved = h.flavor.serialize(); h.flavor.restore(saved);
  assert.equal(h.flavor.tryGenerate({ speakerNationId: A, recipientNationId: B, trigger: 'bully_insult' }), undefined);
  h.at(25); const next = h.flavor.tryGenerate({ speakerNationId: A, recipientNationId: B, trigger: 'bully_threat' })!;
  assert.notEqual(next.resolvedText, insults()[0].metadata?.leaderInsultText);
});

test('retaliation never unlocks Tariffs, Boycott or Embargo and canonical escalation cooldown holds', () => {
  const h = harness(); h.bully.perceive(A, B, 'a rumor');
  h.diplomacy.setEconomicPressureTechnologyChecker(() => false);
  assert.equal(h.bully.considerRetaliation(A, B), false);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), null);
  assert.match(h.logs.join('\n'), /unavailable/);
  h.at(5); h.diplomacy.setEconomicPressureTechnologyChecker((_id, tech) => tech === 'currency');
  assert.equal(h.bully.considerRetaliation(A, B), true);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), 'tariffs');
  h.at(10); h.diplomacy.setEconomicPressureTechnologyChecker(() => true);
  assert.equal(h.bully.considerRetaliation(A, B), false);
  h.at(13); assert.equal(h.bully.considerRetaliation(A, B), true);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), 'embargo');
});

test('Boycott is possible when eligible; intensity changes severity selection and war forbids pressure', () => {
  const h = harness(); h.bully.perceive(A, B, 'a rumor');
  h.diplomacy.setEconomicPressureTechnologyChecker(() => true);
  h.roll(.2); assert.equal(h.bully.considerRetaliation(A, B), true);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), 'boycott');
  h.at(10); h.diplomacy.declareWar(A, B);
  assert.equal(h.bully.considerRetaliation(A, B), false);
});

test('public admiration increases Affinity, ordinary observers distrust supporters, no commitment is created', () => {
  const h = harness(); h.bullies.add(B);
  const base = h.diplomacy.getRelation(A, B);
  h.statements.issue(A, l => l.tone === 'bizarre'); h.bully.runTurn(B);
  const events = h.history.getEvents().filter(e => e.type === 'leaderStatement');
  assert.equal(events.length, 2);
  assert.equal(events[1].metadata?.statementResponseTo, events[0].metadata?.statementId);
  assert.ok(h.diplomacy.getRelation(A, B).affinity >= base.affinity + 9);
  assert.ok(h.diplomacy.getRelation(B, C).suspicion > 0);
  assert.equal(h.diplomacy.getState(A, B), 'PEACE');
  assert.equal(h.diplomacy.getState(B, C), 'PEACE');
  assert.equal(h.diplomacy.getRelation(A, B).openBordersFromAToB, false);
  assert.ok(!h.history.getEvents().some(e => e.type === 'allianceFormed' || e.type === 'joinedWar'));
  h.bully.runTurn(A); assert.equal(h.history.getEvents().filter(e => e.type === 'leaderStatement').length, 2);
});

test('listeners cannot recursively issue Statements and responses cannot themselves receive responses', () => {
  const h = harness(); let recursive: unknown;
  h.statements.onStatement(() => { recursive = h.statements.issue(B, () => true); });
  const s = h.statements.issue(A, l => l.tone === 'grandiose')!;
  assert.equal(recursive, undefined);
  const response = h.statements.issue(B, l => l.context === 'endorsement', s)!;
  assert.ok(response);
  assert.equal(h.statements.issue(C, l => l.context === 'endorsement', response), undefined);
});

test('fake news solidarity can create shared hostility while History and actual defeat remain intact', () => {
  const h = harness(); h.bullies.add(B);
  h.history.record({ type: 'cityCaptured', icon: '', text: 'France captured an English city', eventNationIds: [C, A],
    metadata: { aggressorNationId: C, targetNationId: A } });
  const original = structuredClone(h.history.getEvents()[0]);
  h.bully.runTurn(A);
  assert.deepEqual(h.history.getEvents()[0], original);
  const statements = h.history.getEvents().filter(e => e.type === 'leaderStatement');
  assert.equal(statements.length, 2);
  assert.match(statements[0].metadata!.statementText!, /fake news/i);
  assert.ok(h.diplomacy.getRelation(B, C).hostility >= 3);
});

test('strategic retreat remains possible after grievances expire and victory rhetoric preserves facts', () => {
  const h = harness(); h.diplomacy.setEconomicPressureTechnologyChecker(() => true);
  h.diplomacy.imposeEconomicPressure(A, B, 'embargo'); h.bully.perceive(A, B, 'slight');
  h.at(20); h.distress(true); h.bully.runTurn(A);
  assert.equal(h.diplomacy.getEconomicPressure(A, B), null);
  const s = h.history.getEvents().find(e => e.type === 'leaderStatement')!;
  assert.match(s.metadata!.statementText!, /achieved|learned|successful|won|Peace/);
  assert.equal(h.bully.considerRetaliation(A, B), false);
  assert.match(h.logs.join('\n'), /de-escalation/);
});

test('normal peace ends escalation and queues rhetoric; a denial does not change war or economic state', () => {
  const h = harness(); h.diplomacy.declareWar(A, B); h.bully.reportDefeat(A, B);
  const before = SaveLoadService.serializeDiplomacy(h.diplomacy);
  h.statements.issue(A, l => l.context === 'fake_news');
  assert.equal(h.diplomacy.getState(A, B), 'WAR');
  assert.equal(h.diplomacy.getEconomicPressure(A, B), null);
  assert.equal(SaveLoadService.serializeDiplomacy(h.diplomacy)[0].warStartTurn, before[0].warStartTurn);
  h.bully.retreat(A, B); assert.equal(h.bully.warBonus(A, B), 0);
});

test('deterministic content selection, cadence, recent avoidance and pending support survive serialization', () => {
  const a = harness(undefined); a.bullies.add(B); a.statements.issue(A, l => l.tone === 'grandiose');
  const saved = JSON.parse(JSON.stringify({ statements: a.statements.serialize(), bully: a.bully.serialize(), history: a.history.serialize(), diplomacy: SaveLoadService.serializeDiplomacy(a.diplomacy) }));
  const b = harness(undefined); b.bullies.add(B);
  b.statements.restore(saved.statements); b.bully.restore(saved.bully); b.history.restore(saved.history);
  SaveLoadService.restoreDiplomacy(saved.diplomacy, b.diplomacy);
  for (const round of [1, 5, 8, 10, 15, 20, 25, 30]) {
    a.at(round); b.at(round); a.bully.runTurn(A); b.bully.runTurn(A);
    a.bully.runTurn(B); b.bully.runTurn(B);
  }
  assert.deepEqual(a.statements.serialize(), b.statements.serialize());
  assert.deepEqual(a.bully.serialize(), b.bully.serialize());
  assert.equal(JSON.stringify(a.history.serialize()), JSON.stringify(b.history.serialize()));
  assert.deepEqual(SaveLoadService.serializeDiplomacy(a.diplomacy), SaveLoadService.serializeDiplomacy(b.diplomacy));
  const ids = a.history.getEvents().filter(e => e.type === 'leaderStatement' && e.eventNationIds[0] === A).map(e => e.metadata?.statementText);
  assert.equal(new Set(ids).size, ids.length);
});

test('Chronicle reports a Statement seriously, with frozen leader name and exact quote', () => {
  const h = harness(); h.at(10); const s = h.statements.issue(A, l => l.tone === 'bizarre')!;
  const paper = NewspaperSystem.forNewGame({ humanNationId: A, getTimelineEvents: () => h.history.getEvents(),
    getDominationRanking: () => [A, B, C], getNationName: id => id, getLeaderName: () => 'CHANGED', getWorldEra: () => 'modern', seed: 'test' });
  const issue = paper.consumeDueIssue(11, '1900')!;
  assert.equal(issue.mainArticle.eventType, 'leaderStatement');
  assert.equal(issue.mainArticle.body, `“${s.text}”`);
  assert.match(issue.mainArticle.headline, /ADDRESSES THE WORLD/);
  assert.ok(!issue.mainArticle.headline.includes('CHANGED'));
  assert.ok(LEADER_STATEMENTS.length >= 70);
});

function withAI(h: ReturnType<typeof harness>) {
  const units = [A, B, C].map(id => ({ id, ownerId: id, health: 100,
    unitType: { baseHealth: 100, get baseStrength() { return h.powers.get(id)!; } } }));
  const military = new AIMilitaryEvaluationSystem({ getAllUnits: () => units,
    getUnitsByOwner: (id: string) => units.filter(u => u.ownerId === id), onUnitChanged: () => {} } as any,
    { getCitiesByOwner: (id: string) => [{ id, ownerId: id, health: 0 }], onCityChanged: () => {} } as any,
    undefined, h.diplomacy);
  const evaluation = new DiplomaticEvaluationSystem(h.diplomacy);
  const ai = new AIDiplomacySystem(h.diplomacy, evaluation, h.nations, h.turns, military,
    { getThreatLevel: () => 'none' } as any, (a, b) => a === A && b === B);
  ai.setImpulsiveBullySystem(h.bully);
  return { ai, evaluation };
}

test('unresolved Bully grievance contributes through normal war evaluation, never directly declares', () => {
  const h = harness(); const { ai } = withAI(h);
  h.powers.set(A, 500); h.bully.perceive(A, B, 'a trivial disagreement'); h.roll(.99);
  assert.equal(h.bully.warBonus(A, B), 0); h.at(10); assert.ok(Math.abs(h.bully.warBonus(A, B) - .45) < 1e-9);
  assert.equal(h.diplomacy.getState(A, B), 'PEACE'); ai.runTurn(A);
  assert.equal(h.diplomacy.getState(A, B), 'WAR');
});

test('normal war safeguards still block weak armies and ceasefires despite severe grievances', () => {
  for (const reason of ['weak', 'ceasefire', 'vassal']) {
    const h = harness(); const { ai } = withAI(h);
    if (reason === 'weak') h.powers.set(A, 1);
    if (reason === 'ceasefire') { h.diplomacy.declareWar(A, B); h.diplomacy.enforceCeasefire(A, B, 30, 0); }
    if (reason === 'vassal') h.diplomacy.establishVassal(A, B);
    h.bully.perceive(A, B, 'an insult'); h.roll(.99); h.at(10); ai.runTurn(A);
    assert.equal(h.diplomacy.getState(A, B), 'PEACE', reason);
  }
});

// Exercise the real save service with minimal unrelated services, not just the new serializers.
test('SaveLoadService captures configuration, grievances, Statement cooldowns and History; old saves default empty', () => {
  const h = harness(); h.bully.perceive(A, B, 'a slight'); h.statements.issue(A, l => l.tone === 'grandiose');
  const mapData = { width: 1, height: 1, tileSize: 1, tiles: [[{ x: 0, y: 0, type: TileType.Plains }]] };
  const ctx = { mapKey: 'bully-save', humanNationId: C, activeNationIds: [A, B, C], gameSpeedId: 'marathon', mapData,
    nationManager: h.nations, cityManager: new CityManager(), unitManager: { getAllUnits: () => [], clearAllSilently: () => {}, normalizeCargoLinks: () => {} },
    productionSystem: { getQueue: () => [], clearAllQueues: () => {} }, policySystem: { getActivePolicyAssignments: () => [], loadAllNationPolicies: () => {} },
    diplomacyManager: h.diplomacy, discoverySystem: { getAllMetPairs: () => [], restore: () => {} }, turnManager: h.turns,
    gridSystem: new HexGridSystem(), wonderSystem: { getCompletedWonders: () => [], clearAll: () => {}, restoreCompletedWonder: () => {} },
    impulsiveBullySystem: h.bully, leaderStatementSystem: h.statements, historicalTimeline: h.history, gossipFlavorEventSystem: h.flavor } as unknown as SaveLoadContext;
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serialize(ctx)));
  assert.equal(saved.leaderConfiguration.leaders.leader_henry_v.impulsiveBully, true);
  assert.equal(JSON.stringify(saved.impulsiveBully), JSON.stringify(h.bully.serialize()));
  const original = h.history.serialize();
  h.bully.restore(); h.statements.restore(); h.history.restore();
  SaveLoadService.apply(saved, ctx);
  assert.equal(h.bully.grievance(A)?.reason, 'a slight'); assert.equal(h.statements.available(A), false);
  assert.equal(JSON.stringify(h.history.serialize()), JSON.stringify(original));
  delete saved.impulsiveBully; delete saved.leaderStatements;
  SaveLoadService.apply(saved, ctx);
  assert.equal(h.bully.grievance(A), undefined); assert.equal(h.statements.available(A), true);
});

test('Modern intensity makes public endorsement more likely; a fresh betrayal still prevents endorsement', () => {
  for (const era of ['ancient', 'modern'] as const) {
    const h = harness(.2); h.bullies.add(B); h.era(era);
    h.statements.issue(A, l => l.context === 'general' && l.tone === 'grandiose');
    h.bully.runTurn(B);
    const responses = h.history.getEvents().filter(e => e.metadata?.statementResponseTo);
    assert.equal(responses.length, era === 'modern' ? 1 : 0);
  }
  const h = harness(); h.bullies.add(B);
  h.bully.perceive(B, A, 'a World Council vote against us');
  h.statements.issue(A, l => l.context === 'general' && l.tone === 'grandiose'); h.bully.runTurn(B);
  assert.equal(h.history.getEvents().filter(e => e.metadata?.statementResponseTo).length, 0);
});

test('Bully influence composes with Opportunism and leaves uninvolved negative temporary affinity unchanged', () => {
  const h = harness(); const { ai, evaluation } = withAI(h);
  const relation = { ...h.diplomacy.getRelation(A, B), affinity: -20 };
  assert.equal(h.bully.influence(A, B, relation), relation);
  // An existing motive can supply negative temporary affinity; neither setter may erase it.
  const opportunity = { influence: (_a: string, _b: string, r: typeof relation) => ({ ...r, affinity: r.affinity - 20 }) } as any;
  ai.setOpportunismSystem(opportunity);
  assert.equal(evaluation.evaluateRelation(A, B).affinity, -20);
  ai.setImpulsiveBullySystem(h.bully);
  assert.equal(evaluation.evaluateRelation(A, B).affinity, -20);
  h.bully.perceive(A, B, 'slight');
  assert.equal(evaluation.evaluateRelation(A, B).affinity, -32);
  assert.equal(h.diplomacy.getRelation(A, B).affinity, 0);
});

test('a small serious-content pool cycles least-recent content instead of becoming permanently silent', () => {
  const h = harness(); const lines: string[] = [];
  for (let i = 0; i < 6; i++) {
    h.at(i * 8);
    lines.push(h.statements.issue(A, l => l.tone === 'concerned')!.contentId);
  }
  assert.equal(new Set(lines.slice(0, 4)).size, 4);
  assert.equal(lines[4], lines[0]); assert.equal(lines[5], lines[1]);
});
