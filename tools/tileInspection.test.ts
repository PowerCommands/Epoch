import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTileInspection } from '../src/systems/TileInspectionData';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { AirOperationsSystem } from '../src/systems/AirOperationsSystem';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { WARRIOR, TRANSPORT_SHIP, CARRIER, FIGHTER } from '../src/data/units';
import { AIRFIELD, AIR_BASE } from '../src/data/buildings';
import { TileType, type MapData } from '../src/types/map';

function harness() {
  const mapData: MapData = { width: 5, height: 5, tileSize: 32,
    tiles: Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const deps = { mapData, unitManager: new UnitManager(5, 5), cityManager: new CityManager(),
    nationManager: new NationManager(), gridSystem: new HexGridSystem() };
  const spawn = (id: string, unitType = WARRIOR, x = 2, y = 2) => {
    const unit = new Unit({ id, name: unitType.name, ownerId: 'a', tileX: x, tileY: y, unitType });
    deps.unitManager.addUnit(unit);
    return unit;
  };
  const inspect = (x = 2, y = 2) => buildTileInspection({ x, y }, deps)!.sections.find(s => s.heading === 'Units')!;
  const air = () => new AirOperationsSystem(deps.unitManager, deps.cityManager, mapData, deps.gridSystem,
    undefined, () => 1, () => 'a', () => true);
  return { ...deps, spawn, inspect, air };
}

test('empty tile and ordinary damaged unit have a Units section', () => {
  const h = harness();
  assert.deepEqual(h.inspect().units, []);
  const unit = h.spawn('soldier'); unit.health = 37;
  assert.equal(h.inspect().units?.[0].health, 37);
  assert.equal(h.inspect().units?.[0].maxHealth, WARRIOR.baseHealth);
  assert.equal(h.inspect(1, 1).units?.length, 0);
});

test('transport inspection includes every passenger absent from the tile grid', () => {
  const h = harness(); const ship = h.spawn('ship', TRANSPORT_SHIP);
  for (const id of ['one', 'two', 'three']) {
    h.spawn(id, WARRIOR, 1, 2);
    assert.equal(h.unitManager.boardUnit(id, ship.id), true);
  }
  assert.equal(h.unitManager.getUnitsAt(2, 2).length, 1);
  const units = h.inspect().units!;
  assert.equal(units.length, 4);
  assert.ok(units.slice(1).every(u => u.rows.some(r => r.value === 'Aboard Transport Ship')));
});

for (const building of [AIRFIELD, AIR_BASE]) {
  test(`${building.name} inspection includes multiple stationed aircraft`, () => {
    const h = harness();
    const city = new City({ id: 'city', name: 'Test', ownerId: 'a', tileX: 1, tileY: 2 });
    city.ownedTileCoords = [{ x: 1, y: 2 }, { x: 2, y: 2 }];
    h.cityManager.addCity(city);
    h.mapData.tiles[2][2].buildingId = building.id;
    h.cityManager.getBuildings(city.id).add(building);
    const air = h.air();
    h.spawn('fighter-one', FIGHTER); h.spawn('fighter-two', FIGHTER);
    h.unitManager.airOperations!.reconcile();
    assert.equal(air.aircraftAt({ kind: 'city', id: city.id }).length, 2);
    assert.equal(h.inspect().units?.length, 2);
    assert.equal(h.inspect(1, 2).units?.length, 0);
  });
}

test('carrier aircraft appear once despite both cargo and air base membership', () => {
  const h = harness(); const carrier = h.spawn('carrier', CARRIER); h.air();
  h.spawn('fighter-one', FIGHTER); h.spawn('fighter-two', FIGHTER);
  h.unitManager.airOperations!.reconcile();
  assert.equal(carrier.cargoUnitIds.length, 2);
  const units = h.inspect().units!;
  assert.equal(units.length, 3);
  assert.equal(new Set(units.map(u => u.id)).size, 3);
});
