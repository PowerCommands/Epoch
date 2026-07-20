/**
 * Focused tests for Multilateral Aggression Memory.
 *
 * Third-party nations should gain diplomatic memory of wars and conquests they
 * witness, so that a serial conqueror gradually reads as a geopolitical threat
 * to nations it never attacked.
 *
 * Run with:  npx tsx --test tools/multilateralAggressionMemory.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiplomacyManager, DEFAULT_TRUST } from '../src/systems/DiplomacyManager.ts';
import {
  DiplomaticMemorySystem,
  type MultilateralAggressionContext,
} from '../src/systems/diplomacy/DiplomaticMemorySystem.ts';
import {
  AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS,
  AGGRESSION_MEMORY_DECAY_RATE,
  AGGRESSION_MEMORY_LOG_PREFIX,
  AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS,
  OBSERVER_AGGRESSION_DELTAS,
} from '../src/data/multilateralAggression.ts';

// --- helpers ------------------------------------------------------------

const ENGLAND = 'nation_england';
const CHINA = 'nation_china';
const INDIA = 'nation_india';
const SWEDEN = 'nation_sweden';
const MONGOLIA = 'nation_mongolia';
const HERMIT = 'nation_hermit'; // met nobody
const GHOST = 'nation_ghost';   // eliminated (no cities)

interface Harness {
  diplomacy: DiplomacyManager;
  memory: DiplomaticMemorySystem;
  logs: string[];
}

/**
 * All nations have met each other except HERMIT (met nobody) and GHOST
 * (eliminated — met everyone, but holds no cities).
 */
function createHarness(options: { inactive?: readonly string[] } = {}): Harness {
  const diplomacy = new DiplomacyManager();
  const memory = new DiplomaticMemorySystem(diplomacy);
  const logs: string[] = [];
  const inactive = new Set(options.inactive ?? [GHOST]);

  const context: MultilateralAggressionContext = {
    getAllNationIds: () => [ENGLAND, CHINA, INDIA, SWEDEN, MONGOLIA, HERMIT, GHOST],
    haveMet: (a, b) => a !== HERMIT && b !== HERMIT,
    isNationActive: (nationId) => !inactive.has(nationId),
    log: (line) => logs.push(line),
  };
  memory.setMultilateralAggressionContext(context);
  return { diplomacy, memory, logs };
}

function rel(h: Harness, a: string, b: string) {
  const r = h.diplomacy.getRelation(a, b);
  return { trust: r.trust, fear: r.fear, hostility: r.hostility };
}

/** Run England's full conquest of one nation, as it played out in the autorun. */
function conquer(
  h: Harness,
  victim: string,
  options: { ordinaryCities: number; round?: number },
): void {
  const round = options.round ?? 100;
  h.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: victim, round,
  });
  for (let i = 0; i < options.ordinaryCities; i++) {
    h.memory.recordAggressionForObservers({
      type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: victim, round, cityName: `city_${i}`,
    });
  }
  h.memory.recordAggressionForObservers({
    type: 'capital_capture', aggressorNationId: ENGLAND, victimNationId: victim, round, cityName: 'capital',
  });
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: victim, round,
  });
}

// --- 1. war declaration creates a small observer reaction ----------------

test('war declaration creates a small third-party observer reaction', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  const sweden = rel(h, SWEDEN, ENGLAND);
  const expected = OBSERVER_AGGRESSION_DELTAS.war_declaration;
  assert.equal(sweden.trust, DEFAULT_TRUST + expected.trust);
  assert.equal(sweden.fear, expected.fear);
  assert.equal(sweden.hostility, expected.hostility);

  // Deliberately nowhere near the hostile (50) / afraid (50) / low-trust (20)
  // thresholds in DiplomaticEvaluationSystem.
  assert.ok(sweden.hostility < 50, 'one war declaration must not create hostility');
  assert.ok(sweden.fear < 50, 'one war declaration must not create fear');
  assert.ok(sweden.trust > 20, 'one war declaration must not collapse trust');
});

// --- 2. the direct victim gets no observer delta -------------------------

test('the direct victim does not receive duplicate observer deltas', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  assert.deepEqual(rel(h, CHINA, ENGLAND), { trust: DEFAULT_TRUST, fear: 0, hostility: 0 });
  assert.deepEqual(
    h.memory.getObserverAggressionLedger(CHINA, ENGLAND),
    { trustLost: 0, fearGained: 0, hostilityGained: 0 },
  );
});

// --- 3. the aggressor does not react to itself ---------------------------

test('the aggressor does not react to itself', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  assert.deepEqual(
    h.memory.getObserverAggressionLedger(ENGLAND, ENGLAND),
    { trustLost: 0, fearGained: 0, hostilityGained: 0 },
  );
  assert.ok(!h.logs.some((line) => line.includes(`observer=${ENGLAND}`)));
});

// --- 4. contact gating ---------------------------------------------------

test('nations without contact do not react', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  // HERMIT has met neither party.
  assert.deepEqual(rel(h, HERMIT, ENGLAND), { trust: DEFAULT_TRUST, fear: 0, hostility: 0 });
});

test('an observer that has met the aggressor but not the victim does not react', () => {
  const diplomacy = new DiplomacyManager();
  const memory = new DiplomaticMemorySystem(diplomacy);
  memory.setMultilateralAggressionContext({
    getAllNationIds: () => [ENGLAND, CHINA, SWEDEN],
    // Sweden knows England, but has never discovered China.
    haveMet: (a, b) => !(a === CHINA || b === CHINA) || (a === ENGLAND || b === ENGLAND),
    isNationActive: () => true,
    log: () => {},
  });

  memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  const sweden = diplomacy.getRelation(SWEDEN, ENGLAND);
  assert.equal(sweden.fear, 0, 'cannot react to a war between civilizations it has not discovered');
  assert.equal(sweden.hostility, 0);
});

// --- 5. eliminated nations do not react ----------------------------------

test('eliminated nations do not react', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  assert.deepEqual(rel(h, GHOST, ENGLAND), { trust: DEFAULT_TRUST, fear: 0, hostility: 0 });
});

// --- 6/7/8. severity ordering --------------------------------------------

test('city capture creates a stronger cumulative reaction than war declaration alone', () => {
  const warOnly = createHarness();
  warOnly.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  const warAndCity = createHarness();
  warAndCity.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });
  warAndCity.memory.recordAggressionForObservers({
    type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 12, cityName: 'Shanghai',
  });

  const a = rel(warOnly, SWEDEN, ENGLAND);
  const b = rel(warAndCity, SWEDEN, ENGLAND);
  assert.ok(b.fear > a.fear);
  assert.ok(b.hostility > a.hostility);
  assert.ok(b.trust < a.trust);
});

test('capital capture creates a larger reaction than an ordinary city capture', () => {
  const ordinary = createHarness();
  ordinary.memory.recordAggressionForObservers({
    type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10, cityName: 'Shanghai',
  });

  const capital = createHarness();
  capital.memory.recordAggressionForObservers({
    type: 'capital_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10, cityName: 'Beijing',
  });

  const a = rel(ordinary, SWEDEN, ENGLAND);
  const b = rel(capital, SWEDEN, ENGLAND);
  assert.ok(b.fear > a.fear, 'capital capture must outweigh an ordinary city');
  assert.ok(b.hostility > a.hostility);
  assert.ok(b.trust < a.trust);
});

test('nation elimination is the strongest single observer reaction', () => {
  const deltas = OBSERVER_AGGRESSION_DELTAS;
  for (const type of ['war_declaration', 'city_capture', 'capital_capture'] as const) {
    assert.ok(deltas.nation_elimination.fear > deltas[type].fear, `elimination fear > ${type}`);
    assert.ok(deltas.nation_elimination.hostility > deltas[type].hostility, `elimination hostility > ${type}`);
    assert.ok(deltas.nation_elimination.trust < deltas[type].trust, `elimination trust loss > ${type}`);
  }
});

// --- 9. accumulation -----------------------------------------------------

test('repeated aggression accumulates against the same aggressor', () => {
  const h = createHarness();
  const readings: number[] = [];
  for (let i = 0; i < 4; i++) {
    h.memory.recordAggressionForObservers({
      type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10 + i, cityName: `c${i}`,
    });
    readings.push(rel(h, SWEDEN, ENGLAND).hostility);
  }
  assert.deepEqual(readings, [...readings].sort((x, y) => x - y), 'hostility must be monotonically increasing');
  assert.ok(readings[3]! > readings[0]!);
});

// --- 10. accumulation across victims -------------------------------------

test('aggression against a second nation continues accumulating against the same aggressor', () => {
  const h = createHarness();

  // England conquers China: war + 3 ordinary cities + capital + elimination.
  conquer(h, CHINA, { ordinaryCities: 3, round: 100 });
  const afterChina = rel(h, MONGOLIA, ENGLAND);

  // ...then India: war + 5 ordinary cities + capital + elimination.
  conquer(h, INDIA, { ordinaryCities: 5, round: 200 });
  const afterIndia = rel(h, MONGOLIA, ENGLAND);

  assert.ok(afterIndia.fear > afterChina.fear, 'second conquest compounds fear');
  assert.ok(afterIndia.hostility > afterChina.hostility, 'second conquest compounds hostility');
  assert.ok(afterIndia.trust < afterChina.trust, 'second conquest compounds trust loss');

  // The headline regression from the analysis: after two eliminations it must
  // no longer be plausible for Mongolia to sit at trust 100 / fear 0 / hostility 0.
  assert.ok(afterIndia.hostility >= 50, `expected hostile-level hostility, got ${afterIndia.hostility}`);
  assert.ok(afterIndia.fear > 0);
  assert.ok(afterIndia.trust < DEFAULT_TRUST);
});

test('one conquest reads as serious concern without yet being outright hostile', () => {
  const h = createHarness();
  conquer(h, CHINA, { ordinaryCities: 3, round: 100 });
  const sweden = rel(h, SWEDEN, ENGLAND);

  // Meaningful, but a single campaign should not by itself flip the world hostile.
  assert.ok(sweden.hostility > 20, `expected clear concern, got hostility ${sweden.hostility}`);
  assert.ok(sweden.hostility < 50, `one conquest should stay below the hostile threshold, got ${sweden.hostility}`);
  assert.ok(sweden.fear > 0);

  // JointWarSystem reads hostility/18 + fear/30; this must be a real contribution.
  const jointWarContribution = sweden.hostility / 18 + sweden.fear / 30;
  assert.ok(jointWarContribution > 1, `expected a meaningful joint-war signal, got ${jointWarContribution}`);
});

// --- 11. bilateral memory unchanged --------------------------------------

test('existing bilateral victim memory still works unchanged', () => {
  const h = createHarness();

  h.memory.onDeclareWar(ENGLAND, CHINA);
  const afterWar = rel(h, ENGLAND, CHINA);
  assert.equal(afterWar.hostility, 30);
  assert.equal(afterWar.fear, 10);
  assert.equal(afterWar.trust, DEFAULT_TRUST - 25);

  h.memory.onCityCaptured(ENGLAND, CHINA);
  const afterCapture = rel(h, ENGLAND, CHINA);
  assert.equal(afterCapture.hostility, 70);
  assert.equal(afterCapture.fear, 30);
  assert.equal(afterCapture.trust, 5);

  // The bilateral path must not touch the observer ledger.
  assert.deepEqual(
    h.memory.getObserverAggressionLedger(ENGLAND, CHINA),
    { trustLost: 0, fearGained: 0, hostilityGained: 0 },
  );
});

test('bilateral memory works with no multilateral context attached', () => {
  const diplomacy = new DiplomacyManager();
  const memory = new DiplomaticMemorySystem(diplomacy);
  // No context set — the multilateral path must be inert, not throw.
  memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });
  memory.decayObserverAggressionMemory(AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS);

  memory.onDeclareWar(ENGLAND, CHINA);
  assert.equal(diplomacy.getRelation(ENGLAND, CHINA).hostility, 30);
  assert.equal(diplomacy.getRelation(SWEDEN, ENGLAND).hostility, 0);
});

// --- 12. decay -----------------------------------------------------------

test('observer aggression memory decays over peaceful time', () => {
  const h = createHarness();
  conquer(h, CHINA, { ordinaryCities: 3, round: 100 });
  const peak = rel(h, SWEDEN, ENGLAND);

  // 40 rounds of peace = 10 decay steps at the 4-round cadence.
  for (let round = 101; round <= 140; round++) {
    h.memory.decayObserverAggressionMemory(round);
  }
  const decayed = rel(h, SWEDEN, ENGLAND);

  assert.ok(decayed.fear < peak.fear, 'fear should relax');
  assert.ok(decayed.hostility < peak.hostility, 'hostility should relax');
  assert.ok(decayed.trust > peak.trust, 'trust should recover');

  // Slow enough that a destroyed civilization is not forgotten quickly.
  assert.ok(decayed.hostility > 0, 'an eliminated civilization is not forgotten in 40 turns');
});

test('decay only unwinds observer-derived movement, never bilateral war memory', () => {
  const h = createHarness();

  // Sweden is attacked by England directly — pure bilateral memory.
  h.memory.onDeclareWar(ENGLAND, SWEDEN);
  h.memory.onCityCaptured(ENGLAND, SWEDEN);
  const bilateral = rel(h, SWEDEN, ENGLAND);

  // Many decay rounds with nothing in the ledger for this pair.
  for (let round = 4; round <= 400; round += 4) {
    h.memory.decayObserverAggressionMemory(round);
  }

  assert.deepEqual(rel(h, SWEDEN, ENGLAND), bilateral, 'bilateral memory must be untouched by decay');
});

test('decay never returns more than the observer path contributed', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  for (let round = 4; round <= 4000; round += 4) {
    h.memory.decayObserverAggressionMemory(round);
  }

  // Fully rehabilitated — back to the untouched baseline, never past it.
  assert.deepEqual(rel(h, SWEDEN, ENGLAND), { trust: DEFAULT_TRUST, fear: 0, hostility: 0 });
});

test('decay only acts on the configured cadence', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10, cityName: 'Shanghai',
  });
  const before = rel(h, SWEDEN, ENGLAND);

  // Past the peace cooldown, so only the cadence is under test here.
  const settled = 10 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS;
  const offCadence = settled + (AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS - (settled % AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS)) + 1;
  assert.notEqual(offCadence % AGGRESSION_MEMORY_DECAY_INTERVAL_ROUNDS, 0);

  // A round that is not on the cadence must change nothing.
  h.memory.decayObserverAggressionMemory(offCadence);
  assert.deepEqual(rel(h, SWEDEN, ENGLAND), before);

  // The next on-cadence round does decay.
  h.memory.decayObserverAggressionMemory(offCadence + 3);
  assert.ok(rel(h, SWEDEN, ENGLAND).hostility < before.hostility);
});

// --- 13. proportional decay calibration ----------------------------------
//
// These cover the recalibration that replaced flat ±1/4-rounds decay. The
// measured failure being guarded against is in
// autorun-output/maritime-expansion-aggression-memory-test: six England city
// captures across 52 turns left Mongolia at trust 96-100 / fear 5-7 /
// hostility 7, because flat decay returned as much as each capture took.

/** Advance `rounds` rounds of pure peace from `from`, running decay each round. */
function peace(h: Harness, from: number, rounds: number): void {
  for (let r = from; r < from + rounds; r++) h.memory.decayObserverAggressionMemory(r);
}

function capture(h: Harness, round: number, victim = CHINA): void {
  h.memory.recordAggressionForObservers({
    type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: victim, round, cityName: `c${round}`,
  });
}

test('event deltas are unchanged by the decay recalibration', () => {
  // The calibration task changed decay only; severity must be untouched.
  assert.deepEqual(OBSERVER_AGGRESSION_DELTAS.war_declaration, { trust: -4, fear: 2, hostility: 3 });
  assert.deepEqual(OBSERVER_AGGRESSION_DELTAS.city_capture, { trust: -3, fear: 3, hostility: 4 });
  assert.deepEqual(OBSERVER_AGGRESSION_DELTAS.capital_capture, { trust: -8, fear: 7, hostility: 10 });
  assert.deepEqual(OBSERVER_AGGRESSION_DELTAS.nation_elimination, { trust: -18, fear: 12, hostility: 20 });
});

test('no decay occurs before the peace cooldown expires', () => {
  const h = createHarness();
  capture(h, 100);
  const peak = rel(h, SWEDEN, ENGLAND);

  // One round short of the cooldown: memory must be exactly untouched.
  peace(h, 101, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 1);
  assert.deepEqual(rel(h, SWEDEN, ENGLAND), peak, 'memory must not thaw during the cooldown');
});

test('a new qualifying aggressive action resets the cooldown', () => {
  const h = createHarness();
  capture(h, 100);

  // Wait almost the whole cooldown, then offend again.
  peace(h, 101, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);
  capture(h, 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 1);
  const afterSecond = rel(h, SWEDEN, ENGLAND);

  // The clock restarted, so the original cooldown window must no longer decay.
  peace(h, 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);
  assert.deepEqual(rel(h, SWEDEN, ENGLAND), afterSecond, 'renewed aggression must restart the cooldown');
});

test('six captures spaced 10 rounds apart accumulate instead of cancelling', () => {
  const h = createHarness();
  const trustReadings: number[] = [];
  for (let i = 0; i < 6; i++) {
    const round = 100 + i * 10;
    capture(h, round);
    trustReadings.push(rel(h, SWEDEN, ENGLAND).trust);
    peace(h, round + 1, 9);
  }
  const after = rel(h, SWEDEN, ENGLAND);

  // The exact regression: trust used to return to ~baseline before each capture.
  assert.ok(
    trustReadings.every((t, i) => i === 0 || t < trustReadings[i - 1]!),
    `trust must fall monotonically across captures, got ${trustReadings.join(', ')}`,
  );
  // Six captures at -3 each; the old model netted ~0.
  assert.ok(after.trust <= DEFAULT_TRUST - 15, `expected real trust damage, got ${after.trust}`);
  assert.ok(after.hostility >= 20, `expected accumulated hostility, got ${after.hostility}`);
  assert.ok(after.fear >= 15, `expected accumulated fear, got ${after.fear}`);
});

test('capital-capture memory is still substantial after 36 rounds', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'capital_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 100, cityName: 'Beijing',
  });
  const peak = rel(h, SWEDEN, ENGLAND);

  peace(h, 101, 36);
  const after = rel(h, SWEDEN, ENGLAND);

  // Previously ~85% was erased over this window.
  const retained = after.hostility / peak.hostility;
  assert.ok(retained > 0.75, `expected >75% of capital-capture hostility retained, got ${(retained * 100).toFixed(0)}%`);
});

test('nation-elimination memory is still meaningful after 90 rounds', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 100,
  });
  peace(h, 101, 90);
  const after = rel(h, SWEDEN, ENGLAND);

  // The old flat model fully erased +20 hostility in ~80 rounds.
  assert.ok(after.hostility > 8, `an annihilated civilization must not be forgotten in 90 rounds, got ${after.hostility}`);
  assert.ok(after.trust < DEFAULT_TRUST - 5, `trust must not have recovered, got ${after.trust}`);
});

test('multiple eliminations accumulate into substantial geopolitical pressure', () => {
  const h = createHarness();
  conquer(h, CHINA, { ordinaryCities: 3, round: 100 });
  peace(h, 130, 60);
  conquer(h, INDIA, { ordinaryCities: 4, round: 200 });
  const after = rel(h, MONGOLIA, ENGLAND);

  // Must be readable by DiplomaticEvaluationSystem as a genuine threat:
  // hostility >= 50 or trust <= 20 classifies hostile; fear >= 50 is afraid.
  assert.ok(after.hostility >= 50, `two eliminations must read hostile, got ${after.hostility}`);
  assert.ok(after.fear >= 30, `two eliminations must create real fear, got ${after.fear}`);
  assert.ok(after.trust <= 20, `two eliminations must collapse trust, got ${after.trust}`);
});

test('proportional decay begins once the cooldown expires', () => {
  const h = createHarness();
  capture(h, 100);
  const peak = rel(h, SWEDEN, ENGLAND);

  peace(h, 101, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS + 40);
  const after = rel(h, SWEDEN, ENGLAND);

  assert.ok(after.hostility < peak.hostility, 'decay must start after the cooldown');
  assert.ok(after.hostility > 0, 'decay is gradual, not a reset');
  assert.ok(after.trust > peak.trust, 'trust must recover');
});

test('decay is proportional: a large memory sheds more per interval than a small one', () => {
  const big = createHarness();
  big.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 100,
  });
  const small = createHarness();
  small.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 100,
  });

  const bigPeak = rel(big, SWEDEN, ENGLAND).hostility;
  const smallPeak = rel(small, SWEDEN, ENGLAND).hostility;
  const settle = AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS + 40;
  peace(big, 101, settle);
  peace(small, 101, settle);

  const bigShed = bigPeak - rel(big, SWEDEN, ENGLAND).hostility;
  const smallShed = smallPeak - rel(small, SWEDEN, ENGLAND).hostility;
  assert.ok(bigShed > smallShed, 'proportional decay sheds more absolute points from a larger memory');

  // ...but the same *fraction*, which is what makes a big reputation durable.
  const bigFraction = bigShed / bigPeak;
  const smallFraction = smallShed / smallPeak;
  assert.ok(Math.abs(bigFraction - smallFraction) < 0.02, 'relative decay rate must be scale-independent');
});

test('a large memory takes far longer to clear than under the old flat model', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'nation_elimination', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 100,
  });
  // The old flat model erased +20 hostility in 80 rounds (1 per 4 rounds).
  peace(h, 101, 80);
  assert.ok(
    rel(h, SWEDEN, ENGLAND).hostility > 10,
    'the flat model fully erased an elimination in 80 rounds; proportional decay must not',
  );
});

test('small memories fully clear and do not become immortal through rounding', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'war_declaration', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 10,
  });

  peace(h, 11, 4000);
  assert.deepEqual(
    rel(h, SWEDEN, ENGLAND),
    { trust: DEFAULT_TRUST, fear: 0, hostility: 0 },
    'a minor incident must eventually be forgotten exactly, with no floating-point residue',
  );
  assert.deepEqual(
    h.memory.getObserverAggressionLedger(SWEDEN, ENGLAND),
    { trustLost: 0, fearGained: 0, hostilityGained: 0 },
  );
});

test('decay is deterministic across identical runs', () => {
  const run = () => {
    const h = createHarness();
    conquer(h, CHINA, { ordinaryCities: 3, round: 100 });
    peace(h, 130, 200);
    capture(h, 330);
    peace(h, 331, 150);
    return rel(h, SWEDEN, ENGLAND);
  };
  assert.deepEqual(run(), run(), 'identical event sequences must produce identical relations');
});

test('proportional decay still cannot erase bilateral direct-war memory', () => {
  const h = createHarness();

  // Sweden is attacked directly by England, and also witnesses England
  // conquering China — both paths write the same relation.
  h.memory.onDeclareWar(ENGLAND, SWEDEN);
  h.memory.onCityCaptured(ENGLAND, SWEDEN);
  const bilateralOnly = rel(h, SWEDEN, ENGLAND);

  conquer(h, CHINA, { ordinaryCities: 2, round: 100 });
  peace(h, 130, 4000);

  const after = rel(h, SWEDEN, ENGLAND);
  assert.equal(after.hostility, bilateralOnly.hostility, 'bilateral hostility must survive unbounded decay');
  assert.equal(after.fear, bilateralOnly.fear, 'bilateral fear must survive unbounded decay');
  assert.equal(after.trust, bilateralOnly.trust, 'bilateral trust damage must survive unbounded decay');
});

test('the peace cooldown is keyed to the aggressor, not to any one observer', () => {
  const h = createHarness();
  // England offends against China (seen by Sweden, India, Mongolia), then
  // later against India — the second act must freeze *everyone's* memory.
  capture(h, 100, CHINA);
  peace(h, 101, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);
  capture(h, 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 1, INDIA);

  const swedenAfter = rel(h, SWEDEN, ENGLAND);
  const mongoliaAfter = rel(h, MONGOLIA, ENGLAND);
  peace(h, 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);

  assert.deepEqual(rel(h, SWEDEN, ENGLAND), swedenAfter);
  assert.deepEqual(rel(h, MONGOLIA, ENGLAND), mongoliaAfter);
});

test('an aggressor with no eligible observers still restarts its own cooldown', () => {
  // Regression guard: the cooldown stamp must not sit inside the observer
  // loop, or aggression witnessed by nobody would silently allow rehabilitation.
  const h = createHarness();
  capture(h, 100, CHINA);
  const peak = rel(h, SWEDEN, ENGLAND);

  peace(h, 101, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);
  // England attacks HERMIT, whom nobody has met — zero observer events fire.
  h.memory.recordAggressionForObservers({
    type: 'city_capture', aggressorNationId: ENGLAND, victimNationId: HERMIT,
    round: 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 1, cityName: 'hidden',
  });

  peace(h, 100 + AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS, AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS - 2);
  assert.deepEqual(rel(h, SWEDEN, ENGLAND), peak, 'unwitnessed aggression must still block rehabilitation');
});

test('the documented decay rate stays inside the intended calibration band', () => {
  assert.ok(AGGRESSION_MEMORY_DECAY_RATE >= 0.02 && AGGRESSION_MEMORY_DECAY_RATE <= 0.03);
  assert.ok(
    AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS >= 20 && AGGRESSION_MEMORY_PEACE_COOLDOWN_ROUNDS <= 30,
  );
});

// --- logging -------------------------------------------------------------

test('logs are machine-searchable and carry the full reconstruction payload', () => {
  const h = createHarness();
  h.memory.recordAggressionForObservers({
    type: 'capital_capture', aggressorNationId: ENGLAND, victimNationId: CHINA, round: 239, cityName: 'Beijing',
  });

  const line = h.logs.find((l) => l.includes(`observer=${SWEDEN}`));
  assert.ok(line, 'expected an observer log line for Sweden');
  assert.ok(line!.startsWith(AGGRESSION_MEMORY_LOG_PREFIX));
  for (const fragment of [
    'r239', 'event=capital_capture', `aggressor=${ENGLAND}`, `victim=${CHINA}`,
    `observer=${SWEDEN}`, 'city=Beijing', 'trust ', 'fear ', 'hostility ',
  ]) {
    assert.ok(line!.includes(fragment), `log line missing "${fragment}": ${line}`);
  }

  // One line per eligible observer: Sweden, India, Mongolia (not England,
  // China, HERMIT or GHOST).
  assert.equal(h.logs.length, 3, `expected 3 observer lines, got ${h.logs.length}`);
});
