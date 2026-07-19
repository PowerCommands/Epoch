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
