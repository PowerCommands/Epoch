import assert from 'node:assert/strict';
import test from 'node:test';

import { MUSEUM } from '../src/data/buildings.ts';
import { ARCHAEOLOGIST } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import {
  buildArchaeologyDiagnostics,
  formatArchaeologyDiagnostics,
} from '../src/systems/ArchaeologyDiagnostics.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const FRANCE = 'france';

function tile(x: number, resourceId?: string, improvementId?: string, ownerId = FRANCE, type = TileType.Plains): Tile {
  return { x, y: 0, type, ownerId, resourceId, improvementId };
}

function makeWorld(tiles: Tile[]) {
  const cityManager = new CityManager();
  const paris = new City({ id: 'paris', name: 'Paris', ownerId: FRANCE, tileX: 0, tileY: 0 });
  cityManager.addCity(paris);
  const mapData: MapData = { width: tiles.length, height: 1, tileSize: 32, tiles: [tiles] };
  const france = new Nation({ id: FRANCE, name: 'France', color: 0x2244aa, isHuman: false });
  return { cityManager, paris, mapData, france };
}

test('diagnostics reflect actual world state and Museum-gated Culture', () => {
  const world = makeWorld([
    tile(0, 'ancient_treasure', 'archaeological_dig'), // excavated, owned
    tile(1, 'ancient_pottery'), // controlled but not excavated
    { ...tile(2, 'shipwreck', 'underwater_archaeological_site'), type: TileType.Coast }, // excavated wreck
  ]);
  const getUnitsByOwner = () => [
    new Unit({ id: 'a1', name: ARCHAEOLOGIST.name, ownerId: FRANCE, tileX: 0, tileY: 0, unitType: ARCHAEOLOGIST }),
  ];

  const withoutMuseum = buildArchaeologyDiagnostics([world.france], getUnitsByOwner, world.cityManager, world.mapData);
  assert.deepEqual(withoutMuseum.world, {
    totalResources: 3,
    totalExcavated: 2,
    totalShipwrecks: 1,
    excavatedShipwrecks: 1,
  });
  const nation = withoutMuseum.nations[0];
  assert.equal(nation.archaeologists, 1);
  assert.equal(nation.sitesControlled, 3);
  assert.equal(nation.sitesExcavated, 2);
  assert.equal(nation.shipwrecksExcavated, 1);
  assert.equal(nation.hasFunctioningMuseum, false);
  assert.equal(nation.museumCount, 0);
  // No functioning Museum → 0 archaeological Culture, exactly as the game applies it.
  assert.equal(nation.culturePerTurn, 0);

  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);
  const withMuseum = buildArchaeologyDiagnostics([world.france], getUnitsByOwner, world.cityManager, world.mapData);
  const dug = withMuseum.nations[0];
  assert.equal(dug.hasFunctioningMuseum, true);
  assert.equal(dug.museumCount, 1);
  // Ancient Treasure (15) + Shipwreck (25), both excavated and owned.
  assert.equal(dug.culturePerTurn, 40);
});

test('formatted lines skip nations with no archaeology footprint', () => {
  const world = makeWorld([tile(0, 'wheat')]);
  const diagnostics = buildArchaeologyDiagnostics([world.france], () => [], world.cityManager, world.mapData);
  const lines = formatArchaeologyDiagnostics(diagnostics);
  assert.equal(lines.length, 1); // world line only
  assert.match(lines[0], /\[ArchaeologyDiag\] world resources=0/);
});
