import type {
  ScenarioMeta,
  ScenarioTimeProgression,
  ScenarioTimeProgressionMode,
} from '../types/scenario';

/**
 * Default scenario metadata values. Applied when loading older scenarios that
 * predate the Scenario Details fields so the UI always has concrete values to
 * show. These defaults are intentionally duplicated in the standalone map
 * editor (public/editor.html), which cannot import this module.
 */
export const DEFAULT_SCENARIO_DESCRIPTION = '';
export const DEFAULT_SCENARIO_AUTHOR = '';
export const DEFAULT_SCENARIO_START_YEAR = 4000;
export const DEFAULT_SCENARIO_START_YEAR_IS_BC = true;
export const DEFAULT_QUARTERLY_TURNS_START_YEAR = 1900;
export const DEFAULT_QUARTERLY_TURNS_START_YEAR_IS_BC = false;
export const DEFAULT_SCENARIO_TIME_PROGRESSION_MODE: ScenarioTimeProgressionMode = 'auto';

/** Scenario metadata with every Scenario Details field resolved to a value. */
export interface ResolvedScenarioMeta {
  name: string;
  description: string;
  author: string;
  startYear: number;
  startYearIsBC: boolean;
  quarterlyTurnsStartYear: number;
  quarterlyTurnsStartYearIsBC: boolean;
  timeProgression: ScenarioTimeProgression;
}

/** Fill missing Scenario Details fields with defaults for safe display. */
export function resolveScenarioMeta(meta: ScenarioMeta | undefined): ResolvedScenarioMeta {
  const startYearRaw = typeof meta?.startYear === 'number' && meta.startYear > 0
    ? Math.floor(meta.startYear)
    : DEFAULT_SCENARIO_START_YEAR;
  const quarterlyTurnsStartYear = typeof meta?.quarterlyTurnsStartYear === 'number'
    && meta.quarterlyTurnsStartYear > 0
    ? Math.floor(meta.quarterlyTurnsStartYear)
    : DEFAULT_QUARTERLY_TURNS_START_YEAR;

  const mode: ScenarioTimeProgressionMode = meta?.timeProgression?.mode ?? DEFAULT_SCENARIO_TIME_PROGRESSION_MODE;
  const staticYearStep = typeof meta?.timeProgression?.staticYearStep === 'number' && meta.timeProgression.staticYearStep > 0
    ? Math.floor(meta.timeProgression.staticYearStep)
    : undefined;

  return {
    name: meta?.name ?? '',
    description: meta?.description ?? DEFAULT_SCENARIO_DESCRIPTION,
    author: meta?.author ?? DEFAULT_SCENARIO_AUTHOR,
    startYear: startYearRaw,
    startYearIsBC: meta?.startYearIsBC ?? DEFAULT_SCENARIO_START_YEAR_IS_BC,
    quarterlyTurnsStartYear,
    quarterlyTurnsStartYearIsBC: meta?.quarterlyTurnsStartYearIsBC
      ?? DEFAULT_QUARTERLY_TURNS_START_YEAR_IS_BC,
    timeProgression: { mode, staticYearStep },
  };
}

/** Format a resolved start year as "4000 BC" or "1939". */
export function formatScenarioStartYear(meta: ResolvedScenarioMeta): string {
  return `${meta.startYear}${meta.startYearIsBC ? ' BC' : ''}`;
}

/** Human-readable description of the time progression setup. */
export function formatScenarioTimeProgression(progression: ScenarioTimeProgression): string {
  switch (progression.mode) {
    case 'staticYear': {
      const step = progression.staticYearStep && progression.staticYearStep > 0 ? progression.staticYearStep : 1;
      return `Static year, ${step} ${step === 1 ? 'year' : 'years'} per turn`;
    }
    case 'monthly':
      return 'Monthly, 1 month per turn';
    case 'auto':
    default:
      return 'Auto';
  }
}
