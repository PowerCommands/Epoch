import assert from 'node:assert/strict';
import test from 'node:test';

import { ALL_BUILDINGS, MONUMENT, SEWERS, getBuildingById } from '../src/data/buildings.ts';
import type { BuildingType } from '../src/entities/Building.ts';
import { getRequiredCultureNodeForBuilding } from '../src/data/cultureTree.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { CultureSystem } from '../src/systems/culture/CultureSystem.ts';

const NATION_ID = 'monument_test_nation';

function makeResearch(nationManager: NationManager, cityManager: CityManager) {
  const culture = new CultureSystem(nationManager, () => 1);
  const research = new ResearchSystem(nationManager, cityManager, () => 1);
  // Mirror the production-time wiring done in GameScene so this exercises the
  // exact shared availability path used by both the human UI and the AI.
  research.setCultureBuildingUnlockResolver((nationId, buildingId) =>
    culture.isBuildingCultureUnlocked(nationId, buildingId));
  return research;
}

/**
 * Replicates the human production-queue availability filter from
 * RightSidebarPanelDataProvider so the test tracks the same rules the UI uses,
 * without standing up Phaser.
 */
function availableBuildingIdsForHuman(
  research: ResearchSystem,
  cityManager: CityManager,
  city: City,
): string[] {
  return ALL_BUILDINGS
    .filter((buildingType: BuildingType) => !cityManager.getBuildings(city.id).has(buildingType.id))
    .filter((buildingType: BuildingType) => research.isBuildingUnlocked(city.ownerId, buildingType.id))
    .map((buildingType) => buildingType.id);
}

test('Monument exists in the building registry with its canonical start-available values', () => {
  assert.equal(getBuildingById('monument'), MONUMENT);
  assert.equal(ALL_BUILDINGS.filter((building) => building.id === 'monument').length, 1);
  assert.deepEqual({
    id: MONUMENT.id,
    era: MONUMENT.era,
    productionCost: MONUMENT.productionCost,
    maintenance: MONUMENT.maintenance,
    modifiers: MONUMENT.modifiers,
  }, {
    id: 'monument',
    era: 'ancient',
    productionCost: 40,
    maintenance: 1,
    modifiers: { culturePerTurn: 2, happinessPerTurn: 1 },
  });
});

test('Monument has neither a technology nor a Culture Tree requirement', () => {
  const nationManager = new NationManager();
  const cityManager = new CityManager();
  const research = makeResearch(nationManager, cityManager);
  assert.equal(research.getRequiredTechnologyForBuilding('monument'), undefined);
  assert.equal(getRequiredCultureNodeForBuilding('monument'), undefined);
});

test('Monument is available to a fresh Human and AI city with no research or culture', () => {
  for (const isHuman of [true, false]) {
    const nationManager = new NationManager();
    const nation = new Nation({ id: `${NATION_ID}_${isHuman}`, name: 'Test', color: 0, isHuman });
    nationManager.addNation(nation);
    const cityManager = new CityManager();
    const research = makeResearch(nationManager, cityManager);
    assert.equal(nation.researchedTechIds.length, 0);
    assert.equal(nation.unlockedCultureNodeIds.length, 0);
    assert.equal(research.isBuildingUnlocked(nation.id, 'monument'), true);
  }
});

test('Monument appears in the human production choices and disappears once built (no duplicate)', () => {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Test', color: 0, isHuman: true });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const city = new City({ id: 'monument_city', name: 'Capital', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  cityManager.addCity(city);
  const research = makeResearch(nationManager, cityManager);

  assert.ok(availableBuildingIdsForHuman(research, cityManager, city).includes('monument'));

  // Build it, then confirm it is no longer offered (cannot build a duplicate).
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const production = new ProductionSystem(cityManager, turnManager, happiness);
  production.onCompleted((cityId, item) => {
    if (item.kind === 'building') cityManager.getBuildings(cityId).add(item.buildingType);
  });
  production.enqueue(city.id, { kind: 'building', buildingType: MONUMENT });
  assert.equal(production.completeCurrentProduction(city.id).kind, 'completed');
  assert.equal(cityManager.getBuildings(city.id).hasActive('monument'), true);

  assert.ok(!availableBuildingIdsForHuman(research, cityManager, city).includes('monument'));
});

test('technology-unlocked buildings stay locked until their technology is researched', () => {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Test', color: 0 });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const research = makeResearch(nationManager, cityManager);

  const libraryTech = research.getRequiredTechnologyForBuilding('library');
  assert.ok(libraryTech, 'Library should be gated by a technology');
  assert.equal(research.isBuildingUnlocked(nation.id, 'library'), false);
  nation.researchedTechIds.push(libraryTech!.id);
  assert.equal(research.isBuildingUnlocked(nation.id, 'library'), true);
});

test('Sewers (the only other technology-less building) remains culture-gated by State Workforce', () => {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Test', color: 0 });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const research = makeResearch(nationManager, cityManager);

  assert.equal(getRequiredCultureNodeForBuilding(SEWERS.id)?.id, 'state_workforce');
  assert.equal(research.isBuildingUnlocked(nation.id, SEWERS.id), false);
  nation.unlockedCultureNodeIds.push('state_workforce');
  assert.equal(research.isBuildingUnlocked(nation.id, SEWERS.id), true);
});

test('Monument availability is invariant across research/culture state, so save/load cannot change it', () => {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Test', color: 0 });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const research = makeResearch(nationManager, cityManager);

  // Monument availability is derived from static data (no tech, no culture node),
  // never persisted, so no combination of loaded state should gate it.
  assert.equal(research.isBuildingUnlocked(nation.id, 'monument'), true);
  nation.unlockedCultureNodeIds.push('state_workforce');
  nation.researchedTechIds.push('pottery');
  assert.equal(research.isBuildingUnlocked(nation.id, 'monument'), true);
});
