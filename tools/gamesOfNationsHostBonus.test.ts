import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GamesOfNationsSystem,
  GAMES_OF_NATIONS_SPORTS,
  HOST_GAMES_BONUS_RATE,
  drawSportMedals,
  type GamesOfNationsDependencies,
  type GamesOfNationsSportResolvedEvent,
} from '../src/systems/GamesOfNationsSystem';
import { selectNextSportFavorite } from '../src/systems/GamesOfNationsChronicle';
import { buildHistoricalMedalStandings } from '../src/systems/GamesOfNationsSystem';
import type {
  CompletedGamesOfNationsRecord,
  GamesOfNationsParticipantState,
  GamesOfNationsSport,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

function participant(
  nationId: string,
  culture: number,
  production: number,
  options: { participating?: boolean; baseGP?: number; unallocatedGP?: number } = {},
): GamesOfNationsParticipantState {
  return {
    nationId,
    participating: options.participating ?? true,
    cultureCommitment: culture,
    productionCommitment: production,
    unallocatedGamesPoints: options.unallocatedGP ?? 0,
    gamesPointsBySport: Object.fromEntries(GAMES_OF_NATIONS_SPORTS.map((sport) => [sport, options.baseGP ?? 0])) as GamesOfNationsSportValues,
    totalGamesPoints: (options.baseGP ?? 0) * 5,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
  };
}

function preparationState(hostNationId: string, participants: GamesOfNationsParticipantState[]): SavedGamesOfNationsState {
  return {
    founded: true,
    founderNationId: hostNationId,
    foundedTurn: 70,
    firstGamesTurn: 100,
    phase: 'preparation',
    competitionNumber: 1,
    phaseStartTurn: 90,
    nextTransitionTurn: 100,
    scheduledGamesTurn: 100,
    hostNationId,
    hostCityId: `${hostNationId}-city`,
    hostRotationOrder: participants.map((entry) => entry.nationId),
    hostRotationIndex: 0,
    participants,
    sportResults: GAMES_OF_NATIONS_SPORTS.map((sport) => ({ sport, resolved: false })),
    medalTable: [],
    lastProcessedTurn: 90,
  };
}

function deps(
  humanNationId: string,
  turnRef = { value: 90 },
  sportEvents: GamesOfNationsSportResolvedEvent[] = [],
): GamesOfNationsDependencies {
  return {
    getCurrentTurn: () => turnRef.value,
    getLivingNationIds: () => ['host', 'a', 'b', 'out', humanNationId].filter((id, index, values) => values.indexOf(id) === index),
    getNationName: (id) => id.toUpperCase(),
    getCapitalCity: (id) => ({ id: `${id}-city`, name: `${id} City` }),
    getCityName: (id) => id,
    isHumanNation: (id) => id === humanNationId,
    getCultureOutput: () => 0,
    getProductionSources: () => [],
    seed: 'host-bonus-tests',
    onSportResolved: (event) => sportEvents.push(event),
  };
}

test('host bonus snapshots all participating non-host commitments, converts 10 GP each, and floors 10%', () => {
  const state = preparationState('host', [
    participant('host', 50, 50),
    participant('a', 3, 5),
    participant('b', 2, 4),
    participant('out', 99, 99, { participating: false }),
  ]);
  const system = GamesOfNationsSystem.fromSave(deps('host'), state, 90);
  const summary = system.getSummary();
  assert.equal(HOST_GAMES_BONUS_RATE, 0.10);
  assert.equal(summary.totalExternalInitialGamesPoints, 140);
  assert.equal(summary.hostBonusGamesPoints, 14);
  assert.equal(summary.hostBonusCalculated, true);
  assert.equal(summary.hostBonusSport, null);
  assert.equal(summary.participants.find((entry) => entry.nationId === 'a')?.initialCultureCommitment, 3);
  assert.equal(summary.participants.find((entry) => entry.nationId === 'a')?.initialProductionCommitment, 5);
  assert.equal(summary.participants.find((entry) => entry.nationId === 'out')?.initialCultureCommitment, 99);
  assert.equal(Math.floor(107 * HOST_GAMES_BONUS_RATE), 10);
});

test('human host must participate, selects exactly one locked sport, and direct normal GP cannot alter the bank bonus', () => {
  const state = preparationState('host', [participant('host', 0, 0, { unallocatedGP: 10 }), participant('a', 3, 5)]);
  const system = GamesOfNationsSystem.fromSave(deps('host'), state, 90);
  assert.equal(system.setParticipation('host', false), false);
  assert.equal(system.confirmHumanPreparationConfiguration('host', 1), false);
  assert.equal(system.confirmHumanPreparationConfiguration('host', 1, 'Wrestling'), true);
  assert.equal(system.getSummary().hostBonusGamesPoints, 8);
  assert.equal(system.getSummary().hostBonusSport, 'Wrestling');
  assert.equal(system.confirmHumanPreparationConfiguration('host', 1, 'Marathon'), false);

  assert.equal(system.setNationCultureCommitment('a', 100), true);
  assert.equal(system.setNationProductionCommitment('a', 0), true);
  assert.equal(system.allocateGamesPoints('host', 'Wrestling', 10), true);
  const after = system.getSummary();
  assert.equal(after.hostBonusGamesPoints, 8);
  assert.equal(after.hostBonusSport, 'Wrestling');
  assert.equal(after.participants.find((entry) => entry.nationId === 'host')?.gamesPointsBySport.Wrestling, 10);
  assert.equal(system.getEffectiveGamesPoints('host', 'Wrestling'), 18);
  assert.equal(after.participants.find((entry) => entry.nationId === 'a')?.initialCultureCommitment, 3);
  assert.equal(after.participants.find((entry) => entry.nationId === 'a')?.cultureCommitment, 100);
});

test('failed investments and changed output neither recalculate the bonus nor deduct from another nation', () => {
  const turn = { value: 90 };
  const state = preparationState('host', [participant('host', 0, 0), participant('a', 2, 3)]);
  const system = GamesOfNationsSystem.fromSave(deps('host', turn), state, turn.value);
  system.confirmHumanPreparationConfiguration('host', 1, 'Swimming');
  const otherBefore = structuredClone(system.getSummary().participants.find((entry) => entry.nationId === 'a'));
  turn.value = 91;
  system.processNationPreparationTurn('a', 91);
  const otherAfter = system.getSummary().participants.find((entry) => entry.nationId === 'a');
  assert.equal(system.getSummary().hostBonusGamesPoints, 5);
  assert.equal(otherAfter?.totalGamesPoints, otherBefore?.totalGamesPoints);
  assert.equal(otherAfter?.failedCultureCommitmentTurns, 1);
  assert.equal(otherAfter?.failedProductionCommitmentTurns, 1);
});

test('AI host waits for the human initial configuration, chooses a deterministic sport, and persists it', () => {
  const state = preparationState('host', [
    participant('host', 1, 1),
    participant('human', 2, 1),
  ]);
  const dependencies = deps('human');
  const system = GamesOfNationsSystem.fromSave(dependencies, state, 90);
  assert.equal(system.getSummary().hostBonusCalculated, false);
  system.setNationCultureCommitment('human', 4);
  system.setNationProductionCommitment('human', 3);
  assert.equal(system.confirmHumanPreparationConfiguration('human', 1), true);
  assert.equal(system.getSummary().totalExternalInitialGamesPoints, 70);
  assert.equal(system.getSummary().hostBonusGamesPoints, 7);
  assert.equal(system.getSummary().hostBonusSport, 'Swimming');
  const loaded = GamesOfNationsSystem.fromSave(dependencies, JSON.parse(JSON.stringify(system.getState())), 90);
  assert.equal(loaded.getSummary().hostBonusGamesPoints, 7);
  assert.equal(loaded.getSummary().hostBonusSport, 'Swimming');
});

test('effective competition GP boosts only the host selected sport and Chronicle favorite sees it', () => {
  const events: GamesOfNationsSportResolvedEvent[] = [];
  const turn = { value: 90 };
  const prep = GamesOfNationsSystem.fromSave(deps('human', turn, events), preparationState('host', [
    participant('host', 0, 0, { baseGP: 100 }),
    participant('human', 10, 0, { baseGP: 100 }),
  ]), 90);
  prep.confirmHumanPreparationConfiguration('human', 1);
  const competition = prep.getState();
  competition.phase = 'competition';
  competition.phaseStartTurn = 100;
  competition.nextTransitionTurn = 105;
  competition.lastProcessedTurn = 99;
  competition.hostBonusCalculated = true;
  competition.hostBonusGamesPoints = 10;
  competition.hostBonusSport = 'Marathon';
  const system = GamesOfNationsSystem.fromSave(deps('human', turn, events), competition, 99);
  assert.equal(system.getEffectiveGamesPoints('host', 'Marathon'), 110);
  assert.equal(system.getEffectiveGamesPoints('host', 'Wrestling'), 100);
  assert.equal(system.getEffectiveGamesPoints('human', 'Marathon'), 100);
  turn.value = 100;
  system.handleRoundStart(100);
  assert.deepEqual(system.getSummary().sportResults[0]?.weights, { host: 100, human: 100 });
  assert.equal(events[0]?.nextSport, 'Marathon');
  assert.deepEqual(events[0]?.nextSportCandidates, [
    { nationId: 'host', gamesPoints: 110 },
    { nationId: 'human', gamesPoints: 100 },
  ]);
  assert.equal(selectNextSportFavorite(events[0]!.nextSportCandidates), 'host');

  const possibleWinners = new Set(Array.from({ length: 100 }, (_, index) =>
    drawSportMedals([{ nationId: 'host', weight: 110 }, { nationId: 'human', weight: 100 }], `host-can-lose-${index}`).goldNationId,
  ));
  assert.deepEqual(possibleWinners, new Set(['host', 'human']));
});

test('Preparation/Competition saves and completed history preserve bonus without changing Medal League points', () => {
  const turn = { value: 90 };
  const dependencies = deps('host', turn);
  const system = GamesOfNationsSystem.fromSave(dependencies, preparationState('host', [
    participant('host', 0, 0, { baseGP: 100 }),
    participant('a', 5, 5, { baseGP: 100 }),
  ]), 90);
  system.confirmHumanPreparationConfiguration('host', 1, 'Javelin');
  const preparationLoaded = GamesOfNationsSystem.fromSave(dependencies, JSON.parse(JSON.stringify(system.getState())), 90);
  assert.equal(preparationLoaded.getSummary().hostBonusGamesPoints, 10);
  assert.equal(preparationLoaded.getSummary().hostBonusSport, 'Javelin');

  const competition = preparationLoaded.getState();
  competition.phase = 'competition';
  competition.phaseStartTurn = 100;
  competition.nextTransitionTurn = 105;
  competition.lastProcessedTurn = 99;
  const competitionLoaded = GamesOfNationsSystem.fromSave(dependencies, JSON.parse(JSON.stringify(competition)), 99);
  assert.equal(competitionLoaded.getSummary().hostBonusGamesPoints, 10);
  for (let current = 100; current <= 104; current += 1) {
    turn.value = current;
    competitionLoaded.handleRoundStart(current);
  }
  const record = competitionLoaded.getCompletedGames()[0]!;
  assert.equal(record.hostBonusGamesPoints, 10);
  assert.equal(record.hostBonusSport, 'Javelin');
  const leagueBefore = buildHistoricalMedalStandings([record]);
  const withoutBonus: CompletedGamesOfNationsRecord = { ...record };
  delete withoutBonus.hostBonusGamesPoints;
  delete withoutBonus.hostBonusSport;
  assert.deepEqual(buildHistoricalMedalStandings([withoutBonus]), leagueBefore);
});

test('older active Competition saves load with a safe zero bonus and do not alter resolved weights', () => {
  const state = preparationState('host', [participant('host', 0, 0), participant('human', 1, 1)]);
  state.phase = 'competition';
  state.phaseStartTurn = 100;
  state.nextTransitionTurn = 105;
  state.lastProcessedTurn = 100;
  state.sportResults![0] = {
    sport: 'Wrestling', resolved: true, competitionTurn: 1, weights: { host: 25, human: 20 }, goldNationId: 'host',
  };
  const loaded = GamesOfNationsSystem.fromSave(deps('human'), state, 100);
  assert.equal(loaded.getSummary().hostBonusCalculated, true);
  assert.equal(loaded.getSummary().hostBonusGamesPoints, 0);
  assert.deepEqual(loaded.getSummary().sportResults[0]?.weights, { host: 25, human: 20 });
});
