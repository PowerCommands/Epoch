import assert from 'node:assert/strict';
import test from 'node:test';
import { MONUMENT } from '../src/data/buildings';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityManager } from '../src/systems/CityManager';
import { CultureSystem } from '../src/systems/culture/CultureSystem';
import {
  distributeGamesPointsEvenly,
  GAMES_AND_RECREATION_CULTURE_ID,
  GAMES_OF_NATIONS_SPORTS,
  GamesOfNationsSystem,
  reduceGamesStrategyToBudget,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import type { HappinessSystem } from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { TurnManager } from '../src/systems/TurnManager';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const CULTURAL_AI = 'cultural-ai';
const LOW_AI = 'low-ai';
const HUMAN = 'human';
const ADDITIONAL_ZERO = {
  'Horse Racing': 0, Boxing: 0, '100 Metres': 0, 'Pole Vault': 0, Fencing: 0,
} as const;

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
  assert.equal(participant(h).unallocatedGamesPoints, 60);
  assert.equal(Object.values(participant(h).gamesPointsBySport).reduce((sum, value) => sum + value, 0), 0);
  assert.equal(participant(h).failedCultureCommitmentTurns, 1);

  h.culture[HUMAN] = 4;
  h.production[HUMAN] = [{ cityId: 'human-capital', available: 5 }];
  h.process(96);
  assert.equal(participant(h).totalCultureInvested, 4);
  assert.equal(participant(h).totalProductionInvested, 6);
  assert.equal(participant(h).totalGamesPoints, 100);
  assert.equal(participant(h).unallocatedGamesPoints, 100);
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
  assert.equal(participant(h).unallocatedGamesPoints, 20);
  assert.deepEqual(participant(h).gamesPointsBySport, {
    Wrestling: 0, Marathon: 0, Swimming: 0, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  });
});

test('human can assign the recurring GP strategy before any resources are paid', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  assert.equal(h.system.setNationCultureCommitment(HUMAN, 3), true);
  assert.equal(h.system.setNationProductionCommitment(HUMAN, 8), true);
  const strategy: GamesOfNationsSportValues = {
    Wrestling: 60, Marathon: 50, Swimming: 0, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  };
  assert.equal(h.system.setNationGamesPointsStrategy(HUMAN, strategy), true);
  assert.equal(participant(h).totalGamesPoints, 0);
  assert.equal(participant(h).totalCultureInvested, 0);
  assert.equal(participant(h).totalProductionInvested, 0);
  assert.deepEqual(participant(h).gamesPointsStrategyBySport, strategy);

  h.process(95);
  assert.equal(participant(h).totalGamesPoints, 110);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 60);
  assert.equal(participant(h).gamesPointsBySport.Marathon, 50);
  assert.equal(participant(h).unallocatedGamesPoints, 0);

  h.process(96);
  assert.equal(participant(h).totalGamesPoints, 220);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 120);
  assert.equal(participant(h).gamesPointsBySport.Marathon, 100);
});

test('resource shortfall reduces the largest recurring sport allocations and requests human review', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 3);
  h.system.setNationProductionCommitment(HUMAN, 8);
  assert.equal(h.system.setNationGamesPointsStrategy(HUMAN, {
    Wrestling: 70, Marathon: 40, Swimming: 0, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  }), true);
  h.production[HUMAN] = [{ cityId: 'human-capital', available: 7 }];
  h.process(95);

  assert.equal(participant(h).totalCultureInvested, 3);
  assert.equal(participant(h).totalProductionInvested, 0);
  assert.equal(participant(h).totalGamesPoints, 30);
  assert.equal(participant(h).gamesPointsStrategyBySport.Wrestling, 15);
  assert.equal(participant(h).gamesPointsStrategyBySport.Marathon, 15);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 15);
  assert.equal(participant(h).gamesPointsBySport.Marathon, 15);
  assert.equal(participant(h).unallocatedGamesPoints, 0);
  assert.equal(participant(h).strategyAdjustmentPending, true);
  assert.equal(h.system.acknowledgeHumanStrategyAdjustment(HUMAN), true);
  assert.equal(participant(h).strategyAdjustmentPending, undefined);
});

test('a complete payment failure reduces a human strategy to zero without free GP', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 3);
  h.system.setNationProductionCommitment(HUMAN, 8);
  assert.equal(h.system.setNationGamesPointsStrategy(HUMAN, {
    Wrestling: 110, Marathon: 0, Swimming: 0, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  }), true);
  h.culture[HUMAN] = 2;
  h.production[HUMAN] = [{ cityId: 'human-capital', available: 7 }];
  h.process(95);
  assert.equal(participant(h).totalGamesPoints, 0);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 0);
  assert.equal(participant(h).gamesPointsStrategyBySport.Wrestling, 0);
  assert.equal(participant(h).strategyAdjustmentPending, true);
});

test('strategy reduction always removes from the currently largest allocation', () => {
  const reduced = reduceGamesStrategyToBudget({
    Wrestling: 70, Marathon: 20, Swimming: 10, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  }, 60);
  assert.deepEqual(reduced, {
    Wrestling: 30, Marathon: 20, Swimming: 10, Javelin: 0, 'Long Jump': 0,
    ...ADDITIONAL_ZERO,
  });
});

test('direct allocation irreversibly transfers exact integer GP from the pool and accumulates', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationProductionCommitment(HUMAN, 0);
  h.system.setNationCultureCommitment(HUMAN, 10);
  h.culture[HUMAN] = 20;
  h.process(95);
  assert.equal(participant(h).unallocatedGamesPoints, 100);
  for (const sport of GAMES_OF_NATIONS_SPORTS) {
    assert.equal(h.system.allocateGamesPoints(HUMAN, sport, 1), true);
  }
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Wrestling', 35), true);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Wrestling', 10), true);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 46);
  assert.equal(participant(h).unallocatedGamesPoints, 50);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Marathon', 51), false);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Marathon', -1), false);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Marathon', 1.5), false);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Marathon', 0), false);
  assert.equal(participant(h).gamesPointsBySport.Wrestling, 46);
  assert.equal(participant(h).unallocatedGamesPoints, 50);
});

test('even distribution uses canonical remainder order and ignores existing committed totals', () => {
  const result = distributeGamesPointsEvenly(103);
  assert.deepEqual(result, {
    Wrestling: 21,
    Marathon: 21,
    Swimming: 21,
    Javelin: 20,
    'Long Jump': 20,
    ...ADDITIONAL_ZERO,
  });
  assert.equal(Object.values(result).reduce((sum, value) => sum + value, 0), 103);
  assert.deepEqual(distributeGamesPointsEvenly(100), {
    Wrestling: 20, Marathon: 20, Swimming: 20, Javelin: 20, 'Long Jump': 20,
    ...ADDITIONAL_ZERO,
  });

  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 10);
  h.culture[HUMAN] = 20;
  h.process(95);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Wrestling', 100), true);
  h.process(96);
  assert.equal(h.system.distributeRemainingGamesPointsEvenly(HUMAN), true);
  assert.deepEqual(participant(h).gamesPointsBySport, {
    Wrestling: 120, Marathon: 20, Swimming: 20, Javelin: 20, 'Long Jump': 20,
    ...ADDITIONAL_ZERO,
  });
  assert.equal(participant(h).unallocatedGamesPoints, 0);
});

test('Preparation end automatically distributes the full human pool before Competition', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 7);
  h.system.setNationProductionCommitment(HUMAN, 3);
  h.process(95);
  assert.equal(participant(h).unallocatedGamesPoints, 100);
  const before = participant(h).totalGamesPoints;
  h.advanceTo(105);
  assert.equal(participant(h).unallocatedGamesPoints, 0);
  assert.equal(Object.values(participant(h).gamesPointsBySport).reduce((sum, value) => sum + value, 0), before);
  assert.deepEqual(participant(h).gamesPointsBySport, {
    Wrestling: 20, Marathon: 20, Swimming: 20, Javelin: 20, 'Long Jump': 20,
    ...ADDITIONAL_ZERO,
  });
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

test('AI cultural priority raises conservative commitments and AI assigns integer GP without percentage state', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  const cultural = participant(h, CULTURAL_AI);
  const low = participant(h, LOW_AI);
  assert.ok(cultural.cultureCommitment > low.cultureCommitment);
  assert.ok(cultural.cultureCommitment < h.culture[CULTURAL_AI] / 2);
  assert.ok(cultural.productionCommitment < h.production[CULTURAL_AI][0]!.available / 2);
  h.process(95, CULTURAL_AI);
  h.process(95, LOW_AI);
  assert.equal(participant(h, CULTURAL_AI).unallocatedGamesPoints, 0);
  assert.equal(participant(h, LOW_AI).unallocatedGamesPoints, 0);
  assert.equal(participant(h, CULTURAL_AI).sportAllocation, undefined);
  assert.equal(Object.values(participant(h, CULTURAL_AI).gamesPointsBySport).reduce((sum, value) => sum + value, 0), participant(h, CULTURAL_AI).totalGamesPoints);
  assert.equal(GAMES_OF_NATIONS_SPORTS.every((sport) => participant(h, CULTURAL_AI).gamesPointsBySport[sport] > 0), true);
  assert.notDeepEqual(participant(h, CULTURAL_AI).gamesPointsBySport, participant(h, LOW_AI).gamesPointsBySport);
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

test('save/load preserves exact committed and unallocated GP without redistributing on load', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  h.system.setNationCultureCommitment(HUMAN, 10);
  h.culture[HUMAN] = 20;
  h.process(95);
  assert.equal(h.system.allocateGamesPoints(HUMAN, 'Wrestling', 17), true);
  const restored = investmentHarness(JSON.parse(JSON.stringify(h.system.getState())), 95);
  assert.equal(participant(restored).gamesPointsBySport.Wrestling, 17);
  assert.equal(participant(restored).unallocatedGamesPoints, 83);
});

test('legacy percentage saves retain committed GP exactly, discard percentages, and start with an empty pool', () => {
  const h = investmentHarness();
  foundAt80(h);
  h.advanceTo(95);
  const saved = h.system.getState();
  const legacy = saved.participants.find((entry) => entry.nationId === HUMAN)! as GamesOfNationsParticipantState & {
    sportAllocation: GamesOfNationsSportValues;
    unallocatedGamesPoints?: number;
  };
  legacy.gamesPointsBySport = { Wrestling: 130, Marathon: 70, Swimming: 40, Javelin: 100, 'Long Jump': 50 };
  legacy.totalGamesPoints = 390;
  legacy.sportAllocation = { Wrestling: 50, Marathon: 20, Swimming: 10, Javelin: 10, 'Long Jump': 10 };
  delete legacy.unallocatedGamesPoints;
  const restored = investmentHarness(saved, 95);
  const migrated = participant(restored);
  assert.deepEqual(migrated.gamesPointsBySport, { ...legacy.gamesPointsBySport, ...ADDITIONAL_ZERO });
  assert.equal(migrated.unallocatedGamesPoints, 0);
  assert.equal(migrated.sportAllocation, undefined);
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
    ...ADDITIONAL_ZERO,
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
