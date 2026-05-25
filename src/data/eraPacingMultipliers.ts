import type { Era } from './technologies';

/**
 * Era-based cost multipliers for research and culture progression.
 *
 * Applied on top of the game-speed cost multiplier so that each successive era
 * takes proportionally longer to traverse, without touching AI logic, combat,
 * production, or any other gameplay system.
 *
 * Ancient/Classical: barely changed — early-game should feel active and fun.
 * Medieval onward: progressively heavier so units and wars stay relevant longer
 * and industrial nations no longer appear while others field medieval armies.
 *
 * These values are easy to tune: they are only read by ResearchSystem and
 * CultureSystem when computing effective costs.
 */
export const ERA_PACING_MULTIPLIERS: Record<Era, number> = {
  ancient:     1.00,
  classical:   1.15,
  medieval:    1.50,
  renaissance: 2.00,
  industrial:  2.80,
  modern:      3.50,
  atomic:      4.20,
  information: 5.00,
  future:      5.80,
};

export function getEraPacingMultiplier(era: Era): number {
  return ERA_PACING_MULTIPLIERS[era] ?? 1.0;
}
