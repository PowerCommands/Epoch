import assert from 'node:assert/strict';
import test from 'node:test';
import { ARSENAL, CASTLE, WALLS } from '../src/data/buildings';
import { TUTORIAL_SECTIONS } from '../src/data/tutorialContent';
import type { City } from '../src/entities/City';
import type { Unit } from '../src/entities/Unit';
import type { CityManager } from '../src/systems/CityManager';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem';
import { resolveRangedVsCity, resolveUnitVsCity } from '../src/systems/CombatResolver';
import { CityDefenseSystem, getCityFortificationLevel } from '../src/systems/CityDefenseSystem';
import type { MapData } from '../src/types/map';

const city = { id: 'fortified-city' } as City;

function cityManagerWithActiveBuildings(buildingIds: string[]): CityManager {
  return {
    getBuildings: () => ({ getAll: () => [...buildingIds] }),
  } as unknown as CityManager;
}

test('fortifications are city-bound and use the increased production costs', () => {
  assert.deepEqual(
    [WALLS, CASTLE, ARSENAL].map((building) => ({
      id: building.id,
      placement: building.placement,
      cost: building.productionCost,
      defense: building.modifiers.cityDefensePercent,
    })),
    [
      { id: 'walls', placement: 'city', cost: 100, defense: 25 },
      { id: 'castle', placement: 'city', cost: 210, defense: 25 },
      { id: 'arsenal', placement: 'city', cost: 400, defense: 25 },
    ],
  );

  const placement = new BuildingPlacementSystem();
  assert.deepEqual(placement.getValidPlacementCoords(city, WALLS, { tiles: [] } as unknown as MapData), []);
});

test('active fortifications add defense percentages and reduce incoming damage reciprocally', () => {
  const defense = new CityDefenseSystem(
    undefined,
    cityManagerWithActiveBuildings([WALLS.id, CASTLE.id, ARSENAL.id]),
  );

  assert.equal(defense.getFortificationDefensePercent(city), 75);
  assert.equal(defense.getDefenseMultiplier(city), 1.75);
  assert.equal(defense.getEffectiveDefense(city), 43);
  assert.equal(defense.getDamageTakenMultiplier(city), 1 / 1.75);
});

test('only active building ids supplied by CityBuildings contribute defense', () => {
  const defense = new CityDefenseSystem(undefined, cityManagerWithActiveBuildings([WALLS.id]));
  assert.equal(defense.getFortificationDefensePercent(city), 25);
  assert.equal(defense.getEffectiveDefense(city), 31);
});

test('visual fortification levels count only active Walls, Castle, and Arsenal', () => {
  const active = new Set([WALLS.id, ARSENAL.id]);
  assert.equal(getCityFortificationLevel({ hasActive: (buildingId) => active.has(buildingId) }), 2);
  active.add(CASTLE.id);
  assert.equal(getCityFortificationLevel({ hasActive: (buildingId) => active.has(buildingId) }), 3);
  active.clear();
  assert.equal(getCityFortificationLevel({ hasActive: (buildingId) => active.has(buildingId) }), 0);
});

test('the fortification multiplier strengthens retaliation and protects against melee and ranged damage', () => {
  const fortifiedCity = { ...city, health: 200 } as City;
  const attacker = {
    health: 100,
    unitType: { baseHealth: 100, baseStrength: 20, rangedStrength: 20 },
  } as Unit;
  const defense = new CityDefenseSystem(
    undefined,
    cityManagerWithActiveBuildings([WALLS.id, CASTLE.id, ARSENAL.id]),
  );
  const modifiers = {
    cityDefenseMultiplier: defense.getDefenseMultiplier(fortifiedCity),
    cityDamageTakenMultiplier: defense.getDamageTakenMultiplier(fortifiedCity),
  };

  const melee = resolveUnitVsCity(attacker, fortifiedCity, modifiers);
  const ranged = resolveRangedVsCity(attacker, fortifiedCity, modifiers);
  assert.equal(melee.attackerDamageTaken, 22);
  assert.equal(melee.cityDamageTaken, 11);
  assert.equal(ranged.cityDamageTaken, 11);
});

test('the Cities tutorial documents defense mechanics and the visual fortification ring', () => {
  const cities = TUTORIAL_SECTIONS.find((section) => section.id === 'cities');
  const text = JSON.stringify(cities?.blocks ?? []);
  assert.match(text, /City Defense/);
  assert.match(text, /Walls, Castle and Arsenal/);
  assert.match(text, /31, 37 and 43/);
  assert.match(text, /dark-gray ring/);
  assert.match(text, /Broken fortifications/);
});
