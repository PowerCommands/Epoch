import { CULTURE_TREE } from '../../data/cultureTree';
import type { NationManager } from '../NationManager';
import type { HappinessSystem } from '../HappinessSystem';
import type { PolicySystem } from '../PolicySystem';
import type { PolicyDefinition, PolicyModifier } from '../../types/policy';

export class AIPolicySystem {
  constructor(
    private readonly policySystem: PolicySystem,
    private readonly nationManager: NationManager,
    private readonly happinessSystem: HappinessSystem,
  ) {}

  runTurn(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.isHuman) return;

    this.policySystem.normalizeActivePolicies(nationId);

    while (true) {
      const candidates = this.getActivatablePolicies(nationId);
      if (candidates.length === 0) return;

      const best = candidates
        .map((policy) => ({
          policy,
          score: this.scorePolicy(nationId, policy),
          cultureOrder: getCultureOrder(policy.requiredCultureNodeId),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => (
          b.score - a.score
          || a.cultureOrder - b.cultureOrder
          || a.policy.id.localeCompare(b.policy.id)
        ))[0];

      if (!best) return;
      if (!this.policySystem.activatePolicy(nationId, best.policy.id)) return;
    }
  }

  private getActivatablePolicies(nationId: string): PolicyDefinition[] {
    const activePolicyIds = new Set(
      this.policySystem.getActivePolicyAssignments(nationId)
        .map((assignment) => assignment.policyId),
    );
    return this.policySystem.getUnlockedPolicies(nationId)
      .filter((policy) => !activePolicyIds.has(policy.id))
      .filter((policy) => this.policySystem.canActivatePolicy(nationId, policy.id));
  }

  private scorePolicy(nationId: string, policy: PolicyDefinition): number {
    const isUnhappy = this.happinessSystem.getNationState(nationId).netHappiness < 0;
    return policy.modifiers.reduce((sum, modifier) => (
      sum + scoreModifier(modifier, isUnhappy)
    ), 0);
  }
}

function scoreModifier(modifier: PolicyModifier, isUnhappy: boolean): number {
  switch (modifier.type) {
    case 'happinessFlat':
      return modifier.value * (isUnhappy ? 100 : 25);
    case 'happinessPerCity':
      return modifier.value * (isUnhappy ? 90 : 20);
    case 'happinessPerLuxuryResource':
      return modifier.value * (isUnhappy ? 70 : 15);
    case 'unhappinessPerCityFlat':
      return Math.max(0, -modifier.value) * (isUnhappy ? 90 : 20);
    case 'unhappinessPerPopulationPercent':
      return Math.max(0, -modifier.value) * (isUnhappy ? 90 : 20);
    case 'productionFlatPerCity':
      return modifier.value * 35;
    case 'productionPercent':
      return modifier.value * 35;
    case 'goldFlatPerCity':
      return modifier.value * 25;
    case 'goldPercent':
      return modifier.value * 25;
    case 'cultureFlatPerCity':
      return modifier.value * 20;
    case 'culturePercent':
      return modifier.value * 20;
    case 'scienceFlatPerCity':
      return modifier.value * 20;
    case 'sciencePercent':
      return modifier.value * 20;
    case 'influenceFlat':
      return modifier.value * 15;
    case 'influencePercent':
      return modifier.value * 15;
    case 'landUnitProductionPercent':
      return modifier.value * 20;
    case 'wonderProductionPercent':
      return modifier.value * 10;
    case 'cityDefenseFlat':
      return modifier.value * 15;
    case 'ownedTerritoryCombatFlat':
      return modifier.value * 15;
    case 'unitUpkeepPercent':
      return Math.max(0, -modifier.value) * 10;
    case 'improvementBuildSpeedPercent':
      return modifier.value * 15;
  }
}

function getCultureOrder(cultureNodeId: string): number {
  const index = CULTURE_TREE.findIndex((node) => node.id === cultureNodeId);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
