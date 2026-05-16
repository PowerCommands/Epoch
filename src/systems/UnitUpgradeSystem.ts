import type { Unit } from '../entities/Unit';
import type { UnitCategory, UnitType } from '../entities/UnitType';
import type { Era } from '../data/technologies';
import { getUnitTypeById } from '../data/units';
import type { NationManager } from './NationManager';
import type { ResearchSystem } from './ResearchSystem';
import type { UnitManager } from './UnitManager';

const BASE_UPGRADE_FEE = 25;

const ERA_MULTIPLIER: Record<Era, number> = {
  ancient: 1,
  classical: 2,
  medieval: 4,
  renaissance: 8,
  industrial: 16,
  modern: 32,
  atomic: 64,
  information: 128,
  future: 256,
};

const ERA_ORDER: Record<Era, number> = {
  ancient: 0,
  classical: 1,
  medieval: 2,
  renaissance: 3,
  industrial: 4,
  modern: 5,
  atomic: 6,
  information: 7,
  future: 8,
};

const MILITARY_CATEGORIES = new Set<UnitCategory>([
  'melee',
  'ranged',
  'mounted',
  'siege',
  'naval_melee',
  'naval_ranged',
  'air',
]);

export interface UnitUpgradePreview {
  readonly canUpgrade: boolean;
  readonly target?: UnitType;
  readonly cost?: number;
  readonly reason?: string;
}

export interface UnitUpgradeLogContext {
  readonly logEvent?: (nationId: string, message: string) => void;
  readonly formatLog?: (nationId: string, message: string) => string;
}

export class UnitUpgradeSystem {
  constructor(
    private readonly nationManager: NationManager,
    private readonly unitManager: UnitManager,
    private readonly researchSystem?: ResearchSystem,
    private readonly logContext: UnitUpgradeLogContext = {},
  ) {}

  static getEraMultiplier(era: Era): number {
    return ERA_MULTIPLIER[era];
  }

  canUpgradeUnit(unit: Unit, nationId: string): boolean {
    return this.getUpgradePreview(unit, nationId).canUpgrade;
  }

  getUpgradeTarget(unit: Unit): UnitType | undefined {
    const targetId = unit.unitType.upgradeToUnitId;
    return targetId ? getUnitTypeById(targetId) : undefined;
  }

  getUpgradeCost(unit: Unit): number | undefined {
    const target = this.getUpgradeTarget(unit);
    if (!target) return undefined;

    const oldUpkeep = unit.unitType.upkeepGold ?? 0;
    const newUpkeep = target.upkeepGold ?? 0;
    return Math.round((oldUpkeep + newUpkeep) * BASE_UPGRADE_FEE * ERA_MULTIPLIER[target.era]);
  }

  getUpgradePreview(unit: Unit, nationId: string): UnitUpgradePreview {
    const target = this.getUpgradeTarget(unit);
    if (!this.nationManager.getNation(nationId)) return { canUpgrade: false, target, reason: 'Nation is not active.' };
    if (unit.ownerId !== nationId) return { canUpgrade: false, target, reason: 'Unit belongs to another nation.' };
    if (this.unitManager.getUnit(unit.id) !== unit) return { canUpgrade: false, target, reason: 'Unit is no longer active.' };
    if (!unit.isAlive()) return { canUpgrade: false, target, reason: 'Unit is not alive.' };
    if (!this.isMilitaryUnit(unit.unitType)) return { canUpgrade: false, target, reason: 'Only military units can upgrade.' };
    if (!unit.unitType.upgradeToUnitId) return { canUpgrade: false, reason: 'Unit has no upgrade path.' };
    if (!target) return { canUpgrade: false, reason: 'Upgrade target is missing.' };
    if (!this.isMilitaryUnit(target)) return { canUpgrade: false, target, reason: 'Upgrade target is not military.' };
    if (!this.isSameOrLaterEra(unit.unitType.era, target.era)) {
      return { canUpgrade: false, target, reason: 'Upgrade target is from an earlier era.' };
    }
    if (this.hasUpgradeCycle(unit.unitType)) return { canUpgrade: false, target, reason: 'Upgrade path contains a cycle.' };
    if (!this.isTargetUnlocked(nationId, target.id)) {
      return { canUpgrade: false, target, reason: `${target.name} has not been unlocked.` };
    }

    const cost = this.getUpgradeCost(unit);
    if (cost === undefined) return { canUpgrade: false, target, reason: 'Upgrade cost could not be calculated.' };

    const resources = this.nationManager.getResources(nationId);
    if (resources.gold < cost) {
      return { canUpgrade: false, target, cost, reason: `Need ${cost} gold to upgrade to ${target.name}.` };
    }

    return { canUpgrade: true, target, cost };
  }

  upgradeUnit(unit: Unit, nationId: string): boolean {
    const preview = this.getUpgradePreview(unit, nationId);
    if (!preview.canUpgrade || !preview.target || preview.cost === undefined) return false;

    const oldType = unit.unitType;
    const resources = this.nationManager.getResources(nationId);
    if (resources.gold < preview.cost) return false;
    if (!this.unitManager.upgradeUnitType(unit.id, preview.target)) return false;

    resources.gold = Math.max(0, resources.gold - preview.cost);
    this.logUpgrade(nationId, oldType, preview.target, preview.cost);
    return true;
  }

  private isMilitaryUnit(unitType: UnitType): boolean {
    return MILITARY_CATEGORIES.has(unitType.category);
  }

  private isTargetUnlocked(nationId: string, unitTypeId: string): boolean {
    return this.researchSystem?.isUnitUnlocked(nationId, unitTypeId) ?? true;
  }

  private isSameOrLaterEra(source: Era, target: Era): boolean {
    return ERA_ORDER[target] >= ERA_ORDER[source];
  }

  private hasUpgradeCycle(source: UnitType): boolean {
    const seen = new Set<string>();
    let cursor: UnitType | undefined = source;
    while (cursor?.upgradeToUnitId) {
      if (seen.has(cursor.id)) return true;
      seen.add(cursor.id);
      cursor = getUnitTypeById(cursor.upgradeToUnitId);
    }
    return false;
  }

  private logUpgrade(nationId: string, oldType: UnitType, newType: UnitType, cost: number): void {
    const message = `upgraded ${oldType.name} to ${newType.name} for ${cost} gold.`;
    this.logContext.logEvent?.(
      nationId,
      this.logContext.formatLog?.(nationId, message) ?? `${this.nationManager.getNation(nationId)?.name ?? nationId} ${message}`,
    );
  }
}
