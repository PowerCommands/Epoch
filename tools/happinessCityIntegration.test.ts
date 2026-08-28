/**
 * City-derived Happiness must obey the same occupation/recovery integration
 * model as every other city output: an Occupied city contributes 0% of its
 * building Happiness, a Recovering city 50%, and an Integrated city 100%.
 *
 * The recently-conquered unhappiness penalty is a separate, independent source
 * and is unchanged by this behavior.
 *
 * Run with: npx tsx --test tools/happinessCityIntegration.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { TEMPLE } from '../src/data/buildings';
import {
  CITY_OCCUPIED_TURNS,
  CITY_RECOVERING_TURNS,
} from '../src/systems/CityIntegrationSystem';

const TEMPLE_HAPPINESS = TEMPLE.modifiers.happinessPerTurn ?? 0;

interface Harness {
  happiness: HappinessSystem;
  city: City;
  setRound: (round: number) => void;
  setConqueredPenalty: (value: number) => void;
  recalc: () => void;
  buildingHappiness: () => number;
  conqueredUnhappiness: () => number;
}

function buildHarness(): Harness {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'mongolia', name: 'Mongolia', color: 0x2244ff }));
  const cities = new CityManager();
  const city = new City({ id: 'stockholm', name: 'Stockholm', ownerId: 'mongolia', tileX: 0, tileY: 0 });
  cities.addCity(city);
  cities.getBuildings(city.id).add(TEMPLE);

  let currentRound = 0;
  let conqueredPenalty = 0;

  const happiness = new HappinessSystem(
    nations,
    cities,
    undefined, // getNationModifiers
    undefined, // getAvailableLuxuryResources
    undefined, // policySystem
    undefined, // getCultureHappinessBonus
    undefined, // getCorporationHappinessBonus
    undefined, // getManufacturedResourceHappinessBonus
    undefined, // getMilitaryUnhappiness
    undefined, // getCityCountPressure
    undefined, // getDistancePressure
    () => conqueredPenalty, // getConqueredCityUnhappiness
    undefined, // getWarWeariness
    () => currentRound, // getCurrentRound
  );

  return {
    happiness,
    city,
    setRound: (round) => { currentRound = round; },
    setConqueredPenalty: (value) => { conqueredPenalty = value; },
    recalc: () => happiness.recalculateNation('mongolia'),
    buildingHappiness: () => happiness.getNationState('mongolia').happinessFromBuildings,
    conqueredUnhappiness: () => happiness.getNationState('mongolia').unhappinessFromConqueredCities,
  };
}

test('TEMPLE actually provides a positive Happiness baseline to test against', () => {
  assert.ok(TEMPLE_HAPPINESS > 0, 'TEMPLE must have happinessPerTurn > 0 for this test to be meaningful');
});

test('A: an integrated city contributes 100% of its building Happiness', () => {
  const h = buildHarness();
  // A freshly founded city has no integrationStartedRound => integrated.
  assert.equal(h.city.integrationStartedRound, undefined);
  h.recalc();
  assert.equal(h.buildingHappiness(), TEMPLE_HAPPINESS);
});

test('B: while Occupied, the same building contributes 0 Happiness', () => {
  const h = buildHarness();
  h.city.integrationStartedRound = 100;
  h.setRound(100); // elapsed 0 -> occupied
  h.recalc();
  assert.equal(h.buildingHappiness(), 0);
});

test('C: while Recovering, it contributes 50%', () => {
  const h = buildHarness();
  h.city.integrationStartedRound = 100;
  h.setRound(100 + CITY_OCCUPIED_TURNS); // elapsed == occupied window -> recovering
  h.recalc();
  assert.equal(h.buildingHappiness(), Math.round(TEMPLE_HAPPINESS * 0.5));
});

test('D: once Integrated again, it contributes 100%', () => {
  const h = buildHarness();
  h.city.integrationStartedRound = 100;
  h.setRound(100 + CITY_OCCUPIED_TURNS + CITY_RECOVERING_TURNS); // fully integrated
  h.recalc();
  assert.equal(h.buildingHappiness(), TEMPLE_HAPPINESS);
});

test('E: the recently-conquered unhappiness penalty is independent and unchanged', () => {
  const h = buildHarness();
  h.city.integrationStartedRound = 100;
  h.setRound(100); // occupied: building Happiness suppressed to 0
  h.setConqueredPenalty(7);
  h.recalc();
  // Building Happiness is suppressed by occupation...
  assert.equal(h.buildingHappiness(), 0);
  // ...but the separate conquered-city penalty still flows through untouched.
  assert.equal(h.conqueredUnhappiness(), 7);

  // The penalty is applied regardless of integration multiplier: it is the
  // same value once the city has fully integrated.
  h.setRound(100 + CITY_OCCUPIED_TURNS + CITY_RECOVERING_TURNS);
  h.recalc();
  assert.equal(h.buildingHappiness(), TEMPLE_HAPPINESS);
  assert.equal(h.conqueredUnhappiness(), 7);
});

test('conquest is not an immediate Happiness windfall: net effect of capture is not positive from buildings', () => {
  const h = buildHarness();
  h.recalc();
  const integratedBuildingHappiness = h.buildingHappiness();

  // Simulate capture: city becomes occupied this round.
  h.city.integrationStartedRound = 200;
  h.setRound(200);
  h.recalc();
  assert.equal(h.buildingHappiness(), 0);
  assert.ok(
    h.buildingHappiness() < integratedBuildingHappiness,
    'an occupied city must not immediately grant its full building Happiness',
  );
});
