import type { UnitManager } from '../UnitManager';
import type {
  AIMilitaryDoctrine,
  AIMilitaryDoctrineMillitaryBudget,
  AIMilitaryDoctrineRole,
} from '../../types/aiMilitaryDoctrine';
import { getLeaderMilitaryDoctrineByNationId } from '../../data/leaders';
import { DEFAULT_TARGET_COMPOSITION } from '../../data/aiMilitaryDoctrines';
import { getUnitDoctrineRole } from '../../utils/unitRoleUtils';

const ALL_ROLES: readonly AIMilitaryDoctrineRole[] = [
  'melee', 'ranged', 'mounted', 'siege', 'navalMelee', 'navalRanged', 'air',
];

const ZERO_COMPOSITION: Record<AIMilitaryDoctrineRole, number> = {
  melee: 0, ranged: 0, mounted: 0, siege: 0, navalMelee: 0, navalRanged: 0, air: 0,
};

export interface DoctrineDiscourageContext {
  happiness?: number;
  gold?: number;
  warWeariness?: number;
  isThreatened?: boolean;
}

export class AIMilitaryDoctrineEvaluator {
  constructor(private readonly unitManager: UnitManager) {}

  getDoctrine(nationId: string): AIMilitaryDoctrine {
    return getLeaderMilitaryDoctrineByNationId(nationId);
  }

  getCurrentComposition(nationId: string): Record<AIMilitaryDoctrineRole, number> {
    const counts = { ...ZERO_COMPOSITION };
    for (const unit of this.unitManager.getUnitsByOwner(nationId)) {
      const role = getUnitDoctrineRole(unit.unitType);
      if (role === null) continue;
      counts[role]++;
    }
    return counts;
  }

  getCurrentCompositionRatio(nationId: string): Record<AIMilitaryDoctrineRole, number> {
    const counts = this.getCurrentComposition(nationId);
    const total = ALL_ROLES.reduce((sum, role) => sum + counts[role], 0);
    if (total === 0) return { ...ZERO_COMPOSITION };
    const ratios = { ...ZERO_COMPOSITION };
    for (const role of ALL_ROLES) {
      ratios[role] = counts[role] / total;
    }
    return ratios;
  }

  getRoleDeficit(nationId: string, role: AIMilitaryDoctrineRole): number {
    const doctrine = this.getDoctrine(nationId);
    const target = doctrine.targetComposition[role] ?? DEFAULT_TARGET_COMPOSITION[role] ?? 0;
    const current = this.getCurrentCompositionRatio(nationId)[role];
    return target - current;
  }

  getPreferredRoleMultiplier(nationId: string, role: AIMilitaryDoctrineRole): number {
    return this.getDoctrine(nationId).preferredRoles[role] ?? 1.0;
  }

  getRoleDeficitMultiplier(nationId: string, role: AIMilitaryDoctrineRole): number {
    const deficit = this.getRoleDeficit(nationId, role);
    if (deficit > 0) return 1 + Math.min(deficit * 4, 2.5);
    if (deficit < 0) return Math.max(0.25, 1 + deficit * 2);
    return 1;
  }

  getDesiredMilitaryBudget(nationId: string): AIMilitaryDoctrineMillitaryBudget {
    return this.getDoctrine(nationId).militaryBudget;
  }

  /**
   * Returns a score multiplier (≤ 1.0) for non-essential military production
   * based on current national pressure vs doctrine tolerance thresholds.
   * 1.0 = no discouragement; 0.5 = moderate; 0.25 = strong.
   * Always returns 1.0 when the nation is threatened and doctrine permits overbuilding.
   */
  getMilitaryProductionPressureModifier(nationId: string, context: DoctrineDiscourageContext): number {
    const doctrine = this.getDoctrine(nationId);
    const { strategicTolerance, militaryBudget } = doctrine;

    if (militaryBudget.allowOverbuildingWhenThreatened && (context.isThreatened ?? false)) return 1.0;

    let modifier = 1.0;

    if (context.happiness !== undefined && context.happiness < strategicTolerance.minHappinessForMilitaryBuilds) {
      modifier = Math.min(modifier, 0.25);
    }
    if (context.gold !== undefined && context.gold < strategicTolerance.minGoldReserveForMilitaryBuilds) {
      modifier = Math.min(modifier, 0.5);
    }
    if (!strategicTolerance.tolerateWarWeariness && (context.warWeariness ?? 0) > 0) {
      modifier = Math.min(modifier, 0.5);
    }

    return modifier;
  }

  shouldDiscourageMilitaryProduction(nationId: string, context: DoctrineDiscourageContext): boolean {
    const doctrine = this.getDoctrine(nationId);
    const { strategicTolerance, militaryBudget } = doctrine;

    if (militaryBudget.allowOverbuildingWhenThreatened && (context.isThreatened ?? false)) return false;

    if (context.happiness !== undefined && context.happiness < strategicTolerance.minHappinessForMilitaryBuilds) return true;
    if (context.gold !== undefined && context.gold < strategicTolerance.minGoldReserveForMilitaryBuilds) return true;

    return false;
  }

  explainDoctrineState(nationId: string): string {
    const doctrine = this.getDoctrine(nationId);
    const counts = this.getCurrentComposition(nationId);

    const naval = counts.navalMelee + counts.navalRanged;
    const countStr = `melee=${counts.melee} ranged=${counts.ranged} mounted=${counts.mounted} siege=${counts.siege} naval=${naval}`;

    let deficitRole: AIMilitaryDoctrineRole = 'melee';
    let deficitValue = -Infinity;
    let overRole: AIMilitaryDoctrineRole = 'melee';
    let overValue = Infinity;

    for (const role of ALL_ROLES) {
      const deficit = this.getRoleDeficit(nationId, role);
      if (deficit > deficitValue) { deficitValue = deficit; deficitRole = role; }
      if (deficit < overValue) { overValue = deficit; overRole = role; }
    }

    return [
      `doctrine ${doctrine.id}`,
      `composition ${countStr}`,
      `strongest deficit ${deficitRole} +${deficitValue.toFixed(2)}`,
      `overrepresented ${overRole} ${overValue.toFixed(2)}`,
    ].join('; ');
  }
}
