import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GRAND_STADIUM,
  GRAND_STADIUM_BUILDING_ID,
  STADIUM,
  STADIUM_HAPPINESS_PER_TURN,
} from '../src/data/buildings';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityBuildings } from '../src/entities/CityBuildings';
import { CityManager } from '../src/systems/CityManager';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
  type GamesOfNationsHostCityCandidate,
} from '../src/systems/GamesOfNationsSystem';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { buildGamesOfNationsUiModel } from '../src/ui/hud/GamesOfNationsUiModel';

function candidate(id: string, productionPerTurn: number, hasGrandStadium = false): GamesOfNationsHostCityCandidate {
  return { id, name: id[0]!.toUpperCase() + id.slice(1), productionPerTurn, hasGrandStadium, canConstructGrandStadium: !hasGrandStadium };
}

function systemHarness(options: {
  human?: boolean;
  cities?: GamesOfNationsHostCityCandidate[];
  activeStadiums?: Set<string>;
  physicalStadiums?: Set<string>;
  living?: string[];
} = {}) {
  let turn = 80;
  const cities = options.cities ?? [candidate('paris', 10)];
  const active = options.activeStadiums ?? new Set<string>();
  const physical = options.physicalStadiums ?? active;
  const owners = new Map(cities.map((city) => [city.id, 'france']));
  const living = options.living ?? ['france'];
  const logs: string[] = [];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => living,
    getNationName: () => 'France',
    getCapitalCity: () => cities[0] ? { id: cities[0].id, name: cities[0].name } : undefined,
    getHostCityCandidates: () => cities.map((city) => ({ ...city, hasGrandStadium: active.has(city.id) })),
    getCityOwnerId: (id) => owners.get(id),
    getCityName: (id) => cities.find((city) => city.id === id)?.name,
    hasGrandStadium: (id) => active.has(id),
    hasGrandStadiumStructure: (id) => physical.has(id),
    isHumanNation: () => options.human === true,
    log: (message) => logs.push(message),
  };
  const system = GamesOfNationsSystem.forNewGame(dependencies);
  system.handleCultureCompleted('france', GAMES_AND_RECREATION_CULTURE_ID, turn);
  return {
    system, active, physical, owners, logs, dependencies,
    advanceTo(target: number) {
      for (turn += 1; turn <= target; turn += 1) system.handleRoundStart(turn);
      turn = target;
    },
  };
}

test('Grand Stadium shares the normal Stadium happiness value and stacks through normal building effects', () => {
  assert.equal(STADIUM_HAPPINESS_PER_TURN, 5);
  assert.equal(STADIUM.modifiers.happinessPerTurn, STADIUM_HAPPINESS_PER_TURN);
  assert.equal(GRAND_STADIUM.modifiers.happinessPerTurn, STADIUM.modifiers.happinessPerTurn);

  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'france', name: 'France', color: 0x2244ff }));
  nations.addNation(new Nation({ id: 'england', name: 'England', color: 0xff2244 }));
  const cities = new CityManager();
  cities.addCity(new City({ id: 'paris', name: 'Paris', ownerId: 'france', tileX: 0, tileY: 0 }));
  const happiness = new HappinessSystem(nations, cities);
  const buildings = cities.getBuildings('paris');

  happiness.recalculateNation('france');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 0, 'queued/uncompleted buildings contribute nothing');
  buildings.add(GRAND_STADIUM);
  happiness.recalculateNation('france');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 5);
  buildings.add(STADIUM);
  happiness.recalculateNation('france');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 10);
  assert.deepEqual(new Set(buildings.getAll()), new Set([GRAND_STADIUM_BUILDING_ID, STADIUM.id]));

  buildings.add(GRAND_STADIUM);
  happiness.recalculateNation('france');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 10, 're-adding the same id cannot duplicate its yield');
  buildings.setBroken(GRAND_STADIUM_BUILDING_ID, true);
  happiness.recalculateNation('france');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 5, 'broken buildings use normal inactive-effect rules');
  buildings.setBroken(GRAND_STADIUM_BUILDING_ID, false);

  const savedEntries = JSON.parse(JSON.stringify(buildings.getAllEntries())) as Array<{ buildingId: string; broken: boolean }>;
  const restored = new CityBuildings('restored-paris');
  for (const entry of savedEntries) restored.addEntry(entry.buildingId, entry.broken);
  assert.equal(restored.hasActive(GRAND_STADIUM_BUILDING_ID), true, 'serialized city building state restores the stadium');
  assert.equal(restored.getAll().reduce((sum, id) => sum + (id === GRAND_STADIUM.id ? GRAND_STADIUM.modifiers.happinessPerTurn ?? 0 : id === STADIUM.id ? STADIUM.modifiers.happinessPerTurn ?? 0 : 0), 0), 10);

  cities.transferOwnership('paris', 'england');
  happiness.recalculateNation('france');
  happiness.recalculateNation('england');
  assert.equal(happiness.getNationState('france').happinessFromBuildings, 0);
  assert.equal(happiness.getNationState('england').happinessFromBuildings, 10, 'capture keeps buildings and moves their normal effects to the new owner');
});

test('AI strongly prefers a valid existing Grand Stadium and activates no construction priority', () => {
  const h = systemHarness({
    cities: [candidate('paris', 8, true), candidate('lyon', 30)],
    activeStadiums: new Set(['paris']),
  });
  assert.equal(h.system.getState().upcomingHostCityId, 'paris');
  assert.equal(h.system.getSummary().stadiumExistingInfrastructure, true);
  assert.equal(h.system.getGrandStadiumPriorityCityId('france'), null);
  assert.equal(h.system.canCityConstructGrandStadium('paris', 'france'), false);
  assert.match(h.logs.join('\n'), /existing Grand Stadium satisfies hosting requirement/);
});

test('stadium reuse is city-specific, survives GoN save/load, and remains valid for later Games', () => {
  const h = systemHarness({
    cities: [candidate('paris', 8, true), candidate('lyon', 30)],
    activeStadiums: new Set(['paris']),
    living: ['france', 'england', 'sweden'], // three eligible participants let the Games proceed
  });
  assert.equal(h.system.canCityConstructGrandStadium('lyon', 'france'), false, 'only the selected host city gets special availability');
  const saved = JSON.parse(JSON.stringify(h.system.getState()));
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, saved, 80);
  assert.equal(restored.getSummary().stadiumCompleted, true);
  assert.equal(restored.getGrandStadiumPriorityCityId('france'), null);

  h.advanceTo(105);
  assert.equal(h.system.getState().phase, 'competition', 'an old stadium passes the normal deadline validation');
  assert.equal(h.system.getState().hostingGamesNumber, 2);
  assert.equal(h.system.getState().upcomingHostCityId, 'paris', 'the same permanent stadium is selected again next cycle');
  assert.equal(h.system.getGrandStadiumPriorityCityId('france'), null);
});

test('a different selected city requires its own stadium, while a broken structure cannot be duplicated', () => {
  const different = systemHarness({ cities: [candidate('lyon', 20)] });
  assert.equal(different.system.getGrandStadiumPriorityCityId('france'), 'lyon');
  assert.equal(different.system.canCityConstructGrandStadium('lyon', 'france'), true);

  const broken = systemHarness({
    cities: [candidate('paris', 20)],
    physicalStadiums: new Set(['paris']),
  });
  assert.equal(broken.system.getSummary().stadiumCompleted, false);
  assert.equal(broken.system.canCityConstructGrandStadium('paris', 'france'), false, 'physical uniqueness includes broken buildings');
  assert.equal(broken.system.getGrandStadiumPriorityCityId('france'), null);
});

test('human host-city presentation and Preparation status identify existing infrastructure', () => {
  const h = systemHarness({
    human: true,
    cities: [candidate('paris', 18, true), candidate('lyon', 22)],
    activeStadiums: new Set(['paris']),
  });
  assert.equal(h.system.acceptHostingOffer('france'), true);
  const summaryBeforeSelection = h.system.getSummary();
  const pending = buildGamesOfNationsUiModel({
    summary: summaryBeforeSelection,
    humanNationId: 'france',
    hostNationName: null,
    hostCityName: null,
    founderNationName: 'France',
    currentCultureAvailable: 0,
    currentBaseProductionAvailable: 0,
    hostCityOptions: [
      { id: 'paris', name: 'Paris', productionPerTurn: 18, estimatedTurns: 0, hasGrandStadium: true },
      { id: 'lyon', name: 'Lyon', productionPerTurn: 22, estimatedTurns: 7, hasGrandStadium: false },
    ],
  });
  assert.equal(pending.hostCityOptions[0]?.hasGrandStadium, true);
  assert.equal(h.system.selectHostCity('france', 'paris'), true);
  const selected = buildGamesOfNationsUiModel({
    summary: h.system.getSummary(),
    humanNationId: 'france',
    hostNationName: 'France',
    hostCityName: 'Paris',
    founderNationName: 'France',
    currentCultureAvailable: 0,
    currentBaseProductionAvailable: 0,
  });
  assert.equal(selected.stadiumStatus, 'Completed — existing infrastructure');

  const dialogSource = readFileSync(new URL('../src/ui/GamesOfNationsDialog.ts', import.meta.url), 'utf8');
  assert.match(dialogSource, /Grand Stadium: Completed · Hosting requirement: Already satisfied/);
  assert.match(dialogSource, /Grand Stadium: Not built/);
  assert.match(dialogSource, /Estimated completion:/);
});
