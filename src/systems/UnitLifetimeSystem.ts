import type { Unit } from '../entities/Unit';
import type { DiplomacyManager } from './DiplomacyManager';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';
import { isMilitaryUnitType } from '../utils/unitRoleUtils';

const WARTIME_EXTENSION_ROUNDS = 20;

type ExpirationLogger = (nationId: string, message: string) => void;
type BeforeExpireUnit = (unit: Unit) => void;

export class UnitLifetimeSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly logExpiration?: ExpirationLogger,
    private readonly beforeExpireUnit?: BeforeExpireUnit,
  ) {}

  handleRoundStart(round: number): void {
    const humanNationId = this.nationManager.getHumanNationId();
    const expiredUnits = this.unitManager.getAllUnits()
      .filter((unit) => unit.expiresAtRound !== undefined && round >= unit.expiresAtRound);

    for (const unit of expiredUnits) {
      if (!this.unitManager.getUnit(unit.id)) continue;
      if (unit.ownerId === humanNationId) continue;

      if (isMilitaryUnitType(unit.unitType) && this.isNationAtWar(unit.ownerId)) {
        unit.expiresAtRound! += WARTIME_EXTENSION_ROUNDS;
        this.logExtension(unit, round);
      } else {
        this.beforeExpireUnit?.(unit);
        this.unitManager.removeUnit(unit.id);
        this.logExpiredUnit(unit, round);
      }
    }
  }

  private isNationAtWar(nationId: string): boolean {
    for (const nation of this.nationManager.getAllNations()) {
      if (nation.id === nationId) continue;
      if (this.diplomacyManager.getState(nationId, nation.id) === 'WAR') return true;
    }
    return false;
  }

  private logExpiredUnit(unit: Unit, round: number): void {
    if (!this.logExpiration) return;
    this.logExpiration(unit.ownerId, `[r${round}] ${unit.name} expired after reaching service life.`);
  }

  private logExtension(unit: Unit, round: number): void {
    if (!this.logExpiration) return;
    this.logExpiration(unit.ownerId, `[r${round}] ${unit.name} service life extended due to wartime (+${WARTIME_EXTENSION_ROUNDS} rounds).`);
  }
}
