import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';
import type { TurnStartEvent } from '../types/events';
import type { MapData } from '../types/map';
import { getUnitTypeById } from '../data/units';
import type { CityManager } from './CityManager';
import type { EventLogSystem } from './EventLogSystem';
import type { NationManager } from './NationManager';
import type { PolicySystem } from './PolicySystem';
import type { ResourceSystem } from './ResourceSystem';
import type { UnitManager } from './UnitManager';

export interface UnitUpkeepEnforcementResult {
  readonly chargedUpkeep: number;
  readonly dismissedUnits: readonly Unit[];
}

export class UnitUpkeepSystem {
  private hasSkippedInitialTurnStart = false;

  constructor(
    private readonly nationManager: NationManager,
    private readonly unitManager: UnitManager,
    private readonly resourceSystem: ResourceSystem,
    private readonly mapData: MapData,
    private readonly cityManager?: CityManager,
    private readonly policySystem?: PolicySystem,
    private readonly eventLog?: EventLogSystem,
    private readonly getCurrentRound: () => number = () => 0,
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
    const result = this.enforceAndApplyUpkeepForNation(nationId);
    return result.chargedUpkeep;
  }

  enforceAndApplyUpkeepForNation(nationId: string): UnitUpkeepEnforcementResult {
    const dismissedUnits = this.dismissUnitsUntilUpkeepAffordable(nationId);
    const totalUpkeep = this.calculateUpkeep(nationId);
    if (totalUpkeep <= 0) {
      return {
        chargedUpkeep: 0,
        dismissedUnits,
      };
    }

    this.resourceSystem.addGold(nationId, -totalUpkeep);
    return {
      chargedUpkeep: totalUpkeep,
      dismissedUnits,
    };
  }

  calculateUpkeep(nationId: string): number {
    const baseUpkeep = this.unitManager
      .getUnitsByOwner(nationId)
      .reduce((sum, unit) => sum + calculateUnitUpkeep(unit, this.mapData), 0);
    const upkeepPercent = this.policySystem?.getUnitUpkeepPercentModifier(nationId) ?? 0;
    const multiplier = Math.max(0, 1 + (upkeepPercent / 100));
    return Math.max(0, Math.floor(baseUpkeep * multiplier));
  }

  canAffordUnitUpkeepForTurns(nationId: string, unitTypeId: string, turns: number): boolean {
    const unitType = getUnitTypeById(unitTypeId);
    if (!unitType) return false;
    const upkeep = this.calculateUnitTypeUpkeep(nationId, unitType);
    if (upkeep <= 0) return true;
    const gold = this.nationManager.getResources(nationId).gold;
    return gold >= upkeep * Math.max(0, turns);
  }

  getUnitUpkeepAffordabilityReason(nationId: string, unitType: UnitType, turns: number): string | undefined {
    const upkeep = this.calculateUnitTypeUpkeep(nationId, unitType);
    if (upkeep <= 0) return undefined;
    const requiredGold = upkeep * Math.max(0, turns);
    const gold = this.nationManager.getResources(nationId).gold;
    if (gold >= requiredGold) return undefined;
    return `Not enough gold reserves to support this unit for ${turns} turns.`;
  }

  calculateUnitTypeUpkeep(nationId: string, unitType: UnitType): number {
    const base = unitType.upkeepGold ?? 0;
    if (base <= 0) return 0;
    const upkeepPercent = this.policySystem?.getUnitUpkeepPercentModifier(nationId) ?? 0;
    const multiplier = Math.max(0, 1 + (upkeepPercent / 100));
    return Math.max(0, Math.floor(base * multiplier));
  }

  private dismissUnitsUntilUpkeepAffordable(nationId: string): Unit[] {
    const dismissedUnits: Unit[] = [];
    let currentGold = this.nationManager.getResources(nationId).gold;
    let currentUpkeep = this.calculateUpkeep(nationId);
    if (currentUpkeep <= currentGold) return dismissedUnits;

    for (const unit of this.getDismissalOrder(nationId, false)) {
      if (currentUpkeep <= currentGold) break;
      this.dismissUnit(unit);
      dismissedUnits.push(unit);
      currentGold = this.nationManager.getResources(nationId).gold;
      currentUpkeep = this.calculateUpkeep(nationId);
    }

    if (currentUpkeep > currentGold) {
      for (const unit of this.getDismissalOrder(nationId, true)) {
        if (currentUpkeep <= currentGold) break;
        if (dismissedUnits.some((dismissed) => dismissed.id === unit.id)) continue;
        this.dismissUnit(unit);
        dismissedUnits.push(unit);
        currentGold = this.nationManager.getResources(nationId).gold;
        currentUpkeep = this.calculateUpkeep(nationId);
      }
    }

    if (dismissedUnits.length > 0) {
      this.logDismissals(nationId, dismissedUnits);
    }
    return dismissedUnits;
  }

  private getDismissalOrder(nationId: string, includeLoadedTransports: boolean): Unit[] {
    return this.unitManager.getUnitsByOwner(nationId)
      .filter((unit) => this.isDismissibleMilitaryUnit(unit, includeLoadedTransports))
      .sort((a, b) => this.compareDismissalPriority(a, b));
  }

  private dismissUnit(unit: Unit): void {
    const cargo = this.unitManager.getCargoForTransport(unit);
    if (cargo !== undefined) {
      this.unitManager.moveUnit(cargo.id, unit.tileX, unit.tileY, 0);
    }
    this.unitManager.removeUnit(unit.id);
  }

  private isDismissibleMilitaryUnit(unit: Unit, includeLoadedTransports: boolean): boolean {
    if (calculateUnitUpkeep(unit, this.mapData) <= 0) return false;
    if (unit.unitType.category === 'civilian' || unit.unitType.category === 'recon' || unit.unitType.category === 'naval_recon') return false;
    if (unit.unitType.canFound === true || unit.unitType.canBuildImprovements === true) return false;
    const isMilitary = unit.unitType.baseStrength > 0 || (unit.unitType.rangedStrength ?? 0) > 0;
    if (!isMilitary) return false;
    if (!includeLoadedTransports && this.unitManager.getCargoForTransport(unit) !== undefined) return false;
    return true;
  }

  private compareDismissalPriority(a: Unit, b: Unit): number {
    const upkeepDiff = calculateUnitUpkeep(b, this.mapData) - calculateUnitUpkeep(a, this.mapData);
    if (upkeepDiff !== 0) return upkeepDiff;

    const strengthDiff = getUnitStrength(a) - getUnitStrength(b);
    if (strengthDiff !== 0) return strengthDiff;

    const distanceDiff = this.getDistanceToNearestOwnedCity(b) - this.getDistanceToNearestOwnedCity(a);
    if (distanceDiff !== 0) return distanceDiff;

    return a.id.localeCompare(b.id);
  }

  private getDistanceToNearestOwnedCity(unit: Unit): number {
    const cities = this.cityManager?.getCitiesByOwner(unit.ownerId) ?? [];
    if (cities.length === 0) return Number.MAX_SAFE_INTEGER;
    return cities.reduce((best, city) => {
      const dx = unit.tileX - city.tileX;
      const dy = unit.tileY - city.tileY;
      return Math.min(best, (dx * dx) + (dy * dy));
    }, Number.MAX_SAFE_INTEGER);
  }

  private logDismissals(nationId: string, units: readonly Unit[]): void {
    if (!this.eventLog) return;
    const nationName = this.nationManager.getNation(nationId)?.name ?? nationId;
    const round = this.getCurrentRound();
    const summary = summarizeUnits(units);
    this.eventLog.log(
      `[r${round}] ${nationName} disbanded ${summary} due to unpaid upkeep.`,
      [nationId],
      round,
    );
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

function getUnitStrength(unit: Unit): number {
  return Math.max(unit.unitType.baseStrength, unit.unitType.rangedStrength ?? 0);
}

function summarizeUnits(units: readonly Unit[]): string {
  const counts = new Map<string, number>();
  for (const unit of units) {
    counts.set(unit.unitType.name, (counts.get(unit.unitType.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${count} ${pluralize(name, count)}`)
    .join(' and ');
}

function pluralize(name: string, count: number): string {
  if (count === 1) return name;
  if (name.endsWith('s')) return name;
  return `${name}s`;
}
