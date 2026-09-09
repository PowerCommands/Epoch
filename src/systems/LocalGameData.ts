/**
 * Clearing of all locally persisted Epoch data.
 *
 * Every browser-persisted value the game writes uses the `epoch.` key prefix
 * (player preferences, audio settings, scenario order, custom scenarios, the
 * editor/game autosaves, tutorial and history-panel flags). Rather than track
 * each key by hand, this enumerates localStorage and removes anything under the
 * shared prefix, so keys added in future are cleared without extra wiring.
 *
 * Access is wrapped defensively because localStorage may be unavailable
 * (private browsing, disabled storage, etc.).
 */
export const EPOCH_STORAGE_PREFIX = 'epoch.';

/**
 * Remove every `epoch.`-prefixed entry from localStorage. Returns the number of
 * keys removed (0 when storage is unavailable or nothing was stored).
 */
export function clearAllLocalGameData(): number {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(EPOCH_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
    return keys.length;
  } catch {
    // Ignore storage errors — nothing persisted, nothing to clear.
    return 0;
  }
}
