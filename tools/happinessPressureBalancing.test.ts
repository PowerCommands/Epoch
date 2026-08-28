import assert from 'node:assert/strict';
import test from 'node:test';

import { COURTHOUSE } from '../src/data/buildings.ts';
import { WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { ConqueredCityUnhappinessSystem } from '../src/systems/ConqueredCityUnhappinessSystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { MilitaryUnhappinessSystem } from '../src/systems/MilitaryUnhappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { calculateMilitaryOverCapUnhappiness } from '../src/systems/ai/AIMilitaryCapacity.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { buildHappinessTooltip } from '../src/ui/happinessFormat.ts';

const NATION_ID = 'nation_england';

test('military over-cap unhappiness follows the exact unit-minus-cap rule', () => {
  assert.equal(calculateMilitaryOverCapUnhappiness(5, 8), 0);
  assert.equal(calculateMilitaryOverCapUnhappiness(8, 8), 0);
  assert.equal(calculateMilitaryOverCapUnhappiness(9, 8), 1);
  assert.equal(calculateMilitaryOverCapUnhappiness(15, 8), 7);
});

test('effective-cap changes and disbanding are reflected immediately', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION_ID, name: 'England', color: 0xff0000 }));
  const units = new UnitManager(20, 1);
  for (let index = 0; index < 9; index += 1) {
    units.createUnit({ type: WARRIOR, ownerId: NATION_ID, tileX: index, tileY: 0 });
  }
  let effectiveCap = 8;
  const diplomacy = {
    getState: () => 'PEACE',
    getAggressorNationId: () => undefined,
  } as unknown as DiplomacyManager;
  const pressure = new MilitaryUnhappinessSystem(units, diplomacy, nations, () => effectiveCap);
  assert.equal(pressure.getOverCapUnhappiness(NATION_ID), 1);

  effectiveCap = 6; // represents an effective-cap modifier changing
  assert.equal(pressure.getOverCapUnhappiness(NATION_ID), 3);

  units.removeUnit(units.getUnitsByOwner(NATION_ID)[0].id);
  assert.equal(pressure.getOverCapUnhappiness(NATION_ID), 2);
});

test('conquered-city penalties are exactly doubled, including Courthouse mitigation', () => {
  const cities = new CityManager();
  const occupied = new City({ id: 'occupied', name: 'Occupied', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  occupied.recentlyConqueredTurnsRemaining = 30;
  cities.addCity(occupied);
  const pressure = new ConqueredCityUnhappinessSystem(cities);
  assert.equal(pressure.getUnhappiness(NATION_ID), 10);

  cities.getBuildings(occupied.id).add(COURTHOUSE);
  assert.equal(pressure.getUnhappiness(NATION_ID), 4);
  occupied.recentlyConqueredTurnsRemaining = 0;
  assert.equal(pressure.getUnhappiness(NATION_ID), 0);
});

test('energy shortage unhappiness is two per canonical shortage turn and sums by city', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION_ID, name: 'England', color: 0xff0000 }));
  const cities = new CityManager();
  const first = new City({ id: 'first', name: 'First', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  const second = new City({ id: 'second', name: 'Second', ownerId: NATION_ID, tileX: 1, tileY: 0 });
  cities.addCity(first);
  cities.addCity(second);
  const happiness = new HappinessSystem(nations, cities);

  for (const [turns, expected] of [[0, 0], [1, 2], [5, 10], [10, 20]] as const) {
    first.energyShortageTurns = turns === 0 ? undefined : turns;
    second.energyShortageTurns = undefined;
    happiness.recalculateNation(NATION_ID);
    assert.equal(happiness.getNationState(NATION_ID).unhappinessFromEnergyShortages, expected);
  }

  first.energyShortageTurns = 5;
  second.energyShortageTurns = 3;
  happiness.recalculateNation(NATION_ID);
  assert.equal(happiness.getNationState(NATION_ID).unhappinessFromEnergyShortages, 16);

  first.energyShortageTurns = undefined;
  second.energyShortageTurns = undefined;
  happiness.recalculateNation(NATION_ID);
  assert.equal(happiness.getNationState(NATION_ID).unhappinessFromEnergyShortages, 0);
});

test('the detailed Happiness breakdown exposes all three pressure sources', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION_ID, name: 'England', color: 0xff0000 }));
  const cities = new CityManager();
  const city = new City({ id: 'london', name: 'London', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  city.energyShortageTurns = 7;
  cities.addCity(city);
  const happiness = new HappinessSystem(
    nations, cities,
    undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined,
    () => 20,
    undefined, undefined,
    () => 8,
  );
  const tooltip = buildHappinessTooltip(happiness.getNationState(NATION_ID));
  assert.match(tooltip, /Military Over Capacity: -8/);
  assert.match(tooltip, /Conquered cities: -20/);
  assert.match(tooltip, /Energy Shortages: -14/);
});
