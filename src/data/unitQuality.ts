import { BARRACKS, ARMORY, MILITARY_ACADEMY, MILITARY_BASE } from './buildings';

/**
 * Military Unit Quality — a permanent 1–5 level baked into a military unit when
 * it is produced, based on the highest qualifying military building present and
 * functioning in the producing city at that moment.
 *
 * The level never changes afterwards: it survives building loss, relocation,
 * upgrades and save/load. This module is the single canonical source of truth
 * for the level → multiplier mapping and the building hierarchy; combat, AI
 * strength evaluation, production and UI all read from here rather than
 * hardcoding the numbers.
 */
export type MilitaryQualityLevel = 1 | 2 | 3 | 4 | 5;

/** Safe default for units without an explicit quality (older saves, spawns). */
export const MIN_MILITARY_QUALITY_LEVEL: MilitaryQualityLevel = 1;

export interface MilitaryQualityTier {
  readonly level: MilitaryQualityLevel;
  /** Short flavor name shown in the UI (Regular, Trained, …). */
  readonly name: string;
  /** Combat-power multiplier applied to melee and ranged strength. */
  readonly multiplier: number;
  /**
   * Id of the military building that grants this tier, or null for the baseline
   * tier that needs no building.
   */
  readonly buildingId: string | null;
}

/**
 * Quality tiers ordered highest → lowest so that "the highest qualifying
 * building wins" is a simple first-match scan. The intentionally large Level 5
 * jump (200%, not 180%) is part of the design and must not be normalized.
 */
export const MILITARY_QUALITY_TIERS: readonly MilitaryQualityTier[] = [
  { level: 5, name: 'Special Forces', multiplier: 2.0, buildingId: MILITARY_BASE.id },
  { level: 4, name: 'Elite', multiplier: 1.6, buildingId: MILITARY_ACADEMY.id },
  { level: 3, name: 'Professional', multiplier: 1.4, buildingId: ARMORY.id },
  { level: 2, name: 'Trained', multiplier: 1.2, buildingId: BARRACKS.id },
  { level: 1, name: 'Regular', multiplier: 1.0, buildingId: null },
];

const TIER_BY_LEVEL: ReadonlyMap<MilitaryQualityLevel, MilitaryQualityTier> = new Map(
  MILITARY_QUALITY_TIERS.map((tier) => [tier.level, tier]),
);

/** Resolve a level to its tier, falling back to the baseline tier. */
export function getMilitaryQualityTier(level: MilitaryQualityLevel): MilitaryQualityTier {
  return TIER_BY_LEVEL.get(level) ?? TIER_BY_LEVEL.get(MIN_MILITARY_QUALITY_LEVEL)!;
}

/** Combat-power multiplier for a level (Level 1 → 1.0). */
export function getMilitaryQualityMultiplier(level: MilitaryQualityLevel): number {
  return getMilitaryQualityTier(level).multiplier;
}

/** Human-readable tier name for a level (e.g. "Professional"). */
export function getMilitaryQualityName(level: MilitaryQualityLevel): string {
  return getMilitaryQualityTier(level).name;
}

/**
 * Highest qualifying quality level for a city, given a predicate that reports
 * whether a building is present AND currently functioning (not broken). Takes a
 * predicate rather than a city so it stays free of entity/system dependencies.
 */
export function resolveMilitaryQualityLevel(
  hasFunctioningBuilding: (buildingId: string) => boolean,
): MilitaryQualityLevel {
  for (const tier of MILITARY_QUALITY_TIERS) {
    if (tier.buildingId === null) return tier.level;
    if (hasFunctioningBuilding(tier.buildingId)) return tier.level;
  }
  return MIN_MILITARY_QUALITY_LEVEL;
}

/**
 * Normalize an arbitrary (possibly missing/out-of-range) stored value into a
 * valid level, defaulting to Level 1. Used by save/load so older saves or
 * corrupt data can never produce an invalid quality.
 */
export function clampMilitaryQualityLevel(value: number | undefined): MilitaryQualityLevel {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MIN_MILITARY_QUALITY_LEVEL;
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as MilitaryQualityLevel;
}
