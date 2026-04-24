export type CultureUnlockType = 'government' | 'policySlot' | 'building' | 'unit' | 'diplomacy';

export interface CultureUnlock {
  type: CultureUnlockType;
  value: string;
}
