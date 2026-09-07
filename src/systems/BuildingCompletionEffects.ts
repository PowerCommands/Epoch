import type { BuildingType } from '../entities/Building';
import type { City } from '../entities/City';

/** Apply data-driven, one-time effects after construction has completed successfully. */
export function applyBuildingCompletionEffects(city: City, building: BuildingType): void {
  city.population += building.populationOnCompletion ?? 0;
}
