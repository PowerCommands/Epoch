import type { Unit } from '../entities/Unit';
import { getMilitaryQualityMultiplier } from '../data/unitQuality';

/**
 * Canonical quality-adjusted combat strength for a unit. Every consumer that
 * needs a unit's effective fighting power (combat resolution, AI/diplomacy
 * strength evaluation, UI) reads through these helpers so the Military Unit
 * Quality multiplier is applied in exactly one place and never twice.
 *
 * The multiplier scales only the unit's own base/ranged strength; flat and
 * situational combat modifiers are layered on top by the caller.
 */

/** Effective melee/direct combat strength after the quality multiplier. */
export function getEffectiveMeleeStrength(unit: Unit): number {
  return unit.unitType.baseStrength * getMilitaryQualityMultiplier(unit.qualityLevel);
}

/**
 * Effective ranged combat strength after the quality multiplier. Mirrors the
 * combat rule of falling back to base strength when no ranged strength is set.
 */
export function getEffectiveRangedStrength(unit: Unit): number {
  const base = unit.unitType.rangedStrength ?? unit.unitType.baseStrength;
  return base * getMilitaryQualityMultiplier(unit.qualityLevel);
}
