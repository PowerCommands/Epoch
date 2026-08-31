import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  VassalWarSystem,
  type VassalDefenseRequest,
  type VassalDefenseResolution,
  type VassalWarJoinEvent,
} from '../src/systems/diplomacy/VassalWarSystem.ts';

function harness(options: { humanHost?: string; aiDefends?: boolean } = {}) {
  const diplomacy = new DiplomacyManager();
  const joins: VassalWarJoinEvent[] = [];
  const resolutions: VassalDefenseResolution[] = [];
  const humanRequests: Array<{ request: VassalDefenseRequest; resolve: (defend: boolean) => void }> = [];
  const system = new VassalWarSystem(diplomacy, {
    isHumanNation: (id) => id === options.humanHost,
    shouldAIDefend: () => options.aiDefends ?? true,
    requestHumanDefense: (request, resolve) => humanRequests.push({ request, resolve }),
  });
  system.onVassalJoinedWar((event) => joins.push(event));
  system.onDefenseResolved((event) => resolutions.push(event));
  return { diplomacy, system, joins, resolutions, humanRequests };
}

test('host offensive declaration deterministically pulls every direct vassal into war', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.establishVassal('france', 'mongolia');
  assert.equal(h.diplomacy.declareWar('mongolia', 'china'), true);
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
  assert.equal(h.diplomacy.getState('france', 'china'), 'WAR');
  assert.deepEqual(h.joins.map((event) => event.vassalNationId), ['england', 'france']);
  assert.ok(h.joins.every((event) => event.cause === 'hostDeclaredWar'));
});

test('a human vassal is pulled into its host war without receiving a choice', () => {
  const h = harness({ humanHost: 'england' });
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.declareWar('mongolia', 'china');
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
  assert.equal(h.humanRequests.length, 0);
});

test('an attack on the host automatically pulls all direct vassals into its defensive war', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.establishVassal('france', 'mongolia');
  assert.equal(h.diplomacy.declareWar('china', 'mongolia'), true);
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
  assert.equal(h.diplomacy.getState('france', 'china'), 'WAR');
  assert.ok(h.joins.every((event) => event.cause === 'hostWasAttacked'));
});

test('already-participating vassals are skipped without duplicate declarations', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.establishVassal('france', 'mongolia');
  h.diplomacy.restoreState('england', 'china', { state: 'WAR' });
  h.diplomacy.declareWar('mongolia', 'china');
  assert.deepEqual(h.joins.map((event) => event.vassalNationId), ['france']);
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
});

test('vassal cannot initiate or force war but the validated host obligation can join it', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  assert.equal(h.diplomacy.declareWar('england', 'china'), false);
  assert.equal(h.diplomacy.forceDeclareWar('england', 'china'), false);
  assert.equal(h.diplomacy.joinWarForHost('england', 'mongolia', 'china'), false, 'host must already be at war');
  h.diplomacy.declareWar('mongolia', 'china');
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
});

test('host and direct vassal can never be put at war with each other', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  assert.equal(h.diplomacy.declareWar('mongolia', 'england'), false);
  assert.equal(h.diplomacy.forceDeclareWar('mongolia', 'england'), false);
  assert.equal(h.diplomacy.declareWar('england', 'mongolia'), false);
});

test('AI host accepts defence, joins the attacker war, and keeps its vassal', () => {
  const h = harness({ aiDefends: true });
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.declareWar('china', 'england');
  assert.equal(h.diplomacy.getState('mongolia', 'china'), 'WAR');
  assert.equal(h.diplomacy.getHost('england'), 'mongolia');
  assert.deepEqual(h.resolutions.map((event) => [event.defended, event.joinedWar]), [[true, true]]);
});

test('AI host refusal ends vassalage without resetting relationship memory', () => {
  const h = harness({ aiDefends: false });
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 12, fear: 23, suspicion: 34, hostility: 45, affinity: 56,
  });
  h.diplomacy.declareWar('china', 'england');
  assert.equal(h.diplomacy.isVassal('england'), false);
  const relation = h.diplomacy.getRelation('england', 'mongolia');
  assert.deepEqual(
    [relation.trust, relation.fear, relation.suspicion, relation.hostility, relation.affinity],
    [12, 23, 34, 45, 56],
  );
  assert.deepEqual(h.resolutions.map((event) => event.defended), [false]);
});

test('human host receives a decision and no result occurs until it answers', () => {
  const h = harness({ humanHost: 'mongolia' });
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.declareWar('china', 'england');
  assert.equal(h.humanRequests.length, 1);
  assert.equal(h.diplomacy.getState('mongolia', 'china'), 'PEACE');
  assert.equal(h.diplomacy.getHost('england'), 'mongolia');
  h.humanRequests[0]!.resolve(false);
  assert.equal(h.diplomacy.isVassal('england'), false);
});

test('human host can accept defence and retain the vassal relationship', () => {
  const h = harness({ humanHost: 'mongolia' });
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.declareWar('china', 'england');
  h.humanRequests[0]!.resolve(true);
  assert.equal(h.diplomacy.getState('mongolia', 'china'), 'WAR');
  assert.equal(h.diplomacy.getHost('england'), 'mongolia');
});

test('save-restored vassal relationships retain automatic war behavior', () => {
  const original = new DiplomacyManager();
  original.establishVassal('england', 'mongolia');
  const saved = JSON.parse(JSON.stringify(original.getAllVassalRelationships()));
  const h = harness();
  h.diplomacy.restoreVassalRelationships(saved);
  h.diplomacy.declareWar('mongolia', 'china');
  assert.equal(h.diplomacy.getState('england', 'china'), 'WAR');
});
