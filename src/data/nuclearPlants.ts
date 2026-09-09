import { airMissionRoll } from './airOperations';

export const NUCLEAR_PLANT_RISK_FRACTION = 0.5;
export const NUCLEAR_PLANT_MELTDOWN_CHANCE = 0.1;
export const NUCLEAR_PLANT_MELTDOWN_RADIUS = 2;
export const NUCLEAR_PLANT_MAINTENANCE_TURNS = 3;
export const MAINTAIN_NUCLEAR_PLANT = 'maintain_nuclear_plant';

export function nuclearPlantAtRisk(age: number, lifespan: number): boolean {
  return age > lifespan * NUCLEAR_PLANT_RISK_FRACTION;
}

/** Separate deterministic stream per city and absolute round; no mutable RNG to serialize. */
export function nuclearPlantRoll(cityId: string, round: number): number {
  return airMissionRoll(`nuclear-plant:${cityId}:round:${round}`);
}

export function nuclearPlantMaintenancePriority(age: number, lifespan: number): number {
  const fraction = age / lifespan;
  if (fraction < 0.3) return 0;
  if (fraction > 0.9) return 1000 + fraction * 100;
  if (fraction > NUCLEAR_PLANT_RISK_FRACTION) return 500 + fraction * 100;
  return 50 + (fraction - 0.3) * 1000;
}
