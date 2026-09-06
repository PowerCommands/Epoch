import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { WARRIOR } from '../src/data/units.ts';
import {
  ALL_PROJECTS,
  ECONOMIC_DEVELOPMENT,
  calculateProjectGoldPerTurn,
  getProjectById,
} from '../src/data/projects.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { Producible } from '../src/types/producible.ts';
import { getProjectSpritePath } from '../src/utils/assetPaths.ts';

const NATION_ID = 'france';
const CITY_ID = 'paris';
const PROJECT_ITEM: Producible = { kind: 'project', projectType: ECONOMIC_DEVELOPMENT };

function makeHarness() {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION_ID, name: 'France', color: 0x0000ff, isHuman: true }));
  const cities = new CityManager();
  cities.addCity(new City({ id: CITY_ID, name: 'Paris', ownerId: NATION_ID, tileX: 0, tileY: 0 }));
  const turns = new TurnManager(nations, getGameSpeedById('marathon'));
  const happiness = new HappinessSystem(nations, cities);
  const production = new ProductionSystem(cities, turns, happiness, getGameSpeedById('marathon'), undefined, nations);
  // Process the very first turnStart instead of skipping it, so tests advance
  // production deterministically with a single turns.start().
  production.markInitialTurnStartSkipped();

  let goldGained = 0;
  production.setProjectTurnHandler((_cityId, project, availableProduction) => {
    goldGained += calculateProjectGoldPerTurn(project, availableProduction);
  });

  const setProduction = (value: number): void => {
    cities.getResources(CITY_ID).productionPerTurn = value;
  };
  const advanceTurn = (): void => {
    // With a single nation, endCurrentTurn fires one processed turnStart.
    turns.endCurrentTurn();
  };
  // Kick off so the first endCurrentTurn advances cleanly.
  turns.start();

  return { nations, cities, turns, happiness, production, setProduction, advanceTurn, gold: () => goldGained };
}

test('Economic Development is registered as a repeatable city project', () => {
  assert.equal(getProjectById('economic_development'), ECONOMIC_DEVELOPMENT);
  assert.ok(ALL_PROJECTS.includes(ECONOMIC_DEVELOPMENT));
  assert.equal(ECONOMIC_DEVELOPMENT.productionToGoldRatio, 0.5);
});

test('Economic Development has a project sprite mapped for the GUI', () => {
  const spritePath = getProjectSpritePath(ECONOMIC_DEVELOPMENT.id);
  assert.equal(spritePath, 'assets/sprites/projects/economic_development.png');
  assert.equal(existsSync(new URL(`../public/${spritePath}`, import.meta.url)), true);
});

test('selecting Economic Development makes it the active production', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, PROJECT_ITEM);
  const active = h.production.getProduction(CITY_ID);
  assert.equal(active?.item.kind, 'project');
});

test('converts 50% of the city production into gold each turn', () => {
  const h = makeHarness();
  h.setProduction(20);
  h.production.setProduction(CITY_ID, PROJECT_ITEM);

  const perTurn = h.production.getCityProductionPerTurn(CITY_ID);
  assert.equal(h.production.getProjectGoldPerTurn(CITY_ID), Math.floor(perTurn * 0.5));

  const before = h.gold();
  h.advanceTurn();
  assert.equal(h.gold() - before, Math.floor(perTurn * 0.5));
});

test('conversion tracks the city current production when it changes', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, PROJECT_ITEM);

  h.setProduction(20);
  const before = h.gold();
  h.advanceTurn();
  const firstGain = h.gold() - before;
  assert.equal(firstGain, Math.floor(h.production.getCityProductionPerTurn(CITY_ID) * 0.5));

  h.setProduction(40);
  const mid = h.gold();
  h.advanceTurn();
  const secondGain = h.gold() - mid;
  assert.equal(secondGain, Math.floor(h.production.getCityProductionPerTurn(CITY_ID) * 0.5));
  assert.equal(secondGain, firstGain * 2);
});

test('Economic Development creates no permanent unit/building and never completes', () => {
  const h = makeHarness();
  h.setProduction(20);
  let completions = 0;
  h.production.onCompletedSuccessfully(() => { completions += 1; });
  h.production.setProduction(CITY_ID, PROJECT_ITEM);

  for (let i = 0; i < 50; i += 1) h.advanceTurn();

  assert.equal(completions, 0);
  const queue = h.production.getQueue(CITY_ID);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].item.kind, 'project');
});

test('force-completing a project is refused (projects never complete)', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, PROJECT_ITEM);
  assert.equal(h.production.completeCurrentProduction(CITY_ID).kind, 'blocked');
  assert.equal(h.production.getQueue(CITY_ID)[0].item.kind, 'project');
});

test('Economic Development is interrupted through normal production selection', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, PROJECT_ITEM);
  assert.equal(h.production.getProduction(CITY_ID)?.item.kind, 'project');

  h.production.setProduction(CITY_ID, { kind: 'unit', unitType: WARRIOR });
  const active = h.production.getProduction(CITY_ID);
  assert.equal(active?.item.kind, 'unit');
  assert.equal(h.production.getProjectGoldPerTurn(CITY_ID), undefined);
});

test('project queue view shows no completion progress, cost, turns or buy option', () => {
  const h = makeHarness();
  h.setProduction(16);
  h.production.setProduction(CITY_ID, PROJECT_ITEM);

  const view = h.production.getQueue(CITY_ID)[0];
  assert.equal(view.progress, 0);
  assert.equal(view.cost, 0);
  assert.equal(view.turnsRemaining, 0);
  assert.equal(h.production.getBuyCost(CITY_ID, 0), null);
  assert.equal(h.production.getProjectGoldPerTurn(CITY_ID), 8);
});

test('a city running Economic Development survives save/load', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, PROJECT_ITEM);

  const tiles: Tile[][] = [[{ x: 0, y: 0, type: TileType.Plains }]];
  const mapData: MapData = { width: 1, height: 1, tileSize: 1, tiles };
  const gridSystem = new HexGridSystem();

  const saved = SaveLoadService.serialize({
    mapKey: 'ed-test', humanNationId: NATION_ID,
    activeNationIds: [NATION_ID], gameSpeedId: 'marathon',
    mapData, nationManager: h.nations, cityManager: h.cities,
    unitManager: { getAllUnits: () => [] }, productionSystem: h.production,
    policySystem: { getActivePolicyAssignments: () => [] },
    diplomacyManager: {
      getAllStates: () => [],
      getAllVassalRelationships: () => [],
      getPendingPeaceProposals: () => [],
      getPeaceTreatyCooldownTurns: () => 0,
      getMinPeaceNegotiationTurns: () => 0,
    },
    discoverySystem: { getAllMetPairs: () => [] }, turnManager: h.turns,
    gridSystem, wonderSystem: { getCompletedWonders: () => [] },
  } as unknown as SaveLoadContext);

  const savedItem = saved.cities.find((c) => c.id === CITY_ID)?.productionQueue[0]?.item;
  assert.equal(savedItem?.kind, 'project');
  assert.equal(savedItem?.id, 'economic_development');

  // Restore into a fresh production system and confirm the project is active.
  const restoredCities = new CityManager();
  const restoredTurns = new TurnManager(h.nations, getGameSpeedById('marathon'));
  const restoredProduction = new ProductionSystem(
    restoredCities, restoredTurns, new HappinessSystem(h.nations, restoredCities),
    getGameSpeedById('marathon'), undefined, h.nations,
  );
  const applyCitiesAndProduction = (SaveLoadService as unknown as {
    applyCitiesAndProduction: (
      cities: unknown, cityManager: CityManager, productionSystem: ProductionSystem,
      mapData: MapData, gridSystem: HexGridSystem, gameSpeedId: string,
    ) => void;
  }).applyCitiesAndProduction;
  applyCitiesAndProduction(saved.cities, restoredCities, restoredProduction, mapData, gridSystem, 'marathon');

  assert.equal(restoredProduction.getProduction(CITY_ID)?.item.kind, 'project');
});
