export type CultureUnlockType = 'government' | 'policySlot' | 'policy' | 'building' | 'unit' | 'diplomacy';

export interface CultureUnlock {
  type: CultureUnlockType;
  value: string;
}
