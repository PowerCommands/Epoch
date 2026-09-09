import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getImprovementForTile } from '../src/systems/ImprovementResolution.ts';
import { BuilderSystem } from '../src/systems/BuilderSystem.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { WORKER, WORK_BOAT, ARCHAEOLOGIST } from '../src/data/units.ts';
import { ALL_TECHNOLOGIES } from '../src/data/technologies.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

function harness(type: TileType, resourceId?: string, known = true) {
  const nation = new Nation({ id: 'a', name: 'Builders', color: 1, researchedTechIds: ALL_TECHNOLOGIES.map(t => t.id) });
  const nations = new NationManager(); nations.addNation(nation);
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'City', ownerId: 'a', tileX: 0, tileY: 0 });
  city.ownedTileCoords = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; cities.addCity(city);
  const tile: Tile = { x: 1, y: 0, type, resourceId, ownerId: 'a' };
  const map: MapData = { width: 2, height: 1, tileSize: 1, tiles: [[{ x: 0, y: 0, type: TileType.Plains, ownerId: 'a' }, tile]] };
  const units = new UnitManager(2, 1);
  const unitType = type === TileType.Coast || type === TileType.Ocean ? WORK_BOAT : WORKER;
  const unit = new Unit({ id: 'worker', name: unitType.name, ownerId: 'a', tileX: 1, tileY: 0, unitType, improvementCharges: 2 });
  units.addUnit(unit);
  const research = new ResearchSystem(nations, cities, () => 1);
  const builder = new BuilderSystem(units, cities, turns, map, new HexGridSystem(), research, undefined, undefined, () => known);
  const toolbox = new UnitActionToolbox('a'); toolbox.setBuildAvailabilityProvider(builder); toolbox.setSelectedUnit(unit);
  return { nation, cities, map, tile, unit, units, research, builder, toolbox };
}

const cases: [TileType, string | undefined, string, string][] = [
  [TileType.Plains, 'wheat', 'farm', 'Farm'],
  [TileType.Plains, 'rice', 'farm', 'Farm'],
  [TileType.Plains, 'horses', 'pasture', 'Pasture'],
  [TileType.Forest, 'iron', 'mine', 'Mine'],
  [TileType.Forest, undefined, 'lumber_mill', 'Lumber Mill'],
  [TileType.Mountain, undefined, 'mine', 'Mine'],
  [TileType.Plains, undefined, 'farm', 'Farm'],
  [TileType.Meadow, undefined, 'farm', 'Farm'],
  [TileType.Beach, undefined, 'farm', 'Farm'],
  [TileType.Coast, 'fish', 'fishing_boats', 'Fishing Boats'],
  [TileType.Ocean, 'oil', 'offshore_platform', 'Offshore Platform'],
  [TileType.Desert, 'oil', 'oil_well', 'Oil Well'],
];
for (const [type, resource, id, name] of cases) test(`${type}/${resource ?? 'no resource'} resolves and builds ${name}`, () => {
  const h = harness(type, resource);
  assert.equal(getImprovementForTile(h.tile)?.id, id);
  assert.equal(h.builder.getCurrentTileBuildPreview(h.unit).improvementId, id);
  const action = h.toolbox.getHudActions().find(a => a.mode === 'build');
  assert.equal(action?.label, `Build ${name}`); assert.equal(action?.isAvailable, true);
  if (!h.unit.unitType.isNaval) assert.equal(h.builder.canNationImproveLandTile('a', h.tile), true);
  const result = h.builder.build(h.unit, h.tile);
  assert.equal(result?.improvement.id, id);
  assert.equal(result?.requiredTurns, 3);
  const construction = new ImprovementConstructionSystem(h.map, h.units, h.cities);
  for (let round = 1; round <= 3; round++) construction.handleTurnStart({ nation: h.nation, round });
  assert.equal(h.tile.improvementId, id);
  // Charge consumption remains the existing scene completion listener’s responsibility.
  assert.equal(h.unit.improvementCharges, 2);
});

for (const type of [TileType.Jungle, TileType.Desert, TileType.Ice, TileType.Coast, TileType.Ocean]) test(`${type} without resource exposes no Build action`, () => {
  const h = harness(type);
  assert.equal(getImprovementForTile(h.tile), undefined);
  assert.equal(h.builder.canBuild(h.unit, h.tile), false);
  assert.ok(!h.toolbox.getHudActions().some(a => a.mode === 'build'));
});

test('locked resource improvement remains named and does not fall back to the terrain', () => {
  const h = harness(TileType.Forest, 'iron'); h.nation.researchedTechIds = ['construction'];
  const action = h.toolbox.getHudActions().find(a => a.mode === 'build');
  assert.equal(action?.label, 'Build Mine'); assert.equal(action?.isAvailable, false);
  assert.match(action?.tooltip ?? '', /Requires Mining/);
  assert.equal(h.builder.canNationImproveLandTile('a', h.tile), false);
});

test('unknown resources and unsupported resource terrain cannot fall back to a generic build', () => {
  const h = harness(TileType.Plains, 'iron', false);
  assert.equal(h.builder.canBuild(h.unit, h.tile), false);
  assert.equal(h.builder.canNationImproveLandTile('a', h.tile), false);
  assert.equal(getImprovementForTile({ type: TileType.Forest, resourceId: 'fish' }), undefined);
});

test('archaeological resources keep specialized improvements and Worker cannot Dig', () => {
  const h = harness(TileType.Plains, 'ancient_pottery');
  assert.equal(getImprovementForTile(h.tile)?.id, 'archaeological_dig');
  assert.equal(h.builder.canBuild(h.unit, h.tile), false);
  assert.ok(!h.toolbox.getHudActions().some(a => a.mode === 'build'));
  assert.equal(getImprovementForTile({ type: TileType.Ocean, resourceId: 'shipwreck' })?.id, 'underwater_archaeological_site');
  const archaeologist = new Unit({ id: 'archaeologist', name: 'Archaeologist', ownerId: 'a', tileX: 1, tileY: 0, unitType: ARCHAEOLOGIST });
  h.units.addUnit(archaeologist); h.toolbox.setSelectedUnit(archaeologist);
  assert.equal(h.toolbox.getHudActions().find(a => a.mode === 'dig')?.isAvailable, true);
});

test('builder UI has one contextual action and AI shares the canonical resolver', () => {
  const h = harness(TileType.Plains);
  assert.equal(h.toolbox.getHudActions().filter(a => a.mode === 'build').length, 1);
  assert.ok(h.toolbox.getHudActions().every(a => !/choose|cycle/i.test(a.label)));
  assert.match(readFileSync('src/systems/AISystem.ts', 'utf8'), /getImprovementForTile\(tile\)/);
});
