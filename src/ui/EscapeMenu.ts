export interface EscapeMenuCallbacks {
  onSave: () => void;
  onLoad: (file: File) => void;
  onQuit: () => void;
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
  private open = false;

  constructor(private readonly callbacks: EscapeMenuCallbacks) {
    this.overlay = this.buildOverlay();
    this.fileInput = this.buildFileInput();
    this.errorText = this.overlay.querySelector<HTMLDivElement>('.escape-menu-error')!;
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
