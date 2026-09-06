/** The population supported by a city with no qualifying infrastructure. */
export const BASE_CITY_POPULATION_CAPACITY = 6;

/** Canonical additive bonuses; the base capacity is applied separately. */
export const CITY_POPULATION_CAPACITY_BONUSES = Object.freeze({
  sewers: 2,
  aqueduct: 2,
  hospital: 4,
  hydroPlant: 4,
  medicalLab: 2,
  coalPowerPlant: 6,
  oilPowerPlant: 10,
  gasPowerPlant: 14,
  nuclearPowerPlant: 38,
});
