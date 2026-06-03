export interface ConfirmDialogOptions {
  title: string;
  /** Body text, one entry per paragraph. */
  body: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Small modal confirmation dialog.
 *
 * HTML overlay (styled like {@link EscapeMenu}) pinned full-viewport at a high
 * z-index so map/unit clicks never leak through. It owns no game logic — the
 * caller supplies the title, body and button callbacks. A single instance can
 * be reused: each {@link show} call rebuilds the content and rebinds callbacks.
 */
export class ConfirmDialog {
  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;
  private open = false;
  private options: ConfirmDialogOptions | null = null;

  constructor() {
    this.overlay = this.buildOverlay();
    this.titleEl = this.overlay.querySelector<HTMLDivElement>('.confirm-dialog-title')!;
    this.bodyEl = this.overlay.querySelector<HTMLDivElement>('.confirm-dialog-body')!;
    this.confirmBtn = this.overlay.querySelector<HTMLButtonElement>('.confirm-dialog-confirm')!;
    this.cancelBtn = this.overlay.querySelector<HTMLButtonElement>('.confirm-dialog-cancel')!;
    document.body.appendChild(this.overlay);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(options: ConfirmDialogOptions): void {
    this.options = options;
    this.titleEl.textContent = options.title;
    this.bodyEl.replaceChildren(
      ...options.body.map((text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        paragraph.style.cssText = 'margin: 0 0 12px 0; line-height: 1.5;';
        return paragraph;
      }),
    );
    this.confirmBtn.textContent = options.confirmLabel;
    this.cancelBtn.textContent = options.cancelLabel;
    this.overlay.style.display = 'flex';
    this.open = true;
    requestAnimationFrame(() => this.confirmBtn.focus());
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
    this.options = null;
  }

  shutdown(): void {
    this.overlay.remove();
  }

  private confirm(): void {
    const options = this.options;
    this.close();
    options?.onConfirm();
  }

  private cancel(): void {
    const options = this.options;
    this.close();
    options?.onCancel?.();
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10002;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
      font-family: sans-serif; color: #eee;
    `;
    // Swallow clicks/keys on the shield so nothing behind this dialog reacts.
    overlay.addEventListener('click', (e) => e.stopPropagation());
    overlay.addEventListener('mousedown', (e) => e.stopPropagation());
    overlay.addEventListener('mouseup', (e) => e.stopPropagation());
    overlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.confirm();
      }
    });

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid #888; border-radius: 8px;
      padding: 28px 32px; max-width: 460px;
    `;

    const title = document.createElement('div');
    title.className = 'confirm-dialog-title';
    title.style.cssText =
      'font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 18px; text-align: center;';
    box.appendChild(title);

    const body = document.createElement('div');
    body.className = 'confirm-dialog-body';
    body.style.cssText = 'font-size: 14px; color: #ddd; margin-bottom: 20px;';
    box.appendChild(body);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const makeButton = (className: string, accent: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.className = className;
      btn.style.cssText = `
        padding: 10px 24px; font-size: 15px; cursor: pointer;
        border: 1px solid ${accent}; border-radius: 4px;
        background: transparent; color: #eee;
      `;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const confirmBtn = makeButton('confirm-dialog-confirm', '#4a90d9', () => this.confirm());
    const cancelBtn = makeButton('confirm-dialog-cancel', '#888', () => this.cancel());
    buttonRow.appendChild(confirmBtn);
    buttonRow.appendChild(cancelBtn);
    box.appendChild(buttonRow);

    overlay.appendChild(box);
    return overlay;
  }
}
