/** Signed national Happiness effects, independent of contamination source. */
export const NUCLEAR_WASTE_HAPPINESS_PENALTY = -5;
export const FOSSIL_PLANT_HAPPINESS: Readonly<Record<string, number>> = {
  coal_power_plant: -5, oil_power_plant: -3, gas_power_plant: -1,
};
export interface EnvironmentalHappiness {
  coal: number; oil: number; gas: number; nuclearWaste: number;
}
export const EMPTY_ENVIRONMENT: EnvironmentalHappiness = { coal: 0, oil: 0, gas: 0, nuclearWaste: 0 };
