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
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10002;
      display: none; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      font-family: sans-serif; color: #eee;
    `;
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (e) => e.stopPropagation());
    }

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid #888; border-radius: 8px;
      padding: 28px 34px; min-width: 320px; max-width: 92vw;
    `;

    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.cssText =
      'font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 20px; text-align: center;';
    box.appendChild(title);

    if (this.options.music) box.appendChild(this.buildAudioGroup());
    box.appendChild(this.buildPreferencesGroup());

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      margin-top: 20px; width: 100%; padding: 10px 24px; font-size: 16px; cursor: pointer;
      border: 1px solid #888; border-radius: 4px; background: transparent; color: #eee;
    `;
    closeBtn.addEventListener('click', () => this.close());
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    return overlay;
  }

  private buildAudioGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'settings-audio-group';
    group.style.cssText = `
      margin-bottom: 16px; padding: 12px;
      border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;
      background: rgba(255,255,255,0.05); text-align: left; display: grid; gap: 10px;
    `;

    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;';
    const toggle = document.createElement('input');
    toggle.className = 'settings-music-toggle';
    toggle.type = 'checkbox';
    toggle.style.cssText = 'width: 16px; height: 16px; accent-color: #4a90d9; cursor: pointer;';
    const toggleText = document.createElement('span');
    toggleText.textContent = 'Music';
    label.append(toggle, toggleText);

    const row = document.createElement('div');
    row.style.cssText = 'display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px;';
    const volumeText = document.createElement('span');
    volumeText.textContent = 'Volume';
    volumeText.style.cssText = 'font-size: 13px; color: #aaa;';
    const slider = document.createElement('input');
    slider.className = 'settings-music-volume';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.style.cssText = 'width: 100%; accent-color: #4a90d9; cursor: pointer;';
    const value = document.createElement('span');
    value.className = 'settings-music-volume-value';
    value.style.cssText = 'font-size: 13px; color: #ccc; min-width: 34px; text-align: right;';
    row.append(volumeText, slider, value);

    group.append(label, row);
    return group;
  }

  private buildPreferencesGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.style.cssText = `
      padding: 12px; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;
      background: rgba(255,255,255,0.05); text-align: left; display: grid; gap: 12px;
    `;

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

  private buildDefaultZoomControl(): HTMLLabelElement {
    const label = document.createElement('label');
    label.style.cssText = 'display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; cursor: pointer;';

    const text = document.createElement('span');
    text.textContent = 'Default zoom';
    text.style.cssText = 'font-size: 13px; color: #aaa;';

    const slider = document.createElement('input');
    slider.className = 'settings-default-zoom';
    slider.type = 'range';
    slider.min = MIN_DEFAULT_CAMERA_ZOOM.toFixed(2);
    slider.max = MAX_DEFAULT_CAMERA_ZOOM.toFixed(2);
    slider.step = '0.05';
    slider.style.cssText = 'width: 100%; accent-color: #4a90d9; cursor: pointer;';

    const value = document.createElement('span');
    value.className = 'settings-default-zoom-value';
    value.style.cssText = 'font-size: 13px; color: #ccc; min-width: 36px; text-align: right;';

    label.append(text, slider, value);
    return label;
  }

  private buildCheckbox(className: string, labelText: string, hint: string): HTMLLabelElement {
    const label = document.createElement('label');
    label.style.cssText = 'display: grid; grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 2px; align-items: center; cursor: pointer;';
    const input = document.createElement('input');
    input.className = className;
    input.type = 'checkbox';
    input.style.cssText = 'width: 16px; height: 16px; accent-color: #4a90d9; cursor: pointer;';
    const text = document.createElement('span');
    text.textContent = labelText;
    text.style.cssText = 'font-size: 14px;';
    const hintText = document.createElement('span');
    hintText.textContent = hint;
    hintText.style.cssText = 'grid-column: 2; font-size: 12px; color: #9aa3b2;';
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
