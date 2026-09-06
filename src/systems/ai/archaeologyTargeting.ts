import { getNaturalResourceById } from '../../data/naturalResources';
import type { NaturalResourceDefinition } from '../../types/naturalResources';
import type { Tile } from '../../types/map';

/**
 * Pure helpers shared by the AI archaeology behaviour in AISystem. Kept separate
 * (and Phaser-free) so the deterministic candidate scoring can be unit-tested and
 * rebalanced without touching the large AI orchestrator. There is no strategy
 * engine or planner here — only value/distance math over already-validated tiles,
 * mirroring the style of the other small ai/*.ts scoring helpers.
 */

/** archaeologicalCultureValue is multiplied by this so value dominates ties. */
export const ARCHAEOLOGY_CULTURE_VALUE_WEIGHT = 100;
/** Per-tile distance penalty for a land Archaeologist target. */
export const ARCHAEOLOGY_LAND_DISTANCE_PENALTY = 6;
/** Small bonus so equal-value sites inside our own borders win over foreign ones. */
export const ARCHAEOLOGY_OWNED_BONUS = 30;
/** Large penalty keeping AI use of foreign exploitation rights conservative. */
export const ARCHAEOLOGY_FOREIGN_PENALTY = 500;
/** Shipwrecks carry a much stronger logistics penalty than land sites. */
export const ARCHAEOLOGY_SHIPWRECK_DISTANCE_PENALTY = 20;

/** A land Archaeologist only searches for targets within this many tiles. */
export const MAX_ARCHAEOLOGY_TARGET_DISTANCE = 16;
/** Shipwreck expeditions may reach farther than land digs (they are rarer). */
export const MAX_SHIPWRECK_TARGET_DISTANCE = 24;
/** Cap on comparatively-expensive reachability pathfinding per search. */
export const MAX_ARCHAEOLOGY_REACHABILITY_CHECKS = 8;
/** Roughly one Archaeologist per this many viable known targets. */
export const ARCHAEOLOGY_TARGETS_PER_ARCHAEOLOGIST = 3;
/** Low practical cap so the AI never fields an archaeology army. */
export const MAX_ARCHAEOLOGISTS_PER_NATION = 3;

export interface ArchaeologyTargetScoreInput {
  readonly cultureValue: number;
  readonly distance: number;
  readonly owned: boolean;
}

/** Higher is better. Bounded search handles cross-map cases; this orders locals. */
export function scoreLandArchaeologyTarget(input: ArchaeologyTargetScoreInput): number {
  return input.cultureValue * ARCHAEOLOGY_CULTURE_VALUE_WEIGHT
    - input.distance * ARCHAEOLOGY_LAND_DISTANCE_PENALTY
    + (input.owned ? ARCHAEOLOGY_OWNED_BONUS : -ARCHAEOLOGY_FOREIGN_PENALTY);
}

/** Shipwreck value/distance trade-off with a heavier distance penalty. */
export function scoreShipwreckTarget(cultureValue: number, distance: number): number {
  return cultureValue * ARCHAEOLOGY_CULTURE_VALUE_WEIGHT
    - distance * ARCHAEOLOGY_SHIPWRECK_DISTANCE_PENALTY;
}

/** Resource metadata is the single source of archaeological Culture value. */
export function getArchaeologicalCultureValue(resourceId: string | undefined): number {
  if (resourceId === undefined) return 0;
  return getNaturalResourceById(resourceId)?.archaeologicalCultureValue ?? 0;
}

export function isArchaeologicalResource(resource: NaturalResourceDefinition | undefined): boolean {
  return resource?.archaeological === true;
}

/**
 * A tile is a raw (ownership-independent) archaeological site when it carries an
 * archaeological resource that has not yet been excavated (no completed
 * improvement and no in-progress construction). Ownership, reveal and reachability
 * are enforced by the caller against live per-nation state.
 */
export function isUnexcavatedArchaeologicalTile(tile: Tile): boolean {
  if (tile.resourceId === undefined) return false;
  if (tile.improvementId !== undefined || tile.improvementConstruction !== undefined) return false;
  return isArchaeologicalResource(getNaturalResourceById(tile.resourceId));
}

/** Desired Archaeologist count from viable target count, respecting the cap. */
export function desiredArchaeologistCount(targetCount: number): number {
  if (targetCount <= 0) return 0;
  return Math.min(
    MAX_ARCHAEOLOGISTS_PER_NATION,
    Math.ceil(targetCount / ARCHAEOLOGY_TARGETS_PER_ARCHAEOLOGIST),
  );
}
