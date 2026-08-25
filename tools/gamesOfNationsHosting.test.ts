import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getGrandStadiumPriorityQueueAction } from '../src/systems/AISystem';
import { GRAND_STADIUM, GRAND_STADIUM_BUILDING_ID, MONUMENT } from '../src/data/buildings';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityManager } from '../src/systems/CityManager';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
  type GamesOfNationsHostCityCandidate,
} from '../src/systems/GamesOfNationsSystem';
import type { HappinessSystem } from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { TurnManager } from '../src/systems/TurnManager';

function city(id: string, productionPerTurn: number, valid = true, hasGrandStadium = false): GamesOfNationsHostCityCandidate {
  return { id, name: id.toUpperCase(), productionPerTurn, canConstructGrandStadium: valid, hasGrandStadium };
}

function hostingHarness(options: {
  humanId?: string;
  cities?: Record<string, GamesOfNationsHostCityCandidate[]>;
  stadiums?: Set<string>;
} = {}) {
  let turn = 80;
  const living = ['france', 'sweden', 'england'];
  const owners = new Map<string, string>();
  const candidates = options.cities ?? {
    france: [city('paris', 8), city('lyon', 14)],
    sweden: [city('stockholm', 10)],
    england: [city('london', 9)],
  };
  for (const [nationId, entries] of Object.entries(candidates)) {
    for (const entry of entries) owners.set(entry.id, nationId);
  }
  const hostingEvents: Array<{ gamesNumber: number; hostNationId: string; hostCityId: string }> = [];
  const cancellations: string[] = [];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => living,
    getNationName: (id) => id,
    getCapitalCity: (id) => candidates[id]?.[0] ? { id: candidates[id]![0]!.id, name: candidates[id]![0]!.name } : undefined,
    getHostCityCandidates: (id) => candidates[id] ?? [],
    getCityName: (id) => id.toUpperCase(),
    getCityOwnerId: (id) => owners.get(id),
    hasGrandStadium: (id) => options.stadiums?.has(id) === true,
    isHumanNation: (id) => id === options.humanId,
    onHostingConfirmed: (event) => hostingEvents.push(event),
    onGamesCancelled: (event) => cancellations.push(event.reason),
  };
  const system = GamesOfNationsSystem.forNewGame(dependencies);
  system.handleCultureCompleted('france', GAMES_AND_RECREATION_CULTURE_ID, turn);
  return {
    system, living, owners, hostingEvents, cancellations, dependencies,
    setTurn(value: number) { turn = value; },
    advanceTo(target: number) {
      for (turn += 1; turn <= target; turn += 1) system.handleRoundStart(turn);
      turn = target;
    },
  };
}

test('human accept/decline is one-time, advances rotation, and locks an owned selected city', () => {
  const h = hostingHarness({ humanId: 'france' });
  assert.equal(h.system.isHumanHostingPromptPending(), true);
  assert.equal(h.system.acceptHostingOffer('france'), true);
  assert.equal(h.system.isHumanHostCitySelectionPending(), true);
  assert.equal(h.system.selectHostCity('france', 'stockholm'), false);
  assert.equal(h.system.selectHostCity('france', 'lyon'), true);
  assert.equal(h.system.selectHostCity('france', 'paris'), false);
  assert.equal(h.system.getState().upcomingHostCityId, 'lyon');
  assert.equal(h.hostingEvents.length, 1);

  const declined = hostingHarness({ humanId: 'france' });
  assert.equal(declined.system.declineHostingOffer('france'), true);
  assert.equal(declined.system.getState().upcomingHostNationId, 'sweden');
  assert.deepEqual(declined.system.getState().offeredHostNationIds, ['france', 'sweden']);
  assert.deepEqual(declined.system.getState().declinedHostNationIds, ['france']);
});

test('AI accepts, chooses the highest-production city deterministically, and only it receives stadium priority', () => {
  const h = hostingHarness();
  assert.equal(h.system.getState().upcomingHostNationId, 'france');
  assert.equal(h.system.getState().upcomingHostCityId, 'lyon');
  assert.equal(h.system.getGrandStadiumPriorityCityId('france'), 'lyon');
  assert.equal(h.system.getGrandStadiumPriorityCityId('sweden'), null);
  assert.equal(h.system.canCityConstructGrandStadium('paris', 'france'), false);
  assert.equal(h.system.canCityConstructGrandStadium('lyon', 'france'), true);
});

test('no valid nation terminates selection and the scheduled Games cancel without sports or medals', () => {
  const h = hostingHarness({ cities: { france: [], sweden: [], england: [] } });
  assert.equal(h.system.getState().hostingDecision, 'cancelled');
  assert.deepEqual(h.system.getState().offeredHostNationIds, ['france', 'sweden', 'england']);
  h.advanceTo(105);
  const state = h.system.getState();
  assert.equal(state.phase, 'cancelled');
  assert.equal(state.sportResults?.every((sport) => !sport.resolved), true);
  assert.deepEqual(state.medalTable, []);
  assert.equal(state.completedGames?.[0]?.status, 'cancelled');
  assert.equal(h.cancellations.length, 1);
});

test('deadline requires ownership and a completed stadium; an existing stadium proceeds and removes priority', () => {
  const stadiums = new Set<string>();
  const incomplete = hostingHarness({ stadiums });
  incomplete.advanceTo(105);
  assert.equal(incomplete.system.getState().phase, 'cancelled');
  assert.match(incomplete.cancellations[0] ?? '', /Grand Stadium incomplete/);

  const existing = hostingHarness({ stadiums: new Set(['lyon']) });
  assert.equal(existing.system.getGrandStadiumPriorityCityId('france'), null);
  existing.advanceTo(105);
  assert.equal(existing.system.getState().phase, 'competition');

  const captured = hostingHarness({ stadiums: new Set(['lyon']) });
  captured.owners.set('lyon', 'england');
  captured.advanceTo(105);
  assert.equal(captured.system.getState().phase, 'cancelled');
  assert.match(captured.cancellations[0] ?? '', /no longer owned/);
});

test('the next confirmed host keeps one fixed 25-turn deadline across Competition, Cooldown, and Preparation', () => {
  const h = hostingHarness({ stadiums: new Set(['lyon', 'stockholm']) });
  h.advanceTo(105);
  assert.equal(h.system.getSummary().competitionDeadline, 130);
  h.advanceTo(110);
  assert.equal(h.system.getSummary().competitionDeadline, 130);
  h.advanceTo(120);
  assert.equal(h.system.getSummary().competitionDeadline, 130);
});

test('AI queue action makes Grand Stadium absolute priority and safe reordering preserves earned Production', () => {
  const ordinary = { kind: 'building' as const, buildingType: MONUMENT };
  const stadium = { kind: 'building' as const, buildingType: GRAND_STADIUM };
  assert.equal(getGrandStadiumPriorityQueueAction([{ item: ordinary }, { item: stadium }]), 1);
  assert.equal(getGrandStadiumPriorityQueueAction([{ item: stadium }, { item: ordinary }]), null);
  assert.equal(getGrandStadiumPriorityQueueAction([{ item: ordinary }]), -1);

  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'ai', name: 'AI', color: 0xffffff }));
  const cities = new CityManager();
  cities.addCity(new City({ id: 'host', name: 'Host', ownerId: 'ai', tileX: 0, tileY: 0 }));
  cities.getResources('host').productionPerTurn = 10;
  const turns = new TurnManager(nations);
  const production = new ProductionSystem(cities, turns, { getProductionModifier: () => 1 } as HappinessSystem);
  production.restoreQueue('host', [
    { item: ordinary, accumulated: 30, lockedProductionCost: MONUMENT.productionCost },
    { item: stadium, accumulated: 0, lockedProductionCost: GRAND_STADIUM.productionCost },
  ]);
  assert.equal(production.moveQueueEntryToFront('host', 1), true);
  assert.equal(production.getProduction('host')?.item.kind, 'building');
  assert.equal((production.getProduction('host')?.item as typeof stadium).buildingType.id, GRAND_STADIUM_BUILDING_ID);
  assert.equal(production.moveQueueEntryToFront('host', 1), true);
  assert.equal(production.getProduction('host')?.accumulated, 30);
  assert.equal(production.getProduction('host')?.lockedProductionCost, MONUMENT.productionCost);
});

test('Grand Stadium definition and generated asset use normal 256×256 RGBA PNG conventions', () => {
  assert.equal(GRAND_STADIUM.id, GRAND_STADIUM_BUILDING_ID);
  assert.equal(GRAND_STADIUM.productionCost, 150);
  const png = readFileSync(new URL('../public/assets/sprites/buildings/grand_stadium.png', import.meta.url));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
  assert.equal(png[25], 6, 'PNG color type 6 is RGBA');
});

test('confirmed hosting survives save/load without repeating selection or its announcement', () => {
  const h = hostingHarness({ humanId: 'france' });
  h.system.acceptHostingOffer('france');
  h.system.selectHostCity('france', 'paris');
  assert.equal(h.hostingEvents.length, 1);
  const saved = JSON.parse(JSON.stringify(h.system.getState()));
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, saved, 80);
  assert.equal(restored.getState().hostingDecision, 'confirmed');
  assert.equal(restored.getState().upcomingHostCityId, 'paris');
  assert.equal(restored.isHumanHostingPromptPending(), false);
  assert.equal(restored.isHumanHostCitySelectionPending(), false);
  assert.equal(h.hostingEvents.length, 1);
});

test('a cancelled Games leaves the last completed champion and Cultural Victory window unchanged', () => {
  const h = hostingHarness();
  const state = h.system.getState();
  state.phase = 'preparation';
  state.competitionNumber = 2;
  state.hostingGamesNumber = 2;
  state.phaseStartTurn = 95;
  state.nextTransitionTurn = 105;
  state.scheduledGamesTurn = 105;
  state.lastProcessedTurn = 104;
  state.completedGames = [{
    status: 'completed', gamesNumber: 1, tournamentStartTurn: 75, completionTurn: 79,
    worldYear: -1000, yearLabel: '1000 BC', hostNationName: 'Sweden', hostCityName: 'Stockholm',
    overallWinnerNationId: 'sweden', overallWinnerNationName: 'Sweden', medalTable: [],
  }];
  h.setTurn(104);
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, state, 104);
  assert.equal(restored.getReigningChampionNationId(), 'sweden');
  h.setTurn(105);
  restored.handleRoundStart(105);
  assert.equal(restored.getState().phase, 'cancelled');
  assert.equal(restored.getReigningChampionNationId(), 'sweden');
  assert.equal(restored.getLatestCompletedGames()?.gamesNumber, 1);
});

test('hosting and cancellation are ordinary importance-3 History events with ranked newspaper definitions', () => {
  const scene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  const content = readFileSync(new URL('../src/data/newspaperContent.ts', import.meta.url), 'utf8');
  assert.match(scene, /type: 'gamesHostingAnnounced'[\s\S]*?newsImportance: 3/);
  assert.match(scene, /type: 'gamesCancelled'[\s\S]*?newsImportance: 3/);
  assert.match(content, /gamesHostingAnnounced: definition\(70/);
  assert.match(content, /gamesCancelled: definition\(70/);
});

test('selecting a human host city closes hosting UI without opening the investment panel early', () => {
  const dialog = readFileSync(new URL('../src/ui/GamesOfNationsDialog.ts', import.meta.url), 'utf8');
  const citySelection = dialog.match(/showHostCitySelection\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(citySelection, /onHostCitySelected\(city\.id\)\) this\.close\(\)/);
  assert.doesNotMatch(citySelection, /onHostCitySelected\(city\.id\)\) this\.showPanel\(\)/);
});
