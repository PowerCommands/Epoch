import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GAMES_OF_NATIONS_SPORTS,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import type { SavedGamesOfNationsState } from '../src/types/gamesOfNations';

interface Harness {
  system: GamesOfNationsSystem;
  living: string[];
  capitals: Map<string, { id: string; name: string }>;
  logs: string[];
  setTurn(turn: number): void;
  advanceTo(turn: number): void;
}

function harness(saved?: SavedGamesOfNationsState, initialTurn = 1): Harness {
  let currentTurn = initialTurn;
  const living = ['france', 'sweden', 'england'];
  const capitals = new Map([
    ['france', { id: 'paris', name: 'Paris' }],
    ['sweden', { id: 'stockholm', name: 'Stockholm' }],
    ['england', { id: 'london', name: 'London' }],
  ]);
  const logs: string[] = [];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => currentTurn,
    getLivingNationIds: () => living,
    getNationName: (id) => ({ france: 'France', sweden: 'Sweden', england: 'England' })[id],
    getCapitalCity: (id) => capitals.get(id),
    log: (message) => logs.push(message),
  };
  const system = saved
    ? GamesOfNationsSystem.fromSave(dependencies, saved, initialTurn)
    : GamesOfNationsSystem.forNewGame(dependencies);
  return {
    system,
    living,
    capitals,
    logs,
    setTurn(turn) { currentTurn = turn; },
    advanceTo(turn) {
      for (let round = currentTurn + 1; round <= turn; round += 1) {
        currentTurn = round;
        system.handleRoundStart(round);
      }
    },
  };
}

function foundAt80(h: Harness): void {
  h.setTurn(80);
  assert.equal(h.system.handleCultureCompleted('france', GAMES_AND_RECREATION_CULTURE_ID, 80), true);
}

test('remains inactive before Games and Recreation is completed', () => {
  const h = harness();
  h.advanceTo(100);
  assert.deepEqual(h.system.getSummary(), {
    founded: false,
    founderNationId: null,
    foundedTurn: null,
    firstGamesTurn: null,
    phase: 'inactive',
    competitionNumber: 0,
    hostNationId: null,
    hostCityId: null,
    phaseStartTurn: null,
    nextTransitionTurn: null,
    turnsUntilNextPhase: null,
    nextGamesTurn: null,
    turnsUntilGames: null,
    activeSport: null,
    phaseProgressTurn: null,
    phaseTotalTurns: null,
    preparationActive: false,
    humanPreparationPromptAcknowledgedCompetitionNumber: null,
    sportResults: [],
    medalTable: [],
    overallWinnerNationId: null,
    competitionComplete: false,
    hostBonusCalculated: false,
    hostBonusRate: 0.1,
    totalExternalInitialGamesPoints: 0,
    hostBonusGamesPoints: 0,
    hostBonusSport: null,
    hostEffectiveGamesPoints: null,
    completedGamesCount: 0,
    completedGames: [],
    historicalMedalStandings: [],
    participatingNationIds: [],
    participants: [],
  });
});

test('first unlock founds once and later unlocks do not reset the founder or schedule', () => {
  const h = harness();
  foundAt80(h);
  const founded = h.system.getState();
  assert.equal(h.system.handleCultureCompleted('sweden', GAMES_AND_RECREATION_CULTURE_ID, 82), false);
  assert.equal(h.system.handleCultureCompleted('england', 'another_node', 83), false);
  assert.equal(h.system.getState().founderNationId, 'france');
  assert.equal(h.system.getState().foundedTurn, 80);
  assert.equal(h.system.getState().firstGamesTurn, 105);
  assert.equal(h.system.getState().nextTransitionTurn, founded.nextTransitionTurn);
});

test('first Games begin exactly 25 turns later with founder and current capital hosting', () => {
  const h = harness();
  foundAt80(h);
  h.capitals.set('france', { id: 'new-capital', name: 'Lyon' });
  h.advanceTo(94);
  assert.equal(h.system.getState().phase, 'waitingForFirstGames');
  h.advanceTo(95);
  assert.equal(h.system.getState().phase, 'preparation');
  h.advanceTo(104);
  assert.equal(h.system.getState().phase, 'preparation');
  h.advanceTo(105);
  const state = h.system.getState();
  assert.equal(state.phase, 'competition');
  assert.equal(state.competitionNumber, 1);
  assert.equal(state.hostNationId, 'france');
  assert.equal(state.hostCityId, 'new-capital');
  assert.match(h.logs.join('\n'), /Games #1 begin in Lyon on turn 105/);
});

test('five competition turns expose sports in fixed order before cooldown', () => {
  const h = harness();
  foundAt80(h);
  const observed: string[] = [];
  for (let turn = 105; turn <= 109; turn += 1) {
    h.advanceTo(turn);
    assert.equal(h.system.getState().phase, 'competition');
    observed.push(h.system.getSummary().activeSport!);
  }
  assert.deepEqual(observed, GAMES_OF_NATIONS_SPORTS);
  h.advanceTo(110);
  assert.equal(h.system.getState().phase, 'cooldown');
  assert.equal(h.system.getSummary().activeSport, null);
});

test('cooldown and preparation last ten turns each and preserve 25-turn competition cadence', () => {
  const h = harness();
  foundAt80(h);
  h.advanceTo(110);
  assert.equal(h.system.getState().phase, 'cooldown');
  h.advanceTo(119);
  assert.equal(h.system.getState().phase, 'cooldown');
  h.advanceTo(120);
  assert.equal(h.system.getState().phase, 'preparation');
  assert.equal(h.system.getState().competitionNumber, 2);
  h.advanceTo(129);
  assert.equal(h.system.getState().phase, 'preparation');
  h.advanceTo(130);
  assert.equal(h.system.getState().phase, 'competition');
  assert.equal(h.system.getState().competitionNumber, 2);
  assert.equal(h.system.getState().scheduledGamesTurn, 130);
});

test('host rotation is deterministic and skips invalid or eliminated nations', () => {
  const h = harness();
  foundAt80(h);
  h.advanceTo(105);
  assert.equal(h.system.getState().hostNationId, 'france');
  h.advanceTo(119);
  h.living.splice(h.living.indexOf('sweden'), 1);
  h.capitals.delete('sweden');
  h.advanceTo(120);
  assert.equal(h.system.getState().hostNationId, 'england');
  h.advanceTo(130);
  assert.equal(h.system.getState().hostNationId, 'england');
  h.advanceTo(144);
  h.advanceTo(145);
  assert.equal(h.system.getState().hostNationId, 'france');
});

test('invalid first host is skipped safely when the first Games begin', () => {
  const h = harness();
  foundAt80(h);
  h.living.splice(h.living.indexOf('france'), 1);
  h.capitals.delete('france');
  h.advanceTo(105);
  assert.equal(h.system.getState().phase, 'competition');
  assert.equal(h.system.getState().hostNationId, 'sweden');
  assert.equal(h.system.getState().hostCityId, 'stockholm');
});

test('participation is cycle-scoped, defaults living nations in, and supports future opt-out', () => {
  const h = harness();
  foundAt80(h);
  assert.deepEqual(h.system.getSummary().participatingNationIds, ['france', 'sweden', 'england']);
  assert.equal(h.system.setParticipation('france', false), false);
  assert.equal(h.system.setParticipation('sweden', false), true);
  assert.deepEqual(h.system.getSummary().participatingNationIds, ['france', 'england']);
  h.advanceTo(120);
  assert.deepEqual(h.system.getSummary().participatingNationIds, ['france', 'sweden', 'england']);
});

test('save/load resumes waiting, competition, cooldown, and preparation without calendar drift', () => {
  for (const checkpoint of [90, 97, 107, 115, 125]) {
    const original = harness();
    foundAt80(original);
    original.advanceTo(checkpoint);
    const saved = JSON.parse(JSON.stringify(original.system.getState())) as SavedGamesOfNationsState;
    const restored = harness(saved, checkpoint);
    assert.deepEqual(restored.system.getState(), original.system.getState(), `state at turn ${checkpoint}`);
    assert.deepEqual(restored.system.getSummary(), original.system.getSummary(), `summary at turn ${checkpoint}`);

    original.advanceTo(checkpoint + 30);
    restored.advanceTo(checkpoint + 30);
    assert.deepEqual(restored.system.getState(), original.system.getState(), `advanced state from turn ${checkpoint}`);
  }
});

test('old saves without Games state initialize inactive', () => {
  const h = harness(undefined, 140);
  const restored = GamesOfNationsSystem.fromSave({
    getCurrentTurn: () => 140,
    getLivingNationIds: () => h.living,
    getNationName: () => undefined,
    getCapitalCity: (id) => h.capitals.get(id),
  }, undefined, 140);
  assert.equal(restored.getState().phase, 'inactive');
  assert.equal(restored.getState().founded, false);
  restored.handleRoundStart(140);
  assert.equal(restored.getState().phase, 'inactive');
});

test('major transition logging is concise and sport-specific', () => {
  const h = harness();
  foundAt80(h);
  h.advanceTo(120);
  const gamesLogs = h.logs.filter((line) => line.startsWith('[GamesOfNations]'));
  assert.match(gamesLogs[0]!, /Founded by France/);
  assert.deepEqual(
    gamesLogs.filter((line) => line.includes('competition:')).map((line) => line.split('competition: ')[1]),
    GAMES_OF_NATIONS_SPORTS,
  );
  assert.ok(gamesLogs.some((line) => line.includes('Preparation for Games #1 begins')));
  assert.ok(gamesLogs.some((line) => line.includes('Preparation for Games #2 begins')));
});
