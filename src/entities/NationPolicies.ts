import type { PolicyCategory } from '../types/policy';

export interface PolicySlotCounts {
  readonly economic: number;
  readonly military: number;
  readonly diplomatic: number;
  readonly wildcard: number;
}

export interface ActivePolicyAssignment {
  readonly policyId: string;
  readonly slotCategory: PolicyCategory;
}

export class NationPolicies {
  readonly nationId: string;
  activePolicies: ActivePolicyAssignment[];

  constructor(nationId: string, activePolicies: ActivePolicyAssignment[] = []) {
    this.nationId = nationId;
    this.activePolicies = [...activePolicies];
  }
}
