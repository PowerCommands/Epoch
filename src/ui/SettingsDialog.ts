import type { SetupMusicManager } from '../systems/SetupMusicManager';
import { bindMusicControls } from './MusicControls';
import {
  getDefaultCameraZoom,
  isAutoEndTurn,
  isAutofocusOnEndTurn,
  MAX_DEFAULT_CAMERA_ZOOM,
  MIN_DEFAULT_CAMERA_ZOOM,
  setAutoEndTurn,
  setAutofocusOnEndTurn,
  setDefaultCameraZoom,
} from '../systems/PlayerSettings';
import { isTutorialDontShowAgain, setTutorialDontShowAgain } from '../systems/TutorialSettings';
import { clearAllLocalGameData } from '../systems/LocalGameData';

export interface SettingsDialogOptions {
  /** Music manager for the audio controls; audio section is hidden when absent. */
  music?: SetupMusicManager;
  /** Notified when the player toggles a preference, so the host can react live. */
  onAutofocusChanged?: (enabled: boolean) => void;
  onAutoEndTurnChanged?: (enabled: boolean) => void;
}

/**
 * Reusable Settings dialog (Start Screen + in-game pause menu).
 *
 * Collects player preferences (Autofocus, Auto End Turn, guide tips) and audio
 * settings in one place. Built as an isolated HTML/CSS overlay so it carries no
 * external stylesheet dependency, and pinned above the pause menu so it can open
 * on top of it. Audio persistence is owned by SetupMusicManager; the preference
 * toggles persist through PlayerSettings.
 */
export class SettingsDialog {
  private readonly overlay: HTMLDivElement;
  private readonly unbindMusicControls: (() => void) | null;
  private open = false;

  constructor(private readonly options: SettingsDialogOptions = {}) {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.unbindMusicControls = this.bindAudioControls();
    this.wirePreferenceToggles();
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.syncPreferenceToggles();
    this.overlay.style.display = 'flex';
    this.open = true;
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  shutdown(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.unbindMusicControls?.();
    this.overlay.remove();
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'settings-dialog';
    overlay.setAttribute('role', 'presentation');
    overlay.appendChild(this.buildStyles());
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (e) => e.stopPropagation());
    }

    const box = document.createElement('div');
    box.className = 'settings-dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'settings-dialog-title');

    const heading = document.createElement('header');
    heading.className = 'settings-dialog-heading';
    const kicker = document.createElement('span');
    kicker.textContent = 'Player Preferences';
    const title = document.createElement('h2');
    title.id = 'settings-dialog-title';
    title.textContent = 'Settings';
    heading.append(kicker, title);
    box.appendChild(heading);

    if (this.options.music) box.appendChild(this.buildAudioGroup());
    box.appendChild(this.buildPreferencesGroup());

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset settings';
    resetBtn.title =
      'Clear all Epoch data saved in this browser: preferences, audio settings, ' +
      'scenario order, saved scenarios and autosaves. Reloads the page.';
    resetBtn.addEventListener('click', () => this.resetLocalData());
    box.appendChild(resetBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    return overlay;
  }

  private buildStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      #settings-dialog {
        --settings-panel: #07121c;
        --settings-panel-light: #0d1c29;
        --settings-gold: #b88a43;
        --settings-gold-bright: #efcd83;
        --settings-text: #f2eadb;
        --settings-muted: #9ba9b5;
        --settings-border: rgba(190, 145, 70, 0.35);
        --settings-border-soft: rgba(190, 145, 70, 0.17);
        position: fixed;
        inset: 0;
        z-index: 10002;
        display: none;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 22px;
        overflow-y: auto;
        color: var(--settings-text);
        background:
          radial-gradient(circle at 50% 42%, rgba(48, 76, 92, 0.16), transparent 32%),
          rgba(0, 5, 10, 0.82);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(7px);
      }

      #settings-dialog,
      #settings-dialog * {
        box-sizing: border-box;
      }

      #settings-dialog .settings-dialog-box {
        position: relative;
        width: min(440px, 92vw);
        padding: 25px;
        background:
          linear-gradient(145deg, rgba(17, 32, 45, 0.98), rgba(5, 13, 22, 0.99));
        border: 1px solid var(--settings-border);
        border-radius: 2px;
        box-shadow:
          0 28px 80px rgba(0, 0, 0, 0.7),
          inset 0 1px 0 rgba(255, 255, 255, 0.035),
          inset 0 0 70px rgba(0, 0, 0, 0.16);
      }

      #settings-dialog .settings-dialog-box::before,
      #settings-dialog .settings-dialog-box::after {
        content: '';
        position: absolute;
        left: 50%;
        width: 7px;
        height: 7px;
        transform: translateX(-50%) rotate(45deg);
        border: 1px solid var(--settings-gold);
        background: #08131d;
      }

      #settings-dialog .settings-dialog-box::before { top: -5px; }
      #settings-dialog .settings-dialog-box::after { bottom: -5px; }

      #settings-dialog .settings-dialog-heading {
        position: relative;
        margin-bottom: 18px;
        padding-bottom: 17px;
        text-align: center;
        border-bottom: 1px solid var(--settings-border-soft);
      }

      #settings-dialog .settings-dialog-heading::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 5px;
        height: 5px;
        transform: translateX(-50%) rotate(45deg);
        background: var(--settings-gold);
        box-shadow: 0 0 9px rgba(224, 172, 82, 0.28);
      }

      #settings-dialog .settings-dialog-heading span,
      #settings-dialog .settings-section-title {
        display: block;
        color: var(--settings-gold);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.2em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      #settings-dialog .settings-dialog-heading h2 {
        margin: 4px 0 0;
        color: var(--settings-text);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 29px;
        font-weight: 400;
        letter-spacing: 0.08em;
        line-height: 1.15;
      }

      #settings-dialog .settings-group {
        position: relative;
        margin-bottom: 11px;
        padding: 31px 14px 14px;
        text-align: left;
        background: linear-gradient(145deg, rgba(13, 28, 41, 0.92), rgba(6, 15, 24, 0.94));
        border: 1px solid var(--settings-border-soft);
        border-radius: 1px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      #settings-dialog .settings-section-title {
        position: absolute;
        top: 10px;
        left: 14px;
      }

      #settings-dialog .settings-control-row,
      #settings-dialog .settings-checkbox-row {
        transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
      }

      #settings-dialog .settings-control-row {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr) 40px;
        align-items: center;
        gap: 10px;
        min-height: 34px;
      }

      #settings-dialog .settings-control-row + .settings-control-row {
        margin-top: 8px;
      }

      #settings-dialog .settings-control-label,
      #settings-dialog .settings-checkbox-label {
        color: #d8dce0;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 14px;
        letter-spacing: 0.02em;
      }

      #settings-dialog .settings-control-value {
        min-width: 40px;
        color: var(--settings-gold-bright);
        font: 11px/1 Inter, ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.04em;
        text-align: right;
      }

      #settings-dialog input[type="range"] {
        width: 100%;
        height: 18px;
        margin: 0;
        appearance: none;
        background: transparent;
        cursor: pointer;
      }

      #settings-dialog input[type="range"]::-webkit-slider-runnable-track {
        height: 3px;
        background: linear-gradient(90deg, #74501f, #b88a43);
        border: 1px solid rgba(231, 190, 110, 0.18);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
      }

      #settings-dialog input[type="range"]::-webkit-slider-thumb {
        width: 14px;
        height: 14px;
        margin-top: -6px;
        appearance: none;
        border: 2px solid #f0cf88;
        border-radius: 50%;
        background: #6f4b1c;
        box-shadow: 0 0 0 2px #101b24, 0 0 9px rgba(225, 176, 83, 0.22);
      }

      #settings-dialog input[type="range"]::-moz-range-track {
        height: 3px;
        background: #9b6f2e;
        border: 1px solid rgba(231, 190, 110, 0.18);
      }

      #settings-dialog input[type="range"]::-moz-range-thumb {
        width: 11px;
        height: 11px;
        border: 2px solid #f0cf88;
        border-radius: 50%;
        background: #6f4b1c;
        box-shadow: 0 0 0 2px #101b24;
      }

      #settings-dialog input[type="range"]:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      #settings-dialog .settings-checkbox-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        column-gap: 10px;
        row-gap: 3px;
        align-items: center;
        min-height: 46px;
        margin: 0 -5px;
        padding: 7px 6px;
        border: 1px solid transparent;
        border-radius: 1px;
        cursor: pointer;
      }

      #settings-dialog .settings-checkbox-row + .settings-checkbox-row,
      #settings-dialog .settings-control-row + .settings-checkbox-row,
      #settings-dialog .settings-checkbox-row + .settings-control-row {
        margin-top: 3px;
      }

      #settings-dialog .settings-checkbox-row:hover {
        background: rgba(31, 48, 61, 0.56);
        border-color: var(--settings-border-soft);
      }

      #settings-dialog input[type="checkbox"] {
        grid-row: 1 / span 2;
        width: 17px;
        height: 17px;
        margin: 0;
        accent-color: var(--settings-gold);
        cursor: pointer;
      }

      #settings-dialog .settings-control-hint {
        grid-column: 2;
        color: var(--settings-muted);
        font-size: 11px;
        line-height: 1.35;
      }

      #settings-dialog .settings-close-btn {
        position: relative;
        width: 100%;
        min-height: 43px;
        margin-top: 7px;
        padding: 9px 22px;
        color: #e8e2d7;
        background: linear-gradient(180deg, rgba(25, 39, 52, 0.96), rgba(8, 17, 27, 0.98));
        border: 1px solid var(--settings-border);
        border-radius: 1px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 100ms ease;
      }

      #settings-dialog .settings-close-btn::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 2px;
        background: var(--settings-gold);
        opacity: 0.65;
      }

      #settings-dialog .settings-close-btn:hover {
        color: #fff2cf;
        border-color: rgba(232, 184, 99, 0.72);
        background: linear-gradient(180deg, rgba(40, 55, 67, 0.98), rgba(13, 24, 35, 0.99));
        box-shadow: inset 0 0 18px rgba(214, 163, 78, 0.07);
      }

      #settings-dialog .settings-close-btn:active { transform: translateY(1px); }

      #settings-dialog .settings-reset-btn {
        display: block;
        width: 100%;
        margin-top: 4px;
        padding: 7px 12px;
        color: var(--settings-muted);
        background: transparent;
        border: 1px solid var(--settings-border-soft);
        border-radius: 1px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
      }

      #settings-dialog .settings-reset-btn:hover {
        color: #e7b0a0;
        border-color: rgba(179, 87, 66, 0.55);
        background: rgba(120, 40, 30, 0.12);
      }

      #settings-dialog input:focus-visible,
      #settings-dialog button:focus-visible {
        outline: 2px solid var(--settings-gold-bright);
        outline-offset: 2px;
      }

      @media (max-width: 480px) {
        #settings-dialog { padding: 12px; align-items: flex-start; }
        #settings-dialog .settings-dialog-box { width: 100%; padding: 20px 16px; margin: auto 0; }
        #settings-dialog .settings-dialog-heading h2 { font-size: 25px; }
        #settings-dialog .settings-group { padding-inline: 11px; }
        #settings-dialog .settings-control-row { grid-template-columns: 82px minmax(0, 1fr) 38px; gap: 7px; }
      }

      @media (prefers-reduced-motion: reduce) {
        #settings-dialog * { transition-duration: 0.01ms !important; }
      }
    `;
    return style;
  }

  private buildAudioGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'settings-group settings-audio-group';
    group.appendChild(this.buildSectionTitle('Audio'));

    const label = document.createElement('label');
    label.className = 'settings-checkbox-row';
    const toggle = document.createElement('input');
    toggle.className = 'settings-music-toggle';
    toggle.type = 'checkbox';
    const toggleText = document.createElement('span');
    toggleText.className = 'settings-checkbox-label';
    toggleText.textContent = 'Music';
    label.append(toggle, toggleText);

    const row = document.createElement('div');
    row.className = 'settings-control-row';
    const volumeText = document.createElement('span');
    volumeText.className = 'settings-control-label';
    volumeText.textContent = 'Volume';
    const slider = document.createElement('input');
    slider.className = 'settings-music-volume';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    const value = document.createElement('span');
    value.className = 'settings-music-volume-value settings-control-value';
    row.append(volumeText, slider, value);

    group.append(label, row);
    return group;
  }

  private buildPreferencesGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'settings-group settings-preferences-group';
    group.appendChild(this.buildSectionTitle('Gameplay'));

    group.appendChild(this.buildCheckbox(
      'settings-autofocus-toggle',
      'Autofocus on end turn',
      'Center the camera on the active unit or capital each turn.',
    ));
    group.appendChild(this.buildDefaultZoomControl());
    group.appendChild(this.buildCheckbox(
      'settings-auto-end-turn-toggle',
      'Auto end turn',
      'Automatically end the turn when no units need orders.',
    ));
    group.appendChild(this.buildCheckbox(
      'settings-start-guide-toggle',
      'Show guide tips',
      'Show the startup guide and progressive guide tips.',
    ));

    return group;
  }

  private buildSectionTitle(text: string): HTMLSpanElement {
    const title = document.createElement('span');
    title.className = 'settings-section-title';
    title.textContent = text;
    return title;
  }

  private buildDefaultZoomControl(): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'settings-control-row';

    const text = document.createElement('span');
    text.className = 'settings-control-label';
    text.textContent = 'Default zoom';

    const slider = document.createElement('input');
    slider.className = 'settings-default-zoom';
    slider.type = 'range';
    slider.min = MIN_DEFAULT_CAMERA_ZOOM.toFixed(2);
    slider.max = MAX_DEFAULT_CAMERA_ZOOM.toFixed(2);
    slider.step = '0.05';

    const value = document.createElement('span');
    value.className = 'settings-default-zoom-value settings-control-value';

    label.append(text, slider, value);
    return label;
  }

  private buildCheckbox(className: string, labelText: string, hint: string): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'settings-checkbox-row';
    const input = document.createElement('input');
    input.className = className;
    input.type = 'checkbox';
    const text = document.createElement('span');
    text.className = 'settings-checkbox-label';
    text.textContent = labelText;
    const hintText = document.createElement('span');
    hintText.className = 'settings-control-hint';
    hintText.textContent = hint;
    label.append(input, text, hintText);
    return label;
  }

  private bindAudioControls(): (() => void) | null {
    const music = this.options.music;
    if (!music) return null;
    const toggle = this.overlay.querySelector<HTMLInputElement>('.settings-music-toggle');
    const slider = this.overlay.querySelector<HTMLInputElement>('.settings-music-volume');
    const valueLabel = this.overlay.querySelector<HTMLSpanElement>('.settings-music-volume-value');
    if (!toggle || !slider || !valueLabel) return null;
    return bindMusicControls(music, { toggle, slider, valueLabel });
  }

  private wirePreferenceToggles(): void {
    const autofocus = this.overlay.querySelector<HTMLInputElement>('.settings-autofocus-toggle');
    const autoEndTurn = this.overlay.querySelector<HTMLInputElement>('.settings-auto-end-turn-toggle');
    const startGuide = this.overlay.querySelector<HTMLInputElement>('.settings-start-guide-toggle');
    const defaultZoom = this.overlay.querySelector<HTMLInputElement>('.settings-default-zoom');
    const defaultZoomValue = this.overlay.querySelector<HTMLSpanElement>('.settings-default-zoom-value');
    autofocus?.addEventListener('change', () => {
      setAutofocusOnEndTurn(autofocus.checked);
      this.options.onAutofocusChanged?.(autofocus.checked);
    });
    autoEndTurn?.addEventListener('change', () => {
      setAutoEndTurn(autoEndTurn.checked);
      this.options.onAutoEndTurnChanged?.(autoEndTurn.checked);
    });
    startGuide?.addEventListener('change', () => {
      setTutorialDontShowAgain(!startGuide.checked);
    });
    defaultZoom?.addEventListener('input', () => {
      const value = Number(defaultZoom.value);
      setDefaultCameraZoom(value);
      if (defaultZoomValue) defaultZoomValue.textContent = value.toFixed(2);
    });
  }

  private syncPreferenceToggles(): void {
    const autofocus = this.overlay.querySelector<HTMLInputElement>('.settings-autofocus-toggle');
    const autoEndTurn = this.overlay.querySelector<HTMLInputElement>('.settings-auto-end-turn-toggle');
    const startGuide = this.overlay.querySelector<HTMLInputElement>('.settings-start-guide-toggle');
    const defaultZoom = this.overlay.querySelector<HTMLInputElement>('.settings-default-zoom');
    const defaultZoomValue = this.overlay.querySelector<HTMLSpanElement>('.settings-default-zoom-value');
    if (autofocus) autofocus.checked = isAutofocusOnEndTurn();
    if (autoEndTurn) autoEndTurn.checked = isAutoEndTurn();
    if (startGuide) startGuide.checked = !isTutorialDontShowAgain();
    const zoom = getDefaultCameraZoom();
    if (defaultZoom) defaultZoom.value = zoom.toFixed(2);
    if (defaultZoomValue) defaultZoomValue.textContent = zoom.toFixed(2);
  }

  /**
   * Clear all Epoch data saved in this browser, then reload so every system
   * re-initialises from defaults (the in-memory audio manager, scenario order,
   * etc. read their persisted state only at startup).
   */
  private resetLocalData(): void {
    const confirmed = window.confirm(
      'Reset all Epoch settings saved in this browser?\n\n' +
        'This clears player preferences, audio settings, scenario order, saved ' +
        'scenarios and autosaves, then reloads the page. It cannot be undone.',
    );
    if (!confirmed) return;
    clearAllLocalGameData();
    window.location.reload();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === 'Escape') {
      // Close settings and stop the key from reaching the scene/menu underneath.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close();
    }
  };
}
