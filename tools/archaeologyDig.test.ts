import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { ARCHAEOLOGICAL_DIG, FARM, UNDERWATER_ARCHAEOLOGICAL_SITE } from '../src/data/improvements.ts';
import { ARCHAEOLOGIST, TRANSPORT_SHIP, WORKER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import {
  BuilderSystem,
  canUnitConstructImprovement,
} from '../src/systems/BuilderSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const OWNER_ID = 'nation_archaeology_test';
const LAND_RESOURCE_IDS = [
  'ancient_pottery',
  'ancient_coins',
  'ancient_weapons',
  'royal_relics',
  'ancient_treasure',
] as const;

function createHarness(resourceId: string | undefined, options: { known?: boolean; worker?: boolean } = {}) {
  const mapData: MapData = {
    width: 3,
    height: 2,
    tileSize: 48,
    tiles: Array.from({ length: 2 }, (_, y) => (
      Array.from({ length: 3 }, (_, x): Tile => ({ x, y, type: TileType.Plains }))
    )),
  };
  const tile = mapData.tiles[0][1];
  tile.ownerId = OWNER_ID;
  tile.resourceId = resourceId;
  if (resourceId === 'shipwreck') tile.type = TileType.Coast;

  const nation = new Nation({
    id: OWNER_ID,
    name: 'Excavators',
    color: 0x876543,
    researchedTechIds: ['archaeology'],
  });
  const nations = new NationManager();
  nations.addNation(nation);
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'Test City', ownerId: OWNER_ID, tileX: 0, tileY: 0 });
  city.ownedTileCoords = [{ x: 0, y: 0 }, { x: tile.x, y: tile.y }];
  cities.addCity(city);
  const units = new UnitManager(mapData.width, mapData.height);
  const unitType = options.worker ? WORKER : ARCHAEOLOGIST;
  const unit = new Unit({
    id: options.worker ? 'worker' : 'archaeologist',
    name: unitType.name,
    ownerId: OWNER_ID,
    tileX: tile.x,
    tileY: tile.y,
    unitType,
  });
  units.addUnit(unit);
  const research = new ResearchSystem(nations, cities, () => turns.getCurrentRound());
  const builder = new BuilderSystem(
    units,
    cities,
    turns,
    mapData,
    new HexGridSystem(),
    research,
    undefined,
    undefined,
    () => options.known ?? true,
  );
  const construction = new ImprovementConstructionSystem(mapData, units, cities);
  return { mapData, tile, nation, nations, turns, cities, units, unit, research, builder, construction };
}

test('Archaeology unlocks a Renaissance civilian Archaeologist', () => {
  const h = createHarness('ancient_pottery');
  h.nation.researchedTechIds.length = 0;
  assert.equal(h.research.isUnitUnlocked(OWNER_ID, ARCHAEOLOGIST.id), false);
  h.nation.researchedTechIds.push('archaeology');
  assert.equal(h.research.isUnitUnlocked(OWNER_ID, ARCHAEOLOGIST.id), true);
  assert.equal(h.research.isImprovementUnlocked(OWNER_ID, ARCHAEOLOGICAL_DIG.id), true);
  assert.equal(ARCHAEOLOGIST.era, 'renaissance');
  assert.equal(ARCHAEOLOGIST.category, 'civilian');
  assert.equal(ARCHAEOLOGIST.baseStrength, 0);
  assert.equal(ARCHAEOLOGIST.canBuildImprovements, undefined);
  assert.equal(ARCHAEOLOGIST.maxImprovementCharges, undefined);
});

test('builder capabilities permit only Archaeologist Dig and preserve Worker builds', () => {
  assert.equal(canUnitConstructImprovement(ARCHAEOLOGIST, ARCHAEOLOGICAL_DIG), true);
  assert.equal(canUnitConstructImprovement(ARCHAEOLOGIST, FARM), false);
  assert.equal(canUnitConstructImprovement(WORKER, ARCHAEOLOGICAL_DIG), false);
  assert.equal(canUnitConstructImprovement(WORKER, FARM), true);

  for (const resourceId of LAND_RESOURCE_IDS) {
    const h = createHarness(resourceId);
    const preview = h.builder.getCurrentTileBuildPreview(h.unit);
    assert.equal(preview.canBuild, true, resourceId);
    assert.equal(preview.improvementId, ARCHAEOLOGICAL_DIG.id, resourceId);
  }

  const emptyTile = createHarness(undefined);
  assert.equal(emptyTile.builder.getCurrentTileBuildPreview(emptyTile.unit).canBuild, false);
  for (const resourceId of ['wheat', 'iron', 'shipwreck']) {
    const h = createHarness(resourceId);
    assert.equal(h.builder.getCurrentTileBuildPreview(h.unit).canBuild, false, resourceId);
  }
  const workerAtSite = createHarness('ancient_pottery', { worker: true });
  assert.equal(workerAtSite.builder.getCurrentTileBuildPreview(workerAtSite.unit).canBuild, false);
  const hiddenSite = createHarness('ancient_pottery', { known: false });
  assert.equal(hiddenSite.builder.getCurrentTileBuildPreview(hiddenSite.unit).canBuild, false);
});

test('Dig uses normal three-turn construction, retains resource, and keeps Archaeologist', () => {
  const h = createHarness('ancient_treasure');
  const result = h.builder.build(h.unit, h.tile);
  assert.ok(result);
  assert.equal(result.requiredTurns, 3);
  assert.equal(h.tile.improvementConstruction?.improvementId, ARCHAEOLOGICAL_DIG.id);

  h.construction.handleTurnStart({ round: 1, nation: h.nation });
  assert.equal(h.tile.improvementConstruction?.remainingTurns, 2);
  h.construction.handleTurnStart({ round: 2, nation: h.nation });
  assert.equal(h.tile.improvementConstruction?.remainingTurns, 1);
  h.construction.handleTurnStart({ round: 3, nation: h.nation });

  assert.equal(h.tile.improvementConstruction, undefined);
  assert.equal(h.tile.improvementId, ARCHAEOLOGICAL_DIG.id);
  assert.equal(h.tile.resourceId, 'ancient_treasure');
  assert.equal(h.units.getUnit(h.unit.id), h.unit);
  assert.equal(h.unit.buildAction, undefined);
  assert.equal(h.unit.improvementCharges, undefined);

  const resources = new ResourceAccessSystem(h.mapData, { getAllDeals: () => [] });
  assert.ok(resources.getOwnedResourceSourceCount(OWNER_ID, 'ancient_treasure') > 0);

  const nextSite = h.mapData.tiles[0][2];
  Object.assign(nextSite, { ownerId: OWNER_ID, resourceId: 'ancient_pottery' });
  h.cities.getCity('city')!.ownedTileCoords.push({ x: nextSite.x, y: nextSite.y });
  h.unit.resetMovement();
  assert.equal(h.units.moveUnit(h.unit.id, nextSite.x, nextSite.y), true);
  assert.ok(h.builder.build(h.unit, nextSite), 'surviving Archaeologist can begin another Dig');
});

test('Dig construction and completion use existing tile save/load state', () => {
  const source = createHarness('ancient_coins');
  assert.ok(source.builder.build(source.unit, source.tile));
  source.construction.handleTurnStart({ round: 1, nation: source.nation });
  const inProgressSave = SaveLoadService.serializeTiles(source.mapData);

  const restored = createHarness(undefined);
  SaveLoadService.restoreTiles(inProgressSave, restored.mapData);
  restored.construction.syncUnitsFromTiles();
  restored.builder.rebuildConstructionIndex();
  assert.equal(restored.tile.resourceId, 'ancient_coins');
  assert.equal(restored.tile.improvementConstruction?.remainingTurns, 2);
  assert.equal(restored.unit.buildAction?.improvementId, ARCHAEOLOGICAL_DIG.id);

  restored.construction.handleTurnStart({ round: 2, nation: restored.nation });
  restored.construction.handleTurnStart({ round: 3, nation: restored.nation });
  const completedSave = SaveLoadService.serializeTiles(restored.mapData);
  const completed = createHarness(undefined);
  SaveLoadService.restoreTiles(completedSave, completed.mapData);
  assert.equal(completed.tile.resourceId, 'ancient_coins');
  assert.equal(completed.tile.improvementId, ARCHAEOLOGICAL_DIG.id);
});

function createShipwreckHarness(options: { tileOwned?: boolean; tileInCity?: boolean } = {}) {
  const mapData: MapData = {
    width: 3,
    height: 2,
    tileSize: 48,
    tiles: Array.from({ length: 2 }, (_, y) => (
      Array.from({ length: 3 }, (_, x): Tile => ({ x, y, type: TileType.Coast }))
    )),
  };
  const wreck = mapData.tiles[0][1];
  wreck.resourceId = 'shipwreck';
  wreck.type = TileType.Coast;
  if (options.tileOwned) wreck.ownerId = OWNER_ID;

  const nation = new Nation({ id: OWNER_ID, name: 'Excavators', color: 0x876543, researchedTechIds: ['archaeology'] });
  const nations = new NationManager();
  nations.addNation(nation);
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'Port', ownerId: OWNER_ID, tileX: 0, tileY: 1 });
  city.ownedTileCoords = options.tileInCity
    ? [{ x: 0, y: 1 }, { x: wreck.x, y: wreck.y }]
    : [{ x: 0, y: 1 }];
  cities.addCity(city);
  const units = new UnitManager(mapData.width, mapData.height);
  const transport = new Unit({
    id: 'transport', name: TRANSPORT_SHIP.name, ownerId: OWNER_ID, tileX: wreck.x, tileY: wreck.y, unitType: TRANSPORT_SHIP,
  });
  const archaeologist = new Unit({
    id: 'archaeologist', name: ARCHAEOLOGIST.name, ownerId: OWNER_ID, tileX: wreck.x, tileY: wreck.y, unitType: ARCHAEOLOGIST,
  });
  units.addUnit(transport);
  units.addUnit(archaeologist);
  units.boardUnit(archaeologist.id, transport.id, 0);
  const research = new ResearchSystem(nations, cities, () => turns.getCurrentRound());
  const builder = new BuilderSystem(
    units, cities, turns, mapData, new HexGridSystem(), research, undefined, undefined, () => true,
  );
  return { mapData, wreck, builder, transport, archaeologist, units };
}

test('Shipwreck Dig starts with an Archaeologist aboard a Transport Ship over the wreck', () => {
  const h = createShipwreckHarness();
  // The preview is offered from either the selected carrier or its cargo.
  const transportPreview = h.builder.getCurrentTileBuildPreview(h.transport);
  const cargoPreview = h.builder.getCurrentTileBuildPreview(h.archaeologist);
  assert.equal(transportPreview.canBuild, true);
  assert.equal(transportPreview.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
  assert.equal(transportPreview.builderUnitId, h.archaeologist.id);
  assert.equal(transportPreview.transportUnitId, h.transport.id);
  assert.equal(cargoPreview.canBuild, true);

  const result = h.builder.build(h.transport, h.wreck);
  assert.ok(result);
  assert.equal(result.requiredTurns, UNDERWATER_ARCHAEOLOGICAL_SITE.buildTurns);
  assert.equal(h.wreck.improvementConstruction?.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
  assert.equal(h.wreck.improvementConstruction?.unitId, h.archaeologist.id);
  assert.equal(h.wreck.improvementConstruction?.transportUnitId, h.transport.id);
  // Both the Archaeologist and the Transport go inactive while excavating.
  assert.equal(h.archaeologist.actionStatus, 'building');
  assert.equal(h.transport.movementPoints, 0);
});

test('Shipwreck Dig preview never promises more than build delivers, regardless of tile ownership', () => {
  // Regression: an owned wreck tile that belongs to no city\'s owned-tile list
  // used to pass the naval preview yet be refused by build() (Dig did nothing).
  for (const options of [
    { tileOwned: false, tileInCity: false },
    { tileOwned: true, tileInCity: true },
    { tileOwned: true, tileInCity: false },
  ]) {
    const h = createShipwreckHarness(options);
    const preview = h.builder.getCurrentTileBuildPreview(h.transport);
    const result = h.builder.build(h.transport, h.wreck);
    assert.equal(preview.canBuild, result !== null, JSON.stringify(options));
    assert.ok(result, `build should start for ${JSON.stringify(options)}`);
  }
});

test('Dig action and graphical assets use existing UI/asset infrastructure', () => {
  const h = createHarness('ancient_pottery');
  const toolbox = new UnitActionToolbox(OWNER_ID);
  toolbox.setBuildAvailabilityProvider(h.builder);
  toolbox.setSelectedUnit(h.unit);
  const actions = toolbox.getHudActions();
  assert.equal(actions.some((action) => action.mode === 'dig' && action.label === 'Dig' && action.isAvailable), true);
  assert.equal(actions.some((action) => action.mode === 'build'), false);
  assert.equal(actions.some((action) => action.mode === 'repair'), false);

  assert.equal(existsSync('public/assets/sprites/actions/dig.png'), true);
  assert.equal(existsSync('public/assets/sprites/improvements/archaeological_dig.png'), true);
  assert.match(readFileSync('src/ui/hud/UnitActionHudToolbox.ts', 'utf8'), /dig: 'action_dig'/);
});
