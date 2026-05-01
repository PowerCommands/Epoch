import type { Unit } from '../entities/Unit';
import type { TurnStartEvent } from '../types/events';
import type { MapData } from '../types/map';
import type { NationManager } from './NationManager';
import type { PolicySystem } from './PolicySystem';
import type { ResourceSystem } from './ResourceSystem';
import type { UnitManager } from './UnitManager';

export class UnitUpkeepSystem {
  private hasSkippedInitialTurnStart = false;

  constructor(
    private readonly nationManager: NationManager,
    private readonly unitManager: UnitManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly mapData: MapData,
    private readonly policySystem?: PolicySystem,
  ) {}

  handleTurnStart(event: TurnStartEvent): void {
    if (!this.hasSkippedInitialTurnStart) {
      this.hasSkippedInitialTurnStart = true;
      return;
    }

    this.applyUpkeepForNation(event.nation.id);
  }

  applyUpkeep(): void {
    for (const nation of this.nationManager.getAllNations()) {
      this.applyUpkeepForNation(nation.id);
    }
  }

  applyUpkeepForNation(nationId: string): number {
    const totalUpkeep = this.calculateUpkeep(nationId);
    if (totalUpkeep <= 0) return 0;

    this.resourceSystem.addGold(nationId, -totalUpkeep);
    return totalUpkeep;
  }

  calculateUpkeep(nationId: string): number {
    const baseUpkeep = this.unitManager
      .getUnitsByOwner(nationId)
      .reduce((sum, unit) => sum + calculateUnitUpkeep(unit, this.mapData), 0);
    const upkeepPercent = this.policySystem?.getUnitUpkeepPercentModifier(nationId) ?? 0;
    const multiplier = Math.max(0, 1 + (upkeepPercent / 100));
    return Math.max(0, Math.floor(baseUpkeep * multiplier));
  }
}

export function calculateUnitUpkeep(unit: Unit, mapData: MapData): number {
  const base = unit.unitType.upkeepGold ?? 0;
  if (base <= 0) return 0;

  return isUnitInOwnTerritory(unit, mapData) ? base : base * 2;
}

function isUnitInOwnTerritory(unit: Unit, mapData: MapData): boolean {
  const tile = mapData.tiles[unit.tileY]?.[unit.tileX];
  return tile?.ownerId === unit.ownerId;
}
