import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GamesOfNationsSystem,
  type GamesOfNationsCancelledEvent,
  type GamesOfNationsCompletedEvent,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportResult,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const SPORTS = ['Wrestling', 'Marathon', 'Swimming', 'Javelin', 'Long Jump'] as const;

function points(value: number): GamesOfNationsSportValues {
  return { Wrestling: value, Marathon: value, Swimming: value, Javelin: value, 'Long Jump': value };
}

function participant(
  nationId: string,
  overrides: Partial<GamesOfNationsParticipantState> = {},
): GamesOfNationsParticipantState {
  return {
    nationId,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    unallocatedGamesPoints: 0,
    gamesPointsBySport: points(0),
    totalGamesPoints: 0,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
    ...overrides,
  };
}

function sportResults(resolvedDays: number): GamesOfNationsSportResult[] {
  return SPORTS.map((sport, index) => ({
    sport,
    resolved: index < resolvedDays,
    ...(index < resolvedDays ? { competitionTurn: index + 1, goldNationId: 'a' } : {}),
  }));
}

interface HarnessOptions {
  state: SavedGamesOfNationsState;
  living?: string[];
  aggressors?: Set<string>;
  worldWars?: Set<string>;
  getCultureOutput?: (nationId: string) => number;
}

function harness(options: HarnessOptions) {
  let turn = options.state.lastProcessedTurn;
  const living = options.living ?? [...options.state.hostRotationOrder];
  const aggressors = options.aggressors ?? new Set<string>();
  const worldWars = options.worldWars ?? new Set<string>();
  const logs: string[] = [];
  const cancelledEvents: GamesOfNationsCancelledEvent[] = [];
  const completedEvents: GamesOfNationsCompletedEvent[] = [];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => living,
    getNationName: (id) => id.toUpperCase(),
    getCapitalCity: (id) => ({ id: `${id}-city`, name: `${id.toUpperCase()} City` }),
    getCultureOutput: options.getCultureOutput ?? (() => 0),
    getProductionSources: () => [],
    hasActiveWorldWar: () => worldWars.size > 0,
    isActiveWarAggressor: (id) => aggressors.has(id),
    log: (message) => logs.push(message),
    onGamesCancelled: (event) => cancelledEvents.push(event),
    onGamesCompleted: (event) => completedEvents.push(event),
  };
  const system = GamesOfNationsSystem.fromSave(dependencies, options.state, turn);
  return {
    system,
    logs,
    aggressors,
    worldWars,
    cancelledEvents,
    completedEvents,
    get turn() { return turn; },
    startWar(id: string) { worldWars.add(id); },
    endWar(id: string) { worldWars.delete(id); },
    setLiving(ids: string[]) { living.length = 0; living.push(...ids); },
    advance(to: number) {
      for (let round = turn + 1; round <= to; round += 1) {
        turn = round;
        system.handleRoundStart(round);
      }
    },
    getState() { return system.getState(); },
  };
}

function preparationState(
  participants: GamesOfNationsParticipantState[],
  overrides: Partial<SavedGamesOfNationsState> = {},
): SavedGamesOfNationsState {
  const order = participants.map((entry) => entry.nationId);
  return {
    founded: true,
    founderNationId: order[0],
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'preparation',
    competitionNumber: 1,
    phaseStartTurn: 95,
    nextTransitionTurn: 105,
    scheduledGamesTurn: 105,
    hostNationId: order[0],
    hostCityId: `${order[0]}-city`,
    hostingGamesNumber: 1,
    hostRotationOrder: [...order],
    hostRotationIndex: 0,
    participants,
    lastProcessedTurn: 104,
    ...overrides,
  };
}

function competitionState(
  participants: GamesOfNationsParticipantState[],
  resolvedDays: number,
  overrides: Partial<SavedGamesOfNationsState> = {},
): SavedGamesOfNationsState {
  const order = participants.map((entry) => entry.nationId);
  return {
    founded: true,
    founderNationId: order[0],
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'competition',
    competitionNumber: 1,
    phaseStartTurn: 105,
    nextTransitionTurn: 110,
    scheduledGamesTurn: 105,
    hostNationId: order[0],
    hostCityId: `${order[0]}-city`,
    hostingGamesNumber: 1,
    hostRotationOrder: [...order],
    hostRotationIndex: 0,
    activeSportIndex: resolvedDays,
    sportResults: sportResults(resolvedDays),
    participants,
    lastProcessedTurn: 104 + resolvedDays,
    ...overrides,
  };
}

// --- Test A: World War suspends the countdown -------------------------------

test('A: World War freezes the countdown to the next phase', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')], { lastProcessedTurn: 100 }),
  });
  assert.equal(h.system.getSummary().turnsUntilNextPhase, 5);

  h.startWar('ww2');
  h.advance(120);
  const suspended = h.system.getSummary();
  assert.equal(suspended.suspendedForWorldWar, true);
  assert.equal(suspended.phase, 'preparation');
  assert.equal(suspended.turnsUntilNextPhase, 5); // still 5 rounds away — no cycle time consumed

  h.endWar('ww2');
  h.advance(121);
  const resumed = h.system.getSummary();
  assert.equal(resumed.suspendedForWorldWar, false);
  assert.equal(resumed.turnsUntilNextPhase, 4); // clock ticks one round after resuming
});

// --- Test B: suspended investment phase -------------------------------------

test('B: investment neither advances nor deducts while suspended', () => {
  const invested = participant('a', { cultureCommitment: 3 });
  const h = harness({
    state: preparationState([invested, participant('b'), participant('c')]),
    getCultureOutput: () => 100,
  });
  h.advance(100);

  h.startWar('ww2');
  h.system.processNationPreparationTurn('a', 101);
  const during = h.system.getSummary().participants.find((p) => p.nationId === 'a')!;
  assert.equal(during.totalCultureInvested, 0);
  assert.equal(during.totalGamesPoints, 0);

  h.endWar('ww2');
  h.system.processNationPreparationTurn('a', 101);
  const after = h.system.getSummary().participants.find((p) => p.nationId === 'a')!;
  assert.equal(after.totalCultureInvested, 3);
  assert.equal(after.totalGamesPoints, 30);
});

// --- Test C: suspended active competition ------------------------------------

test('C: an active competition pauses and resumes from the same day', () => {
  const h = harness({
    state: competitionState([participant('a', { gamesPointsBySport: points(100) }), participant('b'), participant('c')], 2),
  });
  assert.equal(h.system.getSummary().sportResults.filter((r) => r.resolved).length, 2);

  h.startWar('ww2');
  h.advance(125);
  const paused = h.system.getSummary();
  assert.equal(paused.suspendedForWorldWar, true);
  assert.equal(paused.sportResults.filter((r) => r.resolved).length, 2); // day 3 did not run

  h.endWar('ww2');
  h.advance(126);
  assert.equal(h.system.getSummary().sportResults.filter((r) => r.resolved).length, 3); // resumes with day 3
});

// --- Test D: overlapping World Wars -----------------------------------------

test('D: Games stay suspended until the final World War ends', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')]),
  });
  h.advance(100);
  h.startWar('a');
  h.startWar('b');
  h.advance(110);
  assert.equal(h.system.getSummary().suspendedForWorldWar, true);

  h.endWar('a');
  h.advance(115);
  assert.equal(h.system.getSummary().suspendedForWorldWar, true); // B still active

  h.endWar('b');
  h.advance(116);
  assert.equal(h.system.getSummary().suspendedForWorldWar, false);
});

// --- Test E: exactly three participants --------------------------------------

test('E: a competition begins with exactly three eligible participants', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')]),
  });
  h.advance(105);
  assert.equal(h.system.getSummary().phase, 'competition');
});

// --- Test F: only two participants -------------------------------------------

test('F: a competition is cancelled with only two eligible participants', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c', { participating: false })]),
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.notEqual(summary.phase, 'competition');
  assert.equal(summary.overallWinnerNationId, null);
  assert.equal(h.completedEvents.length, 0);
  assert.equal(h.system.getLatestCompletedGames(), undefined);
  assert.equal(h.system.getReigningChampionNationId(), null);
  assert.equal(h.cancelledEvents.length, 1);
  assert.match(h.cancelledEvents[0].reason, /Fewer than 3/);
});

// --- Test G: aggressor excluded, defender eligible ---------------------------

test('G: an active-war aggressor is excluded while its defender remains eligible', () => {
  const h = harness({
    state: preparationState([participant('germany'), participant('poland'), participant('france'), participant('sweden')]),
    aggressors: new Set(['germany']),
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.equal(summary.phase, 'competition');
  assert.ok(!summary.participatingNationIds.includes('germany'));
  assert.ok(summary.participatingNationIds.includes('poland'));
  assert.ok(h.logs.some((line) => /GERMANY excluded from competition: active war aggressor/.test(line)));
});

// --- Test H: defender never excluded ----------------------------------------

test('H: a nation at war only as defender still participates', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('poland'), participant('c')]),
    aggressors: new Set(['germany']), // germany is not a participant here
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.equal(summary.phase, 'competition');
  assert.ok(summary.participatingNationIds.includes('poland'));
});

// --- Test I: aggressor in one of several wars --------------------------------

test('I: aggressor in any single active war is excluded', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c'), participant('d')]),
    aggressors: new Set(['b']),
  });
  h.advance(105);
  assert.ok(!h.system.getSummary().participatingNationIds.includes('b'));
});

// --- Test J: former aggressor after peace ------------------------------------

test('J: a former aggressor at peace before the Games is eligible', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')]),
    aggressors: new Set(), // war ended before competition start
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.equal(summary.phase, 'competition');
  assert.ok(summary.participatingNationIds.includes('a'));
});

// --- Test K: war begins after competition has started ------------------------

test('K: a war started after the competition begins does not remove a participant', () => {
  const h = harness({
    state: preparationState([
      participant('a', { gamesPointsBySport: points(50) }),
      participant('b', { gamesPointsBySport: points(50) }),
      participant('c', { gamesPointsBySport: points(50) }),
    ]),
  });
  h.advance(105);
  assert.equal(h.system.getSummary().phase, 'competition');

  h.aggressors.add('b');
  h.advance(107);
  assert.ok(h.system.getSummary().participatingNationIds.includes('b'));
});

// --- Test L: investment lost, not refunded, on aggressor exclusion -----------

test('L: an excluded aggressor keeps its committed points but forfeits participation', () => {
  const invested = participant('b', {
    gamesPointsBySport: points(40),
    totalGamesPoints: 200,
    totalCultureInvested: 20,
  });
  const h = harness({
    state: preparationState([participant('a'), invested, participant('c'), participant('d')]),
    aggressors: new Set(['b']),
  });
  h.advance(105);
  const entry = h.system.getSummary().participants.find((p) => p.nationId === 'b')!;
  assert.equal(entry.participating, false);
  assert.equal(entry.totalCultureInvested, 20); // committed resources are not refunded
  assert.equal(entry.gamesPointsBySport.Wrestling, 40); // generated points retained, just uncounted
});

// --- Test M: World Council exclusion + aggressor combine ---------------------

test('M: World Council exclusion and aggressor exclusion stack for the final count', () => {
  const h = harness({
    state: preparationState(
      [participant('a'), participant('b'), participant('c'), participant('d'), participant('e')],
      { excludedGamesNumber: 1, excludedNationIds: ['a'] },
    ),
    aggressors: new Set(['b']),
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.equal(summary.phase, 'competition'); // c, d, e remain → 3 eligible
  assert.ok(!summary.participatingNationIds.includes('a'));
  assert.ok(!summary.participatingNationIds.includes('b'));
});

// --- Test N: human opt-out drops the count below three ----------------------

test('N: a human opt-out that leaves two participants cancels the Games', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('human', { participating: false })]),
  });
  h.advance(105);
  assert.notEqual(h.system.getSummary().phase, 'competition');
  assert.equal(h.cancelledEvents.length, 1);
});

// --- Test O: host is an aggressor -------------------------------------------

test('O: an aggressor host is excluded but the Games are still held', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c'), participant('d')]),
    aggressors: new Set(['a']), // 'a' is the host
  });
  h.advance(105);
  const summary = h.system.getSummary();
  assert.equal(summary.phase, 'competition');
  assert.equal(summary.hostNationId, 'a'); // hosting semantics preserved
  assert.ok(!summary.participatingNationIds.includes('a'));
});

// --- Test P: save/load while suspended --------------------------------------

test('P: suspension survives save/load with the same frozen progress', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')]),
    worldWars: new Set(['ww2']),
  });
  h.advance(110);
  const suspended = h.system.getSummary();
  assert.equal(suspended.suspendedForWorldWar, true);
  const savedCountdown = suspended.turnsUntilNextPhase;

  const saved = h.getState();
  const reloaded = harness({ state: saved, worldWars: new Set(['ww2']), living: ['a', 'b', 'c'] });
  const restored = reloaded.system.getSummary();
  assert.equal(restored.suspendedForWorldWar, true);
  assert.equal(restored.turnsUntilNextPhase, savedCountdown); // no duplicate pause offset
  assert.equal(restored.phase, 'preparation');
});

// --- Test Q: no World War regression ----------------------------------------

test('Q: without an active World War the schedule advances normally', () => {
  const h = harness({
    state: preparationState([participant('a'), participant('b'), participant('c')]),
  });
  assert.equal(h.system.getSummary().suspendedForWorldWar, false);
  h.advance(105);
  assert.equal(h.system.getSummary().phase, 'competition');
  h.advance(110);
  assert.equal(h.system.getSummary().phase, 'cooldown');
});
