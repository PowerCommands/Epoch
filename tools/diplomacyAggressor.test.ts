import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';

test('isActiveWarAggressor reports only the recorded aggressor of an active war', () => {
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar('germany', 'poland');

  assert.equal(diplomacy.isActiveWarAggressor('germany'), true);
  assert.equal(diplomacy.isActiveWarAggressor('poland'), false); // the defender is never an aggressor
  assert.equal(diplomacy.isActiveWarAggressor('france'), false);
});

test('a former aggressor is no longer flagged once the war ends', () => {
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar('germany', 'poland');
  assert.equal(diplomacy.isActiveWarAggressor('germany'), true);

  diplomacy.enforceCeasefire('germany', 'poland', 5, 20);
  assert.equal(diplomacy.isActiveWarAggressor('germany'), false);
});

test('aggression in any one active war is sufficient', () => {
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar('france', 'germany'); // germany defends here
  diplomacy.declareWar('germany', 'poland'); // germany is the aggressor here

  assert.equal(diplomacy.isActiveWarAggressor('germany'), true);
  assert.equal(diplomacy.isActiveWarAggressor('poland'), false);
});
