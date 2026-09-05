/**
 * Human-player city-capture decision (Keep / Liberate / Raze).
 *
 * Covers the pure eligibility rules, the Liberate and Raze operations, and the
 * CombatSystem trigger wiring (human capture defers collapse and flags the
 * decision; AI capture and resolved capital vassalization do not).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CityTerritorySystem } from '../src/systems/CityTerritorySystem.ts';
import { CulturalSphereSystem } from '../src/systems/CulturalSphereSystem.ts';
import { CityIntegrationSystem, getCityIntegrationProgress } from '../src/systems/CityIntegrationSystem.ts';
import {
  canLiberateCapturedCity,
  getAvailableCaptureOutcomes,
  liberateCapturedCity,
  razeCapturedCity,
} from '../src/systems/CityCaptureDecision.ts';
import { CombatSystem, type CityCombatEvent } from '../src/systems/CombatSystem.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import type { NationCollapseSystem } from '../src/systems/NationCollapseSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { WonderSystem } from '../src/systems/WonderSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const HUMAN = 'nation_england';
const OCCUPIER = 'nation_germany';
const FOUNDER = 'nation_france';

function makeMap(width = 8, height = 8): MapData {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push({ x, y, type: TileType.Plains, ownerId: undefined });
    tiles.push(row);
  }
  return { width, height, tileSize: 32, tiles } as unknown as MapData;
}

// ─── Part 1: eligibility ────────────────────────────────────────────────────

test('human captures a city from its original owner: Keep + Raze, no Liberate', () => {
  const input = { originNationId: FOUNDER, previousOwnerId: FOUNDER, captorNationId: HUMAN };
  assert.equal(canLiberateCapturedCity(input), false);
  assert.deepEqual(getAvailableCaptureOutcomes(input), ['keep', 'raze']);
});

test('human captures a city occupied by a third nation: Keep + Liberate + Raze', () => {
  const input = { originNationId: FOUNDER, previousOwnerId: OCCUPIER, captorNationId: HUMAN };
  assert.equal(canLiberateCapturedCity(input), true);
  assert.deepEqual(getAvailableCaptureOutcomes(input), ['keep', 'liberate', 'raze']);
});

test('human recaptures a city it originally founded: Keep + Raze, no Liberate', () => {
  const input = { originNationId: HUMAN, previousOwnerId: OCCUPIER, captorNationId: HUMAN };
  assert.equal(canLiberateCapturedCity(input), false);
  assert.deepEqual(getAvailableCaptureOutcomes(input), ['keep', 'raze']);
});

// ─── Part 2: Liberate operation ─────────────────────────────────────────────

function ownershipHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: HUMAN, name: 'England', color: 0xc8102e }));
  nationManager.addNation(new Nation({ id: OCCUPIER, name: 'Germany', color: 0x000000 }));
  nationManager.addNation(new Nation({ id: FOUNDER, name: 'France', color: 0x002395 }));

  const mapData = makeMap();
  const gridSystem = new HexGridSystem();
  const cityManager = new CityManager();
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happiness);
  const cityTerritorySystem = new CityTerritorySystem(undefined, gridSystem);
  const culturalSphereSystem = new CulturalSphereSystem();
  const cityIntegrationSystem = new CityIntegrationSystem(cityManager, turnManager);
  const wonderSystem = new WonderSystem();

  // Paris: founded by France, currently held by the human (as if just captured).
  const city = new City({
    id: 'city_paris', name: 'Paris', ownerId: HUMAN, originNationId: FOUNDER,
    tileX: 3, tileY: 3, isCapital: false,
  });
  city.population = 3;
  cityManager.addCity(city);

  const owned = [{ x: 3, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 3 }];
  city.ownedTileCoords = owned.map((c) => ({ ...c }));
  for (const c of owned) mapData.tiles[c.y][c.x].ownerId = HUMAN;

  return {
    nationManager, mapData, gridSystem, cityManager, turnManager, productionSystem,
    cityTerritorySystem, culturalSphereSystem, cityIntegrationSystem, wonderSystem, city, owned,
  };
}

test('Liberate returns the city to its original nation, integrated, with no stale human ownership', () => {
  const h = ownershipHarness();
  h.turnManager.restoreTurnState(40, 0);

  liberateCapturedCity(h.city, {
    cityManager: h.cityManager,
    cityTerritorySystem: h.cityTerritorySystem,
    culturalSphereSystem: h.culturalSphereSystem,
    cityIntegrationSystem: h.cityIntegrationSystem,
    productionSystem: h.productionSystem,
    mapData: h.mapData,
    gridSystem: h.gridSystem,
  });

  // Owner becomes the founder.
  assert.equal(h.city.ownerId, FOUNDER);
  assert.equal(h.cityManager.getCity('city_paris')?.ownerId, FOUNDER);
  assert.equal(h.cityManager.getCitiesByOwner(HUMAN).length, 0);

  // Territory returns to the founder — no tile left owned by the human.
  for (const c of h.owned) assert.equal(h.mapData.tiles[c.y][c.x].ownerId, FOUNDER);

  // The city is integrated immediately for its founder (not occupied).
  assert.equal(h.city.integrationStartedRound, undefined);
  assert.equal(getCityIntegrationProgress(h.city, 40).state, 'integrated');
  assert.equal(h.city.occupiedOriginalNationId, undefined);
});

// ─── Part 3: Raze operation ─────────────────────────────────────────────────

test('Raze destroys the city, unclaims only its territory, and removes its artefacts', () => {
  const h = ownershipHarness();

  // Give the city a building record, a wonder, an improvement and a natural
  // resource with an economic owner on its own tiles.
  h.cityManager.getBuildings('city_paris').addEntry('market', false);
  h.wonderSystem.restoreCompletedWonder({ wonderId: 'pyramids', cityId: 'city_paris', ownerId: HUMAN, completedTurn: 1 });
  const improvedTile = h.mapData.tiles[3][4];
  improvedTile.improvementId = 'farm';
  improvedTile.improvementOwnerId = HUMAN;
  improvedTile.resourceId = 'iron';
  improvedTile.resourceOwnerNationId = HUMAN;
  h.mapData.tiles[3][3].cultureOwnerId = HUMAN;
  h.mapData.tiles[3][3].cultureSourceCityId = 'city_paris';

  // A neighbouring city's tile must survive untouched.
  const neighbourTile = h.mapData.tiles[6][6];
  neighbourTile.ownerId = OCCUPIER;
  neighbourTile.improvementId = 'mine';

  // The capturing unit sits on the city tile.
  const unitManager = new UnitManager(h.mapData.width, h.mapData.height);
  const meleeType = { id: 'melee', name: 'Melee', baseHealth: 100, baseStrength: 10, movementPoints: 2, range: 1 } as unknown as UnitType;
  const captor = new Unit({ id: 'u1', name: 'Legion', ownerId: HUMAN, unitType: meleeType, tileX: 3, tileY: 3 });
  unitManager.addUnit(captor);

  const result = razeCapturedCity(h.city, {
    cityManager: h.cityManager,
    productionSystem: h.productionSystem,
    wonderSystem: h.wonderSystem,
    mapData: h.mapData,
  });

  // City no longer exists.
  assert.equal(h.cityManager.getCity('city_paris'), undefined);
  assert.equal(h.cityManager.getCitiesByOwner(HUMAN).length, 0);

  // Wonder removed (globally available again), reported by the result.
  assert.deepEqual(result.removedWonderIds, ['pyramids']);
  assert.equal(h.wonderSystem.isWonderBuilt('pyramids'), false);

  // Its territory is unclaimed and stripped of improvements/buildings.
  for (const c of h.owned) {
    const tile = h.mapData.tiles[c.y][c.x];
    assert.equal(tile.ownerId, undefined, `tile ${c.x},${c.y} owner cleared`);
  }
  assert.equal(improvedTile.improvementId, undefined);
  assert.equal(improvedTile.improvementOwnerId, undefined);
  assert.equal(improvedTile.resourceOwnerNationId, undefined);
  // Natural terrain resource stays on the land.
  assert.equal(improvedTile.resourceId, 'iron');
  // Cultural marker sourced from this city is gone.
  assert.equal(h.mapData.tiles[3][3].cultureOwnerId, undefined);
  assert.equal(h.mapData.tiles[3][3].cultureSourceCityId, undefined);

  // Neighbour territory untouched.
  assert.equal(neighbourTile.ownerId, OCCUPIER);
  assert.equal(neighbourTile.improvementId, 'mine');

  // The capturing unit survives on the former city tile.
  assert.equal(unitManager.getUnitAt(3, 3)?.id, 'u1');
});

// ─── Part 4: CombatSystem trigger wiring ────────────────────────────────────

function meleeType(strength: number): UnitType {
  return { id: 'melee', name: 'Melee', baseHealth: 100, baseStrength: strength, movementPoints: 2, range: 1 } as unknown as UnitType;
}

const gridStub = {
  getDistance: () => 1,
  isAdjacent: () => true,
  getTilesInRange: () => [],
  getAdjacentCoords: () => [],
} as unknown as IGridSystem;

const CITY_X = 3;
const CITY_Y = 3;

function combatHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: HUMAN, name: 'England', color: 0xc8102e }));
  nationManager.addNation(new Nation({ id: OCCUPIER, name: 'Germany', color: 0x000000 }));

  const mapData = makeMap();
  const cityManager = new CityManager();
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happiness);
  const unitManager = new UnitManager(mapData.width, mapData.height);
  const diplomacy = new DiplomacyManager(turnManager);

  const collapses: string[] = [];
  const collapseStub = {
    collapse: (input: { nationId: string }) => { collapses.push(input.nationId); return null; },
  } as unknown as NationCollapseSystem;

  const combat = new CombatSystem(
    unitManager, turnManager, cityManager, productionSystem, mapData, diplomacy,
    gridStub, () => false, undefined, () => false, undefined, collapseStub, undefined,
  );
  combat.setHumanCaptureDecisionPredicate((_city, _previousOwnerId, captorNationId) => captorNationId === HUMAN);

  const events: CityCombatEvent[] = [];
  combat.onCityCombat((e) => events.push(e));

  const addCity = (
    options: { ownerId: string; originNationId: string; isResidenceCapital?: boolean },
  ): City => {
    const isResidenceCapital = options.isResidenceCapital ?? false;
    const city = new City({
      id: 'city_target', name: 'Cologne', ownerId: options.ownerId, originNationId: options.originNationId,
      tileX: CITY_X, tileY: CITY_Y, isCapital: isResidenceCapital,
    });
    city.health = 21;
    city.isResidenceCapital = isResidenceCapital;
    cityManager.addCity(city);
    return city;
  };

  const addAttacker = (nationId: string): Unit => {
    const unit = new Unit({ id: 'atk', name: 'Legion', ownerId: nationId, unitType: meleeType(100), tileX: CITY_X, tileY: CITY_Y - 1 });
    unitManager.addUnit(unit);
    return unit;
  };

  const attack = (unit: Unit): void => {
    unit.movementPoints = unit.maxMovementPoints;
    combat.tryAttack(unit, CITY_X, CITY_Y, { allowOutOfTurn: true });
  };

  return { combat, cityManager, diplomacy, events, collapses, addCity, addAttacker, attack };
}

test('a human capture flags the decision and defers the previous owner collapse', () => {
  const h = combatHarness();
  h.diplomacy.declareWar(HUMAN, OCCUPIER);
  const city = h.addCity({ ownerId: OCCUPIER, originNationId: OCCUPIER });
  const attacker = h.addAttacker(HUMAN);

  h.attack(attacker);

  const captured = h.events.find((e) => e.captured);
  assert.ok(captured, 'a capture event was emitted');
  assert.equal(captured.pendingHumanCaptureDecision, true);
  assert.equal(captured.previousOwnerId, OCCUPIER);
  assert.equal(city.ownerId, HUMAN, 'the city is held by the human until the decision runs');
  // Collapse of the now-cityless previous owner is deferred to the decision flow.
  assert.deepEqual(h.collapses, []);
});

test('an AI capture keeps resolving synchronously with no decision flag', () => {
  const h = combatHarness();
  // The AI (Germany) captures the human's only city; the human is the previous owner.
  h.diplomacy.declareWar(OCCUPIER, HUMAN);
  h.addCity({ ownerId: HUMAN, originNationId: HUMAN });
  const attacker = h.addAttacker(OCCUPIER);

  h.attack(attacker);

  const captured = h.events.find((e) => e.captured);
  assert.ok(captured, 'a capture event was emitted');
  assert.ok(!captured.pendingHumanCaptureDecision, 'AI capture is never flagged for the human dialog');
  // Previous owner (human) had only this city, so synchronous collapse ran.
  assert.deepEqual(h.collapses, [HUMAN]);
});

test('a resolved capital vassalization is not routed to the human decision dialog', () => {
  const h = combatHarness();
  h.combat.setCapitalCaptureResolver(() => true); // vassalization resolves the capture
  h.diplomacy.declareWar(HUMAN, OCCUPIER);
  const city = h.addCity({ ownerId: OCCUPIER, originNationId: OCCUPIER, isResidenceCapital: true });
  const attacker = h.addAttacker(HUMAN);

  h.attack(attacker);

  const captured = h.events.find((e) => e.captured);
  assert.ok(captured, 'a capture event was emitted');
  assert.equal(captured.capitalVassalizationResolved, true);
  assert.ok(!captured.pendingHumanCaptureDecision, 'an already-resolved capital capture skips the dialog');
  assert.equal(city.name, 'Cologne');
});
