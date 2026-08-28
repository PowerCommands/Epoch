/** The population supported by a city with no qualifying infrastructure. */
export const BASE_CITY_POPULATION_CAPACITY = 6;

/**
 * Canonical population-capacity levels. Effective capacity is the highest
 * active level present in a city; these values are not additive bonuses.
 */
export const CITY_POPULATION_CAPACITY_LEVELS = Object.freeze({
  sewers: 8,
  aqueduct: 10,
  coalPowerPlant: 16,
  oilPowerPlant: 20,
  gasPowerPlant: 24,
  nuclearPowerPlant: 48,
});
