import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARMORY,
  BARRACKS,
  COLOSSEUM,
  FACTORY,
  HARBOR,
  MILITARY_ACADEMY,
  MILITARY_BASE,
  PUBLIC_SCHOOL,
  SEAPORT,
  SHRINE,
  STADIUM,
  TEMPLE,
  UNIVERSITY,
  WALLS,
  WORKSHOP,
} from '../src/data/buildings.ts';
import { ARCHAEOLOGIST, WARRIOR, WORKER } from '../src/data/units.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import { PYRAMIDS } from '../src/data/wonders.ts';
import type { BuildingType } from '../src/entities/Building.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { BuildingResourceRequirementSystem } from '../src/systems/BuildingResourceRequirementSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CityDefenseSystem } from '../src/systems/CityDefenseSystem.ts';
import { calculateCityEconomy } from '../src/systems/CityEconomy.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import type { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import {
  completeBuildingUpgrade,
  getBuildingUpgradeBlockReason,
  isBuildingObsoleteInCity,
} from '../src/systems/buildingUpgrades.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedCity } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION_ID = 'upgrade_test_nation';
const CITY_ID = 'upgrade_test_city';
const SINGLE_STEP_UPGRADE_PAIRS: ReadonlyArray<readonly [BuildingType, BuildingType]> = [
  [HARBOR, SEAPORT],
  [COLOSSEUM, STADIUM],
  [UNIVERSITY, PUBLIC_SCHOOL],
  [WORKSHOP, FACTORY],
  [SHRINE, TEMPLE],
];

function makeHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: NATION_ID, name: 'Upgrade Test', color: 0x123456 }));
  const cityManager = new CityManager();
  const city = new City({ id: CITY_ID, name: 'Forgeholm', ownerId: NATION_ID, tileX: 2, tileY: 2 });
  const tiles: Tile[][] = Array.from({ length: 3 }, (_, y) => (
    Array.from({ length: 3 }, (_, x): Tile => ({ x, y, type: TileType.Plains, ownerId: NATION_ID }))
  ));
  const mapData: MapData = { width: 3, height: 3, tileSize: 1, tiles };
  city.ownedTileCoords = tiles.flat().map(({ x, y }) => ({ x, y }));
  cityManager.addCity(city);
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const production = new ProductionSystem(cityManager, turnManager, happiness);
  const placement = new BuildingPlacementSystem();
  production.setItemProductionBlockReasonProvider((cityId, item) => item.kind === 'building'
    ? getBuildingUpgradeBlockReason(cityManager.getBuildings(cityId), item.buildingType)
    : undefined);
  production.onCompleted((cityId, item) => {
    if (item.kind !== 'building') return true;
    const tile = placement.completePhysicalBuilding(city, item.buildingType, mapData);
    if (item.buildingType.placement !== 'city' && !tile) return false;
    completeBuildingUpgrade(cityManager.getBuildings(cityId), item.buildingType);
    return true;
  });
  return { nationManager, cityManager, city, mapData, production, placement };
}

function completeOnReservedTile(h: ReturnType<typeof makeHarness>, building: BuildingType): void {
  const placement = building.upgradesFrom
    ? undefined
    : h.placement.reserveFirstValidPlacement(h.city, building, h.mapData);
  if (!building.upgradesFrom) assert.ok(placement);
  h.production.enqueue(h.city.id, { kind: 'building', buildingType: building }, { placement });
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
}

test('upgrade relationship is declared in building data', () => {
  assert.equal(ARMORY.upgradesFrom, BARRACKS.id);
  assert.equal(MILITARY_ACADEMY.upgradesFrom, ARMORY.id);
  assert.equal(MILITARY_BASE.upgradesFrom, MILITARY_ACADEMY.id);
  assert.equal(BARRACKS.upgradesFrom, undefined);
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    assert.equal(successor.upgradesFrom, predecessor.id);
  }
});

test('military infrastructure defines total military-production bonuses with no placeholder Food', () => {
  assert.deepEqual(BARRACKS.modifiers, { militaryProductionPercent: 10 });
  assert.deepEqual(ARMORY.modifiers, { militaryProductionPercent: 20 });
  assert.deepEqual(MILITARY_ACADEMY.modifiers, { militaryProductionPercent: 30 });
  assert.deepEqual(MILITARY_BASE.modifiers, { militaryProductionPercent: 40, cityDefensePercent: 25 });
  for (const building of [BARRACKS, ARMORY, MILITARY_ACADEMY, MILITARY_BASE]) {
    assert.equal(building.modifiers.foodPerTurn, undefined);
    assert.doesNotMatch(building.description, /omitted|XP|promotion/i);
    assert.match(building.description, new RegExp(`\\+${building.modifiers.militaryProductionPercent}% Military Unit Production`));
  }
  assert.match(MILITARY_BASE.description, /\+25% City Defense/);
});

test('military-production bonuses affect only authoritative military unit categories', () => {
  const expectedBonuses = new Map<BuildingType, number>([
    [BARRACKS, 10],
    [ARMORY, 20],
    [MILITARY_ACADEMY, 30],
    [MILITARY_BASE, 40],
  ]);
  for (const [building, bonus] of expectedBonuses) {
    const h = makeHarness();
    h.cityManager.getResources(CITY_ID).productionPerTurn = 100;
    h.cityManager.getBuildings(CITY_ID).add(building);
    const effectiveProduction = (item: Parameters<ProductionSystem['getTurnsEstimate']>[1]): number => (
      h.production as unknown as {
        getEffectiveProductionPerTurn: (cityId: string, producible: typeof item) => number;
      }
    ).getEffectiveProductionPerTurn(CITY_ID, item);

    assert.equal(effectiveProduction({ kind: 'unit', unitType: WARRIOR }), 100 + bonus);
    assert.equal(effectiveProduction({ kind: 'unit', unitType: WORKER }), 100);
    assert.equal(effectiveProduction({ kind: 'unit', unitType: ARCHAEOLOGIST }), 100);
    assert.equal(effectiveProduction({ kind: 'building', buildingType: BARRACKS }), 100);
    assert.equal(effectiveProduction({ kind: 'wonder', wonderType: PYRAMIDS }), 100);
    assert.equal(effectiveProduction({ kind: 'project', projectType: ECONOMIC_DEVELOPMENT }), 100);
  }
});

test('each single-step upgrade requires its predecessor in the same city and reports it to the UI gate', () => {
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    assert.match(
      getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), successor) ?? '',
      new RegExp(`Requires ${predecessor.name}`),
    );

    const other = new City({ id: `other_${successor.id}`, name: 'Elsewhere', ownerId: NATION_ID, tileX: 0, tileY: 0 });
    h.cityManager.addCity(other);
    h.cityManager.getBuildings(other.id).add(predecessor);
    assert.match(
      getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), successor) ?? '',
      new RegExp(`Requires ${predecessor.name}`),
    );

    h.cityManager.getBuildings(CITY_ID).add(predecessor);
    assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), successor), undefined);
  }
});

test('each single-step upgrade replaces its predecessor and reuses its land or water tile', () => {
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    const predecessorTile = h.mapData.tiles[1][1];
    predecessorTile.type = predecessor.placement === 'water' ? TileType.Coast : TileType.Plains;
    predecessorTile.buildingId = predecessor.id;
    const originalOwnerId = predecessorTile.ownerId;
    h.cityManager.getBuildings(CITY_ID).add(predecessor);

    completeOnReservedTile(h, successor);

    assert.equal(predecessorTile.buildingId, successor.id, `${predecessor.name} → ${successor.name}`);
    assert.equal(predecessorTile.ownerId, originalOwnerId);
    assert.equal(
      h.mapData.tiles.flat().filter((tile) => tile.buildingId === predecessor.id || tile.buildingId === successor.id).length,
      1,
      `${predecessor.name} → ${successor.name} must occupy exactly one tile`,
    );
    assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [successor.id]);
    assert.equal(h.cityManager.getBuildings(CITY_ID).has(predecessor.id), false);
    assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), predecessor) ?? '', /later upgrade/);
    assert.deepEqual(
      h.cityManager.getBuildings(CITY_ID).getAll().map((id) => [predecessor, successor].find((building) => building.id === id)!.modifiers),
      [successor.modifiers],
      `${predecessor.name} modifiers must not remain active`,
    );
  }
});

test('ordinary physical buildings still use reservation and manual placement state', () => {
  const h = makeHarness();

  assert.equal(h.placement.startPlacement(h.city, BARRACKS.id, h.mapData), true);
  assert.equal(h.placement.isActiveForCity(CITY_ID), true);
  h.placement.cancelPlacement();

  const reserved = h.placement.reserveFirstValidPlacement(h.city, BARRACKS, h.mapData);
  assert.ok(reserved);
  assert.equal(
    h.mapData.tiles[reserved.tileY][reserved.tileX].buildingConstruction?.buildingId,
    BARRACKS.id,
  );
});

test('physical upgrades cannot enter manual placement or reserve another tile', () => {
  const h = makeHarness();
  const harborTile = h.mapData.tiles[1][1];
  harborTile.type = TileType.Coast;
  harborTile.buildingId = HARBOR.id;
  h.cityManager.getBuildings(CITY_ID).add(HARBOR);

  assert.equal(h.placement.startPlacement(h.city, SEAPORT.id, h.mapData), false);
  assert.equal(h.placement.isActive(), false);
  assert.equal(h.placement.reserveFirstValidPlacement(h.city, SEAPORT, h.mapData), undefined);
  assert.equal(h.mapData.tiles.flat().some((tile) => tile.buildingConstruction !== undefined), false);
});

test('city-internal buildings remain independent of physical placement', () => {
  const h = makeHarness();

  h.production.enqueue(CITY_ID, { kind: 'building', buildingType: WALLS });
  assert.equal(h.production.completeCurrentProduction(CITY_ID).kind, 'completed');
  assert.equal(h.cityManager.getBuildings(CITY_ID).has(WALLS.id), true);
  assert.equal(h.mapData.tiles.flat().some((tile) => tile.buildingId === WALLS.id), false);
  assert.equal(h.placement.isActive(), false);
});

test('Shrine and Temple have only their total Culture effects and current descriptions', () => {
  assert.deepEqual(SHRINE.modifiers, { culturePerTurn: 2 });
  assert.deepEqual(TEMPLE.modifiers, { culturePerTurn: 5 });
  assert.equal(SHRINE.modifiers.happinessPerTurn, undefined);
  assert.equal(TEMPLE.modifiers.happinessPerTurn, undefined);
  assert.match(SHRINE.description, /\+2 Culture per turn/);
  assert.match(TEMPLE.description, /\+5 Culture per turn/);
  assert.doesNotMatch(`${SHRINE.description} ${TEMPLE.description}`, /Faith omitted|placeholder/i);

  const h = makeHarness();
  const grid = new HexGridSystem();
  const baseline = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(CITY_ID), grid);
  h.cityManager.getBuildings(CITY_ID).add(SHRINE);
  const withShrine = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(CITY_ID), grid);
  assert.equal(withShrine.culture - baseline.culture, 2);
  assert.equal(withShrine.happiness - baseline.happiness, 0);

  completeBuildingUpgrade(h.cityManager.getBuildings(CITY_ID), TEMPLE);
  const withTemple = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(CITY_ID), grid);
  assert.equal(withTemple.culture - baseline.culture, 5);
  assert.equal(withTemple.happiness - baseline.happiness, 0);
});

test('Seaport destination is always the Harbor tile, with terrain mismatch treated as configuration', () => {
  const h = makeHarness();
  const harborTile = h.mapData.tiles[1][1];
  harborTile.buildingId = HARBOR.id;
  h.cityManager.getBuildings(CITY_ID).add(HARBOR);
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city, SEAPORT, h.mapData), [{
    x: harborTile.x,
    y: harborTile.y,
  }]);

  harborTile.type = TileType.Coast;
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city, SEAPORT, h.mapData)[0], {
    x: harborTile.x,
    y: harborTile.y,
  });
});

test('existing technology and Factory resource gates remain independent of upgrade eligibility', () => {
  for (const [, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    const research = new ResearchSystem(h.nationManager, h.cityManager, () => 1);
    const requiredTechnology = research.getRequiredTechnologyForBuilding(successor.id);
    assert.ok(requiredTechnology, `${successor.name} should retain its technology requirement`);
    assert.equal(research.isBuildingUnlocked(NATION_ID, successor.id), false);
    h.nationManager.getNation(NATION_ID)!.researchedTechIds.push(requiredTechnology.id);
    assert.equal(research.isBuildingUnlocked(NATION_ID, successor.id), true);
  }

  const shrineHarness = makeHarness();
  const shrineResearch = new ResearchSystem(shrineHarness.nationManager, shrineHarness.cityManager, () => 1);
  assert.equal(shrineResearch.getRequiredTechnologyForBuilding(SHRINE.id)?.id, 'pottery');
  assert.equal(shrineResearch.getRequiredTechnologyForBuilding(TEMPLE.id)?.id, 'philosophy');

  const militaryBaseHarness = makeHarness();
  const militaryBaseResearch = new ResearchSystem(
    militaryBaseHarness.nationManager,
    militaryBaseHarness.cityManager,
    () => 1,
  );
  assert.equal(militaryBaseResearch.getRequiredTechnologyForBuilding(MILITARY_BASE.id)?.id, 'replaceable_parts');
  assert.equal(militaryBaseResearch.isBuildingUnlocked(NATION_ID, MILITARY_BASE.id), false);
  militaryBaseHarness.nationManager.getNation(NATION_ID)!.researchedTechIds.push('replaceable_parts');
  assert.equal(militaryBaseResearch.isBuildingUnlocked(NATION_ID, MILITARY_BASE.id), true);

  const h = makeHarness();
  h.cityManager.getBuildings(CITY_ID).add(WORKSHOP);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), FACTORY), undefined);
  const resourceRequirements = new BuildingResourceRequirementSystem(
    h.cityManager,
    { hasResource: () => false } as unknown as ResourceAccessSystem,
  );
  assert.equal(resourceRequirements.getRequiredResourceId(FACTORY.id), 'coal');
  assert.match(resourceRequirements.getConstructionBlockReason(CITY_ID, FACTORY.id) ?? '', /Requires Coal/);
});

test('AI-owned cities use the shared gate for all single-step upgrade chains', () => {
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    h.nationManager.getNation(NATION_ID)!.isHuman = false;
    h.production.enqueue(CITY_ID, { kind: 'building', buildingType: successor });
    assert.equal(h.production.getQueue(CITY_ID).length, 0, `${successor.name} without ${predecessor.name}`);

    const tile = h.mapData.tiles[1][1];
    tile.type = predecessor.placement === 'water' ? TileType.Coast : TileType.Plains;
    tile.buildingId = predecessor.id;
    h.cityManager.getBuildings(CITY_ID).add(predecessor);
    const placement = h.placement.reserveFirstValidPlacement(h.city, successor, h.mapData);
    assert.equal(placement, undefined);
    h.production.enqueue(CITY_ID, { kind: 'building', buildingType: successor });
    assert.equal(h.production.getQueue(CITY_ID).length, 1, `${successor.name} with ${predecessor.name}`);
  }
});

test('Armory requires a Barracks in the same city', () => {
  const h = makeHarness();
  assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), ARMORY) ?? '', /Requires Barracks/);
  h.cityManager.getBuildings(CITY_ID).add(BARRACKS);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), ARMORY), undefined);

  const other = new City({ id: 'other_city', name: 'Elsewhere', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  h.cityManager.addCity(other);
  assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(other.id), ARMORY) ?? '', /Requires Barracks/);
});

test('Armory replaces Barracks in city state and on its existing physical tile', () => {
  const h = makeHarness();
  const barracksTile = h.mapData.tiles[1][1];
  barracksTile.buildingId = BARRACKS.id;
  h.cityManager.getBuildings(CITY_ID).add(BARRACKS);

  completeOnReservedTile(h, ARMORY);

  assert.equal(barracksTile.buildingId, ARMORY.id);
  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [ARMORY.id]);
  assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), BARRACKS) ?? '', /later upgrade/);
});

test('Military Academy requires Armory and replaces it without retaining predecessor effects', () => {
  const h = makeHarness();
  const militaryTile = h.mapData.tiles[1][1];
  militaryTile.buildingId = BARRACKS.id;
  h.cityManager.getBuildings(CITY_ID).add(BARRACKS);
  completeOnReservedTile(h, ARMORY);

  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), MILITARY_ACADEMY), undefined);
  completeOnReservedTile(h, MILITARY_ACADEMY);

  const active = h.cityManager.getBuildings(CITY_ID).getAll();
  assert.deepEqual(active, [MILITARY_ACADEMY.id]);
  assert.equal(active.reduce((sum, id) => sum + [BARRACKS, ARMORY, MILITARY_ACADEMY].find((b) => b.id === id)!.maintenance, 0), MILITARY_ACADEMY.maintenance);
  assert.equal(militaryTile.buildingId, MILITARY_ACADEMY.id);
  assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), BARRACKS) ?? '', /later upgrade/);
  assert.match(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), ARMORY) ?? '', /later upgrade/);
});

test('Military Base requires Military Academy and replaces the complete chain on the Academy tile', () => {
  const h = makeHarness();
  const militaryTile = h.mapData.tiles[1][1];
  militaryTile.buildingId = MILITARY_ACADEMY.id;
  h.cityManager.getBuildings(CITY_ID).add(MILITARY_ACADEMY);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), MILITARY_BASE), undefined);

  completeOnReservedTile(h, MILITARY_BASE);

  assert.equal(militaryTile.buildingId, MILITARY_BASE.id);
  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [MILITARY_BASE.id]);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), MILITARY_ACADEMY) !== undefined, true);
  h.cityManager.getResources(CITY_ID).productionPerTurn = 100;
  const effectiveMilitaryProduction = (
    h.production as unknown as {
      getEffectiveProductionPerTurn: (
        cityId: string,
        item: Parameters<ProductionSystem['getTurnsEstimate']>[1],
      ) => number;
    }
  ).getEffectiveProductionPerTurn(CITY_ID, { kind: 'unit', unitType: WARRIOR });
  assert.equal(effectiveMilitaryProduction, 140);
});

test('Military Base defense stacks through CityDefenseSystem without changing fortification levels', () => {
  const h = makeHarness();
  h.cityManager.getBuildings(CITY_ID).add(WALLS);
  h.cityManager.getBuildings(CITY_ID).add(MILITARY_BASE);
  const defense = new CityDefenseSystem(undefined, h.cityManager);

  assert.equal(defense.getFortificationDefensePercent(h.city), 50);
  assert.equal(defense.getDefenseMultiplier(h.city), 1.5);
  assert.equal(defense.getFortificationLevel(h.city), 1);
});

test('AI can progress through Barracks, Armory, Military Academy and Military Base', () => {
  const h = makeHarness();
  h.nationManager.getNation(NATION_ID)!.isHuman = false;
  const militaryTile = h.mapData.tiles[1][1];
  militaryTile.buildingId = BARRACKS.id;
  h.cityManager.getBuildings(CITY_ID).add(BARRACKS);

  for (const successor of [ARMORY, MILITARY_ACADEMY, MILITARY_BASE]) {
    completeOnReservedTile(h, successor);
  }

  assert.equal(militaryTile.buildingId, MILITARY_BASE.id);
  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [MILITARY_BASE.id]);
});

test('production rejects unavailable upgrades and a rebuilt predecessor', () => {
  const h = makeHarness();
  h.production.enqueue(CITY_ID, { kind: 'building', buildingType: ARMORY });
  h.production.enqueue(CITY_ID, { kind: 'building', buildingType: MILITARY_ACADEMY });
  h.production.enqueue(CITY_ID, { kind: 'building', buildingType: MILITARY_BASE });
  assert.equal(h.production.getQueue(CITY_ID).length, 0);

  h.cityManager.getBuildings(CITY_ID).add(ARMORY);
  h.production.enqueue(CITY_ID, { kind: 'building', buildingType: BARRACKS });
  assert.equal(h.production.getQueue(CITY_ID).length, 0);
});

test('completed upgrades mark every predecessor as obsolete for human building lists', () => {
  const h = makeHarness();
  const buildings = h.cityManager.getBuildings(CITY_ID);
  buildings.add(MILITARY_ACADEMY);

  assert.equal(isBuildingObsoleteInCity(buildings, BARRACKS), true);
  assert.equal(isBuildingObsoleteInCity(buildings, ARMORY), true);
  assert.equal(isBuildingObsoleteInCity(buildings, MILITARY_ACADEMY), false);
  assert.equal(isBuildingObsoleteInCity(buildings, MILITARY_BASE), false);
  assert.equal(isBuildingObsoleteInCity(buildings, HARBOR), false);
});

function savedCity(buildings: SavedCity['buildings']): SavedCity {
  return {
    id: CITY_ID,
    name: 'Forgeholm',
    ownerId: NATION_ID,
    tileX: 2,
    tileY: 2,
    isCapital: true,
    originNationId: NATION_ID,
    isOriginalCapital: true,
    isResidenceCapital: true,
    health: 100,
    population: 1,
    foodStorage: 0,
    culture: 0,
    ownedTileCoords: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
    workedTileCoords: [],
    lastTurnAttacked: null,
    buildings,
    productionQueue: [],
  };
}

function applySavedCity(h: ReturnType<typeof makeHarness>, saved: SavedCity): void {
  const apply = (SaveLoadService as unknown as {
    applyCitiesAndProduction: (
      cities: SavedCity[], cityManager: CityManager, productionSystem: ProductionSystem,
      mapData: MapData, gridSystem: HexGridSystem, gameSpeedId: 'standard',
    ) => void;
  }).applyCitiesAndProduction;
  apply([saved], h.cityManager, h.production, h.mapData, new HexGridSystem(), 'standard');
}

test('legacy saves with multiple chain members normalize to the highest upgrade and remove old tiles', () => {
  const h = makeHarness();
  h.mapData.tiles[0][0].buildingId = BARRACKS.id;
  h.mapData.tiles[0][1].buildingId = ARMORY.id;
  h.mapData.tiles[0][2].buildingId = MILITARY_ACADEMY.id;
  applySavedCity(h, savedCity([BARRACKS.id, ARMORY.id, MILITARY_ACADEMY.id]));

  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [MILITARY_ACADEMY.id]);
  assert.equal(h.mapData.tiles[0][0].buildingId, undefined);
  assert.equal(h.mapData.tiles[0][1].buildingId, undefined);
  assert.equal(h.mapData.tiles[0][2].buildingId, MILITARY_ACADEMY.id);
});

test('legacy military-chain saves normalize through Military Base and preserve it on load', () => {
  const h = makeHarness();
  h.mapData.tiles[0][0].buildingId = BARRACKS.id;
  h.mapData.tiles[0][1].buildingId = ARMORY.id;
  h.mapData.tiles[0][2].buildingId = MILITARY_BASE.id;
  applySavedCity(h, savedCity([BARRACKS.id, ARMORY.id, MILITARY_ACADEMY.id, MILITARY_BASE.id]));

  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [MILITARY_BASE.id]);
  assert.equal(h.mapData.tiles[0][0].buildingId, undefined);
  assert.equal(h.mapData.tiles[0][1].buildingId, undefined);
  assert.equal(h.mapData.tiles[0][2].buildingId, MILITARY_BASE.id);
});

test('legacy Barracks plus Armory saves normalize to Armory', () => {
  const h = makeHarness();
  h.mapData.tiles[0][0].buildingId = BARRACKS.id;
  h.mapData.tiles[0][1].buildingId = ARMORY.id;
  applySavedCity(h, savedCity([BARRACKS.id, ARMORY.id]));

  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [ARMORY.id]);
  assert.equal(h.mapData.tiles[0][0].buildingId, undefined);
  assert.equal(h.mapData.tiles[0][1].buildingId, ARMORY.id);
});

test('legacy saves for each single-step chain normalize to the successor', () => {
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    h.mapData.tiles[0][0].buildingId = predecessor.id;
    h.mapData.tiles[0][1].buildingId = successor.id;
    applySavedCity(h, savedCity([predecessor.id, successor.id]));

    assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [successor.id]);
    assert.equal(h.mapData.tiles[0][0].buildingId, undefined);
    assert.equal(h.mapData.tiles[0][1].buildingId, successor.id);
  }
});

test('save/load preserves each single-step chain at its upgraded state', () => {
  for (const [predecessor, successor] of SINGLE_STEP_UPGRADE_PAIRS) {
    const h = makeHarness();
    h.mapData.tiles[0][1].buildingId = successor.id;
    applySavedCity(h, savedCity([successor.id]));

    assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [successor.id]);
    assert.equal(h.mapData.tiles[0][1].buildingId, successor.id);
    assert.notEqual(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), predecessor), undefined);
  }
});

test('save/load preserves an upgrade completed on its inherited tile', () => {
  const source = makeHarness();
  const harborTile = source.mapData.tiles[0][1];
  harborTile.type = TileType.Coast;
  harborTile.buildingId = HARBOR.id;
  source.cityManager.getBuildings(CITY_ID).add(HARBOR);
  completeOnReservedTile(source, SEAPORT);

  const serializedTiles = SaveLoadService.serializeTiles(source.mapData);
  const restored = makeHarness();
  SaveLoadService.restoreTiles(serializedTiles, restored.mapData);
  applySavedCity(restored, savedCity([SEAPORT.id]));

  assert.equal(restored.mapData.tiles[0][1].buildingId, SEAPORT.id);
  assert.deepEqual(restored.cityManager.getBuildings(CITY_ID).getAll(), [SEAPORT.id]);
  assert.equal(restored.mapData.tiles.flat().some((tile) => tile.buildingId === HARBOR.id), false);
});

test('save/load representation preserves a final Military Academy-only state', () => {
  const h = makeHarness();
  h.mapData.tiles[0][2].buildingId = MILITARY_ACADEMY.id;
  applySavedCity(h, savedCity([MILITARY_ACADEMY.id]));

  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAllEntries(), [
    { buildingId: MILITARY_ACADEMY.id, broken: false },
  ]);
  assert.equal(h.mapData.tiles[0][2].buildingId, MILITARY_ACADEMY.id);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), BARRACKS) !== undefined, true);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), ARMORY) !== undefined, true);
});

test('save/load representation preserves a final Armory-only state', () => {
  const h = makeHarness();
  h.mapData.tiles[0][1].buildingId = ARMORY.id;
  applySavedCity(h, savedCity([ARMORY.id]));

  assert.deepEqual(h.cityManager.getBuildings(CITY_ID).getAll(), [ARMORY.id]);
  assert.equal(h.mapData.tiles[0][1].buildingId, ARMORY.id);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), BARRACKS) !== undefined, true);
  assert.equal(getBuildingUpgradeBlockReason(h.cityManager.getBuildings(CITY_ID), MILITARY_ACADEMY), undefined);
});
