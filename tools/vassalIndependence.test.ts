import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  VASSAL_INDEPENDENCE_COST,
  VassalIndependenceSystem,
} from '../src/systems/diplomacy/VassalIndependenceSystem.ts';

function harness(vassalGold: number) {
  const diplomacy = new DiplomacyManager();
  diplomacy.establishVassal('england', 'mongolia');
  const gold = new Map([['england', vassalGold], ['mongolia', 50_000]]);
  const system = new VassalIndependenceSystem(diplomacy, {
    getGold: (nationId) => gold.get(nationId) ?? 0,
    transferGold: (from, to, amount) => {
      if ((gold.get(from) ?? 0) < amount) return false;
      gold.set(from, (gold.get(from) ?? 0) - amount);
      gold.set(to, (gold.get(to) ?? 0) + amount);
      return true;
    },
  });
  return { diplomacy, gold, system };
}

test('independence price is the centralized 200,000 Gold constant', () => {
  assert.equal(VASSAL_INDEPENDENCE_COST, 200_000);
});

test('a vassal below the price cannot purchase independence', () => {
  const h = harness(199_999);
  assert.equal(h.system.canBuyIndependence('england').ok, false);
  assert.match(h.system.canBuyIndependence('england').reason ?? '', /200,000 Gold/);
  assert.equal(h.system.buyIndependence('england'), null);
  assert.equal(h.diplomacy.getHost('england'), 'mongolia');
});

test('purchase transfers exactly 200,000 Gold, ends vassalage, and reconciles relations', () => {
  const h = harness(250_000);
  h.diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 11, fear: 22, suspicion: 33, hostility: 44, affinity: 65,
  });
  const events: unknown[] = [];
  h.system.onPurchased((event) => events.push(event));
  const result = h.system.buyIndependence('england');
  assert.deepEqual(result, {
    vassalNationId: 'england', hostNationId: 'mongolia', goldTransferred: 200_000,
    previousAffinity: 65, affinity: 65,
  });
  assert.deepEqual(events, [result]);
  assert.equal(h.gold.get('england'), 50_000);
  assert.equal(h.gold.get('mongolia'), 250_000);
  assert.equal(h.diplomacy.isVassal('england'), false);
  // Negative memory is zeroed and affinity is lifted to at least 50 (here it
  // stays 65), mirroring the peaceful release reconciliation.
  const relation = h.diplomacy.getRelation('england', 'mongolia');
  assert.deepEqual(
    [relation.trust, relation.fear, relation.suspicion, relation.hostility, relation.affinity],
    [0, 0, 0, 0, 65],
  );
});

test('independence stamps a peace treaty so the former host cannot immediately re-declare war', () => {
  const h = harness(250_000);
  h.diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 0, fear: 60, suspicion: 40, hostility: 80, affinity: 5,
  });
  h.system.buyIndependence('england');
  // A negotiated-independence peace guarantee is in force for both directions,
  // blocking the dominant former host from reconquering the freed nation on the
  // very next turn.
  assert.equal(h.diplomacy.isPeaceTreatyActive('mongolia', 'england', 0), true);
  assert.equal(h.diplomacy.getPeaceTreatyRemainingTurns('mongolia', 'england', 0) > 0, true);
  assert.equal(h.diplomacy.canDeclareWar('mongolia', 'england'), false);
  assert.equal(h.diplomacy.canDeclareWar('england', 'mongolia'), false);
});

test('independence lifts a low affinity up to the reconciliation floor of 50', () => {
  const h = harness(250_000);
  h.diplomacy.setMemoryValues('england', 'mongolia', {
    trust: 0, fear: 60, suspicion: 40, hostility: 80, affinity: 5,
  });
  const result = h.system.buyIndependence('england');
  assert.equal(result?.previousAffinity, 5);
  assert.equal(result?.affinity, 50);
  const relation = h.diplomacy.getRelation('england', 'mongolia');
  assert.deepEqual(
    [relation.trust, relation.fear, relation.suspicion, relation.hostility, relation.affinity],
    [0, 0, 0, 0, 50],
  );
});
