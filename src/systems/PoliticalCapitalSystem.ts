import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { TurnManager } from './TurnManager';

export interface ResidenceRelocatedEvent {
  nationId: string;
  fromCity: City;
  toCity: City;
}

type ResidenceRelocatedListener = (event: ResidenceRelocatedEvent) => void;

export class PoliticalCapitalSystem {
  private readonly relocatedListeners: ResidenceRelocatedListener[] = [];

  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
  ) {}

  onResidenceRelocated(listener: ResidenceRelocatedListener): void {
    this.relocatedListeners.push(listener);
  }

  /**
   * Safety net run each round: guarantee every listed nation that still owns at
   * least one city has exactly one residence capital. The residence-capital flag
   * is what gates military vassalization on conquest, so a nation that silently
   * lost the flag (through a capture / relocation / save-load lifecycle edge) must
   * not become impossible to vassalize — otherwise grinding it to its last city
   * eliminates it outright instead of turning it into a vassal. Deterministic:
   * prefers the nation's own original-capital city when it still holds it, else its
   * lowest-id owned city. A no-op for nations that are already correct.
   */
  ensureResidenceCapitals(nationIds: readonly string[]): void {
    for (const nationId of nationIds) {
      const cities = this.cityManager.getCitiesByOwner(nationId);
      if (cities.length === 0) continue;
      const flaggedCount = cities.reduce((count, city) => count + (city.isResidenceCapital ? 1 : 0), 0);
      if (flaggedCount === 1) continue;
      const preferred = cities.find((city) => city.isOriginalCapital && city.originNationId === nationId)
        ?? [...cities].sort((a, b) => a.id.localeCompare(b.id))[0];
      // setResidenceCapital flags `preferred` and clears the flag on every other
      // city the nation owns, so both the 0-capital and >1-capital cases converge
      // to exactly one residence capital.
      this.cityManager.setResidenceCapital(nationId, preferred.id);
    }
  }

  handleCityCaptured(city: City, previousOwnerId: string): void {
    if (!city.isResidenceCapital) return;

    city.isResidenceCapital = false;
    if (!this.nationManager.getNation(previousOwnerId)) return;

    const next = this.cityManager.getCitiesByOwner(previousOwnerId)[0];
    if (!next) return;
    const relocated = this.cityManager.setResidenceCapital(previousOwnerId, next.id);
    if (!relocated) return;

    for (const listener of this.relocatedListeners) {
      listener({ nationId: previousOwnerId, fromCity: city, toCity: relocated });
    }
  }
}
