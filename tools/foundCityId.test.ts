import assert from 'node:assert/strict';
import { test } from 'node:test';

import { City } from '../src/entities/City.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { getNextFoundedCityNumber } from '../src/systems/FoundCitySystem.ts';

function city(id: string): City {
  return new City({
    id,
    name: id,
    ownerId: 'nation_england',
    tileX: 0,
    tileY: 0,
    isCapital: false,
  });
}

test('loaded founded-city ids advance the sequence instead of restarting it', () => {
  assert.equal(getNextFoundedCityNumber([
    city('city_nation_china_founded_1'),
    city('city_nation_england_founded_6'),
    city('authored_city_without_sequence'),
  ]), 7);
});

test('malformed founded-city suffixes do not affect the sequence', () => {
  assert.equal(getNextFoundedCityNumber([
    city('city_nation_england_founded_nope'),
    city('city_nation_england_founded_3_extra'),
  ]), 1);
});

test('CityManager rejects duplicate ids instead of overwriting a city silently', () => {
  const manager = new CityManager();
  manager.addCity(city('city_nation_england_founded_1'));

  assert.throws(
    () => manager.addCity(city('city_nation_england_founded_1')),
    /duplicate id/,
  );
  assert.equal(manager.getAllCities().length, 1);
});
