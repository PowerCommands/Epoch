import type { TechnologyDefinition, Era } from './technologies';
import { scaleGameSpeedCost, type GameSpeedDefinition } from './gameSpeeds';

/**
 * Technology-only era scaling. Keep this separate from culture pacing so research
 * can be calibrated without changing any other progression system.
 *
 * The project has an Information era between Atomic and Future; its 2.40 value is
 * the deterministic midpoint of those two configured late-game multipliers.
 */
export const TECH_ERA_COST_MULTIPLIERS: Readonly<Record<Era, number>> = {
  ancient: 1.00,
  classical: 1.00,
  medieval: 1.10,
  renaissance: 1.25,
  industrial: 1.50,
  modern: 1.80,
  atomic: 2.20,
  information: 2.40,
  future: 2.60,
};

export function getTechnologyEraCostMultiplier(era: Era): number {
  return TECH_ERA_COST_MULTIPLIERS[era] ?? 1;
}

/**
 * Canonical gameplay research cost.
 *
 * Existing game-speed scaling remains in place, then the technology's era
 * multiplier is applied. Research costs are rounded to the nearest integer,
 * consistently with the existing game-speed cost rule.
 */
export function getEffectiveTechnologyCost(
  technology: TechnologyDefinition,
  gameSpeed: GameSpeedDefinition,
): number {
  const speedAdjustedBaseCost = scaleGameSpeedCost(technology.cost, gameSpeed);
  return Math.max(
    1,
    Math.round(speedAdjustedBaseCost * getTechnologyEraCostMultiplier(technology.era)),
  );
}
