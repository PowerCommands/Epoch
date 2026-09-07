// Shared by the standalone editor and Game Setup. IDs reference manifest/custom
// entries; scenario files and the manifest's deterministic fallback stay intact.
export const SCENARIO_ORDER_KEY = 'epoch.scenarioOrder';

export function orderScenarios(entries, storage) {
  let ids = [];
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(SCENARIO_ORDER_KEY) || '[]');
    if (Array.isArray(value)) ids = [...new Set(value.filter(id => typeof id === 'string'))];
  } catch { /* Unavailable storage or old/corrupt preference: use source order. */ }
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return entries.map((entry, index) => ({ entry, index }))
    .sort((a, b) => (ranks.get(a.entry.key) ?? Infinity) - (ranks.get(b.entry.key) ?? Infinity) || a.index - b.index)
    .map(({ entry }) => entry);
}

export function saveScenarioOrder(entries, storage = globalThis.localStorage) {
  storage.setItem(SCENARIO_ORDER_KEY, JSON.stringify([...new Set(entries.map(entry => entry.key))]));
}
