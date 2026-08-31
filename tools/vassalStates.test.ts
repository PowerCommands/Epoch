import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';

test('vassal relationship API supports one host and multiple deterministic vassals', () => {
  const diplomacy = new DiplomacyManager();
  assert.equal(diplomacy.establishVassal('england', 'mongolia'), true);
  assert.equal(diplomacy.establishVassal('france', 'mongolia'), true);
  assert.equal(diplomacy.isVassal('england'), true);
  assert.equal(diplomacy.getHost('england'), 'mongolia');
  assert.deepEqual(diplomacy.getVassals('mongolia'), ['england', 'france']);

  diplomacy.establishVassal('england', 'sweden');
  assert.equal(diplomacy.getHost('england'), 'sweden');
  assert.deepEqual(diplomacy.getVassals('mongolia'), ['france']);
});

test('direct-only model rejects vassal chains in live state and restoration', () => {
  const diplomacy = new DiplomacyManager();
  diplomacy.establishVassal('england', 'mongolia');
  assert.equal(diplomacy.establishVassal('mongolia', 'china'), false);

  const restored = new DiplomacyManager();
  restored.restoreVassalRelationships([
    { vassalNationId: 'england', hostNationId: 'mongolia' },
    { vassalNationId: 'mongolia', hostNationId: 'china' },
  ]);
  assert.equal(restored.getAllVassalRelationships().length, 1);
});

test('only the host can release a vassal and release applies the amicable reset', () => {
  const diplomacy = new DiplomacyManager();
  const releaseEvents: unknown[] = [];
  diplomacy.onVassalReleased((event) => releaseEvents.push(event));
  diplomacy.establishVassal('england', 'mongolia');
  diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 80, fear: 70, suspicion: 60, hostility: 50, affinity: 30,
  });

  assert.equal(diplomacy.releaseVassal('england', 'england'), null, 'the vassal cannot release itself');
  const released = diplomacy.releaseVassal('mongolia', 'england');
  assert.deepEqual(released, {
    hostNationId: 'mongolia', vassalNationId: 'england', previousAffinity: 30, affinity: 50,
  });
  assert.deepEqual(releaseEvents, [released]);
  assert.equal(diplomacy.isVassal('england'), false);
  const relation = diplomacy.getRelation('england', 'mongolia');
  assert.deepEqual(
    { trust: relation.trust, fear: relation.fear, suspicion: relation.suspicion, hostility: relation.hostility, affinity: relation.affinity },
    { trust: 0, fear: 0, suspicion: 0, hostility: 0, affinity: 50 },
  );
});

test('release never lowers affinity above 50', () => {
  const diplomacy = new DiplomacyManager();
  diplomacy.establishVassal('england', 'mongolia');
  diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 1, fear: 2, suspicion: 3, hostility: 4, affinity: 65,
  });
  assert.equal(diplomacy.releaseVassal('mongolia', 'england')?.affinity, 65);
  assert.equal(diplomacy.getRelation('england', 'mongolia').affinity, 65);
});

test('vassal state and released independence both survive JSON save boundaries', () => {
  const original = new DiplomacyManager();
  original.establishVassal('england', 'mongolia');
  const savedVassals = JSON.parse(JSON.stringify(original.getAllVassalRelationships()));

  const loaded = new DiplomacyManager();
  loaded.restoreVassalRelationships(savedVassals);
  assert.equal(loaded.getHost('england'), 'mongolia');

  loaded.releaseVassal('mongolia', 'england');
  const releasedSave = JSON.parse(JSON.stringify(loaded.getAllVassalRelationships()));
  const reloaded = new DiplomacyManager();
  reloaded.restoreVassalRelationships(releasedSave);
  assert.equal(reloaded.isVassal('england'), false);
});
