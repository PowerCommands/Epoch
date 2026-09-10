import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CULTURE_TREE } from '../src/data/cultureTree';
import { isNaturalResourceRevealed } from '../src/data/naturalResources';
import { MONUMENT, MUSEUM, LIBRARY, BROADCAST_TOWER } from '../src/data/buildings';
import { SCOUT, SCOUT_BOAT, WARRIOR, FIGHTER } from '../src/data/units';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import { NationManager } from '../src/systems/NationManager';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { PolicySystem } from '../src/systems/PolicySystem';
import { CityManager } from '../src/systems/CityManager';
import { UnitManager } from '../src/systems/UnitManager';
import { TurnManager } from '../src/systems/TurnManager';
import { CityIntegrationSystem, getCityIntegrationProgress } from '../src/systems/CityIntegrationSystem';
import { CultureEffectSystem } from '../src/systems/culture/CultureEffectSystem';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { VisibilitySystem, getExplorationVisionRadius } from '../src/systems/VisibilitySystem';
import { getGameSpeedById } from '../src/data/gameSpeeds';
import { TileType, type MapData } from '../src/types/map';

const NEW_POLICIES = ['mercenary_contracts', 'archives', 'civil_administration', 'phantom_of_the_opera', 'national_infrastructure', 'free_society'];

function harness() {
  const nations = new NationManager();
  for (const id of ['human', 'ai']) nations.addNation(new Nation({
    id, name: id, color: 0, isHuman: id === 'human',
    unlockedCultureNodeIds: CULTURE_TREE.map((node) => node.id),
  }));
  const policies = new PolicySystem(nations);
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'City', ownerId: 'human', originNationId: 'ai', tileX: 0, tileY: 0 });
  cities.addCity(city);
  const turns = new TurnManager(nations);
  return { nations, policies, cities, city, turns };
}

test('new policies are human-only, survive policy saves, and have unique PNG artwork', () => {
  const { nations, policies } = harness();
  const images = new Set<string>();
  for (const id of NEW_POLICIES) {
    assert.equal(policies.activatePolicy('ai', id), false);
    assert.equal(policies.getUnlockedPolicies('ai').some((p) => p.id === id), false);
    assert.equal(policies.activatePolicy('human', id), true);
    const saved = policies.getActivePolicyAssignments('human');
    const restored = new PolicySystem(nations);
    restored.loadNationPolicies('human', saved);
    assert.deepEqual(restored.getActivePolicyAssignments('human'), saved);
    restored.loadNationPolicies('ai', saved);
    assert.deepEqual(restored.getActivePolicyAssignments('ai'), []);
    policies.deactivatePolicy('human', id);
    const bytes = readFileSync(`public/assets/sprites/policies/${id}.png`);
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
    images.add(bytes.toString('base64'));
  }
  assert.equal(images.size, NEW_POLICIES.length);
});

test('Mercenaries and Mobilization split the upkeep discount and stack to 20%', () => {
  const { policies } = harness();
  policies.activatePolicy('human', 'mercenary_contracts');
  assert.equal(policies.getUnitUpkeepPercentModifier('human'), -10);
  policies.activatePolicy('human', 'war_economy');
  assert.equal(policies.getUnitUpkeepPercentModifier('human'), -20);
  policies.deactivatePolicy('human', 'mercenary_contracts');
  assert.equal(policies.getUnitUpkeepPercentModifier('human'), -10);
});

test('Civil Administration completes integration in 25 rounds and cannot double-advance a round', () => {
  const h = harness();
  h.policies.activatePolicy('human', 'civil_administration');
  const system = new CityIntegrationSystem(h.cities, h.turns, undefined, undefined,
    (id) => h.policies.getPercentModifierTotal(id, 'cityIntegrationSpeedPercent'));
  system.handleConquest(h.city, 'ai', 'human');
  const start = h.city.integrationStartedRound!;
  system.handleRoundStart(start + 12);
  assert.equal(getCityIntegrationProgress(h.city, start + 12).state, 'occupied');
  assert.equal(h.city.integrationBonusTurns, 12);
  system.handleRoundStart(start + 12);
  assert.equal(h.city.integrationBonusTurns, 12);
  system.handleRoundStart(start + 13);
  assert.equal(getCityIntegrationProgress(h.city, start + 13).state, 'recovering');
  system.handleRoundStart(start + 24);
  assert.equal(getCityIntegrationProgress(h.city, start + 24).state, 'recovering');
  system.handleRoundStart(start + 25);
  assert.equal(getCityIntegrationProgress(h.city, start + 25).state, 'integrated');
});

test('integration retains earned acceleration after removing the card and restores progress without replay', () => {
  const h = harness();
  const system = new CityIntegrationSystem(h.cities, h.turns, undefined, undefined,
    (id) => h.policies.getPercentModifierTotal(id, 'cityIntegrationSpeedPercent'));
  system.handleConquest(h.city, 'ai', 'human');
  const start = h.city.integrationStartedRound!;
  system.handleRoundStart(start + 10);
  h.policies.activatePolicy('human', 'civil_administration');
  system.handleRoundStart(start + 20);
  assert.equal(h.city.integrationBonusTurns, 10);
  h.policies.deactivatePolicy('human', 'civil_administration');
  const restoredCities = new CityManager();
  const restored = restoredCities.restoreCity(JSON.parse(JSON.stringify(h.city)));
  const restoredSystem = new CityIntegrationSystem(restoredCities, h.turns);
  restoredSystem.handleRoundStart(start + 20);
  assert.equal(restored.integrationBonusTurns, 10);
  restoredSystem.handleRoundStart(start + 39);
  assert.equal(getCityIntegrationProgress(restored, start + 39).state, 'recovering');
  restoredSystem.handleRoundStart(start + 40);
  assert.equal(getCityIntegrationProgress(restored, start + 40).state, 'integrated');
  system.handleConquest(h.city, 'human', 'ai');
  assert.equal(h.city.integrationBonusTurns, undefined);
  assert.equal(h.city.integrationStartedRound, undefined);
});

test('infrastructure movement covers land, naval and aircraft, waits for refresh, and survives reloads', () => {
  const { policies } = harness();
  const units = new UnitManager(20, 20);
  units.setMovementBonusProvider((id) => policies.getFlatModifierTotal(id, 'unitMovementFlat'));
  const existing = units.createUnit({ type: SCOUT, ownerId: 'human', tileX: 0, tileY: 0 });
  const base = existing.maxMovementPoints;
  existing.movementPoints = 1;
  policies.activatePolicy('human', 'national_infrastructure');
  assert.equal(existing.movementPoints, 1);
  units.resetMovementForOwner('human');
  assert.equal(existing.maxMovementPoints, base + 3);
  assert.equal(existing.movementPoints, base + 3);
  for (const [i, type] of [WARRIOR, SCOUT_BOAT, FIGHTER].entries()) {
    const unit = units.createUnit({ type, ownerId: 'human', tileX: i + 1, tileY: 0 });
    assert.equal(unit.maxMovementPoints, type.movementPoints + getGameSpeedById(undefined).movementBonus + 3);
  }
  const ai = units.createUnit({ type: SCOUT, ownerId: 'ai', tileX: 5, tileY: 0 });
  assert.equal(ai.maxMovementPoints, base);
  existing.movementPoints = 0;
  policies.deactivatePolicy('human', 'national_infrastructure');
  policies.activatePolicy('human', 'national_infrastructure');
  assert.equal(existing.movementPoints, 0);
  policies.deactivatePolicy('human', 'national_infrastructure');
  const restoredUnits = new UnitManager(20, 20);
  const restored = restoredUnits.restoreUnit(JSON.parse(JSON.stringify(existing)));
  assert.equal(restored.maxMovementPoints, base + 3);
  assert.equal(restored.movementPoints, 0);
  units.resetMovementForOwner('human');
  assert.equal(existing.movementPoints, base);
});

test('Exploration increases actual scout visibility to eight tiles and leaves other units unchanged', () => {
  const map: MapData = { width: 22, height: 1, tileSize: 32, tiles: [Array.from({ length: 22 }, (_, x) => ({ x, y: 0, type: TileType.Plains }))] };
  const visibility = new VisibilitySystem(map, new HexGridSystem());
  for (const id of ['scout', 'scout_boat']) {
    visibility.update([], [{ tileX: 0, tileY: 0, visibilityRadius: getExplorationVisionRadius(id, false) }]);
    assert.equal(visibility.isVisible(8, 0), false);
    visibility.update([], [{ tileX: 0, tileY: 0, visibilityRadius: getExplorationVisionRadius(id, true) }]);
    assert.equal(visibility.isVisible(8, 0), true);
    assert.equal(visibility.isVisible(9, 0), false);
  }
  assert.equal(getExplorationVisionRadius('warrior', true), 3);
});

test('Natural History gates Shipwrecks while Humanism still reveals land archaeology', () => {
  const reveal = (resource: string, culture: string) => isNaturalResourceRevealed(resource, {
    isTechnologyResearched: () => true, isCultureNodeUnlocked: (id) => id === culture,
  });
  assert.equal(reveal('shipwreck', 'humanism'), false);
  assert.equal(reveal('shipwreck', 'natural_history'), true);
  assert.equal(reveal('ancient_pottery', 'humanism'), true);
});

test('Games and Democracy grant permanent happiness and Enlightenment no longer does', () => {
  const { nations } = harness();
  const nation = nations.getNation('human')!;
  const effects = new CultureEffectSystem(nations, () => 0);
  nation.unlockedCultureNodeIds = ['enlightenment'];
  assert.equal(effects.getCultureHappinessBonus('human'), 0);
  nation.unlockedCultureNodeIds.push('democracy');
  assert.equal(effects.getCultureHappinessBonus('human'), 2);
  nation.unlockedCultureNodeIds.push('games_recreation');
  assert.equal(effects.getCultureHappinessBonus('human'), 4);
});

test('Archives, Phantom and Free Society change actual city yields and influence only while active', () => {
  const h = harness();
  const map: MapData = { width: 1, height: 1, tileSize: 32, tiles: [[{ x: 0, y: 0, type: TileType.Plains, ownerId: 'human' }]] };
  const buildings = h.cities.getBuildings(h.city.id);
  buildings.add(MONUMENT);
  buildings.add(MUSEUM);
  buildings.add(LIBRARY);
  buildings.add(BROADCAST_TOWER);
  buildings.setBroken(MUSEUM.id, true);
  const happiness = new HappinessSystem(h.nations, h.cities);
  const resources = new ResourceSystem(h.nations, h.cities, h.turns, new TileResourceGenerator(), map,
    new HexGridSystem(), happiness, undefined, undefined, undefined, h.policies);
  const yields = () => {
    resources.recalculateForNation('human');
    return { ...h.cities.getResources(h.city.id) };
  };
  const base = yields();
  h.policies.activatePolicy('human', 'archives');
  const archives = yields();
  assert.equal(archives.culturePerTurn, base.culturePerTurn + 1);
  assert.equal(archives.sciencePerTurn, base.sciencePerTurn + 1);
  h.policies.activatePolicy('human', 'phantom_of_the_opera');
  assert.equal(yields().culturePerTurn, archives.culturePerTurn + 2, 'only the active Monument and Broadcast Tower count');
  h.policies.deactivatePolicy('human', 'phantom_of_the_opera');
  const beforeFree = yields();
  const influence = h.nations.getResources('human').influencePerTurn;
  h.policies.activatePolicy('human', 'free_society');
  yields();
  assert.equal(h.nations.getResources('human').influencePerTurn, influence + 2);
  assert.equal(yields().culturePerTurn, Math.round(beforeFree.culturePerTurn * 1.1));
  h.policies.deactivatePolicy('human', 'free_society');
  h.policies.deactivatePolicy('human', 'archives');
  assert.equal(yields().culturePerTurn, base.culturePerTurn);
});


test('an Exploration scout makes diplomatic contact with foreign units inside its extended sight', () => {
  const h = harness();
  h.nations.getNation('human')!.unlockedCultureNodeIds = [];
  h.nations.getNation('ai')!.unlockedCultureNodeIds = [];
  const units = new UnitManager(20, 1);
  units.createUnit({ type: SCOUT, ownerId: 'human', tileX: 0, tileY: 0 });
  units.createUnit({ type: WARRIOR, ownerId: 'ai', tileX: 8, tileY: 0 });
  const discovery = new DiscoverySystem(h.nations, new CityManager(), units, new HexGridSystem());
  discovery.scan();
  assert.equal(discovery.hasMet('human', 'ai'), false);
  h.nations.getNation('human')!.unlockedCultureNodeIds.push('exploration');
  discovery.scan();
  assert.equal(discovery.hasMet('human', 'ai'), true);
});
