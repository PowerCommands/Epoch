const AUTOFOCUS_ON_END_TURN_KEY = 'epoch.autofocusOnEndTurn';
const AUTO_END_TURN_KEY = 'epoch.autoEndTurn';

/**
 * Persistent, cross-game player preferences shown in the Settings dialog.
 *
 * Stored in localStorage so the same choices apply on the Start Screen and
 * in-game, and survive across sessions. Reads are wrapped defensively because
 * localStorage may be unavailable (private browsing, disabled storage, etc.).
 *
 * Audio preferences are NOT here — those live in SetupMusicManager, which
 * already owns their persistence; the Settings dialog simply binds to it.
 */

/** Default true: focus the active unit / capital at the start of each human turn. */
export function isAutofocusOnEndTurn(): boolean {
  try {
    // Absent value defaults to enabled (matching the prior behaviour).
    return localStorage.getItem(AUTOFOCUS_ON_END_TURN_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAutofocusOnEndTurn(value: boolean): void {
  try {
    localStorage.setItem(AUTOFOCUS_ON_END_TURN_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}

/** Default false: when on, the turn auto-ends once no active units need orders. */
export function isAutoEndTurn(): boolean {
  try {
    return localStorage.getItem(AUTO_END_TURN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoEndTurn(value: boolean): void {
  try {
    localStorage.setItem(AUTO_END_TURN_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}
