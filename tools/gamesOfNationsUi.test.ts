import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GamesOfNationsSystem, GAMES_AND_RECREATION_CULTURE_ID } from '../src/systems/GamesOfNationsSystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSummary,
  GamesOfNationsSportValues,
} from '../src/types/gamesOfNations';
import {
  buildGamesOfNationsUiModel,
  GAMES_HUD_BUTTON_LAYOUT,
  GAMES_HUD_DARK_BLUE,
  validateGamesAllocation,
} from '../src/ui/hud/GamesOfNationsUiModel';

const HUMAN = 'human';
const HOST = 'host';
const EQUAL: GamesOfNationsSportValues = {
  Wrestling: 20,
  Marathon: 20,
  Swimming: 20,
  Javelin: 20,
  'Long Jump': 20,
};

function participant(overrides: Partial<GamesOfNationsParticipantState> = {}): GamesOfNationsParticipantState {
  return {
    nationId: HUMAN,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    sportAllocation: { ...EQUAL },
    gamesPointsBySport: { Wrestling: 40, Marathon: 30, Swimming: 20, Javelin: 10, 'Long Jump': 0 },
    totalGamesPoints: 100,
    totalCultureInvested: 4,
    totalProductionInvested: 6,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: false,
    ...overrides,
  };
}

function summary(overrides: Partial<GamesOfNationsSummary> = {}): GamesOfNationsSummary {
  return {
    founded: true,
    founderNationId: HOST,
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'preparation',
    competitionNumber: 1,
    hostNationId: HOST,
    hostCityId: 'paris',
    phaseStartTurn: 95,
    nextTransitionTurn: 105,
    turnsUntilNextPhase: 6,
    nextGamesTurn: 105,
    turnsUntilGames: 6,
    activeSport: null,
    phaseProgressTurn: 4,
    phaseTotalTurns: 10,
    preparationActive: true,
    humanPreparationPromptAcknowledgedCompetitionNumber: null,
    participatingNationIds: [HUMAN, HOST],
    participants: [participant()],
    ...overrides,
  };
}

function model(overrides: Partial<GamesOfNationsSummary> = {}) {
  return buildGamesOfNationsUiModel({
    summary: summary(overrides),
    humanNationId: HUMAN,
    hostNationName: 'France',
    hostCityName: 'Paris',
    founderNationName: 'France',
    currentCultureAvailable: 7,
    currentBaseProductionAvailable: 8,
  });
}

test('HUD availability follows founding and button sits directly below Research and Culture', () => {
  assert.equal(model({ founded: false, phase: 'inactive' }).founded, false);
  assert.equal(model().founded, true);
  assert.equal(GAMES_HUD_BUTTON_LAYOUT.left, 16);
  assert.ok(GAMES_HUD_BUTTON_LAYOUT.researchTop < GAMES_HUD_BUTTON_LAYOUT.cultureTop);
  assert.equal(
    GAMES_HUD_BUTTON_LAYOUT.top - GAMES_HUD_BUTTON_LAYOUT.cultureTop,
    GAMES_HUD_BUTTON_LAYOUT.cultureTop - GAMES_HUD_BUTTON_LAYOUT.researchTop,
  );
  assert.equal(GAMES_HUD_DARK_BLUE, 0x071d3a);
});

test('Preparation ring is lifecycle-derived for Games #1 and later cycles', () => {
  assert.equal(model({ competitionNumber: 1, phaseProgressTurn: 1 }).buttonProgress, 0.1);
  assert.equal(model({ competitionNumber: 1, phaseProgressTurn: 5 }).buttonProgress, 0.5);
  assert.equal(model({ competitionNumber: 1, phaseProgressTurn: 10 }).buttonProgress, 1);
  assert.equal(model({ competitionNumber: 4, phaseProgressTurn: 5 }).buttonProgress, 0.5);
  assert.equal(model({ phase: 'competition', phaseProgressTurn: 2, phaseTotalTurns: 5 }).buttonProgress, 1);
  assert.equal(model({ phase: 'cooldown', phaseProgressTurn: 2 }).buttonProgress, 0);
});

test('one-time Preparation prompt is keyed to the Games number', () => {
  assert.equal(model().promptPending, true);
  assert.equal(model({ humanPreparationPromptAcknowledgedCompetitionNumber: 1 }).promptPending, false);
  assert.equal(model({ competitionNumber: 2, humanPreparationPromptAcknowledgedCompetitionNumber: 1 }).promptPending, true);
  assert.equal(model({ phase: 'competition' }).promptPending, false);
});

test('prompt acknowledgement and participation survive save/load without a rerun', () => {
  let turn = 80;
  const dependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => [HUMAN, HOST],
    getNationName: (id: string) => id,
    getCapitalCity: (id: string) => ({ id: `${id}-city`, name: `${id} City` }),
    isHumanNation: (id: string) => id === HUMAN,
    getCultureOutput: () => 10,
    getProductionSources: () => [{ cityId: 'city', available: 10 }],
  };
  const system = GamesOfNationsSystem.forNewGame(dependencies);
  system.handleCultureCompleted(HOST, GAMES_AND_RECREATION_CULTURE_ID, turn);
  turn = 95;
  system.handleRoundStart(turn);
  assert.equal(system.isHumanPreparationPromptPending(), true);
  assert.equal(system.setParticipation(HUMAN, false), true);
  assert.equal(system.acknowledgeHumanPreparationPrompt(1), true);
  const loaded = GamesOfNationsSystem.fromSave(dependencies, system.getState(), turn);
  assert.equal(loaded.isHumanPreparationPromptPending(), false);
  assert.equal(loaded.getSummary().participants.find((entry) => entry.nationId === HUMAN)?.participating, false);
});

test('human cycle defaults are zero commitments with equal future allocation', () => {
  const view = model();
  assert.equal(view.participant?.cultureCommitment, 0);
  assert.equal(view.participant?.productionCommitment, 0);
  assert.deepEqual(view.participant?.sportAllocation, EQUAL);
});

test('availability and achievable GP reflect independent all-or-nothing commitments', () => {
  const view = buildGamesOfNationsUiModel({
    summary: summary({ participants: [participant({ cultureCommitment: 8, productionCommitment: 6 })] }),
    humanNationId: HUMAN,
    hostNationName: 'France',
    hostCityName: 'Paris',
    founderNationName: 'France',
    currentCultureAvailable: 7,
    currentBaseProductionAvailable: 8,
  });
  assert.equal(view.culture.affordable, false);
  assert.equal(view.culture.achievableGamesPoints, 0);
  assert.match(view.culture.status, /Cannot be fulfilled/);
  assert.equal(view.production.affordable, true);
  assert.equal(view.production.achievableGamesPoints, 60);
  assert.equal(view.theoreticalGamesPointsPerTurn, 140);
  assert.equal(view.achievableGamesPointsPerTurn, 60);
  assert.equal(view.culture.commitment, 8);
});

test('allocation validation rejects invalid totals and accepts an exact 100%', () => {
  assert.equal(validateGamesAllocation(EQUAL), null);
  assert.match(validateGamesAllocation({ ...EQUAL, Wrestling: 19 }) ?? '', /99%/);
  assert.match(validateGamesAllocation({ ...EQUAL, Wrestling: -1 }) ?? '', /whole percentage/);
  assert.match(validateGamesAllocation({ ...EQUAL, Wrestling: Number.NaN }) ?? '', /whole percentage/);
});

test('investment controls are editable only for participating nations during Preparation', () => {
  assert.equal(model().controlsEditable, true);
  assert.equal(model({ phase: 'competition' }).controlsEditable, false);
  assert.equal(model({ phase: 'cooldown' }).controlsEditable, false);
  assert.equal(model({ participants: [participant({ participating: false })] }).controlsEditable, false);
});

test('phase presentation exposes waiting, active sport, and cooldown timing', () => {
  const waiting = model({ phase: 'waitingForFirstGames', turnsUntilNextPhase: 8, phaseProgressTurn: null, phaseTotalTurns: null });
  assert.equal(waiting.turnsUntilPreparation, 8);
  assert.match(waiting.buttonTooltip, /Preparation begins in 8 turns/);
  const competition = model({ phase: 'competition', activeSport: 'Marathon', phaseProgressTurn: 2, phaseTotalTurns: 5 });
  assert.equal(competition.activeSport, 'Marathon');
  assert.equal(competition.competitionProgress, '2 / 5');
  const cooldown = model({ phase: 'cooldown', turnsUntilNextPhase: 7, phaseProgressTurn: 3, phaseTotalTurns: 10 });
  assert.equal(cooldown.turnsUntilPreparation, 7);
  assert.match(cooldown.buttonTooltip, /Next preparation in 7 turns/);
});

test('locked accumulated points remain separate from future allocation in the model', () => {
  const view = model({ participants: [participant({ sportAllocation: { ...EQUAL, Wrestling: 40, Marathon: 0 } })] });
  assert.equal(view.participant?.gamesPointsBySport.Wrestling, 40);
  assert.equal(view.participant?.sportAllocation.Wrestling, 40);
  assert.equal(view.participant?.gamesPointsBySport.Marathon, 30);
  assert.equal(view.participant?.sportAllocation.Marathon, 0);
});

test('dialog copy labels base Production accurately and explains bonus-amplified opportunity cost', () => {
  const source = readFileSync(new URL('../src/ui/GamesOfNationsDialog.ts', import.meta.url), 'utf8');
  assert.match(source, /Base Production commitment/);
  assert.match(source, /base Production available this turn/);
  assert.match(source, /diverted before Production bonuses are applied/);
  assert.match(source, /impact on normal production may be greater than the base amount committed/);
  assert.match(source, /Existing Culture progress is not spent/);
  assert.match(source, /Accumulated:/);
  assert.match(source, /% future/);
  assert.match(source, /Competition results/);
  assert.match(source, /gon-medal-table/);
  assert.match(source, /Final Games result/);
});

test('Competition and Cooldown models expose completed sports, medal standings, and winner names', () => {
  const resultState = {
    sportResults: [
      { sport: 'Wrestling' as const, resolved: true, competitionTurn: 1, goldNationId: HUMAN, silverNationId: HOST },
      { sport: 'Marathon' as const, resolved: false },
      { sport: 'Swimming' as const, resolved: false },
      { sport: 'Javelin' as const, resolved: false },
      { sport: 'Long Jump' as const, resolved: false },
    ],
    medalTable: [
      { nationId: HUMAN, gold: 1, silver: 0, bronze: 0 },
      { nationId: HOST, gold: 0, silver: 1, bronze: 0 },
    ],
    overallWinnerNationId: HUMAN,
    competitionComplete: false,
  };
  const competition = buildGamesOfNationsUiModel({
    summary: summary({ phase: 'competition', activeSport: 'Wrestling', phaseProgressTurn: 1, phaseTotalTurns: 5, ...resultState }),
    humanNationId: HUMAN,
    hostNationName: 'France', hostCityName: 'Paris', founderNationName: 'France',
    currentCultureAvailable: 7, currentBaseProductionAvailable: 8,
    nationNames: { [HUMAN]: 'Sweden', [HOST]: 'France' },
  });
  assert.equal(competition.sportResults[0]?.goldName, 'Sweden');
  assert.equal(competition.sportResults[1]?.status, 'Upcoming');
  assert.deepEqual(competition.medalTable.map((entry) => entry.nationName), ['Sweden', 'France']);

  const cooldown = buildGamesOfNationsUiModel({
    summary: summary({ phase: 'cooldown', phaseProgressTurn: 1, phaseTotalTurns: 10, ...resultState, competitionComplete: true }),
    humanNationId: HUMAN,
    hostNationName: 'France', hostCityName: 'Paris', founderNationName: 'France',
    currentCultureAvailable: 7, currentBaseProductionAvailable: 8,
    nationNames: { [HUMAN]: 'Sweden', [HOST]: 'France' },
  });
  assert.equal(cooldown.overallWinnerName, 'Sweden');
  assert.equal(cooldown.controlsEditable, false);
});
