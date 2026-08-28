import type { CityManager } from './CityManager';

const CONQUERED_TURNS = 30;
// Doubled from 5/2: Courthouse keeps the same proportional mitigation.
const BASE_PENALTY = 10;
const COURTHOUSE_PENALTY = 4;
const COURTHOUSE_BUILDING_ID = 'courthouse';

export class ConqueredCityUnhappinessSystem {
  constructor(private readonly cityManager: CityManager) {}

  /** Call on city capture to start the unrest countdown. */
  onCityCaptured(cityId: string): void {
    const city = this.cityManager.getCity(cityId);
    if (!city) return;
    city.recentlyConqueredTurnsRemaining = CONQUERED_TURNS;
  }

  /** Call once per round to tick down all active conquest timers. */
  handleRoundStart(): void {
    for (const city of this.cityManager.getAllCities()) {
      if (city.recentlyConqueredTurnsRemaining > 0) {
        city.recentlyConqueredTurnsRemaining -= 1;
      }
    }
  }

  getUnhappiness(nationId: string): number {
    let total = 0;
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      if (city.recentlyConqueredTurnsRemaining <= 0) continue;
      const hasCourthouse = this.cityManager.getBuildings(city.id).getAll().includes(COURTHOUSE_BUILDING_ID);
      total += hasCourthouse ? COURTHOUSE_PENALTY : BASE_PENALTY;
    }
    return total;
  }
}
