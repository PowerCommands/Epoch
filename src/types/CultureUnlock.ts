import type { PolicySlotCategory } from './policy';

export type CultureUnlockType = 'government' | 'policySlot' | 'policy' | 'building' | 'unit' | 'diplomacy';

export type CultureUnlock =
  | { type: 'policySlot'; value: PolicySlotCategory }
  | {
      type: Exclude<CultureUnlockType, 'policySlot'>;
      value: string;
      /** When true, this culture unlock is required in addition to an unlocking technology. */
      requiredWithTechnology?: boolean;
    };
