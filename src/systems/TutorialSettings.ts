const DONT_SHOW_AGAIN_STORAGE_KEY = 'epoch.tutorialDontShowAgain';

/**
 * Persistent, cross-game tutorial preference.
 *
 * Default behaviour is to show the new-game start guide and progressive tips.
 * The player can change this preference in the Settings dialog.
 *
 * `tutorialDontShowAgain === true`  → do not auto-show either guide flow.
 * Any other value (missing / 'false' / legacy keys) → show the guides.
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
 * Persist whether automatic guide popups should be suppressed. Passing false
 * clears the flag so the start guide and future due tips can appear.
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
