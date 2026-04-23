import {
  ALL_POLICIES,
  ALL_POLICY_TREES,
  getPolicyById,
  type PolicyDefinition,
  type PolicyTreeDefinition,
} from '../data/policies';
import { EMPTY_MODIFIERS, addModifiers, type ModifierSet } from '../types/modifiers';
import type { EventLogSystem } from './EventLogSystem';
import type { NationManager } from './NationManager';

type ChangedListener = () => void;
type CultureProvider = (nationId: string) => number;

export interface PolicyViewState {
  policy: PolicyDefinition;
  tree: PolicyTreeDefinition;
  isUnlocked: boolean;
  isActive: boolean;
  isAvailable: boolean;
  missingPrerequisiteIds: string[];
  effectiveCost: number;
}

export class PolicySystem {
  private readonly listeners: ChangedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly eventLog: EventLogSystem,
    private readonly getCurrentRound: () => number,
    private readonly getCulturePerTurn: CultureProvider = (nationId) => (
      this.nationManager.getResources(nationId).culturePerTurn
    ),
  ) {}

  canSelectPolicy(nationId: string, policyId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    const policy = getPolicyById(policyId);
    if (!nation || !policy) return false;
    if (nation.currentPolicyId === policyId) return false;
    if (this.isUnlocked(nationId, policyId)) return false;
    return this.getMissingPrerequisiteIds(nationId, policyId).length === 0;
  }

  selectPolicy(nationId: string, policyId: string): boolean {
    if (!this.canSelectPolicy(nationId, policyId)) return false;

    const nation = this.nationManager.getNation(nationId);
    const policy = getPolicyById(policyId);
    if (!nation || !policy) return false;

    nation.currentPolicyId = policyId;

    const unlockedPolicy = this.tryUnlockCurrentPolicy(nationId);
    if (unlockedPolicy) {
      return true;
    }

    this.eventLog.log(
      `${nation.name} focused cultural development on ${policy.name}.`,
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();

    return true;
  }

  advancePolicyForNation(nationId: string): PolicyDefinition | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentPolicyId) return null;

    const policy = getPolicyById(nation.currentPolicyId);
    if (!policy) {
      nation.currentPolicyId = undefined;
      nation.policyProgress = 0;
      this.notifyChanged();
      return null;
    }

    if (this.getMissingPrerequisiteIds(nationId, policy.id).length > 0 || this.isUnlocked(nationId, policy.id)) {
      nation.currentPolicyId = undefined;
      nation.policyProgress = 0;
      this.notifyChanged();
      return null;
    }

    nation.policyProgress += this.getPolicyCulturePerTurn(nationId);

    const unlockedPolicy = this.tryUnlockCurrentPolicy(nationId);
    if (!unlockedPolicy) {
      this.notifyChanged();
      return null;
    }

    return unlockedPolicy;
  }

  ensurePolicySelected(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.currentPolicyId) return false;

    const nextPolicy = this.getAvailablePolicies(nationId)[0];
    if (!nextPolicy) return false;

    return this.selectPolicy(nationId, nextPolicy.id);
  }

  isUnlocked(nationId: string, policyId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.unlockedPolicyIds.includes(policyId) ?? false;
  }

  getCurrentPolicy(nationId: string): PolicyDefinition | undefined {
    const currentPolicyId = this.nationManager.getNation(nationId)?.currentPolicyId;
    return currentPolicyId ? getPolicyById(currentPolicyId) : undefined;
  }

  getPolicyProgress(nationId: string): number {
    return this.nationManager.getNation(nationId)?.policyProgress ?? 0;
  }

  getPolicyCulturePerTurn(nationId: string): number {
    return this.getCulturePerTurn(nationId);
  }

  getEffectiveCost(nationId: string, policyId: string): number {
    const nation = this.nationManager.getNation(nationId);
    const policy = getPolicyById(policyId);
    if (!nation || !policy) return 0;
    const unlockedPolicyCount = nation.unlockedPolicyIds.length;
    return Math.round(policy.cost * (1 + unlockedPolicyCount * 0.15));
  }

  getMissingPrerequisiteIds(nationId: string, policyId: string): string[] {
    const policy = getPolicyById(policyId);
    if (!policy) return [];
    return policy.prerequisites.filter((prerequisiteId) => !this.isUnlocked(nationId, prerequisiteId));
  }

  getAvailablePolicies(nationId: string): PolicyDefinition[] {
    return ALL_POLICIES.filter((policy) => this.canSelectPolicy(nationId, policy.id));
  }

  getUnlockedPolicies(nationId: string): PolicyDefinition[] {
    return ALL_POLICIES.filter((policy) => this.isUnlocked(nationId, policy.id));
  }

  getCombinedModifiers(nationId: string): ModifierSet {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return { ...EMPTY_MODIFIERS };

    const unlockedPolicies = nation.unlockedPolicyIds
      .map((policyId) => getPolicyById(policyId))
      .filter((policy): policy is PolicyDefinition => policy !== undefined);

    return addModifiers(...unlockedPolicies.map((policy) => policy.modifiers));
  }

  getPolicyViewState(nationId: string): PolicyViewState[] {
    return ALL_POLICIES.map((policy) => {
      const tree = ALL_POLICY_TREES.find((treeDef) => treeDef.id === policy.treeId);
      if (!tree) {
        throw new Error(`Missing policy tree for policy ${policy.id}`);
      }

      const missingPrerequisiteIds = this.getMissingPrerequisiteIds(nationId, policy.id);
      return {
        policy,
        tree,
        isUnlocked: this.isUnlocked(nationId, policy.id),
        isActive: this.getCurrentPolicy(nationId)?.id === policy.id,
        isAvailable: this.canSelectPolicy(nationId, policy.id),
        missingPrerequisiteIds,
        effectiveCost: this.getEffectiveCost(nationId, policy.id),
      };
    });
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  private notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }

  private tryUnlockCurrentPolicy(nationId: string): PolicyDefinition | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentPolicyId) return null;

    const policy = getPolicyById(nation.currentPolicyId);
    if (!policy) return null;

    const effectiveCost = this.getEffectiveCost(nationId, policy.id);
    if (nation.policyProgress < effectiveCost) return null;

    if (!nation.unlockedPolicyIds.includes(policy.id)) {
      nation.unlockedPolicyIds.push(policy.id);
    }
    nation.policyProgress -= effectiveCost;
    nation.currentPolicyId = undefined;

    this.eventLog.log(
      `${nation.name} adopted ${policy.name}.`,
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();

    return policy;
  }
}
