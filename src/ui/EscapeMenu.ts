import type { SetupMusicManager } from '../systems/SetupMusicManager';
import { bindMusicControls } from './MusicControls';

export interface EscapeMenuCallbacks {
  onSave: () => void;
  onLoad: (file: File) => void;
  onQuit: () => void;
}

export interface EscapeMenuOptions {
  music?: SetupMusicManager;
}

/**
 * HTML overlay menu toggled by the Escape key.
 *
 * Pinned full-viewport at z-index 10000 so no map/unit clicks leak
 * through while it is open. Styling mirrors the diplomacy modal used
 * elsewhere in the scene.
 */
export class EscapeMenu {
  private readonly overlay: HTMLDivElement;
  private readonly fileInput: HTMLInputElement;
  private readonly errorText: HTMLDivElement;
  private readonly unbindMusicControls: (() => void) | null;
  private open = false;

  constructor(
    private readonly callbacks: EscapeMenuCallbacks,
    private readonly options: EscapeMenuOptions = {},
  ) {
    this.overlay = this.buildOverlay();
    this.fileInput = this.buildFileInput();
    this.errorText = this.overlay.querySelector<HTMLDivElement>('.escape-menu-error')!;
    this.unbindMusicControls = this.bindAudioControls();
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.fileInput);
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.clearError();
    this.overlay.style.display = 'flex';
    this.open = true;
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
  }

  setError(message: string): void {
    this.errorText.textContent = message;
    this.errorText.style.display = message ? 'block' : 'none';
  }

  clearError(): void {
    this.setError('');
  }

  shutdown(): void {
    this.unbindMusicControls?.();
    this.overlay.remove();
    this.fileInput.remove();
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'escape-menu';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
      font-family: sans-serif; color: #eee;
    `;
    // Swallow clicks/keys on the dim shield so the scene never sees them.
    overlay.addEventListener('click', (e) => e.stopPropagation());
    overlay.addEventListener('mousedown', (e) => e.stopPropagation());
    overlay.addEventListener('mouseup', (e) => e.stopPropagation());

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid #888; border-radius: 8px;
      padding: 32px 40px; text-align: center; min-width: 280px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Game menu';
    title.style.cssText =
      'font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 20px;';
    box.appendChild(title);

    box.appendChild(this.buildAudioControls());

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const makeButton = (label: string, accent: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 10px 24px; font-size: 16px; cursor: pointer;
        border: 1px solid ${accent}; border-radius: 4px;
        background: transparent; color: #eee;
      `;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const saveBtn = makeButton('Save game', '#4a90d9', () => {
      this.clearError();
      this.callbacks.onSave();
    });
    const loadBtn = makeButton('Load game', '#4a90d9', () => {
      this.clearError();
      this.fileInput.click();
    });
    const quitBtn = makeButton('Quit', '#c44', () => {
      this.clearError();
      this.callbacks.onQuit();
    });
    const resumeBtn = makeButton('Resume', '#888', () => this.close());

    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(loadBtn);
    buttonRow.appendChild(quitBtn);
    buttonRow.appendChild(resumeBtn);
    box.appendChild(buttonRow);

    const errorText = document.createElement('div');
    errorText.className = 'escape-menu-error';
    errorText.style.cssText =
      'display: none; margin-top: 16px; color: #e88; font-size: 13px; max-width: 320px;';
    box.appendChild(errorText);

    const hint = document.createElement('div');
    hint.textContent = 'Press Esc to resume';
    hint.style.cssText = 'margin-top: 16px; font-size: 12px; color: #777;';
    box.appendChild(hint);

    overlay.appendChild(box);
    return overlay;
  }

  private buildAudioControls(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'escape-audio-group';
    group.style.cssText = `
      margin-bottom: 18px; padding: 12px;
      border: 1px solid rgba(255,255,255,0.18); border-radius: 8px;
      background: rgba(255,255,255,0.05); text-align: left;
      display: grid; gap: 10px;
    `;

    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;';

    const toggle = document.createElement('input');
    toggle.className = 'escape-music-toggle';
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
    slider.className = 'escape-music-volume';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.style.cssText = 'width: 100%; accent-color: #4a90d9; cursor: pointer;';

    const value = document.createElement('span');
    value.className = 'escape-music-volume-value';
    value.style.cssText = 'font-size: 13px; color: #ccc; min-width: 34px; text-align: right;';

    row.append(volumeText, slider, value);
    group.append(label, row);
    return group;
  }

  private bindAudioControls(): (() => void) | null {
    const music = this.options.music;
    if (!music) return null;

    const toggle = this.overlay.querySelector<HTMLInputElement>('.escape-music-toggle');
    const slider = this.overlay.querySelector<HTMLInputElement>('.escape-music-volume');
    const valueLabel = this.overlay.querySelector<HTMLSpanElement>('.escape-music-volume-value');
    if (!toggle || !slider || !valueLabel) return null;

    return bindMusicControls(music, { toggle, slider, valueLabel });
  }

  private buildFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) this.callbacks.onLoad(file);
    });
    return input;
  }
}
