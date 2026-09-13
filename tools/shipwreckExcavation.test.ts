import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { MUSEUM } from '../src/data/buildings.ts';
import { UNDERWATER_ARCHAEOLOGICAL_SITE } from '../src/data/improvements.ts';
import { getNaturalResourceById } from '../src/data/naturalResources.ts';
import { ALL_UNIT_TYPES, canCarryUnitType, ARCHAEOLOGIST, CARGO_SHIP, TRANSPORT_SHIP, WORK_BOAT } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { ArchaeologicalCultureSystem } from '../src/systems/ArchaeologicalCultureSystem.ts';
import { BuilderSystem, canUnitConstructImprovement } from '../src/systems/BuilderSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitBoardingManager } from '../src/systems/UnitBoardingManager.ts';
import { canEmbark, isEmbarked } from '../src/systems/UnitMovementRules.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const OWNER = 'nation_shipwreck_test';

function createHarness(options: {
  known?: boolean;
  researched?: boolean;
  carrierType?: typeof TRANSPORT_SHIP | typeof CARGO_SHIP;
  archaeologistCount?: number;
  resourceId?: string;
} = {}) {
  const mapData: MapData = {
    width: 3,
    height: 2,
    tileSize: 48,
    tiles: Array.from({ length: 2 }, (_, y) => Array.from({ length: 3 }, (_, x): Tile => ({
      x,
      y,
      type: y === 0 ? TileType.Coast : TileType.Plains,
    }))),
  };
  const tile = mapData.tiles[0][1];
  tile.ownerId = OWNER;
  tile.resourceId = options.resourceId ?? 'shipwreck';

  const nation = new Nation({
    id: OWNER,
    name: 'Maritime Archaeologists',
    color: 0x167d8d,
    researchedTechIds: options.researched === false ? [] : ['archaeology'],
  });
  const nations = new NationManager();
  nations.addNation(nation);
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'port', name: 'Port', ownerId: OWNER, tileX: 0, tileY: 1 });
  city.ownedTileCoords = [{ x: 0, y: 1 }, { x: tile.x, y: tile.y }];
  cities.addCity(city);

  const units = new UnitManager(mapData.width, mapData.height);
  const carrierType = options.carrierType ?? TRANSPORT_SHIP;
  const transport = new Unit({
    id: 'transport', name: carrierType.name, ownerId: OWNER,
    tileX: tile.x, tileY: tile.y, unitType: carrierType,
  });
  units.addUnit(transport);
  const archaeologists: Unit[] = [];
  for (let index = 0; index < (options.archaeologistCount ?? 0); index += 1) {
    const archaeologist = new Unit({
      id: `archaeologist-${String(index).padStart(2, '0')}`,
      name: ARCHAEOLOGIST.name,
      ownerId: OWNER,
      tileX: 0,
      tileY: 1,
      unitType: ARCHAEOLOGIST,
    });
    units.addUnit(archaeologist);
    assert.equal(units.boardUnit(archaeologist.id, transport.id, 0), true);
    archaeologists.push(archaeologist);
  }

  const research = new ResearchSystem(nations, cities, () => turns.getCurrentRound());
  const builder = new BuilderSystem(
    units, cities, turns, mapData, new HexGridSystem(), research,
    undefined, undefined, () => options.known ?? true,
  );
  const construction = new ImprovementConstructionSystem(mapData, units, cities);
  return { mapData, tile, nation, nations, turns, cities, city, units, transport, archaeologists, builder, construction };
}

test('Shipwreck is water-only and requires its dedicated four-turn improvement', () => {
  const shipwreck = getNaturalResourceById('shipwreck');
  assert.ok(shipwreck);
  assert.deepEqual(shipwreck.allowedTileTypes, [TileType.Coast, TileType.Ocean]);
  assert.equal(shipwreck.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
  assert.equal(shipwreck.archaeologicalCultureValue, 25);
  assert.equal(UNDERWATER_ARCHAEOLOGICAL_SITE.buildTurns, 4);
  assert.deepEqual(UNDERWATER_ARCHAEOLOGICAL_SITE.allowedTileTypes, [TileType.Coast, TileType.Ocean]);
  assert.equal(canUnitConstructImprovement(WORK_BOAT, UNDERWATER_ARCHAEOLOGICAL_SITE), false);
  assert.equal(TRANSPORT_SHIP.cargoCapacity, 3, 'archaeology does not change normal cargo capacity');
});

test('only a compatible naval transport carrying an Archaeologist can start Shipwreck Dig', () => {
  const noCargo = createHarness();
  assert.equal(noCargo.builder.getCurrentTileBuildPreview(noCargo.transport).canBuild, false);

  const cargoShip = createHarness({ carrierType: CARGO_SHIP, archaeologistCount: 1 });
  assert.equal(cargoShip.builder.getCurrentTileBuildPreview(cargoShip.transport).canBuild, true);

  const embarked = createHarness();
  const independentArchaeologist = new Unit({
    id: 'generic-embarked', name: ARCHAEOLOGIST.name, ownerId: OWNER,
    tileX: embarked.tile.x, tileY: embarked.tile.y, unitType: ARCHAEOLOGIST,
  });
  embarked.units.addUnit(independentArchaeologist);
  assert.equal(embarked.builder.getCurrentTileBuildPreview(independentArchaeologist).canBuild, false);

  const expedition = createHarness({ archaeologistCount: 2 });
  const preview = expedition.builder.getCurrentTileBuildPreview(expedition.transport);
  assert.equal(preview.canBuild, true);
  assert.equal(preview.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
  assert.equal(preview.builderUnitId, 'archaeologist-00', 'one deterministic cargo excavator is selected');
  assert.equal(preview.transportUnitId, expedition.transport.id);

  const result = expedition.builder.build(expedition.transport, expedition.tile);
  assert.ok(result);
  assert.equal(result.unit.id, 'archaeologist-00');
  assert.equal(expedition.tile.improvementConstruction?.transportUnitId, expedition.transport.id);
  assert.equal(expedition.tile.improvementConstruction?.unitId, 'archaeologist-00');
  assert.equal(expedition.construction.isUnitBusy(expedition.transport.id), true);
  assert.equal(expedition.construction.isUnitBusy('archaeologist-00'), true);
});

test('Shipwreck validation covers location, knowledge, technology, and completed sites', () => {
  const hidden = createHarness({ archaeologistCount: 1, known: false });
  assert.equal(hidden.builder.getCurrentTileBuildPreview(hidden.transport).canBuild, false);
  const noTech = createHarness({ archaeologistCount: 1, researched: false });
  assert.equal(noTech.builder.getCurrentTileBuildPreview(noTech.transport).canBuild, false);
  const away = createHarness({ archaeologistCount: 1, resourceId: 'fish' });
  assert.equal(away.builder.getCurrentTileBuildPreview(away.transport).canBuild, false);
  const complete = createHarness({ archaeologistCount: 1 });
  complete.tile.improvementId = UNDERWATER_ARCHAEOLOGICAL_SITE.id;
  assert.equal(complete.builder.getCurrentTileBuildPreview(complete.transport).canBuild, false);
});

test('cargo excavation completes normally without consuming either unit', () => {
  const h = createHarness({ archaeologistCount: 1 });
  const archaeologist = h.archaeologists[0];
  assert.ok(h.builder.build(h.transport, h.tile));
  for (let round = 1; round <= 4; round += 1) {
    h.construction.handleTurnStart({ round, nation: h.nation });
  }
  assert.equal(h.tile.improvementConstruction, undefined);
  assert.equal(h.tile.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
  assert.equal(h.tile.resourceId, 'shipwreck');
  assert.equal(h.units.getUnit(archaeologist.id), archaeologist);
  assert.equal(h.units.getUnit(h.transport.id), h.transport);
  assert.equal(archaeologist.carriedByUnitId, h.transport.id);
  assert.equal(h.transport.cargoUnitIds.includes(archaeologist.id), true);
  assert.equal(h.builder.getCurrentTileBuildPreview(h.transport).canBuild, false);
});

test('moving the carrier or unloading/removing cargo interrupts cargo construction', () => {
  const moved = createHarness({ archaeologistCount: 1 });
  assert.ok(moved.builder.build(moved.transport, moved.tile));
  moved.units.moveUnit(moved.transport.id, 2, 0);
  assert.equal(moved.tile.improvementConstruction, undefined);
  assert.equal(moved.archaeologists[0].buildAction, undefined);

  const unloaded = createHarness({ archaeologistCount: 1 });
  assert.ok(unloaded.builder.build(unloaded.transport, unloaded.tile));
  unloaded.units.unboardUnit(unloaded.archaeologists[0].id, 0, 1);
  assert.equal(unloaded.tile.improvementConstruction, undefined);

  const removed = createHarness({ archaeologistCount: 1 });
  assert.ok(removed.builder.build(removed.transport, removed.tile));
  removed.units.removeUnit(removed.archaeologists[0].id);
  assert.equal(removed.tile.improvementConstruction, undefined);

  const sunk = createHarness({ archaeologistCount: 1 });
  assert.ok(sunk.builder.build(sunk.transport, sunk.tile));
  sunk.units.removeUnit(sunk.transport.id);
  assert.equal(sunk.tile.improvementConstruction, undefined);
});

test('tile save/load preserves cargo excavation progress and completion data', () => {
  const source = createHarness({ archaeologistCount: 1 });
  assert.ok(source.builder.build(source.transport, source.tile));
  source.construction.handleTurnStart({ round: 1, nation: source.nation });
  const saved = SaveLoadService.serializeTiles(source.mapData);

  const restored = createHarness({ archaeologistCount: 1 });
  SaveLoadService.restoreTiles(saved, restored.mapData);
  restored.construction.syncUnitsFromTiles();
  restored.builder.rebuildConstructionIndex();
  assert.equal(restored.tile.improvementConstruction?.remainingTurns, 3);
  assert.equal(restored.tile.improvementConstruction?.unitId, restored.archaeologists[0].id);
  assert.equal(restored.tile.improvementConstruction?.transportUnitId, restored.transport.id);
  assert.equal(restored.construction.isUnitBusy(restored.transport.id), true);

  for (let round = 2; round <= 4; round += 1) {
    restored.construction.handleTurnStart({ round, nation: restored.nation });
  }
  const completedSave = SaveLoadService.serializeTiles(restored.mapData);
  const completed = createHarness({ archaeologistCount: 1 });
  SaveLoadService.restoreTiles(completedSave, completed.mapData);
  assert.equal(completed.tile.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
});

test('transport exposes a disabled Dig explaining missing cargo and enables it for an expedition', () => {
  const invalid = createHarness();
  const invalidToolbox = new UnitActionToolbox(OWNER);
  invalidToolbox.setBuildAvailabilityProvider(invalid.builder);
  invalidToolbox.setSelectedUnit(invalid.transport);
  const lockedDig = invalidToolbox.getHudActions().find(action => action.mode === 'dig');
  assert.equal(lockedDig?.isAvailable, false);
  assert.match(lockedDig?.tooltip ?? '', /Archaeologist aboard/);

  const valid = createHarness({ archaeologistCount: 1 });
  const toolbox = new UnitActionToolbox(OWNER);
  toolbox.setBuildAvailabilityProvider(valid.builder);
  toolbox.setSelectedUnit(valid.transport);
  assert.equal(toolbox.getHudActions().some((action) => action.mode === 'dig' && action.isAvailable), true);
  assert.equal(toolbox.getHudActions().some((action) => action.mode === 'build'), false);
});

test('completed Shipwreck contributes 25 Culture through the generic Museum calculation', () => {
  const h = createHarness({ archaeologistCount: 1 });
  h.tile.improvementId = UNDERWATER_ARCHAEOLOGICAL_SITE.id;
  const archaeology = new ArchaeologicalCultureSystem(h.mapData, h.cities);
  assert.equal(archaeology.calculateForNation(OWNER).baseCulturePerTurn, 0);
  h.cities.getBuildings(h.city.id).add(MUSEUM);
  assert.equal(archaeology.calculateForNation(OWNER).baseCulturePerTurn, 25);

  const second = new City({ id: 'second-port', name: 'Second Port', ownerId: OWNER, tileX: 2, tileY: 1 });
  h.cities.addCity(second);
  h.cities.getBuildings(second.id).add(MUSEUM);
  assert.equal(archaeology.calculateForNation(OWNER).baseCulturePerTurn, 25);

  const nextOwner = 'nation_new_controller';
  h.nations.addNation(new Nation({ id: nextOwner, name: 'New Controller', color: 0x445566 }));
  const nextCity = new City({ id: 'new-port', name: 'New Port', ownerId: nextOwner, tileX: 2, tileY: 1 });
  h.cities.addCity(nextCity);
  h.cities.getBuildings(nextCity.id).add(MUSEUM);
  h.tile.ownerId = nextOwner;
  assert.equal(archaeology.calculateForNation(OWNER).baseCulturePerTurn, 0);
  assert.equal(archaeology.calculateForNation(nextOwner).baseCulturePerTurn, 25);
});

test('Underwater Archaeological Site uses the normal transparent improvement asset path', () => {
  assert.equal(UNDERWATER_ARCHAEOLOGICAL_SITE.spriteKey, 'improvement_underwater_archaeological_site');
  assert.equal(existsSync('public/assets/sprites/improvements/underwater_archaeological_site.png'), true);
});

for (const carrierType of ALL_UNIT_TYPES.filter(type => type.isNaval && canCarryUnitType(type, ARCHAEOLOGIST))) {
  test(`${carrierType.name} supports human Dig from preview through completion`, () => {
    const h = createHarness({ carrierType, archaeologistCount: 1 });
    h.tile.ownerId = undefined;
    const toolbox = new UnitActionToolbox(OWNER);
    toolbox.setBuildAvailabilityProvider(h.builder);
    toolbox.setSelectedUnit(h.transport);
    assert.ok(toolbox.getHudActions().some(action => action.mode === 'dig' && action.isAvailable));
    assert.ok(h.builder.build(h.transport, h.tile));
    for (let round = 1; round <= 4; round++) h.construction.handleTurnStart({ round, nation: h.nation });
    assert.equal(h.tile.improvementId, UNDERWATER_ARCHAEOLOGICAL_SITE.id);
    assert.equal(h.tile.ownerId, undefined);
    assert.equal(h.archaeologists[0].carriedByUnitId, h.transport.id);
  });
}

test('Dig remains visible with explanations for research, movement and exhausted cargo', () => {
  for (const problem of ['research', 'movement', 'charges']) {
    const h = createHarness({ archaeologistCount: 1, researched: problem !== 'research' });
    if (problem === 'movement') h.transport.movementPoints = 0;
    if (problem === 'charges') h.archaeologists[0].improvementCharges = 0;
    const toolbox = new UnitActionToolbox(OWNER);
    toolbox.setBuildAvailabilityProvider(h.builder);
    toolbox.setSelectedUnit(h.transport);
    const dig = toolbox.getHudActions().find(action => action.mode === 'dig');
    assert.equal(dig?.isAvailable, false);
    assert.ok(dig?.tooltip);
  }
});

test('cheated Shipwreck discovery permits Dig but still requires archaeology research', () => {
  const h = createHarness({ archaeologistCount: 1, known: false });
  h.tile.resourceRevealedByCheat = true;
  assert.ok(h.builder.build(h.transport, h.tile));
  const locked = createHarness({ archaeologistCount: 1, known: false, researched: false });
  locked.tile.resourceRevealedByCheat = true;
  assert.equal(locked.builder.build(locked.transport, locked.tile), null);
});

test('selecting a second archaeologist uses that passenger, while transport skips exhausted cargo', () => {
  const h = createHarness({ archaeologistCount: 2 });
  assert.equal(h.builder.getCurrentTileBuildPreview(h.archaeologists[1]).builderUnitId, h.archaeologists[1].id);
  h.archaeologists[0].improvementCharges = 0;
  assert.equal(h.builder.getCurrentTileBuildPreview(h.transport).builderUnitId, h.archaeologists[1].id);
});

for (const water of [TileType.Coast, TileType.Ocean]) {
  test(`industrial cargo must land on land, never ${water}`, () => {
    const h = createHarness({ archaeologistCount: 1 });
    h.nation.researchedTechIds.push('industrialization');
    const passenger = h.archaeologists[0];
    const boarding = new UnitBoardingManager(h.units, h.mapData, new HexGridSystem(), h.nations);
    h.mapData.tiles[0][2].type = water;
    assert.equal(canEmbark(passenger, h.nation), true);
    assert.equal(isEmbarked(passenger, h.mapData), false, 'cargo is not an independent embarked unit');
    assert.equal(boarding.canUnboard(passenger, 2, 0), false);
    assert.equal(boarding.unboard(passenger, 2, 0), false);
    assert.equal(passenger.carriedByUnitId, h.transport.id);
    assert.ok(h.transport.cargoUnitIds.includes(passenger.id));
    assert.match(boarding.getUnboardingFailureReason(passenger, 2, 0) ?? '', /land/);
    assert.equal(boarding.unboard(passenger, 1, 1), true);
    assert.equal(passenger.carriedByUnitId, undefined);
    assert.equal(isEmbarked(passenger, h.mapData), false);
    h.units.moveUnit(passenger.id, 2, 0);
    assert.equal(isEmbarked(passenger, h.mapData), true);
    h.units.moveUnit(passenger.id, 1, 1);
    assert.equal(isEmbarked(passenger, h.mapData), false);
  });
}
