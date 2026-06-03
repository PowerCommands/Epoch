export interface SaveGameDialogCallbacks {
  /** Called with the finalized (sanitized, `.json`-suffixed) filename. */
  onConfirm: (filename: string) => void;
  /** Optional hook for when the dialog is dismissed without saving. */
  onCancel?: () => void;
}

// Characters that are illegal in filenames on common filesystems. Mirrors the
// conservative style of the existing timestamp-based save naming, which only
// ever emits safe characters.
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*]/g;
const JSON_EXTENSION = '.json';

function stripJsonExtension(filename: string): string {
  return filename.toLowerCase().endsWith(JSON_EXTENSION)
    ? filename.slice(0, -JSON_EXTENSION.length)
    : filename;
}

/**
 * Normalize a user-entered save name into a safe download filename.
 *
 * - Empty / whitespace-only input falls back to {@link fallback}.
 * - Illegal filename characters are replaced with `-`.
 * - A typed `.json` extension is treated as the file extension, not part of
 *   the save name.
 * - The `.json` extension is always appended so the file keeps the expected
 *   save format extension.
 * - If sanitizing leaves nothing but the extension, falls back as well.
 */
export function sanitizeSaveFilename(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;

  const baseName = stripJsonExtension(trimmed).replace(ILLEGAL_FILENAME_CHARS, '-').trim();
  const name = `${baseName}${JSON_EXTENSION}`;
  // Reject results that have no base name (e.g. user typed only ".json").
  if (name.toLowerCase() === JSON_EXTENSION) return fallback;
  return name;
}

/**
 * Small modal asking the human player to confirm or edit the save filename
 * before the file is generated and downloaded.
 *
 * HTML overlay (like {@link EscapeMenu}) pinned full-viewport at a high
 * z-index so map/unit clicks never leak through. It owns no save logic — it
 * only collects a filename and hands it back through {@link SaveGameDialogCallbacks}.
 */
export class SaveGameDialog {
  private readonly overlay: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private open = false;
  private defaultFilename = '';

  constructor(private readonly callbacks: SaveGameDialogCallbacks) {
    this.overlay = this.buildOverlay();
    this.input = this.overlay.querySelector<HTMLInputElement>('.save-game-input')!;
    document.body.appendChild(this.overlay);
  }

  isOpen(): boolean {
    return this.open;
  }

  /**
   * Show the dialog with {@link defaultFilename} pre-filled, the input
   * focused and the whole text selected so typing replaces it immediately.
   */
  show(defaultFilename: string): void {
    this.defaultFilename = defaultFilename;
    this.input.value = stripJsonExtension(defaultFilename);
    this.overlay.style.display = 'flex';
    this.open = true;
    // Focus + select after the element is laid out and visible.
    requestAnimationFrame(() => {
      this.input.focus();
      this.input.select();
    });
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
  }

  shutdown(): void {
    this.overlay.remove();
  }

  private confirm(): void {
    const filename = sanitizeSaveFilename(this.input.value, this.defaultFilename);
    this.close();
    this.callbacks.onConfirm(filename);
  }

  private cancel(): void {
    this.close();
    this.callbacks.onCancel?.();
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'save-game-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
      font-family: sans-serif; color: #eee;
    `;
    // Swallow clicks/keys on the shield so the scene (and any menu behind
    // this dialog) never sees them.
    overlay.addEventListener('click', (e) => e.stopPropagation());
    overlay.addEventListener('mousedown', (e) => e.stopPropagation());
    overlay.addEventListener('mouseup', (e) => e.stopPropagation());

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid #888; border-radius: 8px;
      padding: 28px 32px; text-align: center; min-width: 360px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Save game';
    title.style.cssText =
      'font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 18px;';
    box.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'save-game-input';
    input.spellcheck = false;
    input.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      font-size: 15px; font-family: monospace;
      background: #11111e; color: #eee;
      border: 1px solid #4a90d9; border-radius: 4px; margin-bottom: 18px;
    `;
    // Keep keystrokes from leaking to Phaser shortcuts; handle Enter/Escape here.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        // Don't let Ctrl+S inside the field trigger the browser save dialog.
        e.preventDefault();
      }
    });
    box.appendChild(input);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const makeButton = (label: string, accent: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 10px 24px; font-size: 15px; cursor: pointer;
        border: 1px solid ${accent}; border-radius: 4px;
        background: transparent; color: #eee;
      `;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const saveBtn = makeButton('Save / Download', '#4a90d9', () => this.confirm());
    const cancelBtn = makeButton('Cancel', '#888', () => this.cancel());
    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(cancelBtn);
    box.appendChild(buttonRow);

    overlay.appendChild(box);
    return overlay;
  }
}
