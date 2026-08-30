import type { TechnologyDefinition, Era } from './technologies';
import { scaleGameSpeedCost, type GameSpeedDefinition } from './gameSpeeds';
import { getEraTimelineEntry } from './eraTimeline';

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
 * Global research pacing factor. Research progresses this many times faster than
 * the raw (era- and timeline-adjusted) cost would otherwise allow. Because the
 * canonical value is a *cost*, a speed factor of 1.40 (40% faster) is applied by
 * dividing the effective cost, i.e. multiplying by 1 / 1.40.
 *
 * This is technology-only. Culture/Civic pacing lives in eraPacingMultipliers.ts
 * and is deliberately left untouched.
 */
export const RESEARCH_SPEED_FACTOR = 1.4;

/**
 * Timeline resistance is calibrated so that 100 years early adds 70% cost.
 * The base power curve keeps the first few decades manageable. A quadratic tail
 * begins smoothly at 150 years ahead and steepens extreme historical compression.
 * Only this timeline multiplier is capped; technologies always remain researchable.
 *
 * x = yearsAhead / 100
 * calculated = 1 + 0.7 × x^1.5 + 1.53 × max(0, x - 1.5)^2
 * multiplier = min(calculated, 8)
 */
export const AHEAD_OF_TIME_REFERENCE_YEARS = 100;
export const AHEAD_OF_TIME_REFERENCE_PENALTY = 0.7;
export const AHEAD_OF_TIME_EXPONENT = 1.5;
export const AHEAD_OF_TIME_TAIL_START_YEARS = 150;
export const AHEAD_OF_TIME_TAIL_STRENGTH = 1.53;
export const MAX_AHEAD_OF_TIME_MULTIPLIER = 8;

export interface AheadOfTimeResearchCostDetails {
  readonly currentYear: number;
  readonly eraStartYear: number;
  readonly yearsAhead: number;
  readonly multiplier: number;
  readonly penaltyPercent: number;
}

export function getAheadOfTimeResearchCostDetails(
  era: Era,
  currentYear: number,
): AheadOfTimeResearchCostDetails {
  const eraStartYear = getEraTimelineEntry(era)?.startYear ?? currentYear;
  const yearsAhead = Math.max(0, eraStartYear - currentYear);
  const normalizedYearsAhead = yearsAhead / AHEAD_OF_TIME_REFERENCE_YEARS;
  const normalizedTailStart = AHEAD_OF_TIME_TAIL_START_YEARS / AHEAD_OF_TIME_REFERENCE_YEARS;
  const tailYears = Math.max(0, normalizedYearsAhead - normalizedTailStart);
  const calculatedMultiplier = yearsAhead === 0
    ? 1
    : 1
      + AHEAD_OF_TIME_REFERENCE_PENALTY * (normalizedYearsAhead ** AHEAD_OF_TIME_EXPONENT)
      + AHEAD_OF_TIME_TAIL_STRENGTH * (tailYears ** 2);
  const multiplier = Math.min(calculatedMultiplier, MAX_AHEAD_OF_TIME_MULTIPLIER);
  return {
    currentYear,
    eraStartYear,
    yearsAhead,
    multiplier,
    penaltyPercent: Math.round((multiplier - 1) * 100),
  };
}

export function getAheadOfTimeResearchCostMultiplier(era: Era, currentYear: number): number {
  return getAheadOfTimeResearchCostDetails(era, currentYear).multiplier;
}

/**
 * Canonical gameplay research cost.
 *
 * Existing game-speed scaling remains in place, then the technology's era
 * multiplier and timeline multiplier are applied. The existing progressive
 * result is rounded exactly as before; timeline resistance is then applied once
 * and rounded to the nearest integer. Finally the global research pacing factor
 * is applied so research progresses 40% faster (cost divided by 1.40).
 */
export function getEffectiveTechnologyCost(
  technology: TechnologyDefinition,
  gameSpeed: GameSpeedDefinition,
  currentYear: number = Number.POSITIVE_INFINITY,
): number {
  const speedAdjustedBaseCost = scaleGameSpeedCost(technology.cost, gameSpeed);
  const progressiveCost = Math.max(
    1,
    Math.round(speedAdjustedBaseCost * getTechnologyEraCostMultiplier(technology.era)),
  );
  const timelineAdjustedCost = Math.max(
    1,
    Math.round(progressiveCost * getAheadOfTimeResearchCostMultiplier(technology.era, currentYear)),
  );
  return Math.max(1, Math.round(timelineAdjustedCost / RESEARCH_SPEED_FACTOR));
}
