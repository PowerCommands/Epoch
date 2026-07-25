import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WORKER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { BuilderSystem } from '../src/systems/BuilderSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const OWNER_ID = 'nation_builder';

function createHarness() {
  const mapData: MapData = {
    width: 5,
    height: 5,
    tileSize: 1,
    tiles: Array.from({ length: 5 }, (_, y) => (
      Array.from({ length: 5 }, (_, x) => ({ x, y, type: TileType.Plains }))
    )),
  };
  const nation = new Nation({ id: OWNER_ID, name: 'Builders', color: 0x123456 });
  const nations = new NationManager();
  nations.addNation(nation);
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'Workshop', ownerId: OWNER_ID, tileX: 1, tileY: 1 });
  city.ownedTileCoords = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
  cities.addCity(city);
  const tile = mapData.tiles[1][2];
  tile.ownerId = OWNER_ID;
  const units = new UnitManager(mapData.width, mapData.height);
  const worker = new Unit({
    id: 'worker',
    name: WORKER.name,
    ownerId: OWNER_ID,
    tileX: tile.x,
    tileY: tile.y,
    unitType: WORKER,
    improvementCharges: 5,
  });
  units.addUnit(worker);
  const construction = new ImprovementConstructionSystem(mapData, units, cities);
  const builder = new BuilderSystem(units, cities, turns, mapData, new HexGridSystem());
  return { mapData, nation, tile, units, worker, construction, builder };
}

test('construction index follows start, cancel, completion, and unit removal', () => {
  const h = createHarness();
  assert.ok(h.builder.build(h.worker, h.tile));
  assert.equal(h.construction.isUnitBusy(h.worker.id), true);

  assert.equal(h.construction.cancelBuildForUnit(h.worker.id), true);
  assert.equal(h.construction.isUnitBusy(h.worker.id), false);

  h.worker.movementPoints = h.worker.maxMovementPoints;
  assert.ok(h.builder.build(h.worker, h.tile));
  for (let round = 1; round <= 10 && h.construction.isUnitBusy(h.worker.id); round++) {
    h.construction.handleTurnStart({ round, nation: h.nation });
  }
  assert.equal(h.construction.isUnitBusy(h.worker.id), false);
  assert.equal(h.tile.improvementId, 'farm');

  h.tile.improvementId = undefined;
  h.worker.movementPoints = h.worker.maxMovementPoints;
  assert.ok(h.builder.build(h.worker, h.tile));
  h.units.removeUnit(h.worker.id);
  assert.equal(h.construction.isUnitBusy(h.worker.id), false);
  assert.equal(h.tile.improvementConstruction, undefined);
});

test('save-load tile restoration rebuilds both construction indexes', () => {
  const h = createHarness();
  h.tile.improvementConstruction = {
    improvementId: 'farm',
    cityId: 'city',
    unitId: h.worker.id,
    ownerId: OWNER_ID,
    remainingTurns: 2,
    totalTurns: 3,
  };
  h.construction.syncUnitsFromTiles();
  h.builder.rebuildConstructionIndex();

  assert.equal(h.construction.isUnitBusy(h.worker.id), true);
  assert.equal(h.builder.getBuildPreview(h.worker, h.tile).reason, 'Already building an improvement');

  h.tile.improvementConstruction = undefined;
  assert.equal(h.construction.isUnitBusy(h.worker.id), false);
  assert.equal(h.builder.getBuildPreview(h.worker, h.tile).canBuild, true);
});
