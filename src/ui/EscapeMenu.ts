import { EMPIRE_OVERLAY_STYLE } from './EmpireDialogTheme';

export interface EscapeMenuCallbacks {
  onSave: () => void;
  onLoad: (file: File) => void;
  onQuit: () => void;
  onTutorial: () => void;
  onShowTutorial: () => void;
  onSettings: () => void;
}

/**
 * HTML overlay menu toggled by the Escape key.
 *
 * Pinned full-viewport at z-index 10000 so no map/unit clicks leak
 * through while it is open. Branding and styling follow the current
 * landing screen. Audio and player preferences live in the
 * shared Settings dialog, reachable via the Settings button.
 */
export class EscapeMenu {
  private readonly overlay: HTMLDivElement;
  private readonly fileInput: HTMLInputElement;
  private readonly errorText: HTMLDivElement;
  private open = false;

  constructor(
    private readonly callbacks: EscapeMenuCallbacks,
  ) {
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
    overlay.style.cssText = `${EMPIRE_OVERLAY_STYLE} z-index:10000;display:none;`;
    // This menu uses the landing artwork and responsive spacing from its CSS.
    overlay.style.removeProperty('background');
    overlay.style.removeProperty('padding');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pause menu');
    overlay.appendChild(this.buildStyles());
    for (const type of ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel']) {
      overlay.addEventListener(type, event => event.stopPropagation());
    }

    const box = document.createElement('div');
    box.className = 'escape-menu-shell';
    const brand = document.createElement('header');
    brand.className = 'escape-menu-brand';
    brand.innerHTML = `
      <div class="escape-menu-kicker">A grand strategy sandbox through the ages</div>
      <img class="escape-menu-logo" src="/assets/epoch-logo.jpg" alt="" aria-hidden="true">
      <h1 class="escape-menu-title">Epochs <span>of Time</span></h1>
      <div class="escape-menu-subtitle">Your history awaits.</div>
    `;
    box.appendChild(brand);

    const buttonRow = document.createElement('nav');
    buttonRow.className = 'escape-menu-actions';
    buttonRow.setAttribute('aria-label', 'Game menu actions');
    const makeButton = (label: string, className: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `escape-menu-button ${className}`;
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const saveBtn = makeButton('Save game', 'escape-menu-save', () => {
      this.clearError();
      this.callbacks.onSave();
    });
    const loadBtn = makeButton('Load game', 'escape-menu-load', () => {
      this.clearError();
      this.fileInput.click();
    });
    const tutorialBtn = makeButton('Show tips', 'escape-menu-tips', () => {
      this.clearError();
      this.callbacks.onTutorial();
    });
    const showTutorialBtn = makeButton('Tutorial', 'escape-menu-tutorial', () => {
      this.clearError();
      // Opens the tutorial overlay on top of this menu without resuming the
      // game; the menu stays open underneath so closing the tutorial returns
      // here (see GameScene wiring).
      this.callbacks.onShowTutorial();
    });
    const settingsBtn = makeButton('Settings', 'escape-menu-settings', () => {
      this.clearError();
      this.callbacks.onSettings();
    });
    const quitBtn = makeButton('Main menu', 'escape-menu-quit', () => {
      this.clearError();
      this.callbacks.onQuit();
    });
    const resumeBtn = makeButton('Resume game', 'escape-menu-resume', () => this.close());

    buttonRow.append(resumeBtn, saveBtn, loadBtn, showTutorialBtn, settingsBtn, tutorialBtn, quitBtn);
    box.appendChild(buttonRow);

    const errorText = document.createElement('div');
    errorText.className = 'escape-menu-error';
    errorText.style.display = 'none';
    errorText.setAttribute('role', 'alert');
    box.appendChild(errorText);

    const hint = document.createElement('div');
    hint.className = 'escape-menu-hint';
    hint.innerHTML = '<span>Pause menu</span><span>Press <kbd>Esc</kbd> to resume</span>';
    box.appendChild(hint);

    overlay.appendChild(box);
    return overlay;
  }

  private buildStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      #escape-menu {
        padding:clamp(18px,4vh,36px) 18px;overflow-y:auto;overscroll-behavior:contain;
        background:radial-gradient(ellipse at 50% 36%,rgba(184,138,67,.06),transparent 60%),
          linear-gradient(rgba(2,7,13,.8),rgba(2,7,13,.86)),url('/assets/menu-civilizations.jpg') center/cover;
      }
      #escape-menu *{box-sizing:border-box}
      .escape-menu-shell{width:min(560px,100%);margin:auto;text-align:center;padding:8px 0}
      .escape-menu-brand{display:flex;flex-direction:column;align-items:center;margin-bottom:24px}
      .escape-menu-kicker{font:700 10px/1.5 Georgia,'Times New Roman',serif;letter-spacing:.24em;text-transform:uppercase;color:var(--empire-gold-bright)}
      .escape-menu-logo{width:clamp(88px,14vh,128px);height:clamp(88px,14vh,128px);margin:12px 0 3px;border-radius:50%;object-fit:cover;mix-blend-mode:screen;filter:drop-shadow(0 0 20px rgba(220,164,72,.22))}
      .escape-menu-title{margin:0;color:var(--empire-gold-bright);font:400 clamp(42px,8vw,66px)/.95 Georgia,'Times New Roman',serif;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 2px 0 #493115,0 5px 20px #000}
      .escape-menu-title span{display:block;margin-top:10px;font-size:.44em;letter-spacing:.22em}
      .escape-menu-subtitle{margin-top:16px;color:var(--empire-muted);font:700 14px Georgia,'Times New Roman',serif;letter-spacing:.08em}
      .escape-menu-actions{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:13px;border:1px solid var(--empire-border);border-radius:2px;background:linear-gradient(145deg,rgba(5,13,22,.93),rgba(8,17,27,.85));box-shadow:0 24px 70px rgba(0,0,0,.58)}
      .escape-menu-actions::before,.escape-menu-actions::after{content:'';position:absolute;left:50%;width:7px;height:7px;transform:translateX(-50%) rotate(45deg);border:1px solid var(--empire-gold);background:#08111b}
      .escape-menu-actions::before{top:-5px}.escape-menu-actions::after{bottom:-5px}
      #escape-menu .escape-menu-button{position:relative;min-height:46px;padding:11px 12px;border:1px solid var(--empire-border-soft);border-radius:1px;color:#d8dce0;background:linear-gradient(180deg,rgba(25,39,52,.88),rgba(8,17,27,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.035);font:700 14px/1.3 Georgia,'Times New Roman',serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .16s,color .16s,border-color .16s}
      .escape-menu-button::before{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:var(--empire-gold-muted);opacity:.55}
      #escape-menu .escape-menu-button:hover{color:#fff2cf;border-color:var(--empire-gold);background:linear-gradient(180deg,#283743,#0d1823)}
      #escape-menu .escape-menu-button:focus-visible{outline:2px solid var(--empire-gold-bright);outline-offset:3px}
      #escape-menu .escape-menu-resume{grid-column:1/-1;min-height:52px;color:#fff4d5;border-color:rgba(239,193,109,.64);background:var(--empire-primary);box-shadow:inset 0 1px 0 rgba(255,235,184,.25),0 0 22px rgba(184,126,41,.1);font-size:17px}
      #escape-menu .escape-menu-resume:hover{background:var(--empire-primary-hover)}
      .escape-menu-hint{display:flex;justify-content:space-between;gap:12px;margin:18px 2px 0;color:var(--empire-muted);font-size:11px;letter-spacing:.06em}
      .escape-menu-hint>span:first-child{color:var(--empire-gold);text-transform:uppercase}
      .escape-menu-hint kbd{padding:2px 5px;border:1px solid var(--empire-border);border-radius:2px;font:inherit;color:var(--empire-gold-bright)}
      .escape-menu-error{margin-top:16px;padding:12px;border:1px solid #94504b;background:rgba(75,24,24,.7);color:#ffc1b8;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
      @media(max-height:650px){
        .escape-menu-brand{margin-bottom:18px}.escape-menu-logo{width:72px;height:72px;margin:8px 0}
        .escape-menu-title{font-size:44px}.escape-menu-subtitle{margin-top:10px;font-size:12px}
        #escape-menu .escape-menu-button{min-height:40px;padding:9px 10px}
        #escape-menu .escape-menu-resume{min-height:46px}
      }
      @media(max-width:420px){
        .escape-menu-kicker{font-size:9px;letter-spacing:.15em}.escape-menu-actions{gap:8px;padding:10px}
        #escape-menu .escape-menu-button{font-size:12px;letter-spacing:.06em}
        #escape-menu .escape-menu-resume{font-size:16px}
      }
      @media(prefers-reduced-motion:reduce){#escape-menu .escape-menu-button{transition:none}}
    `;
    return style;
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
