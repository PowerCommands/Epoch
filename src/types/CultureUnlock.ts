import type { PolicySlotCategory } from './policy';

export type CultureUnlockType = 'government' | 'policySlot' | 'policy' | 'building' | 'unit' | 'diplomacy';

export type CultureUnlock =
  | { type: 'policySlot'; value: PolicySlotCategory }
  | { type: Exclude<CultureUnlockType, 'policySlot'>; value: string };
