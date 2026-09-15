import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { SURVEYOR, SETTLER, WARRIOR, WORKER } from '../src/data/units';
import { TUTORIAL_SECTIONS } from '../src/data/tutorialContent';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { UnitManager } from '../src/systems/UnitManager';
import { TurnManager } from '../src/systems/TurnManager';
import { ResearchSystem } from '../src/systems/ResearchSystem';
import { CultureSystem } from '../src/systems/culture/CultureSystem';
import { CityTerritorySystem } from '../src/systems/CityTerritorySystem';
import { TerritorialClaimSystem, getPoliticalOwnerId, getTerritorialClaimTint, onTerritorialClaimAbsorbed } from '../src/systems/TerritorialClaimSystem';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType, type MapData } from '../src/types/map';
import { calculateCityEconomy } from '../src/systems/CityEconomy';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem';
import { BuilderSystem } from '../src/systems/BuilderSystem';
import { FoundCitySystem } from '../src/systems/FoundCitySystem';
import { MovementSystem } from '../src/systems/MovementSystem';
import { PathfindingSystem } from '../src/systems/PathfindingSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { DiplomaticMemorySystem } from '../src/systems/diplomacy/DiplomaticMemorySystem';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { AISystem } from '../src/systems/AISystem';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox';

function harness() {
  const map: MapData = { width: 20, height: 20, tileSize: 64, tiles: Array.from({ length: 20 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const grid = new HexGridSystem();
  const nations = new NationManager();
  for (const id of ['a', 'b']) nations.addNation(new Nation({ id, name: id, color: 0x225588, isHuman: id === 'a' }));
  const turns = new TurnManager(nations);
  const cities = new CityManager();
  const city = new City({ id: 'home', name: 'Home', ownerId: 'a', tileX: 2, tileY: 2 });
  cities.addCity(city);
  const territory = new CityTerritorySystem(undefined, grid);
  territory.initializeOwnedTiles(city, map, grid);
  for (const t of city.ownedTileCoords) map.tiles[t.y][t.x].ownerId = 'a';
  const units = new UnitManager(20, 20);
  nations.getResources('a').gold = 1000;
  const claims = new TerritorialClaimSystem({
    mapData: map, gridSystem: grid, getCities: id => cities.getCitiesByOwner(id),
    getGold: id => nations.getResources(id).gold,
    addGold: (id, amount) => { nations.getResources(id).gold += amount; },
    getUnit: id => units.getUnit(id), removeUnit: id => units.removeUnit(id),
    getActiveNationId: () => turns.getCurrentNation().id, isHumanNation: id => nations.getNation(id)?.isHuman === true, onChanged: () => {},
  });
  const surveyor = units.createUnit({ type: SURVEYOR, ownerId: 'a', tileX: 7, tileY: 7 });
  const diplomacy = new DiplomacyManager();
  const memory = new DiplomaticMemorySystem(diplomacy);
  const events: unknown[] = [];
  onTerritorialClaimAbsorbed(map, event => {
    events.push(event);
    memory.onTerritorialClaimViolated(event.claimantId, event.acquiringNationId);
  });
  const research = new ResearchSystem(nations, cities, () => 1);
  const culture = new CultureSystem(nations, () => 1);
  research.setCultureUnitUnlockResolver((id, unit) => culture.isUnitCultureUnlocked(id, unit));
  return { map, grid, nations, turns, cities, city, territory, units, claims, surveyor, diplomacy, memory, events, research, culture };
}

test('Early Empire keeps the general Surveyor unlock; AI production eligibility excludes it', () => {
  const h = harness();
  for (const id of ['a', 'b']) {
    assert.equal(h.research.isUnitUnlocked(id, SURVEYOR.id), false);
    h.nations.getNation(id)!.unlockedCultureNodeIds.push('early_empire');
    assert.equal(h.research.isUnitUnlocked(id, SURVEYOR.id), true);
    const ai = Object.create(AISystem.prototype) as any;
    ai.researchSystem = h.research;
    assert.equal(ai.canBuildUnit(id, SURVEYOR.id), false);
    assert.equal(ai.canBuildUnit(id, WARRIOR.id), true);
  }
  assert.equal(SURVEYOR.productionCost, 100);
  assert.equal(SURVEYOR.category, 'civilian');
  assert.equal(SURVEYOR.canFound, undefined);
  assert.equal(SURVEYOR.canBuildImprovements, undefined);
});

test('claim at canonical distance 10 deducts 200 Gold, consumes unit, adds no economic ownership', () => {
  const h = harness();
  assert.equal(h.grid.getDistance({ x: 2, y: 2 }, { x: 7, y: 7 }), 10);
  const before = calculateCityEconomy(h.city, h.map, h.cities.getBuildings(h.city.id), h.grid);
  const ownedCount = h.city.ownedTileCoords.length;
  h.map.tiles[7][7].resourceId = 'iron';
  assert.equal(h.claims.claimTerritory(h.surveyor), true);
  assert.equal(h.nations.getResources('a').gold, 800);
  assert.equal(h.units.getUnit(h.surveyor.id), undefined);
  assert.equal(h.map.tiles[7][7].ownerId, undefined);
  assert.equal(h.map.tiles[7][7].territorialClaimNationId, 'a');
  assert.equal(getPoliticalOwnerId(h.map.tiles[7][7]), 'a');
  assert.equal(h.city.ownedTileCoords.length, ownedCount);
  assert.equal(h.city.workedTileCoords.some(t => t.x === 7 && t.y === 7), false);
  assert.deepEqual(calculateCityEconomy(h.city, h.map, h.cities.getBuildings(h.city.id), h.grid), before);
  assert.equal(new ResourceAccessSystem(h.map, { getAllDeals: () => [] }).hasOwnResource('a', 'iron'), false);
  const worker = h.units.createUnit({ type: WORKER, ownerId: 'a', tileX: 7, tileY: 7 });
  const builder = new BuilderSystem(h.units, h.cities, h.turns, h.map, h.grid, h.research, undefined, h.diplomacy);
  assert.equal(builder.getCurrentTileBuildPreview(worker).canBuild, false);
  assert.equal(h.claims.claimTerritory(h.surveyor), false, 'consumed units cannot be reused');
  assert.equal(h.nations.getResources('a').gold, 800);
});

test('distance, gold, neutral ownership, structures, water, wrong turn and cargo restrictions are atomic', () => {
  const changes: ((h: ReturnType<typeof harness>) => void)[] = [
    h => { h.units.moveUnit(h.surveyor.id, 7, 8); },
    h => { h.nations.getResources('a').gold = 199; },
    h => { h.map.tiles[7][7].ownerId = 'a'; },
    h => { h.map.tiles[7][7].territorialClaimNationId = 'b'; },
    h => { h.map.tiles[7][7].territorialClaimNationId = 'a'; },
    h => { h.map.tiles[7][7].type = TileType.Coast; },
    h => { h.map.tiles[7][7].type = TileType.Ice; },
    h => { h.map.tiles[7][7].buildingId = 'barbarian_camp'; },
    h => { h.surveyor.carriedByUnitId = 'transport'; },
    h => { h.surveyor.ownerId = 'b'; },
  ];
  for (const change of changes) {
    const h = harness(); change(h);
    const before = JSON.stringify(h.map);
    const gold = h.nations.getResources('a').gold;
    assert.equal(h.claims.claimTerritory(h.surveyor), false);
    assert.equal(h.nations.getResources('a').gold, gold);
    assert.equal(JSON.stringify(h.map), before);
    assert.equal(h.units.getUnit(h.surveyor.id), h.surveyor);
  }
});

test('any owned city can supply the distance requirement', () => {
  const h = harness();
  h.units.moveUnit(h.surveyor.id, 18, 18);
  assert.equal(h.claims.getClaimPreview(h.surveyor).canClaim, false);
  h.cities.addCity(new City({ id: 'far', name: 'Far', ownerId: 'a', tileX: 15, tileY: 15 }));
  assert.equal(h.claims.claimTerritory(h.surveyor), true);
});

test('own settlers can found on claims; foreign settlers and AI founding search cannot', () => {
  const h = harness();
  h.nations.getNation('a')!.isHuman = false;
  h.nations.getNation('b')!.isHuman = true;
  const found = new FoundCitySystem(h.units, h.cities, h.nations, h.turns,
    { invalidate() {} } as any, { refreshCity() {} } as any, { recalculateForNation() {} } as any, h.map, h.grid);
  const settler = h.units.createUnit({ type: SETTLER, ownerId: 'a', tileX: 10, tileY: 10 });
  h.map.tiles[10][10].territorialClaimNationId = 'b';
  assert.equal(found.canFound(settler), false);
  assert.equal(found.isDiplomaticFoundingAllowed('a', 10, 10), false);
  h.map.tiles[10][10].territorialClaimNationId = 'a';
  assert.equal(found.canFound(settler), true);
  assert.ok(found.foundCity(settler));
  assert.equal(h.map.tiles[10][10].territorialClaimNationId, undefined);
  assert.equal(h.map.tiles[10][10].ownerId, 'a');
  assert.equal(h.events.length, 0);
});

function movementHarness() {
  const h = harness();
  const movement = new MovementSystem({ getTileAt: (x: number, y: number) => h.map.tiles[y]?.[x] ?? null } as any,
    h.units, { refreshUnitPosition() {} } as any, h.turns, { onSelectionTarget() {} } as any, h.grid, h.nations, h.diplomacy);
  const pathfinding = new PathfindingSystem(h.map, h.units, h.grid, h.nations);
  pathfinding.setTerritoryAccessPredicate((unit, tile) => movement.canUnitPeacefullyEnterTile(unit, tile));
  return { ...h, movement, pathfinding };
}

test('closed claims block direct movement and pathfinding; directional Open Borders and war grant access', () => {
  const h = movementHarness();
  h.nations.getNation('a')!.isHuman = false;
  h.nations.getNation('b')!.isHuman = true;
  const unit = h.units.createUnit({ type: WARRIOR, ownerId: 'a', tileX: 10, tileY: 10 });
  const target = h.map.tiles[10][11]; target.territorialClaimNationId = 'b';
  assert.equal(h.movement.canMoveUnitTo(unit, 11, 10), false);
  assert.equal(h.pathfinding.findPath(unit, 11, 10, { respectMovementPoints: false }), null);
  const detour = h.pathfinding.findPath(unit, 12, 10, { respectMovementPoints: false });
  assert.ok(detour);
  assert.equal(detour.some(t => t === target), false);
  h.diplomacy.toggleOpenBorders('a', 'b');
  assert.equal(h.movement.canMoveUnitTo(unit, 11, 10), false, 'reverse grant does not give access');
  h.diplomacy.toggleOpenBorders('b', 'a');
  assert.equal(h.movement.canMoveUnitTo(unit, 11, 10), true);
  assert.ok(h.pathfinding.findPath(unit, 11, 10));
  h.diplomacy.toggleOpenBorders('b', 'a');
  h.diplomacy.restoreState('a', 'b', { state: 'WAR' });
  assert.equal(h.movement.canMoveUnitTo(unit, 11, 10), true);
  target.territorialClaimNationId = 'a';
  assert.equal(h.movement.canMoveUnitTo(unit, 11, 10), true);
});

for (const organic of [true, false]) test(`${organic ? 'organic growth' : 'purchased tile'} lets an AI city absorb a human claim exactly once with diplomatic memory`, () => {
  const h = harness();
  h.nations.getNation('a')!.isHuman = false;
  h.nations.getNation('b')!.isHuman = true;
  const target = h.map.tiles[2][4]; target.territorialClaimNationId = 'b';
  const relation = { ...h.diplomacy.getRelation('b', 'a') };
  assert.ok(h.territory.getClaimableTiles(h.city, h.map).some(t => t.x === 4 && t.y === 2));
  h.territory.refreshNextExpansionTile(h.city, h.map);
  assert.equal(target.territorialClaimNationId, 'b', 'radius alone never absorbs');
  assert.equal(h.territory.setNextExpansionTile(h.city, target, h.map), true);
  h.city.culture = 1000;
  const acquired = organic ? h.territory.tryClaimNextExpansionTile(h.city, h.map) : h.territory.claimNextExpansionTileImmediately(h.city, h.map);
  assert.equal(acquired, true);
  assert.equal(target.ownerId, 'a');
  assert.equal(target.territorialClaimNationId, undefined);
  assert.ok(h.city.ownedTileCoords.some(t => t.x === 4 && t.y === 2));
  assert.equal(h.events.length, 1);
  const after = h.diplomacy.getRelation('b', 'a');
  assert.equal(after.trust, Math.max(0, relation.trust - 10));
  assert.equal(after.hostility, Math.min(100, relation.hostility + 10));
  assert.equal(after.suspicion, Math.min(100, relation.suspicion + 5));
  assert.equal(h.territory.claimTileForCity(h.city, target, h.map), false);
  assert.equal(h.events.length, 1);
});

test('own claim absorption has no incident; foreign claims outside stage radius survive bonuses', () => {
  const h = harness();
  h.city.settlementStage = 'Village';
  const own = h.map.tiles[2][4]; own.territorialClaimNationId = 'a';
  assert.equal(h.territory.claimTileForCity(h.city, own, h.map), true);
  assert.equal(h.events.length, 0);
  assert.equal(own.territorialClaimNationId, undefined);
  const far = h.map.tiles[2][6]; far.territorialClaimNationId = 'b';
  assert.equal(h.territory.claimTileForCity(h.city, far, h.map), false);
  assert.equal(far.territorialClaimNationId, 'b');
});

test('tile save/load roundtrip preserves claims; old saves clear stale claims and city ownership wins', () => {
  const h = harness(); h.claims.claimTerritory(h.surveyor);
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
  const restored = harness();
  SaveLoadService.restoreTiles(saved, restored.map);
  assert.equal(restored.map.tiles[7][7].territorialClaimNationId, 'a');
  assert.equal(restored.map.tiles[7][7].ownerId, undefined);
  const old = saved.map(({ territorialClaimNationId, ...tile }: any) => tile);
  SaveLoadService.restoreTiles(old, restored.map);
  assert.equal(restored.map.tiles[7][7].territorialClaimNationId, undefined);
  saved.find((t: any) => t.q === 7 && t.r === 7).ownerId = 'b';
  SaveLoadService.restoreTiles(saved, restored.map);
  assert.equal(restored.map.tiles[7][7].territorialClaimNationId, undefined);
});

test('HUD keeps unavailable Claim Territory visible with a reason and fires a single-use action', () => {
  const h = harness(); const ui = new UnitActionToolbox('a');
  ui.setClaimAvailabilityProvider(h.claims); ui.setSelectedUnit(h.surveyor);
  const seen: string[] = []; ui.onModeChanged(mode => seen.push(mode));
  assert.equal(ui.getHudActions().find(a => a.mode === 'claimTerritory')?.isAvailable, true);
  ui.tryActivate('claimTerritory'); assert.deepEqual(seen, ['claimTerritory']);
  h.nations.getResources('a').gold = 0; ui.refresh();
  const action = ui.getHudActions().find(a => a.mode === 'claimTerritory');
  assert.equal(action?.isAvailable, false); assert.match(action!.tooltip!, /200 Gold/);
});

test('claim tint is lighter in every RGB channel and Cities tutorial explains economic distinction', () => {
  assert.equal(getTerritorialClaimTint(0x225588), 0xa7bbcf);
  const tutorial = JSON.stringify(TUTORIAL_SECTIONS.find(s => s.id === 'cities'));
  for (const text of ['Early Empire', '100 Production', '200 Gold', '10 hex', 'no yields', 'Open Borders', 'without normal territorial border', 'Trust −10']) assert.ok(tutorial.includes(text), text);
});

test('AI-owned Surveyors cannot create claims even on a valid tile during their turn', () => {
  const h = harness();
  h.nations.getNation('a')!.isHuman = false;
  const gold = h.nations.getResources('a').gold;
  assert.equal(h.claims.getClaimPreview(h.surveyor).canClaim, false);
  assert.equal(h.claims.claimTerritory(h.surveyor), false);
  assert.equal(h.nations.getResources('a').gold, gold);
  assert.equal(h.units.getUnit(h.surveyor.id), h.surveyor);
  assert.equal(h.map.tiles[7][7].territorialClaimNationId, undefined);
});

test('foreign claim acquisition respects all four settlement radii', () => {
  for (const [stage, radius] of [['Village', 3], ['Town', 4], ['City', 5], ['Metropolis', 6]] as const) {
    const h = harness(); h.city.settlementStage = stage;
    for (let d = 2; d < radius; d++) {
      h.city.ownedTileCoords.push({ x: 2 + d, y: 2 });
      h.map.tiles[2][2 + d].ownerId = 'a';
    }
    const edge = h.map.tiles[2][2 + radius]; edge.territorialClaimNationId = 'b';
    const outside = h.map.tiles[2][3 + radius]; outside.territorialClaimNationId = 'b';
    assert.equal(h.territory.setNextExpansionTile(h.city, edge, h.map), true, stage);
    assert.equal(h.territory.claimNextExpansionTileImmediately(h.city, h.map), true, stage);
    assert.equal(h.events.length, 1);
    assert.equal(h.territory.setNextExpansionTile(h.city, outside, h.map), false, stage);
    assert.equal(outside.territorialClaimNationId, 'b');
  }
});
