import type { Unit } from '../entities/Unit';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';

type ExpirationLogger = (nationId: string, message: string) => void;
type BeforeExpireUnit = (unit: Unit) => void;

export class UnitLifetimeSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
    private readonly logExpiration?: ExpirationLogger,
    private readonly beforeExpireUnit?: BeforeExpireUnit,
  ) {}

  handleRoundStart(round: number): void {
    const expiredUnits = this.unitManager.getAllUnits()
      .filter((unit) => unit.expiresAtRound !== undefined && round >= unit.expiresAtRound);

    for (const unit of expiredUnits) {
      if (!this.unitManager.getUnit(unit.id)) continue;
      this.beforeExpireUnit?.(unit);
      this.unitManager.removeUnit(unit.id);
      this.logExpiredUnit(unit, round);
    }
  }

  private logExpiredUnit(unit: Unit, _round: number): void {
    if (!this.logExpiration) return;
    this.logExpiration(unit.ownerId, `${unit.name} expired after long exploration duty.`);
  }
}
