import { resolveScenarioMeta, type ResolvedScenarioMeta } from '../data/scenarioMeta';
import type { ScenarioMeta } from '../types/scenario';

/**
 * GameDate — single source of truth for converting a scenario's start metadata
 * plus a turn count into a displayable in-game date.
 *
 * Internally dates are tracked as an "astronomical" year integer with no gap at
 * the BC/AD boundary: AD n maps to n, 1 BC maps to 0, 2 BC to -1, and so on.
 * This lets every progression mode advance time with plain integer arithmetic
 * while still rendering the historical "1 BC → 1 AD" sequence (never a year 0).
 */

export const BASE_YEARS_PER_ROUND = 167;
export const YEAR_PROGRESS_DECAY = 0.026225;

/**
 * Modern-era Auto calendar cadence. Once the normal Auto progression first reaches
 * astronomical year 1900, the calendar stops using the dynamic yearly progression
 * and instead advances a fixed six months per turn. Displayed dates then alternate
 * cleanly between January 1 and July 1 (January 1900, July 1900, January 1901, …).
 * Only the normal `auto` progression is affected — `staticYear`, `monthly`, and the
 * temporary monthly World War progression are untouched.
 */
export const AUTO_MODERN_CADENCE_ASTRO_YEAR = 1900;
export const AUTO_MODERN_CADENCE_MONTHS_PER_TURN = 6;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export interface GameDate {
  /** Positive historical year (paired with isBC). Never zero. */
  year: number;
  isBC: boolean;
  /** 0-based month index (0 = January). Always 0 outside Monthly mode. */
  monthIndex: number;
  monthName: string;
  /** Signed historical year: negative for BC, positive for AD, never zero. */
  signedYear: number;
}

/** Map resolved start metadata to its astronomical year integer. */
export function metaToAstroStart(meta: ResolvedScenarioMeta): number {
  return meta.startYearIsBC ? 1 - meta.startYear : meta.startYear;
}

/**
 * First Auto round (1-based) whose unslowed progression reaches astronomical year
 * 1900 — the round where the fixed six-month modern cadence begins. The caller
 * passes an upper bound already known to sit at/after the threshold; because the
 * year progression is monotonic non-decreasing this is a plain binary search.
 */
function autoModernCadenceStartRound(
  astroStart: number,
  yearProgressionMultiplier: number,
  maxRound: number,
): number {
  let lo = 1;
  let hi = Math.max(1, maxRound);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (astroStart + autoProgressedYears(mid, yearProgressionMultiplier) >= AUTO_MODERN_CADENCE_ASTRO_YEAR) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

/**
 * Absolute month ordinal for the normal Auto calendar at a given round. Before the
 * 1900 threshold this is January of the dynamically-progressed year (unchanged
 * legacy behavior); from the threshold round onward it advances a fixed six months
 * per turn anchored at January 1900. Returned as a month ordinal so both the direct
 * date computation and the runtime World-War continuation can take clean, drift-free
 * differences.
 */
export function autoProgressedMonthOrdinal(
  round: number,
  astroStart: number,
  yearProgressionMultiplier = 1,
): number {
  const unslowedAstro = astroStart + autoProgressedYears(round, yearProgressionMultiplier);
  if (unslowedAstro < AUTO_MODERN_CADENCE_ASTRO_YEAR) return unslowedAstro * 12;
  const startRound = autoModernCadenceStartRound(astroStart, yearProgressionMultiplier, round);
  return AUTO_MODERN_CADENCE_ASTRO_YEAR * 12
    + AUTO_MODERN_CADENCE_MONTHS_PER_TURN * (round - startRound);
}

/** Convert an astronomical year integer into historical parts (no year 0). */
function astroToParts(astro: number): Pick<GameDate, 'year' | 'isBC' | 'signedYear'> {
  if (astro >= 1) return { year: astro, isBC: false, signedYear: astro };
  const year = 1 - astro; // astro 0 → 1 BC, astro -1 → 2 BC, …
  return { year, isBC: true, signedYear: -year };
}

/** Construct a normalized historical date from authored year/month parts. */
export function createGameDate(year: number, isBC: boolean, monthIndex = 0): GameDate {
  const normalizedMonth = Math.max(0, Math.min(11, Math.trunc(monthIndex)));
  const historicalYear = Math.max(1, Math.trunc(year));
  const astro = isBC ? 1 - historicalYear : historicalYear;
  return { ...astroToParts(astro), monthIndex: normalizedMonth, monthName: MONTH_NAMES[normalizedMonth] };
}

/** Monotonic month ordinal, including a seamless 1 BC -> 1 AD transition. */
export function gameDateToMonthOrdinal(date: GameDate): number {
  const astro = date.isBC ? 1 - date.year : date.year;
  return astro * 12 + date.monthIndex;
}

/** Compare two full historical dates without formatted-string or year-zero pitfalls. */
export function compareGameDates(a: GameDate, b: GameDate): number {
  return Math.sign(gameDateToMonthOrdinal(a) - gameDateToMonthOrdinal(b));
}

/** Add whole calendar months, correctly rolling years and crossing BC/AD. */
export function addMonths(date: GameDate, months: number): GameDate {
  const ordinal = gameDateToMonthOrdinal(date) + Math.trunc(months);
  const astro = Math.floor(ordinal / 12);
  const monthIndex = ordinal - astro * 12;
  return { ...astroToParts(astro), monthIndex, monthName: MONTH_NAMES[monthIndex] };
}

/** True when a forward date step enters or passes `target`. */
export function hasReachedOrCrossedDate(previous: GameDate, next: GameDate, target: GameDate): boolean {
  return compareGameDates(previous, target) < 0 && compareGameDates(target, next) <= 0;
}

/**
 * Dynamic Auto-mode year offset (>= 0) added to the scenario start year. This is
 * the same decaying progression the game has always used; only the start year is
 * now scenario-driven instead of hardcoded.
 */
export function autoProgressedYears(round: number, yearProgressionMultiplier = 1): number {
  const elapsedRounds = Math.max(0, round - 1) * yearProgressionMultiplier;
  return Math.round((elapsedRounds * BASE_YEARS_PER_ROUND) / (1 + elapsedRounds * YEAR_PROGRESS_DECAY));
}

/**
 * Compute the display date for a scenario at a given round (1-based, as used by
 * TurnManager). Turn 0 in design terms corresponds to round 1.
 */
export function computeGameDate(
  meta: ResolvedScenarioMeta,
  round: number,
  yearProgressionMultiplier = 1,
): GameDate {
  const turnsElapsed = Math.max(0, round - 1);
  const astroStart = metaToAstroStart(meta);

  let astro = astroStart;
  let monthIndex = 0;

  switch (meta.timeProgression.mode) {
    case 'staticYear': {
      const step = meta.timeProgression.staticYearStep && meta.timeProgression.staticYearStep > 0
        ? meta.timeProgression.staticYearStep
        : 1;
      astro = astroStart + turnsElapsed * step;
      break;
    }
    case 'monthly': {
      astro = astroStart + Math.floor(turnsElapsed / 12);
      monthIndex = turnsElapsed % 12;
      break;
    }
    case 'auto':
    default: {
      const ordinal = autoProgressedMonthOrdinal(round, astroStart, yearProgressionMultiplier);
      astro = Math.floor(ordinal / 12);
      monthIndex = ordinal - astro * 12;
      break;
    }
  }

  return { ...astroToParts(astro), monthIndex, monthName: MONTH_NAMES[monthIndex] };
}

/** Format a GameDate as "January 4000 BC" / "February 1939". */
export function formatGameDate(date: GameDate): string {
  return `${date.monthName} ${date.year}${date.isBC ? ' BC' : ''}`;
}

/** Convenience: resolve raw meta then compute the date in one step. */
export function computeGameDateFromMeta(
  meta: ScenarioMeta | undefined,
  round: number,
  yearProgressionMultiplier = 1,
): GameDate {
  return computeGameDate(resolveScenarioMeta(meta), round, yearProgressionMultiplier);
}
