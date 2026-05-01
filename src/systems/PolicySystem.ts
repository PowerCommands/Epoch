import { CULTURE_TREE } from '../data/cultureTree';
import { ALL_POLICIES, getPolicyById } from '../data/policies';
import { NationPolicies, type ActivePolicyAssignment, type PolicySlotCounts } from '../entities/NationPolicies';
import type { PolicyCategory, PolicyDefinition, PolicyModifier, PolicySlotCategory } from '../types/policy';
import type { NationManager } from './NationManager';

const POLICY_SLOT_CATEGORIES: readonly PolicySlotCategory[] = ['economic', 'military', 'diplomatic', 'ideology', 'wildcard'];

type MutablePolicySlotCounts = {
  -readonly [K in keyof PolicySlotCounts]: PolicySlotCounts[K];
};

export class PolicySystem {
  private readonly policiesByNation = new Map<string, NationPolicies>();

  constructor(private readonly nationManager: NationManager) {}

  getNationPolicies(nationId: string): NationPolicies {
    let policies = this.policiesByNation.get(nationId);
    if (!policies) {
      policies = new NationPolicies(nationId);
      this.policiesByNation.set(nationId, policies);
    }
    return policies;
  }

  getSlotCounts(nationId: string): PolicySlotCounts {
    const counts = createEmptySlotCounts();
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return counts;

    for (const cultureNodeId of nation.unlockedCultureNodeIds) {
      const cultureNode = CULTURE_TREE.find((node) => node.id === cultureNodeId);
      if (!cultureNode) continue;

      for (const unlock of cultureNode.unlocks) {
        if (unlock.type !== 'policySlot') continue;
        if (!isPolicySlotCategory(unlock.value)) continue;
        counts[unlock.value] += 1;
      }
    }

    return counts;
  }

  getUnlockedPolicies(nationId: string): PolicyDefinition[] {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return [];

    const unlockedCultureNodeIds = new Set(nation.unlockedCultureNodeIds);
    return ALL_POLICIES.filter((policy) => unlockedCultureNodeIds.has(policy.requiredCultureNodeId));
  }

  getActivePolicyAssignments(nationId: string): ActivePolicyAssignment[] {
    return this.getNationPolicies(nationId).activePolicies.map((assignment) => ({ ...assignment }));
  }

  getActivePolicies(nationId: string): PolicyDefinition[] {
    return this.getNationPolicies(nationId).activePolicies
      .map((assignment) => getPolicyById(assignment.policyId))
      .filter((policy): policy is PolicyDefinition => policy !== undefined);
  }

  loadNationPolicies(
    nationId: string,
    assignments: readonly ActivePolicyAssignment[],
  ): void {
    const policies = this.getNationPolicies(nationId);
    policies.activePolicies = assignments
      .filter((assignment) => isPolicySlotCategory(assignment.slotCategory))
      .map((assignment) => ({
        policyId: assignment.policyId,
        slotCategory: assignment.slotCategory,
      }));
    this.normalizeActivePolicies(nationId);
  }

  loadAllNationPolicies(
    values: ReadonlyMap<string, readonly ActivePolicyAssignment[]>
      | readonly { nationId: string; activePolicies: readonly ActivePolicyAssignment[] }[],
  ): void {
    if (isReadonlyPolicyMap(values)) {
      for (const [nationId, activePolicies] of values.entries()) {
        this.loadNationPolicies(nationId, activePolicies);
      }
      return;
    }

    for (const value of values) {
      this.loadNationPolicies(value.nationId, value.activePolicies);
    }
  }

  getActiveModifiers(nationId: string): readonly PolicyModifier[] {
    return this.getActivePolicies(nationId).flatMap((policy) => policy.modifiers);
  }

  getFlatModifierTotal(nationId: string, type: PolicyModifier['type']): number {
    return this.getActiveModifiers(nationId)
      .filter((modifier) => modifier.type === type)
      .reduce((sum, modifier) => sum + modifier.value, 0);
  }

  getPercentModifierTotal(nationId: string, type: PolicyModifier['type']): number {
    return this.getFlatModifierTotal(nationId, type);
  }

  getUnitUpkeepPercentModifier(nationId: string): number {
    return this.getPercentModifierTotal(nationId, 'unitUpkeepPercent');
  }

  canActivatePolicy(
    nationId: string,
    policyId: string,
    preferredSlotCategory?: PolicySlotCategory,
  ): boolean {
    return this.resolveActivationSlot(nationId, policyId, preferredSlotCategory) !== null;
  }

  activatePolicy(
    nationId: string,
    policyId: string,
    preferredSlotCategory?: PolicySlotCategory,
  ): boolean {
    const slotCategory = this.resolveActivationSlot(nationId, policyId, preferredSlotCategory);
    if (!slotCategory) return false;

    this.getNationPolicies(nationId).activePolicies.push({ policyId, slotCategory });
    return true;
  }

  deactivatePolicy(nationId: string, policyId: string): boolean {
    const policies = this.getNationPolicies(nationId);
    const index = policies.activePolicies.findIndex((assignment) => assignment.policyId === policyId);
    if (index < 0) return false;

    policies.activePolicies.splice(index, 1);
    return true;
  }

  replacePolicy(
    nationId: string,
    oldPolicyId: string,
    newPolicyId: string,
    preferredSlotCategory?: PolicySlotCategory,
  ): boolean {
    const policies = this.getNationPolicies(nationId);
    const oldIndex = policies.activePolicies.findIndex((assignment) => assignment.policyId === oldPolicyId);
    if (oldIndex < 0) return false;

    const [oldAssignment] = policies.activePolicies.splice(oldIndex, 1);
    if (this.activatePolicy(nationId, newPolicyId, preferredSlotCategory)) {
      return true;
    }

    policies.activePolicies.splice(oldIndex, 0, oldAssignment);
    return false;
  }

  normalizeActivePolicies(nationId: string): void {
    const policies = this.getNationPolicies(nationId);
    const slotCounts = this.getSlotCounts(nationId);
    const usedSlots = createEmptySlotCounts();
    const normalized: ActivePolicyAssignment[] = [];
    const seenPolicyIds = new Set<string>();

    for (const assignment of policies.activePolicies) {
      if (seenPolicyIds.has(assignment.policyId)) continue;

      const policy = getPolicyById(assignment.policyId);
      if (!policy) continue;
      if (!this.isPolicyUnlocked(nationId, policy)) continue;
      if (!isPolicySlotCategory(assignment.slotCategory)) continue;
      if (!isPolicySlotCompatible(policy.category, assignment.slotCategory)) continue;
      if (usedSlots[assignment.slotCategory] >= slotCounts[assignment.slotCategory]) continue;

      normalized.push({ ...assignment });
      usedSlots[assignment.slotCategory] += 1;
      seenPolicyIds.add(assignment.policyId);
    }

    policies.activePolicies = normalized;
  }

  normalizeAllActivePolicies(): void {
    for (const nation of this.nationManager.getAllNations()) {
      this.normalizeActivePolicies(nation.id);
    }
  }

  private resolveActivationSlot(
    nationId: string,
    policyId: string,
    preferredSlotCategory?: PolicySlotCategory,
  ): PolicySlotCategory | null {
    const policy = getPolicyById(policyId);
    if (!policy) return null;
    if (!this.nationManager.getNation(nationId)) return null;
    if (!this.isPolicyUnlocked(nationId, policy)) return null;

    const policies = this.getNationPolicies(nationId);
    if (policies.activePolicies.some((assignment) => assignment.policyId === policyId)) return null;

    const slotCounts = this.getSlotCounts(nationId);
    const usedSlots = this.getUsedSlotCounts(policies.activePolicies);

    if (preferredSlotCategory) {
      return this.canUseSlot(policy, preferredSlotCategory, slotCounts, usedSlots)
        ? preferredSlotCategory
        : null;
    }

    const slotOrder: readonly PolicySlotCategory[] = [policy.category, 'wildcard'];

    for (const slotCategory of slotOrder) {
      if (this.canUseSlot(policy, slotCategory, slotCounts, usedSlots)) {
        return slotCategory;
      }
    }

    return null;
  }

  private isPolicyUnlocked(nationId: string, policy: PolicyDefinition): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.unlockedCultureNodeIds.includes(policy.requiredCultureNodeId) === true;
  }

  private canUseSlot(
    policy: PolicyDefinition,
    slotCategory: PolicySlotCategory,
    slotCounts: PolicySlotCounts,
    usedSlots: PolicySlotCounts,
  ): boolean {
    return isPolicySlotCompatible(policy.category, slotCategory)
      && usedSlots[slotCategory] < slotCounts[slotCategory];
  }

  private getUsedSlotCounts(assignments: readonly ActivePolicyAssignment[]): PolicySlotCounts {
    const counts = createEmptySlotCounts();
    for (const assignment of assignments) {
      if (!isPolicySlotCategory(assignment.slotCategory)) continue;
      counts[assignment.slotCategory] += 1;
    }
    return counts;
  }
}

function createEmptySlotCounts(): MutablePolicySlotCounts {
  return {
    economic: 0,
    military: 0,
    diplomatic: 0,
    ideology: 0,
    wildcard: 0,
  };
}

function isPolicySlotCategory(value: string): value is PolicySlotCategory {
  return POLICY_SLOT_CATEGORIES.includes(value as PolicySlotCategory);
}

export function isPolicySlotCompatible(policyCategory: PolicyCategory, slotCategory: PolicySlotCategory): boolean {
  return policyCategory === slotCategory || slotCategory === 'wildcard';
}

function isReadonlyPolicyMap(
  value: ReadonlyMap<string, readonly ActivePolicyAssignment[]>
    | readonly { nationId: string; activePolicies: readonly ActivePolicyAssignment[] }[],
): value is ReadonlyMap<string, readonly ActivePolicyAssignment[]> {
  return value instanceof Map;
}
