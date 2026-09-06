export interface AllianceNameDialogOptions {
  /** Pre-filled, pre-selected name the human can accept or overwrite. */
  defaultName: string;
  /** The nation agreeing to the alliance, shown for context. */
  partnerName: string;
  /** Called with the final (trimmed, non-empty) alliance name. */
  onConfirm: (name: string) => void;
  /** Called if the human backs out of forming the alliance. */
  onCancel?: () => void;
}

/** Longest alliance name we accept — keeps council headers/logs readable. */
const MAX_ALLIANCE_NAME_LENGTH = 40;
const ACCENT = '#c9a227';

/**
 * HTML/CSS overlay that lets the human name a newly agreed alliance before it is
 * formed. Same transient-modal family as {@link ConfirmDialog} /
 * AllianceCouncilDialog: it owns no alliance logic — the caller supplies the
 * default name and the confirm/cancel callbacks, and this only collects the
 * chosen name and forwards it. The name it returns is used everywhere the
 * alliance is shown afterwards (council headers, logs, invitations).
 */
export class AllianceNameDialog {
  private overlay: HTMLDivElement | null = null;

  show(options: AllianceNameDialogOptions): void {
    this.hide();

    const overlay = document.createElement('div');
    overlay.id = 'alliance-name-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7); font-family: sans-serif; color: #eee;
    `;
    // Shield the map/units behind the modal from every pointer interaction.
    overlay.addEventListener('mousedown', (e) => e.stopPropagation());
    overlay.addEventListener('mouseup', (e) => e.stopPropagation());
    overlay.addEventListener('click', (e) => e.stopPropagation());

    const box = document.createElement('div');
    box.style.cssText = `
      background: #15151f; border: 2px solid ${ACCENT}; border-radius: 10px;
      padding: 24px 28px; width: 420px; max-width: 92vw;
    `;

    const kicker = document.createElement('div');
    kicker.textContent = 'New Alliance';
    kicker.style.cssText = `font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: ${ACCENT};`;
    box.appendChild(kicker);

    const heading = document.createElement('div');
    heading.textContent = `${options.partnerName} agrees to an alliance.`;
    heading.style.cssText = 'font-size: 18px; font-weight: bold; margin: 6px 0 4px;';
    box.appendChild(heading);

    const prompt = document.createElement('label');
    prompt.textContent = 'Name your alliance';
    prompt.style.cssText = 'display: block; font-size: 14px; color: #9aa6b5; margin: 16px 0 6px;';
    box.appendChild(prompt);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = options.defaultName;
    input.maxLength = MAX_ALLIANCE_NAME_LENGTH;
    input.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 9px 10px; font-size: 15px;
      border-radius: 6px; background: #0f0f17; color: #eee; border: 1px solid #3a3a3a;
    `;
    box.appendChild(input);

    const confirm = (): void => {
      const name = input.value.trim().slice(0, MAX_ALLIANCE_NAME_LENGTH);
      this.hide();
      options.onConfirm(name.length > 0 ? name : options.defaultName);
    };
    const cancel = (): void => {
      this.hide();
      options.onCancel?.();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 14px; justify-content: center; margin-top: 22px;';
    row.appendChild(this.button('Form Alliance', true, confirm));
    row.appendChild(this.button('Cancel', false, cancel));
    box.appendChild(row);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Focus + select so the human can type over the suggested name immediately.
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 8px 22px; font-size: 15px; cursor: pointer; border-radius: 5px;
      border: 1px solid ${primary ? ACCENT : '#666'};
      background: ${primary ? ACCENT : 'transparent'};
      color: ${primary ? '#000' : '#ccc'};
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
