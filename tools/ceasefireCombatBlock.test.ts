import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';

// A peace-summit ceasefire keeps two nations formally at WAR while forbidding
// direct attacks and city captures. DiplomacyManager.canAttack is the single gate
// used by both the human and AI combat paths, so a registered combat suppressor
// must block it without changing the diplomacy state.
test('combat suppressor blocks attacks while the pair stays at war', () => {
  const dm = new DiplomacyManager();
  dm.declareWar('ENG', 'FRA');
  assert.equal(dm.getState('ENG', 'FRA'), 'WAR');
  assert.equal(dm.canAttack('ENG', 'FRA'), true);

  let ceasefire = true;
  dm.setCombatSuppressor((a, b) =>
    ceasefire && [a, b].sort().join('|') === ['ENG', 'FRA'].sort().join('|'));

  // Still at war, but combat is suppressed by the ceasefire.
  assert.equal(dm.getState('ENG', 'FRA'), 'WAR');
  assert.equal(dm.canAttack('ENG', 'FRA'), false);
  assert.equal(dm.canAttack('FRA', 'ENG'), false);

  // Lifting the ceasefire restores normal wartime combat.
  ceasefire = false;
  assert.equal(dm.canAttack('ENG', 'FRA'), true);
});

test('combat suppressor never enables attacks between nations at peace', () => {
  const dm = new DiplomacyManager();
  dm.setCombatSuppressor(() => false);
  assert.equal(dm.canAttack('ENG', 'FRA'), false); // default PEACE
});
