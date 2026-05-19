import type { UnitManager } from './UnitManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import { isMilitaryUnitType } from '../utils/unitRoleUtils';

export class MilitaryUnhappinessSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly nationManager: NationManager,
  ) {}

  getUnhappiness(nationId: string): number {
    const units = this.unitManager.getUnitsByOwner(nationId);
    const militaryCount = units.filter((u) => isMilitaryUnitType(u.unitType)).length;
    if (militaryCount === 0) return 0;
    const costPerUnit = this.isAggressorInAnyWar(nationId) ? 2 : 1;
    return militaryCount * costPerUnit;
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
