const DONT_SHOW_AGAIN_STORAGE_KEY = 'epoch.tutorialDontShowAgain';

/**
 * Persistent, cross-game tutorial preference.
 *
 * Default behaviour is to show the new-game tutorial wizard every time a new
 * game starts. The player can change this preference in the Settings dialog.
 *
 * `tutorialDontShowAgain === true`  → do not auto-show on a new game.
 * Any other value (missing / 'false' / legacy keys) → show the wizard.
 *
 * The flag lives in localStorage (not per-game save state) so it persists
 * across separate games. Access is wrapped defensively because localStorage may
 * be unavailable (private browsing, disabled storage, etc.).
 */
export function isTutorialDontShowAgain(): boolean {
  try {
    return localStorage.getItem(DONT_SHOW_AGAIN_STORAGE_KEY) === 'true';
  } catch {
    // localStorage might be unavailable; default to showing the wizard.
    return false;
  }
}

/**
 * Persist whether the start guide should be suppressed. Passing false clears
 * the flag so the wizard returns on the next new game.
 */
export function setTutorialDontShowAgain(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(DONT_SHOW_AGAIN_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(DONT_SHOW_AGAIN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors — the wizard will simply re-appear next game.
  }
}
