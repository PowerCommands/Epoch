import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import { ScenarioHistoricalEventSystem } from '../src/systems/ScenarioHistoricalEventSystem';
import { TurnManager } from '../src/systems/TurnManager';
import {
  AUTO_MODERN_CADENCE_ASTRO_YEAR,
  AUTO_MODERN_CADENCE_MONTHS_PER_TURN,
  autoProgressedYears,
  computeGameDate,
  gameDateToMonthOrdinal,
} from '../src/systems/GameDate';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import type {
  ScenarioMeta,
  ScenarioTimeProgression,
  ScenarioWorldWarHistoricalEvent,
} from '../src/types/scenario';

const GERMANY = 'germany';
const ENGLAND = 'england';
const FRANCE = 'france';
const IDS = [GERMANY, ENGLAND, FRANCE];

/** Resolve auto/staticYear/monthly scenario meta with a 4000 BC default start. */
function meta(
  progression: ScenarioTimeProgression = { mode: 'auto' },
  startYear = 4000,
  startYearIsBC = true,
) {
  const raw: ScenarioMeta = {
    name: 'Calendar test', version: 1, startYear, startYearIsBC, timeProgression: progression,
  };
  return resolveScenarioMeta(raw);
}

/** First round whose Auto date reaches/passes the given AD year. */
function roundReachingYear(year: number, mult = 1): number {
  const m = meta();
  for (let round = 1; round <= 20000; round += 1) {
    if (computeGameDate(m, round, mult).signedYear >= year) return round;
  }
  throw new Error(`year ${year} never reached`);
}

// ── 1. Auto behavior before 1900 is unchanged (dynamic yearly, January only) ──
test('1: Auto before 1900 matches the unmodified yearly curve', () => {
  const m = meta();
  const astroStart = -3999; // astronomical year for 4000 BC (1 - 4000)
  for (let round = 1; round <= 6000; round += 1) {
    const date = computeGameDate(m, round, 1);
    if (date.signedYear >= AUTO_MODERN_CADENCE_ASTRO_YEAR) break;
    const astro = astroStart + autoProgressedYears(round, 1);
    const expectedSignedYear = astro >= 1 ? astro : astro - 1;
    assert.equal(date.signedYear, expectedSignedYear);
    assert.equal(date.monthIndex, 0, 'pre-1900 Auto is always January');
  }
});

// ── 2. Clean transition into the fixed cadence at the 1900 threshold ──────────
test('2: transition lands on January 1900 with no strange intermediate date', () => {
  const m = meta();
  const r0 = roundReachingYear(1900);

  const before = computeGameDate(m, r0 - 1, 1);
  assert.equal(before.signedYear, 1899);
  assert.equal(before.monthName, 'January');

  const at = computeGameDate(m, r0, 1);
  assert.equal(at.signedYear, 1900);
  assert.equal(at.monthName, 'January');

  const next = computeGameDate(m, r0 + 1, 1);
  assert.equal(next.signedYear, 1900);
  assert.equal(next.monthName, 'July');
});

// ── 3 & 4 & 5. Exactly six months per turn, alternating Jan/Jul, no drift ─────
test('3-5: every post-1900 turn advances exactly six months, alternating Jan/Jul', () => {
  const m = meta();
  const r0 = roundReachingYear(1900);

  let previousOrdinal = gameDateToMonthOrdinal(computeGameDate(m, r0, 1));
  for (let k = 0; k <= 400; k += 1) {
    const date = computeGameDate(m, r0 + k, 1);
    // Alternation and absence of accumulated drift: closed-form expectation.
    const expectedYear = 1900 + Math.floor(k / 2);
    const expectedMonth = (k % 2) * AUTO_MODERN_CADENCE_MONTHS_PER_TURN; // 0 or 6
    assert.equal(date.signedYear, expectedYear, `year at k=${k}`);
    assert.equal(date.monthIndex, expectedMonth, `month at k=${k}`);
    assert.equal(date.monthName, k % 2 === 0 ? 'January' : 'July');

    if (k > 0) {
      const ordinal = gameDateToMonthOrdinal(date);
      assert.equal(ordinal - previousOrdinal, 6, `six-month step at k=${k}`);
      previousOrdinal = ordinal;
    }
  }
});

// The fixed cadence must hold across game speeds (progression multiplier).
test('3-5 (game speeds): six-month cadence holds for quick and marathon speeds', () => {
  for (const mult of [1.25, 0.5]) {
    const m = meta();
    const r0 = roundReachingYear(1900, mult);
    for (let k = 0; k <= 100; k += 1) {
      const date = computeGameDate(m, r0 + k, mult);
      assert.equal(date.signedYear, 1900 + Math.floor(k / 2), `mult ${mult} year k=${k}`);
      assert.equal(date.monthIndex, (k % 2) * 6, `mult ${mult} month k=${k}`);
    }
  }
});

// ── Other calendar modes remain unaffected ────────────────────────────────────
test('StaticYear and Monthly modes are untouched by the modern cadence', () => {
  const staticMeta = meta({ mode: 'staticYear', staticYearStep: 5 }, 1000, false);
  assert.equal(computeGameDate(staticMeta, 1, 1).signedYear, 1000);
  assert.equal(computeGameDate(staticMeta, 181, 1).signedYear, 1900); // +180*5
  assert.equal(computeGameDate(staticMeta, 182, 1).signedYear, 1905); // still +5 past 1900
  assert.equal(computeGameDate(staticMeta, 182, 1).monthIndex, 0);

  const monthlyMeta = meta({ mode: 'monthly' }, 1900, false);
  assert.equal(computeGameDate(monthlyMeta, 1, 1).monthName, 'January');
  assert.equal(computeGameDate(monthlyMeta, 2, 1).monthName, 'February'); // one month per turn
  assert.equal(computeGameDate(monthlyMeta, 13, 1).signedYear, 1901);
  assert.equal(computeGameDate(monthlyMeta, 13, 1).monthName, 'January');
});

// ── World War harness (auto mode, real 4000 BC start) ─────────────────────────
function war(id: string, year: number, month: number): ScenarioWorldWarHistoricalEvent {
  return {
    id, type: 'worldWar', name: id, description: '',
    startYear: year, startMonth: month, startYearIsBC: false,
    conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }, { nationAId: GERMANY, nationBId: FRANCE }],
    endConditionNationId: GERMANY,
  };
}

function harness(events: ScenarioWorldWarHistoricalEvent[]) {
  const nations = new NationManager();
  for (const id of IDS) nations.addNation(new Nation({ id, name: id, color: 0 }));
  const turns = new TurnManager(nations, undefined, {
    name: 'WW test', version: 1, startYear: 4000, startYearIsBC: true, timeProgression: { mode: 'auto' },
  });
  const diplomacy = new DiplomacyManager(turns);
  const alliances = new AllianceManager();
  diplomacy.setAllianceGuard((a, b) => alliances.areAllied(a, b));
  const logs: string[] = [];
  const system = new ScenarioHistoricalEventSystem(events, turns, diplomacy, alliances, {
    isNationActive: (id) => nations.getNation(id) !== undefined,
    isNationEliminated: (id) => nations.getNation(id) === undefined,
    getNationName: (id) => id,
    log: (line) => logs.push(line),
  });
  const advanceRound = () => {
    const round = turns.getCurrentRound();
    while (turns.getCurrentRound() === round) turns.endCurrentTurn();
  };
  const makePeace = (a: string, b: string) => assert.equal(diplomacy.enforceCeasefire(a, b, 1), true);
  return { nations, turns, diplomacy, alliances, system, logs, advanceRound, makePeace };
}

// ── 6. Scenario World War events still trigger by their own date logic ────────
test('6: a 1939 World War still triggers when the Auto cadence crosses its date', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  assert.equal(h.system.hasTriggered('WWII'), false, 'still pending before 1939');

  h.advanceRound();
  h.advanceRound();
  assert.equal(h.system.hasTriggered('WWII'), true);
  assert.equal(h.turns.getGameDate().signedYear, 1939);
  // The World War switches to its own temporary monthly progression.
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'monthly');

  const before = h.turns.getGameDate();
  h.advanceRound();
  const after = h.turns.getGameDate();
  assert.equal(after.year, before.year);
  assert.equal(after.monthIndex, before.monthIndex + 1, 'one month per turn during the war');
});

// The cadence change must not shift when the event triggers versus the old speed.
test('6b: reaching 1939 is a pure function of round and unaffected by mode plumbing', () => {
  const m = meta();
  const r = roundReachingYear(1939);
  assert.equal(computeGameDate(m, r, 1).signedYear, 1939);
  assert.equal(computeGameDate(m, r - 1, 1).signedYear, 1938);
});

// ── 7. Save/load during the post-1900 period resumes the same cadence ─────────
test('7: save/load in the post-1900 period resumes the six-month cadence', () => {
  // Pure Auto (no war): a saved round deterministically reproduces its date and
  // continues alternating Jan/Jul six months per turn after "loading".
  const m = meta();
  const r0 = roundReachingYear(1900);
  const savedRound = r0 + 25; // deep into the modern cadence
  const savedDate = computeGameDate(m, savedRound, 1);

  const reloaded = computeGameDate(m, savedRound, 1);
  assert.equal(gameDateToMonthOrdinal(reloaded), gameDateToMonthOrdinal(savedDate));

  for (let k = 1; k <= 10; k += 1) {
    const step = gameDateToMonthOrdinal(computeGameDate(m, savedRound + k, 1))
      - gameDateToMonthOrdinal(computeGameDate(m, savedRound + k - 1, 1));
    assert.equal(step, 6);
  }
});

// Save/load of the World-War-anchored Auto continuation resumes identically.
test('7b: save/load across a World War resumes an identical Auto cadence', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  h.advanceRound();
  h.advanceRound();
  h.advanceRound();
  h.advanceRound();
  const savedRound = h.turns.getCurrentRound();
  const savedLabel = h.turns.getGameDateLabel();
  const savedEvents = h.system.serialize();

  const loaded = harness([war('WWII', 1939, 1)]);
  loaded.turns.restoreTurnState(savedRound, 0);
  loaded.diplomacy.restoreState(GERMANY, ENGLAND, { state: 'WAR', lastWarDeclarationTurn: 1 });
  loaded.diplomacy.restoreState(GERMANY, FRANCE, { state: 'WAR', lastWarDeclarationTurn: 1 });
  loaded.system.restore(savedEvents);
  assert.equal(loaded.turns.getGameDateLabel(), savedLabel);

  // End the war on both, then confirm resumed Auto stays identical and steps by
  // exactly six months per turn.
  h.makePeace(GERMANY, ENGLAND);
  h.makePeace(GERMANY, FRANCE);
  loaded.makePeace(GERMANY, ENGLAND);
  loaded.makePeace(GERMANY, FRANCE);
  h.advanceRound();
  loaded.advanceRound();
  assert.equal(loaded.turns.getGameDateLabel(), h.turns.getGameDateLabel());
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'auto');

  let prev = gameDateToMonthOrdinal(h.turns.getGameDate());
  for (let i = 0; i < 20; i += 1) {
    h.advanceRound();
    loaded.advanceRound();
    assert.equal(loaded.turns.getGameDateLabel(), h.turns.getGameDateLabel());
    const now = gameDateToMonthOrdinal(h.turns.getGameDate());
    assert.equal(now - prev, 6, 'resumed Auto steps six months per turn');
    prev = now;
  }
});
