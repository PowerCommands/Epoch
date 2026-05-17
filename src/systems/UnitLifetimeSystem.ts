import type { Unit } from '../entities/Unit';
import type { NationManager } from './NationManager';
import type { UnitManager } from './UnitManager';

type ExpirationLogger = (unit: Unit, message: string, round: number) => void;
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

  private logExpiredUnit(unit: Unit, round: number): void {
    if (!this.logExpiration) return;
    const nationName = this.nationManager.getNation(unit.ownerId)?.name ?? unit.ownerId;
    this.logExpiration(
      unit,
      `[r${round}] ${nationName} ${unit.name} expired after long exploration duty.`,
      round,
    );
  }
}
