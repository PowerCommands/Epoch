import type {
  ScenarioData,
  ScenarioHistoricalEvent,
  ScenarioTurningPointEventType,
  ScenarioTurningPointHistoricalEvent,
} from '../types/scenario';

/** Legacy trigger years retained solely for scenarios predating authored Turning Points. */
export const LEGACY_TURNING_POINT_TRIGGER_YEARS: Readonly<Record<ScenarioTurningPointEventType, number>> = {
  culturalJealousy: 1500,
  reconciliation: 1800,
  luckyLoser: 1500,
  unluckyWinner: 1914,
};

export const TURNING_POINT_EVENT_NAMES: Readonly<Record<ScenarioTurningPointEventType, string>> = {
  culturalJealousy: 'Cultural Jealousy',
  reconciliation: 'Reconciliation',
  luckyLoser: 'Lucky Loser',
  unluckyWinner: 'Unlucky Winner',
};

export const SCENARIO_TURNING_POINT_TYPES = Object.freeze(
  Object.keys(TURNING_POINT_EVENT_NAMES) as ScenarioTurningPointEventType[],
);

export type ScenarioTurningPointTriggerYears = Record<ScenarioTurningPointEventType, number | null>;

export function isScenarioTurningPointEvent(
  event: ScenarioHistoricalEvent,
): event is ScenarioTurningPointHistoricalEvent {
  return SCENARIO_TURNING_POINT_TYPES.includes(event.type as ScenarioTurningPointEventType);
}

/**
 * New-format scenarios are authoritative: an omitted type is disabled. Legacy
 * scenarios retain the old behavior, while accepting any transitional explicit
 * entry as an override of its old default.
 */
export function resolveScenarioTurningPointTriggerYears(
  scenario: Pick<ScenarioData, 'historicalEvents' | 'turningPointEventsConfigured'>,
): ScenarioTurningPointTriggerYears {
  const authoritative = scenario.turningPointEventsConfigured === true;
  const result = Object.fromEntries(SCENARIO_TURNING_POINT_TYPES.map((type) => [
    type,
    authoritative ? null : LEGACY_TURNING_POINT_TRIGGER_YEARS[type],
  ])) as ScenarioTurningPointTriggerYears;
  const seen = new Set<ScenarioTurningPointEventType>();
  for (const event of scenario.historicalEvents ?? []) {
    if (!isScenarioTurningPointEvent(event) || seen.has(event.type)) continue;
    seen.add(event.type);
    if (Number.isInteger(event.startYear) && event.startYear > 0) result[event.type] = event.startYear;
  }
  return result;
}

/** Editor/import migration payload: make legacy defaults visible and explicit. */
export function createLegacyTurningPointEvents(): ScenarioTurningPointHistoricalEvent[] {
  return SCENARIO_TURNING_POINT_TYPES.map((type) => ({
    id: `turning-point-${type}`,
    type,
    name: TURNING_POINT_EVENT_NAMES[type],
    startYear: LEGACY_TURNING_POINT_TRIGGER_YEARS[type],
  }));
}
