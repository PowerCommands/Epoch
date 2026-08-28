import type { UnitManager } from './UnitManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import {
  calculateMilitaryOverCapUnhappiness,
  countMilitaryUnits,
} from './ai/AIMilitaryCapacity';

export class MilitaryUnhappinessSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
    private readonly getEffectiveMilitaryUnitCap: (nationId: string) => number = () => Number.POSITIVE_INFINITY,
  ) {}

  getUnhappiness(nationId: string): number {
    const militaryCount = countMilitaryUnits(this.unitManager.getUnitsByOwner(nationId));
    if (militaryCount === 0) return 0;
    const costPerUnit = this.isAggressorInAnyWar(nationId) ? 2 : 1;
    return militaryCount * costPerUnit;
  }

  getOverCapUnhappiness(nationId: string): number {
    return calculateMilitaryOverCapUnhappiness(
      countMilitaryUnits(this.unitManager.getUnitsByOwner(nationId)),
      this.getEffectiveMilitaryUnitCap(nationId),
    );
  }

  private isAggressorInAnyWar(nationId: string): boolean {
    for (const other of this.nationManager.getAllNations()) {
      if (other.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, other.id) !== 'WAR') continue;
      if (this.diplomacyManager.getAggressorNationId(nationId, other.id) === nationId) return true;
    }
    return false;
  }
}
