import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  MilitaryVassalizationSystem,
  STRONG_ANTAGONIST_HOSTILITY_THRESHOLD,
  type CapitalReturnedEvent,
  type InheritedVassalDecisionRequest,
  type VassalSuccessionResolvedEvent,
} from '../src/systems/diplomacy/MilitaryVassalizationSystem.ts';

function harness(options: { humanVictor?: string } = {}) {
  const diplomacy = new DiplomacyManager(undefined, 0);
  const capitalOwners = new Map<string, string>();
  const decisions: Array<{
    request: InheritedVassalDecisionRequest;
    resolve: (decision: 'keep' | 'liberate') => void;
  }> = [];
  const succession: VassalSuccessionResolvedEvent[] = [];
  const capitalReturns: CapitalReturnedEvent[] = [];
  const system = new MilitaryVassalizationSystem(diplomacy, {
    isHumanNation: (nationId) => nationId === options.humanVictor,
    endWar: (a, b) => {
      if (diplomacy.getState(a, b) === 'WAR') diplomacy.respondToPeace(a, b, true);
    },
    restoreCapital: (cityId, defeatedNationId) => {
      capitalOwners.set(cityId, defeatedNationId);
      return true;
    },
    requestHumanDecision: (request, resolve) => decisions.push({ request, resolve }),
  });
  system.onSuccessionResolved((event) => succession.push(event));
  system.onCapitalReturned((event) => capitalReturns.push(event));
  return { diplomacy, capitalOwners, decisions, succession, capitalReturns, system };
}

test('capital military defeat creates vassalage, ends war, and returns the capital', () => {
  const h = harness();
  h.capitalOwners.set('karakorum', 'france');
  h.diplomacy.declareWar('france', 'mongolia');
  assert.equal(h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture',
    capturedCapital: { cityId: 'karakorum', cityName: 'Karakorum' },
  }), true);
  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.equal(h.diplomacy.getState('france', 'mongolia'), 'PEACE');
  assert.equal(h.capitalOwners.get('karakorum'), 'mongolia');
  assert.equal(h.capitalReturns.length, 1);
});

test('a human victor vassalizes an AI nation and immediately returns its capital when there are no successors', () => {
  const h = harness({ humanVictor: 'france' });
  h.capitalOwners.set('karakorum', 'france');
  h.diplomacy.declareWar('france', 'mongolia');
  assert.equal(h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture',
    capturedCapital: { cityId: 'karakorum', cityName: 'Karakorum' },
  }), true);
  assert.equal(h.decisions.length, 0);
  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.equal(h.capitalOwners.get('karakorum'), 'mongolia');
});

test('an AI victor vassalizes a human nation without prompting the defeated player', () => {
  const h = harness({ humanVictor: 'mongolia' });
  h.capitalOwners.set('karakorum', 'france');
  h.diplomacy.declareWar('france', 'mongolia');
  assert.equal(h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture',
    capturedCapital: { cityId: 'karakorum', cityName: 'Karakorum' },
  }), true);
  assert.equal(h.decisions.length, 0);
  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.equal(h.capitalOwners.get('karakorum'), 'mongolia');
});

test('formal capitulation uses the same transition without applying capital restoration', () => {
  const h = harness();
  h.diplomacy.declareWar('france', 'mongolia');
  assert.equal(h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitulation',
  }), true);
  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.deepEqual(h.capitalReturns, []);
});

test('AI liberates a neutral inherited vassal and resets memory with its former host', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 90, fear: 80, suspicion: 70, hostility: 60, affinity: 20,
  });
  // Compulsory old-host war against the victor is ended by succession.
  h.diplomacy.restoreState('england', 'france', { state: 'WAR', hostility: 20 });
  h.diplomacy.restoreState('mongolia', 'france', { state: 'WAR' });
  h.system.vassalize({ victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitulation' });

  assert.equal(h.diplomacy.isVassal('england'), false);
  assert.equal(h.diplomacy.getState('england', 'france'), 'PEACE');
  const formerHostRelation = h.diplomacy.getRelation('england', 'mongolia');
  assert.deepEqual(
    [formerHostRelation.trust, formerHostRelation.fear, formerHostRelation.suspicion, formerHostRelation.hostility, formerHostRelation.affinity],
    [0, 0, 0, 0, 50],
  );
  assert.equal(h.succession[0]?.decisionSource, 'notStronglyAntagonistic');
});

test('AI retains a strongly antagonistic inherited nation as a direct vassal', () => {
  const h = harness();
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.restoreState('england', 'france', {
    state: 'WAR', hostility: STRONG_ANTAGONIST_HOSTILITY_THRESHOLD,
  });
  h.diplomacy.restoreState('mongolia', 'france', { state: 'WAR' });
  h.system.vassalize({ victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture' });

  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.equal(h.diplomacy.getHost('england'), 'france');
  assert.equal(h.diplomacy.getVassals('mongolia').length, 0);
  assert.equal(h.diplomacy.getState('england', 'france'), 'PEACE');
  assert.equal(h.succession[0]?.decisionSource, 'strongAntagonism');
});

test('multiple inherited vassals are resolved individually in deterministic order', () => {
  const h = harness();
  h.diplomacy.establishVassal('sweden', 'mongolia');
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.setMemoryValues('france', 'england', {
    trust: 0, fear: 0, suspicion: 0, hostility: 80, affinity: 0,
  });
  h.diplomacy.setMemoryValues('france', 'sweden', {
    trust: 50, fear: 0, suspicion: 0, hostility: 10, affinity: 0,
  });
  h.system.vassalize({ victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitulation' });
  assert.deepEqual(h.succession.map((event) => [event.inheritedVassalNationId, event.decision]), [
    ['england', 'keep'], ['sweden', 'liberate'],
  ]);
  assert.equal(h.diplomacy.getHost('england'), 'france');
  assert.equal(h.diplomacy.isVassal('sweden'), false);
});

test('human victor receives one sequential Keep/Liberate choice per inherited vassal', () => {
  const h = harness({ humanVictor: 'france' });
  h.capitalOwners.set('karakorum', 'france');
  h.diplomacy.establishVassal('england', 'mongolia');
  h.diplomacy.establishVassal('sweden', 'mongolia');
  h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture',
    capturedCapital: { cityId: 'karakorum', cityName: 'Karakorum' },
  });
  assert.equal(h.decisions.length, 1);
  assert.equal(h.capitalOwners.get('karakorum'), 'france', 'capital waits until all choices resolve');
  h.decisions[0]!.resolve('keep');
  assert.equal(h.decisions.length, 2);
  h.decisions[1]!.resolve('liberate');
  assert.equal(h.diplomacy.getHost('england'), 'france');
  assert.equal(h.diplomacy.isVassal('sweden'), false);
  assert.equal(h.capitalOwners.get('karakorum'), 'mongolia');
});

test('an unexpected old host is removed before the defeated nation gets its single new host', () => {
  const h = harness();
  h.diplomacy.establishVassal('mongolia', 'china');
  h.system.vassalize({ victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture' });
  assert.equal(h.diplomacy.getHost('mongolia'), 'france');
  assert.deepEqual(h.diplomacy.getVassals('china'), []);
});

test('resolved succession and capital ownership survive JSON save boundaries', () => {
  const h = harness();
  h.capitalOwners.set('karakorum', 'france');
  h.diplomacy.establishVassal('england', 'mongolia');
  h.system.vassalize({
    victorNationId: 'france', defeatedNationId: 'mongolia', reason: 'capitalCapture',
    capturedCapital: { cityId: 'karakorum', cityName: 'Karakorum' },
  });
  const saved = JSON.parse(JSON.stringify({
    vassals: h.diplomacy.getAllVassalRelationships(),
    capitalOwner: h.capitalOwners.get('karakorum'),
  }));
  const restored = new DiplomacyManager();
  restored.restoreVassalRelationships(saved.vassals);
  assert.equal(saved.capitalOwner, 'mongolia');
  assert.equal(restored.getHost('mongolia'), 'france');
  assert.equal(restored.getVassals('mongolia').length, 0);
});
