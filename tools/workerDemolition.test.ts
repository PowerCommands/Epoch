import assert from 'node:assert/strict';
import test from 'node:test';
import { GRANARY, getBuildingById } from '../src/data/buildings.ts';
import { WORKER, WORK_BOAT, WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { BuilderSystem } from '../src/systems/BuilderSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { InfrastructureSabotageSystem } from '../src/systems/InfrastructureSabotageSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { WonderSystem } from '../src/systems/WonderSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox.ts';

function harness(naval = false, charges = 1) {
  const nations = new NationManager();
  const nation = new Nation({ id: 'owner', name: 'Owner', color: 0 });
  nations.addNation(nation);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'City', ownerId: nation.id, tileX: 0, tileY: 0 });
  city.ownedTileCoords = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  cities.addCity(city);
  const map: MapData = { width: 3, height: 1, tileSize: 80, tiles: [[
    { x: 0, y: 0, type: TileType.Plains, ownerId: nation.id },
    { x: 1, y: 0, type: naval ? TileType.Coast : TileType.Plains, ownerId: nation.id, resourceId: naval ? 'fish' : 'wheat' },
    { x: 2, y: 0, type: naval ? TileType.Coast : TileType.Plains, ownerId: nation.id },
  ]] };
  const tile = map.tiles[0][1];
  const unit = new Unit({ id: 'builder', name: 'Builder', ownerId: nation.id, unitType: naval ? WORK_BOAT : WORKER, tileX: 1, tileY: 0, improvementCharges: charges });
  const units = new UnitManager(3, 1); units.addUnit(unit);
  const changed: string[][] = [];
  const sabotage = new InfrastructureSabotageSystem(map, cities, new WonderSystem(), nations, () => {});
  sabotage.setInfrastructureChangedHandler(ids => changed.push([...ids]));
  const builder = new BuilderSystem(units, cities, new TurnManager(nations), map, new HexGridSystem());
  const construction = new ImprovementConstructionSystem(map, units, cities);
  return { nations, nation, cities, city, map, tile, unit, units, changed, sabotage, builder, construction };
}

for (const naval of [false, true]) for (const charges of [1, 2]) {
  test(`${naval ? 'Work Boat' : 'Worker'} with ${charges} charge(s) demolishes without spending charges and can complete a replacement improvement`, () => {
    const h = harness(naval, charges);
    const building = naval ? getBuildingById('harbor')! : GRANARY;
    h.tile.buildingId = building.id;
    h.cities.getBuildings(h.city.id).add(building);
    const movement = h.unit.movementPoints;
    const gold = h.nations.getResources(h.nation.id).gold;
    assert.equal(h.builder.canUnitBuildOnCurrentTile(h.unit), false);
    assert.equal(h.sabotage.destroyBuilding(h.unit), true);
    assert.equal(h.tile.buildingId, undefined);
    assert.equal(h.cities.getBuildings(h.city.id).has(building.id), false);
    assert.equal(h.unit.improvementCharges, charges);
    assert.equal(h.unit.movementPoints, movement);
    assert.equal(h.nations.getResources(h.nation.id).gold, gold);
    assert.deepEqual(h.changed, [['owner']]);
    assert.equal(h.sabotage.getActOfWarTarget(h.unit, 'building'), undefined);
    // Removing another improvement is free too, even with no movement remaining.
    h.tile.improvementId = naval ? 'fishing_boats' : 'farm';
    h.tile.improvementOwnerId = h.nation.id;
    h.unit.movementPoints = 0;
    assert.equal(h.sabotage.getDestroyImprovementLootGold(h.unit), 0);
    assert.equal(h.sabotage.destroyImprovement(h.unit), true);
    assert.equal(h.tile.improvementOwnerId, undefined);
    assert.equal(h.unit.improvementCharges, charges);
    assert.equal(h.unit.movementPoints, 0);
    assert.equal(h.nations.getResources(h.nation.id).gold, gold);
    h.unit.movementPoints = movement;
    assert.equal(h.builder.canUnitBuildOnCurrentTile(h.unit), true);
    const started = h.builder.build(h.unit, h.tile);
    assert.ok(started);
    assert.equal(h.unit.improvementCharges, charges);
    // GameScene spends charges from this completion event, never from demolition.
    const completedUnits: Unit[] = [];
    h.construction.onCompleted(event => completedUnits.push(event.unit));
    for (let round = 1; round <= started.requiredTurns; round++) h.construction.handleTurnStart({ round, nation: h.nation });
    assert.equal(h.tile.improvementId, started.improvement.id);
    assert.deepEqual(completedUnits, [h.unit]);
  });
}

test('demolition protects wonders, foreign structures, city centers, construction and the wrong domain', () => {
  for (const naval of [false, true]) {
    const h = harness(naval);
    h.tile.buildingId = GRANARY.id;
    h.tile.improvementId = 'farm';
    for (const broken of [false, true]) {
      h.tile.buildingBroken = broken;
      h.tile.wonderId = 'pyramids';
      assert.equal(h.sabotage.destroyBuilding(h.unit), false);
      assert.equal(h.sabotage.destroyImprovement(h.unit), false);
      assert.equal(h.tile.wonderId, 'pyramids');
    }
    h.tile.wonderId = undefined;
    h.tile.ownerId = 'enemy';
    assert.equal(h.sabotage.destroyBuilding(h.unit), false);
    assert.equal(h.sabotage.destroyImprovement(h.unit), false);
    h.tile.ownerId = 'owner';
    h.tile.wonderConstruction = { cityId: h.city.id, wonderId: 'pyramids' };
    assert.equal(h.sabotage.canDestroyBuilding(h.unit), false);
    h.tile.wonderConstruction = undefined;
    h.tile.type = naval ? TileType.Plains : TileType.Coast;
    assert.equal(h.sabotage.canDestroyBuilding(h.unit), false);
    assert.equal(h.sabotage.canDestroyImprovement(h.unit), false);
    h.unit.tileX = 0;
    h.map.tiles[0][0].buildingId = GRANARY.id;
    assert.equal(h.sabotage.canDestroyBuilding(h.unit), false);
    assert.equal(h.unit.improvementCharges, 1);
  }
});

test('broken buildings are removed completely and the action model offers building afterward', () => {
  const h = harness();
  h.tile.buildingId = GRANARY.id;
  h.cities.getBuildings(h.city.id).addEntry(GRANARY.id, true);
  const toolbox = new UnitActionToolbox(h.nation.id);
  toolbox.setBuildAvailabilityProvider(h.builder);
  toolbox.setSabotageAvailabilityProvider(h.sabotage);
  toolbox.setSelectedUnit(h.unit);
  const action = toolbox.getHudActions().find(a => a.mode === 'destroyBuilding');
  assert.equal(action?.label, 'Demolish Building');
  assert.match(action?.tooltip ?? '', /no Gold, movement or build charges/);
  toolbox.onModeChanged(mode => { if (mode === 'destroyBuilding') h.sabotage.destroyBuilding(h.unit); });
  toolbox.tryActivate('destroyBuilding');
  assert.equal(h.cities.getBuildings(h.city.id).has(GRANARY.id), false);
  assert.ok(toolbox.getHudActions().some(a => a.mode === 'build'));
  assert.ok(!toolbox.getHudActions().some(a => a.mode === 'destroyBuilding'));
});

test('military improvement plunder still consumes movement and awards loot', () => {
  const h = harness(); h.unit.unitType = WARRIOR;
  h.tile.ownerId = 'enemy'; h.tile.improvementId = 'farm';
  const gold = h.nations.getResources('owner').gold;
  const loot = h.sabotage.getDestroyImprovementLootGold(h.unit);
  assert.equal(loot, 10);
  assert.equal(h.sabotage.destroyImprovement(h.unit), true);
  assert.equal(h.unit.movementPoints, 0);
  assert.equal(h.nations.getResources('owner').gold, gold + loot);
});

test('a worker can clear several tiles and retains its last build charge', () => {
  const h = harness();
  h.tile.buildingId = GRANARY.id;
  h.cities.getBuildings(h.city.id).add(GRANARY);
  assert.equal(h.sabotage.destroyBuilding(h.unit), true);
  const second = h.map.tiles[0][2];
  second.improvementId = 'farm';
  h.unit.tileX = second.x;
  assert.equal(h.sabotage.destroyImprovement(h.unit), true);
  assert.equal(h.sabotage.destroyImprovement(h.unit), false);
  assert.equal(h.unit.improvementCharges, 1);
  assert.equal(h.units.getUnit(h.unit.id), h.unit);
});

test('Work Boat clears its standalone sea claim without removing the natural resource', () => {
  const h = harness(true);
  h.tile.ownerId = undefined;
  h.tile.improvementId = 'fishing_boats';
  h.tile.resourceOwnerNationId = h.nation.id;
  assert.equal(h.sabotage.destroyImprovement(h.unit), true);
  assert.equal(h.tile.resourceOwnerNationId, undefined);
  assert.equal(h.tile.resourceId, 'fish');
  assert.equal(h.unit.improvementCharges, 1);
});

test('removing a repeatable water building leaves other installations in place', () => {
  const h = harness(true);
  h.tile.buildingId = 'offshore_wind_farm';
  h.tile.buildingBroken = true;
  const second = h.map.tiles[0][2];
  second.buildingId = 'offshore_wind_farm';
  assert.equal(h.sabotage.destroyBuilding(h.unit), true);
  assert.equal(h.tile.buildingId, undefined);
  assert.equal(h.tile.buildingBroken, undefined);
  assert.equal(second.buildingId, 'offshore_wind_farm');
  assert.deepEqual(h.changed, [['owner']]);
});
