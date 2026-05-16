import type { City } from '../entities/City';
import type { CityManager } from './CityManager';
import type { NationManager } from './NationManager';
import type { NationCollapseSystem } from './NationCollapseSystem';
import type { TurnManager } from './TurnManager';
import type { UnitManager } from './UnitManager';

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
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly nationCollapseSystem: NationCollapseSystem,
  ) {
    this.turnManager.on('turnEnd', (event) => {
      this.finalizeLeaderRelocation(event.nation.id);
    });
  }

  onResidenceRelocated(listener: ResidenceRelocatedListener): void {
    this.relocatedListeners.push(listener);
  }

  handleCityCaptured(city: City, previousOwnerId: string, conquerorNationId: string): void {
    if (!city.isResidenceCapital) return;

    const evacuatedLeader = this.getActiveLeader(previousOwnerId);
    if (evacuatedLeader && !(evacuatedLeader.tileX === city.tileX && evacuatedLeader.tileY === city.tileY)) {
      city.isResidenceCapital = false;
      const fallback = this.cityManager.getCityAt(evacuatedLeader.tileX, evacuatedLeader.tileY);
      if (fallback && fallback.ownerId === previousOwnerId) {
        this.cityManager.setResidenceCapital(previousOwnerId, fallback.id);
      } else {
        const next = this.cityManager.getCitiesByOwner(previousOwnerId)[0];
        if (next) this.cityManager.setResidenceCapital(previousOwnerId, next.id);
      }
      return;
    }

    this.nationCollapseSystem.collapse({
      nationId: previousOwnerId,
      conquerorNationId,
      triggerCity: city,
      reason: 'residence_capital_captured_leader_present',
    });
  }

  private finalizeLeaderRelocation(nationId: string): void {
    if (!this.nationManager.getNation(nationId)) return;
    const leader = this.getActiveLeader(nationId);
    if (!leader) return;

    const currentResidence = this.cityManager.getResidenceCapital(nationId);
    const targetCity = this.cityManager.getCityAt(leader.tileX, leader.tileY);
    if (!currentResidence || !targetCity) return;
    if (targetCity.ownerId !== nationId) return;
    if (targetCity.id === currentResidence.id) return;

    const relocated = this.cityManager.setResidenceCapital(nationId, targetCity.id);
    if (!relocated) return;

    this.unitManager.removeUnit(leader.id);
    for (const listener of this.relocatedListeners) {
      listener({ nationId, fromCity: currentResidence, toCity: relocated });
    }
  }

  private getActiveLeader(nationId: string) {
    return this.unitManager.getUnitsByOwner(nationId).find((unit) => unit.unitType.id === 'leader');
  }
}
