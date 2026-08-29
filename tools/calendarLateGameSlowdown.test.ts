import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import {
  ScenarioHistoricalEventSystem,
} from '../src/systems/ScenarioHistoricalEventSystem';
import { TurnManager } from '../src/systems/TurnManager';
import {
  AUTO_LATE_GAME_SLOWDOWN_ASTRO_YEAR,
  AUTO_LATE_GAME_SLOWDOWN_FACTOR,
  applyAutoLateGameSlowdown,
  autoProgressedYears,
  computeGameDate,
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

// ── 1. Auto progression before 1900 is unchanged (matches the raw curve) ──────
test('1: Auto progression before 1900 equals the unmodified curve', () => {
  const m = meta();
  const astroStart = -3999; // astronomical year for 4000 BC (1 - 4000)
  for (let round = 1; round <= 6000; round += 1) {
    const date = computeGameDate(m, round, 1);
    if (date.signedYear >= AUTO_LATE_GAME_SLOWDOWN_ASTRO_YEAR) break;
    // Before 1900, the displayed date must equal start + raw progression, with
    // the astronomical->historical (no year zero) conversion applied.
    const astro = astroStart + autoProgressedYears(round, 1);
    const expectedSignedYear = astro >= 1 ? astro : astro - 1;
    assert.equal(date.signedYear, expectedSignedYear);
  }
});

// ── 2. Crossing into 1900 is continuous (never jumps backward) ────────────────
test('2: crossing into 1900 is monotonic and continuous', () => {
  const m = meta();
  let previous = computeGameDate(m, 1, 1).signedYear;
  let sawBefore1900 = false;
  let sawFrom1900 = false;
  for (let round = 2; round <= 3000; round += 1) {
    const year = computeGameDate(m, round, 1).signedYear;
    assert.ok(year >= previous, `year went backward at round ${round}: ${previous} -> ${year}`);
    if (previous < 1900) sawBefore1900 = true;
    if (year >= 1900) sawFrom1900 = true;
    if (previous < 1900 && year >= 1900) {
      // No artificial leap when the boundary is crossed: the first year at/after
      // 1900 is exactly 1900 (the slowdown pins the boundary).
      assert.equal(year, 1900);
    }
    previous = year;
  }
  assert.ok(sawBefore1900 && sawFrom1900);
});

// ── 3. After 1900 the rate is ~25% of the raw (unslowed) rate ─────────────────
test('3: post-1900 Auto advances at ~25% of the raw rate', () => {
  const m = meta();
  // Find a round comfortably past 1900.
  let round1900 = -1;
  for (let round = 1; round <= 6000; round += 1) {
    if (computeGameDate(m, round, 1).signedYear >= 1900) { round1900 = round; break; }
  }
  assert.ok(round1900 > 0);

  const a = round1900 + 40;
  const b = round1900 + 80;
  const slowedDelta = computeGameDate(m, b, 1).signedYear - computeGameDate(m, a, 1).signedYear;
  const rawDelta = autoProgressedYears(b, 1) - autoProgressedYears(a, 1);
  assert.ok(rawDelta > 0);
  const ratio = slowedDelta / rawDelta;
  assert.ok(ratio > 0.2 && ratio < 0.3, `expected ~0.25 rate, got ${ratio}`);

  // Direct transform check.
  assert.equal(applyAutoLateGameSlowdown(1900), 1900);
  assert.equal(applyAutoLateGameSlowdown(1904), 1900 + 4 * AUTO_LATE_GAME_SLOWDOWN_FACTOR);
  assert.equal(applyAutoLateGameSlowdown(1800), 1800);
});

// ── 4. StaticYear progression is unchanged ────────────────────────────────────
test('4: StaticYear progression is not affected by the slowdown', () => {
  const m = meta({ mode: 'staticYear', staticYearStep: 5 }, 1000, false);
  // 1000, 1005, ... crossing 1900 with no rate change.
  assert.equal(computeGameDate(m, 1, 1).signedYear, 1000);
  assert.equal(computeGameDate(m, 181, 1).signedYear, 1000 + 180 * 5); // 1900
  assert.equal(computeGameDate(m, 182, 1).signedYear, 1905); // still +5 after 1900
  assert.equal(computeGameDate(m, 201, 1).signedYear, 2000);
});

// ── 5. Monthly progression is unchanged ───────────────────────────────────────
test('5: Monthly progression is not affected by the slowdown', () => {
  const m = meta({ mode: 'monthly' }, 1900, false);
  assert.equal(computeGameDate(m, 1, 1).monthName, 'January');
  assert.equal(computeGameDate(m, 1, 1).signedYear, 1900);
  assert.equal(computeGameDate(m, 13, 1).signedYear, 1901); // 12 months later
  assert.equal(computeGameDate(m, 13, 1).monthName, 'January');
  assert.equal(computeGameDate(m, 25, 1).signedYear, 1902); // still one year per 12 rounds
});

// ── World War harness for tests 6–9 (auto mode, real 4000 BC start) ───────────
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

/** First round whose Auto date reaches/passes the given AD year. */
function roundReachingYear(year: number): number {
  const m = meta();
  for (let round = 1; round <= 20000; round += 1) {
    if (computeGameDate(m, round, 1).signedYear >= year) return round;
  }
  throw new Error(`year ${year} never reached`);
}

// ── 6. A post-1900 Historical Event still triggers when its date is crossed ───
test('6: a 1939 World War triggers when Auto crosses its date', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  assert.equal(h.system.hasTriggered('WWII'), false, 'must still be pending just before 1939');

  h.advanceRound(); // -> triggerRound - 1
  h.advanceRound(); // -> triggerRound (crosses into 1939)
  assert.equal(h.system.hasTriggered('WWII'), true);
  assert.equal(h.turns.getGameDate().signedYear, 1939);
});

// ── 7. World War monthly progression activates on trigger ─────────────────────
test('7: monthly progression activates when the World War starts', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  h.advanceRound();
  h.advanceRound();
  assert.equal(h.system.hasActiveWorldWar(), true);
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'monthly');

  const before = h.turns.getGameDate();
  h.advanceRound();
  const after = h.turns.getGameDate();
  // Monthly: one calendar month per round during the war (no year rate change).
  assert.equal(after.year, before.year);
  assert.equal(after.monthIndex, before.monthIndex + 1);
});

// ── 8. After the World War ends, Auto resumes with the slowdown still active ──
test('8: resumed Auto keeps the post-1900 slowdown after a World War', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  h.advanceRound();
  h.advanceRound();
  assert.equal(h.system.hasActiveWorldWar(), true);

  // Run the war a few months, then make peace so Auto resumes.
  h.advanceRound();
  h.advanceRound();
  h.makePeace(GERMANY, ENGLAND);
  h.makePeace(GERMANY, FRANCE);
  h.advanceRound(); // completion evaluated at roundEnd -> Auto restored

  const runtime = h.turns.getRuntimeDateProgression();
  assert.equal(runtime?.mode, 'auto');
  assert.equal(h.system.hasActiveWorldWar(), false);

  // Measure the resumed rate against the raw curve at the same virtual rounds.
  assert.ok(runtime && runtime.mode === 'auto');
  const anchorRound = runtime.anchorRound;
  const autoRoundAtAnchor = runtime.autoRoundAtAnchor;
  const startYear = h.turns.getGameDateForRound(anchorRound).signedYear;
  const span = 200;
  const endYear = h.turns.getGameDateForRound(anchorRound + span).signedYear;
  const slowedDelta = endYear - startYear;
  const rawDelta = autoProgressedYears(autoRoundAtAnchor + span, 1)
    - autoProgressedYears(autoRoundAtAnchor, 1);
  assert.ok(rawDelta > 0);
  const ratio = slowedDelta / rawDelta;
  assert.ok(ratio > 0.2 && ratio < 0.3, `resumed Auto expected ~0.25 rate, got ${ratio}`);
});

// ── 9. Save/load reproduces the same date deterministically ───────────────────
test('9: save/load restores the identical Auto date (mid-war and after)', () => {
  const triggerRound = roundReachingYear(1939);
  const h = harness([war('WWII', 1939, 1)]);
  h.turns.restoreTurnState(triggerRound - 2, 0);
  h.turns.start();
  h.advanceRound();
  h.advanceRound();
  // Advance a couple months into the war, then serialize.
  h.advanceRound();
  h.advanceRound();
  const savedRound = h.turns.getCurrentRound();
  const savedLabel = h.turns.getGameDateLabel();
  const savedEvents = h.system.serialize();

  // Fresh game, restore. Diplomacy is a separate save system, so its war state is
  // restored here alongside the historical-event/calendar runtime state.
  const loaded = harness([war('WWII', 1939, 1)]);
  loaded.turns.restoreTurnState(savedRound, 0);
  loaded.diplomacy.restoreState(GERMANY, ENGLAND, { state: 'WAR', lastWarDeclarationTurn: 1 });
  loaded.diplomacy.restoreState(GERMANY, FRANCE, { state: 'WAR', lastWarDeclarationTurn: 1 });
  loaded.system.restore(savedEvents);
  assert.equal(loaded.turns.getGameDateLabel(), savedLabel);

  // Continued monthly war progression stays identical after load.
  for (let i = 0; i < 3; i += 1) {
    h.advanceRound();
    loaded.advanceRound();
    assert.equal(loaded.turns.getGameDateLabel(), h.turns.getGameDateLabel());
  }

  // End the war on both; resumed post-1900 Auto stays deterministic and identical.
  h.makePeace(GERMANY, ENGLAND);
  h.makePeace(GERMANY, FRANCE);
  loaded.makePeace(GERMANY, ENGLAND);
  loaded.makePeace(GERMANY, FRANCE);
  for (let i = 0; i < 60; i += 1) {
    h.advanceRound();
    loaded.advanceRound();
    assert.equal(loaded.turns.getGameDateLabel(), h.turns.getGameDateLabel());
  }
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'auto');
});
