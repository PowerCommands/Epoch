import type { Era } from './technologies';

/**
 * Era-based cost multipliers for culture progression.
 *
 * Applied on top of the game-speed cost multiplier so that each successive era
 * takes proportionally longer to traverse, without touching AI logic, combat,
 * production, or any other gameplay system.
 *
 * Ancient/Classical: barely changed — early-game should feel active and fun.
 * Medieval onward: progressively heavier so units and wars stay relevant longer
 * and industrial nations no longer appear while others field medieval armies.
 *
 * Technology research uses its own technology-only multiplier table so the two
 * progression systems can be calibrated independently.
 */
export const ERA_PACING_MULTIPLIERS: Record<Era, number> = {
  ancient:     1.00,
  classical:   1.10,
  medieval:    1.35,
  renaissance: 1.55,
  industrial:  1.90,
  modern:      1.90,
  atomic:      2.10,
  information: 2.25,
  future:      2.45,
};

export function getEraPacingMultiplier(era: Era): number {
  return ERA_PACING_MULTIPLIERS[era] ?? 1.0;
}
