import assert from 'node:assert/strict';
import test from 'node:test';
import { MONUMENT } from '../src/data/buildings';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityManager } from '../src/systems/CityManager';
import { CultureSystem } from '../src/systems/culture/CultureSystem';
import {
  distributeGamesPoints,
  GAMES_AND_RECREATION_CULTURE_ID,
  GAMES_OF_NATIONS_SPORTS,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import type { HappinessSystem } from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { TurnManager } from '../src/systems/TurnManager';
import type {
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const CULTURAL_AI = 'cultural-ai';
const LOW_AI = 'low-ai';
const HUMAN = 'human';

interface InvestmentHarness {
  system: GamesOfNationsSystem;
  culture: Record<string, number>;
  production: Record<string, Array<{ cityId: string; available: number }>>;
  priorities: Record<string, number>;
  setTurn(turn: number): void;
  advanceTo(turn: number): void;
  process(turn: number, nationId?: string): void;
}

function investmentHarness(saved?: SavedGamesOfNationsState, initialTurn = 1): InvestmentHarness {
  let currentTurn = initialTurn;
  const living = [CULTURAL_AI, LOW_AI, HUMAN];
  const culture = { [CULTURAL_AI]: 20, [LOW_AI]: 20, [HUMAN]: 7 };
  const production = {
    [CULTURAL_AI]: [{ cityId: 'cultural-capital', available: 20 }],
    [LOW_AI]: [{ cityId: 'low-capital', available: 20 }],
    [HUMAN]: [{ cityId: 'human-capital', available: 10 }],
  };
  const priorities = { [CULTURAL_AI]: 1, [LOW_AI]: 0, [HUMAN]: 0.5 };
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => currentTurn,
    getLivingNationIds: () => living,
    getNationName: (id) => ({ [CULTURAL_AI]: 'Cultured', [LOW_AI]: 'Pragmatic', [HUMAN]: 'Human' })[id],
    getCapitalCity: (id) => ({ id: `${id}-capital`, name: `${id} City` }),
    isHumanNation: (id) => id === HUMAN,
    getCultureOutput: (id) => culture[id] ?? 0,
    getProductionSources: (id) => production[id] ?? [],
    getCulturalPriority: (id) => priorities[id] ?? 0.5,
    seed: 'investment-tests',
  };
  const system = saved
    ? GamesOfNationsSystem.fromSave(dependencies, saved, initialTurn)
    : GamesOfNationsSystem.forNewGame(dependencies);
  return {
    system,
    culture,
    production,
    priorities,
    setTurn(turn) { currentTurn = turn; },
    advanceTo(turn) {
      for (let round = currentTurn + 1; round <= turn; round += 1) {
        currentTurn = round;
        system.handleRoundStart(round);
      }
    },
    process(turn, nationId = HUMAN) {
      currentTurn = turn;
      system.handleRoundStart(turn);
      system.processNationPreparationTurn(nationId, turn);
    },
  };
}

function foundAt80(h: InvestmentHarness): void {
  h.setTurn(80);
  assert.equal(h.system.handleCultureCompleted(CULTURAL_AI, GAMES_AND_RECREATION_CULTURE_ID, 80), true);
}

function allTo(sport: keyof GamesOfNationsSportValues): GamesOfNationsSportValues {
  return Object.fromEntries(
    GAMES_OF_NATIONS_SPORTS.map((candidate) => [candidate, candidate === sport ? 100 : 0]),
  ) as unknown as GamesOfNationsSportValues;
}

function participant(h: InvestmentHarness, nationId = HUMAN) {
  return h.system.getState().participants.find((entry) => entry.nationId === nationId)!;
}

test('Games #1 waits 15 turns, prepares for exactly 10, and retains the +25 start', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(94);
  assert.equal(h.system.getState().phase, 'waitingForFirstGames');
  h.advanceTo(95);
  assert.equal(h.system.getState().phase, 'preparation');
  assert.equal(h.system.getState().phaseStartTurn, 95);
  h.advanceTo(104);
  assert.equal(h.system.getState().phase, 'preparation');
  h.advanceTo(105);
  assert.equal(h.system.getState().phase, 'competition');
  assert.equal(h.system.getState().hostNationId, CULTURAL_AI);
  assert.equal(h.system.getState().scheduledGamesTurn, 105);
});

test('investment occurs only in Preparation, including Games #1 and later Games', () => {
  const h = investmentHarness();
  foundAt80(h);
  assert.equal(h.system.setNationCultureCommitment(HUMAN, 2), true);
  h.process(90);
  assert.equal(participant(h).totalGamesPoints, 0);

  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 2);
  h.process(95);
  assert.equal(participant(h).totalGamesPoints, 20);
  h.advanceTo(105);
  const competitionPoints = participant(h).totalGamesPoints;
  h.process(105);
  assert.equal(participant(h).totalGamesPoints, competitionPoints);

  h.advanceTo(120);
  h.system.setNationCultureCommitment(HUMAN, 1);
  h.process(120);
  assert.equal(participant(h).totalGamesPoints, 10);
  assert.equal(h.system.getState().competitionNumber, 2);
});

test('AI participates and invests during Games #1 Preparation', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  const ai = participant(h, CULTURAL_AI);
  assert.equal(ai.participating, true);
  assert.equal(ai.strategyInitialized, true);
  assert.ok(ai.cultureCommitment > 0);
  assert.ok(ai.productionCommitment > 0);
  h.process(95, CULTURAL_AI);
  assert.ok(participant(h, CULTURAL_AI).totalGamesPoints > 0);
  const points = participant(h, CULTURAL_AI).totalGamesPoints;
  h.advanceTo(105);
  assert.equal(participant(h, CULTURAL_AI).totalGamesPoints, points);
});

test('Culture diversion reduces only new Culture progression and never prior progress', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 3);
  h.system.setNationProductionCommitment(HUMAN, 0);
  h.process(95);
  assert.equal(h.system.getCultureDiversionForTurn(HUMAN, 95), 3);

  const nations = new NationManager();
  const nation = new Nation({
    id: HUMAN,
    name: 'Human',
    color: 0xffffff,
    currentCultureNodeId: 'code_of_laws',
    cultureProgress: 1,
  });
  nations.addNation(nation);
  const cultureSystem = new CultureSystem(
    nations,
    () => 95,
    () => h.culture[HUMAN] - h.system.getCultureDiversionForTurn(HUMAN, 95),
  );
  cultureSystem.advanceCultureForNation(HUMAN);
  assert.equal(nation.cultureProgress, 5);
  assert.equal(participant(h).totalCultureInvested, 3);
  assert.equal(participant(h).totalGamesPoints, 30);
});

test('Production investment removes real progress from a deterministic city queue', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 0);
  h.system.setNationProductionCommitment(HUMAN, 4);
  h.process(95);
  assert.equal(h.system.getProductionDiversionForTurn(HUMAN, 'human-capital', 95), 4);

  const nations = new NationManager();
  nations.addNation(new Nation({ id: HUMAN, name: 'Human', color: 0xffffff }));
  const cities = new CityManager();
  cities.addCity(new City({ id: 'human-capital', name: 'Capital', ownerId: HUMAN, tileX: 0, tileY: 0 }));
  cities.getResources('human-capital').productionPerTurn = 10;
  const turns = new TurnManager(nations);
  const happiness = { getProductionModifier: () => 1 } as HappinessSystem;
  const production = new ProductionSystem(cities, turns, happiness);
  production.setProductionDiversionProvider((nationId, cityId) => (
    h.system.getProductionDiversionForTurn(nationId, cityId, 95)
  ));
  production.enqueue('human-capital', { kind: 'building', buildingType: MONUMENT });
  turns.start();
  turns.endCurrentTurn();
  assert.equal(production.getProduction('human-capital')?.accumulated, 6);
  assert.equal(participant(h).totalProductionInvested, 4);
  assert.equal(participant(h).totalGamesPoints, 40);
});

test('Culture and Production commitments fail independently and never spend partially', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.culture[HUMAN] = 3;
  h.production[HUMAN] = [{ cityId: 'human-capital', available: 8 }];
  h.system.setNationCultureCommitment(HUMAN, 4);
  h.system.setNationProductionCommitment(HUMAN, 6);
  h.process(95);
  assert.equal(participant(h).totalCultureInvested, 0);
  assert.equal(participant(h).totalProductionInvested, 6);
  assert.equal(participant(h).totalGamesPoints, 60);
  assert.equal(participant(h).failedCultureCommitmentTurns, 1);

  h.culture[HUMAN] = 4;
  h.production[HUMAN] = [{ cityId: 'human-capital', available: 5 }];
  h.process(96);
  assert.equal(participant(h).totalCultureInvested, 4);
  assert.equal(participant(h).totalProductionInvested, 6);
  assert.equal(participant(h).totalGamesPoints, 100);
  assert.equal(participant(h).failedProductionCommitmentTurns, 1);
});

test('one Culture and one Production each convert to exactly ten Games Points', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 1);
  h.system.setNationProductionCommitment(HUMAN, 1);
  h.process(95);
  assert.equal(participant(h).totalCultureInvested, 1);
  assert.equal(participant(h).totalProductionInvested, 1);
  assert.equal(participant(h).totalGamesPoints, 20);
});

test('commitment and allocation changes affect future points only', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationProductionCommitment(HUMAN, 0);
  h.system.setNationCultureCommitment(HUMAN, 1);
  h.system.setNationSportAllocation(HUMAN, allTo('Wrestling'));
  h.process(95);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 10);

  h.system.setNationCultureCommitment(HUMAN, 2);
  h.system.setNationSportAllocation(HUMAN, allTo('Marathon'));
  h.process(96);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 10);
  assert.equal(participant(h).gamesPointsBySport.Marathon, 20);
  assert.equal(participant(h).totalGamesPoints, 30);
});

test('point rounding preserves exact totals using stable sport order', () => {
  const allocation: GamesOfNationsSportValues = {
    Wrestling: 33,
    Marathon: 22,
    Swimming: 17,
    Javelin: 16,
    'Long Jump': 12,
  };
  const result = distributeGamesPoints(7, allocation);
  assert.deepEqual(result, {
    Wrestling: 3,
    Marathon: 2,
    Swimming: 1,
    Javelin: 1,
    'Long Jump': 0,
  });
  assert.equal(Object.values(result).reduce((sum, value) => sum + value, 0), 7);

  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  assert.equal(h.system.setNationSportAllocation(HUMAN, {
    Wrestling: 3, Marathon: 2, Swimming: 1, Javelin: 2, 'Long Jump': 2,
  }), true);
  assert.equal(Object.values(participant(h).sportAllocation).reduce((sum, value) => sum + value, 0), 100);
});

test('non-participating human consumes nothing and is not forced back in during the cycle', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setParticipation(HUMAN, false);
  h.system.setNationCultureCommitment(HUMAN, 7);
  h.system.setNationProductionCommitment(HUMAN, 10);
  h.process(95);
  h.process(96);
  assert.equal(participant(h).participating, false);
  assert.equal(participant(h).totalGamesPoints, 0);
  assert.equal(h.system.getCultureDiversionForTurn(HUMAN, 96), 0);
  assert.equal(h.system.getProductionDiversionForTurn(HUMAN, 'human-capital', 96), 0);
});

test('AI cultural priority raises conservative commitments and allocations vary', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  const cultural = participant(h, CULTURAL_AI);
  const low = participant(h, LOW_AI);
  assert.ok(cultural.cultureCommitment > low.cultureCommitment);
  assert.ok(cultural.cultureCommitment < h.culture[CULTURAL_AI] / 2);
  assert.ok(cultural.productionCommitment < h.production[CULTURAL_AI][0]!.available / 2);
  assert.notDeepEqual(cultural.sportAllocation, low.sportAllocation);
  assert.equal(Object.values(cultural.sportAllocation).reduce((sum, value) => sum + value, 0), 100);
});

test('save/load preserves AI strategy and accumulated investment without rerolling', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.process(95, CULTURAL_AI);
  h.process(95, LOW_AI);
  const saved = JSON.parse(JSON.stringify(h.system.getState())) as SavedGamesOfNationsState;
  const restored = investmentHarness(saved, 95);
  restored.system.handleRoundStart(95);
  assert.deepEqual(restored.system.getState(), h.system.getState());
});

test('new Preparation resets all cycle investment while retaining the 25-turn cadence', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 2);
  h.process(95);
  assert.equal(participant(h).totalGamesPoints, 20);
  h.advanceTo(120);
  const next = participant(h);
  assert.equal(next.totalGamesPoints, 0);
  assert.equal(next.totalCultureInvested, 0);
  assert.equal(next.totalProductionInvested, 0);
  assert.deepEqual(next.gamesPointsBySport, {
    Wrestling: 0, Marathon: 0, Swimming: 0, Javelin: 0, 'Long Jump': 0,
  });
  h.advanceTo(130);
  assert.equal(h.system.getState().scheduledGamesTurn, 130);
  h.advanceTo(155);
  assert.equal(h.system.getState().scheduledGamesTurn, 155);
  assert.equal(h.system.getState().competitionNumber, 3);
});

test('Step 1 waiting saves migrate into first Preparation without shifting Competition', () => {
  const oldParticipant = { nationId: HUMAN, participating: true };
  const oldState = {
    founded: true,
    founderNationId: CULTURAL_AI,
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'waitingForFirstGames',
    competitionNumber: 1,
    phaseStartTurn: 80,
    nextTransitionTurn: 105,
    scheduledGamesTurn: 105,
    hostNationId: CULTURAL_AI,
    hostCityId: 'cultural-ai-capital',
    hostRotationOrder: [CULTURAL_AI, LOW_AI, HUMAN],
    hostRotationIndex: 0,
    participants: [oldParticipant],
    lastProcessedTurn: 100,
  } as unknown as SavedGamesOfNationsState;
  const restored = investmentHarness(oldState, 100);
  assert.equal(restored.system.getState().phase, 'preparation');
  assert.equal(restored.system.getState().phaseStartTurn, 95);
  assert.equal(restored.system.getState().nextTransitionTurn, 105);
  assert.equal(participant(restored).totalGamesPoints, 0);
  restored.advanceTo(105);
  assert.equal(restored.system.getState().phase, 'competition');
  assert.equal(restored.system.getState().scheduledGamesTurn, 105);
});

test('old saves without Games state remain inactive', () => {
  const h = investmentHarness(undefined, 100);
  assert.equal(h.system.getState().phase, 'inactive');
  assert.deepEqual(h.system.getState().participants, []);
});
