export const SCENARIO_ORDER_KEY: string;
export function orderScenarios<T extends { key: string }>(entries: readonly T[], storage?: Pick<Storage, 'getItem'>): T[];
export function saveScenarioOrder(entries: readonly { key: string }[], storage?: Pick<Storage, 'setItem'>): void;
