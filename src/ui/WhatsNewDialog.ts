const MODAL_ID = 'whats-new-modal';
const EMPTY_MESSAGE = 'No recent updates available.';

/**
 * WhatsNewDialog — a lightweight, scrollable "release notes" overlay.
 *
 * The content is NOT a permanent history; it is a quick overview of the latest
 * changes, loaded at open time from an external text file
 * ({@link CONTENT_URL}, e.g. `public/whats-new.md`). Developers update the notes
 * between releases by editing that file — no code changes required.
 *
 * Lightweight Markdown is supported (`#`/`##` headings, `-` bullets, blank-line
 * spacing, plain paragraphs); dates or version numbers can be added freely since
 * they render as normal text. If the file is missing or empty, a simple
 * "No recent updates available." message is shown.
 *
 * Pure presentation: no data binding, no save-game integration, no history.
 */
export class WhatsNewDialog {
  async show(): Promise<void> {
    this.close();
    const overlay = this.buildOverlay();
    const body = overlay.querySelector<HTMLDivElement>('.whats-new-body')!;
    document.body.appendChild(overlay);

    const text = await this.loadContent();
    if (text === null || text.trim().length === 0) {
      this.renderEmpty(body);
    } else {
      this.renderMarkdown(body, text);
    }
  }

  close(): void {
    document.getElementById(MODAL_ID)?.remove();
    document.removeEventListener('keydown', this.handleKeyDown, true);
  }

  private async loadContent(): Promise<string | null> {
    // Served from public/ at the app base URL; editable between releases.
    const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    try {
      const response = await fetch(`${base}whats-new.md`, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.setAttribute('role', 'presentation');
    overlay.appendChild(this.buildStyles());
    // Swallow pointer events; click outside the panel closes the dialog.
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.close();
    });

    const panel = document.createElement('div');
    panel.className = 'whats-new-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'whats-new-title');

    const header = document.createElement('div');
    header.className = 'whats-new-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'whats-new-title-wrap';
    const kicker = document.createElement('span');
    kicker.textContent = 'Chronicle of Changes';
    const title = document.createElement('h1');
    title.id = 'whats-new-title';
    title.textContent = "What's New";
    titleWrap.append(kicker, title);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.className = 'whats-new-close-btn';
    closeBtn.setAttribute('aria-label', "Close What's New");
    closeBtn.addEventListener('click', () => this.close());
    header.append(titleWrap, closeBtn);

    const body = document.createElement('div');
    body.className = 'whats-new-body';

    panel.append(header, body);
    overlay.appendChild(panel);
    document.addEventListener('keydown', this.handleKeyDown, true);
    return overlay;
  }

  private buildStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      #${MODAL_ID} {
        --news-gold: #b88a43;
        --news-gold-bright: #efcd83;
        --news-text: #eee8dc;
        --news-muted: #9ba9b5;
        --news-border: rgba(190, 145, 70, 0.35);
        --news-border-soft: rgba(190, 145, 70, 0.17);
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 20px;
        color: var(--news-text);
        background:
          radial-gradient(circle at 50% 40%, rgba(49, 80, 96, 0.15), transparent 36%),
          rgba(0, 5, 10, 0.84);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(7px);
      }

      #${MODAL_ID},
      #${MODAL_ID} * { box-sizing: border-box; }

      #${MODAL_ID} .whats-new-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(720px, 94vw);
        height: min(82vh, 760px);
        overflow: hidden;
        background: linear-gradient(145deg, rgba(15, 29, 42, 0.99), rgba(4, 12, 20, 0.995));
        border: 1px solid var(--news-border);
        border-radius: 2px;
        box-shadow: 0 28px 85px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      #${MODAL_ID} .whats-new-panel::before,
      #${MODAL_ID} .whats-new-panel::after {
        content: '';
        position: absolute;
        z-index: 3;
        left: 50%;
        width: 7px;
        height: 7px;
        transform: translateX(-50%) rotate(45deg);
        border: 1px solid var(--news-gold);
        background: #08131d;
      }

      #${MODAL_ID} .whats-new-panel::before { top: -5px; }
      #${MODAL_ID} .whats-new-panel::after { bottom: -5px; }

      #${MODAL_ID} .whats-new-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 82px;
        padding: 15px 20px 15px 26px;
        background: linear-gradient(90deg, rgba(8, 19, 29, 0.99), rgba(13, 28, 40, 0.96));
        border-bottom: 1px solid var(--news-border);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      }

      #${MODAL_ID} .whats-new-title-wrap span {
        display: block;
        color: var(--news-gold);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      #${MODAL_ID} .whats-new-title-wrap h1 {
        margin: 3px 0 0;
        color: var(--news-text);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 27px;
        font-weight: 400;
        letter-spacing: 0.07em;
      }

      #${MODAL_ID} .whats-new-close-btn {
        width: 38px;
        height: 38px;
        padding: 0;
        color: var(--news-muted);
        background: rgba(7, 17, 27, 0.76);
        border: 1px solid var(--news-border-soft);
        border-radius: 1px;
        font-size: 15px;
        line-height: 1;
        cursor: pointer;
        transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 100ms ease;
      }

      #${MODAL_ID} .whats-new-close-btn:hover {
        color: var(--news-gold-bright);
        border-color: var(--news-border);
        background: rgba(30, 47, 60, 0.94);
      }

      #${MODAL_ID} .whats-new-close-btn:active { transform: translateY(1px); }

      #${MODAL_ID} .whats-new-body {
        flex: 1;
        min-height: 0;
        padding: 27px 34px 36px;
        overflow-y: auto;
        color: #d4dce1;
        background:
          radial-gradient(circle at 86% 0%, rgba(70, 127, 143, 0.05), transparent 35%),
          rgba(7, 16, 25, 0.35);
        font-size: 14px;
        line-height: 1.62;
        scrollbar-color: rgba(184, 138, 67, 0.58) rgba(0, 0, 0, 0.18);
      }

      #${MODAL_ID} .whats-new-release-heading {
        position: relative;
        margin: 2px 0 22px;
        padding-bottom: 14px;
        color: var(--news-text);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 25px;
        font-weight: 400;
        letter-spacing: 0.045em;
        border-bottom: 1px solid var(--news-border-soft);
      }

      #${MODAL_ID} .whats-new-release-heading::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -1px;
        width: 70px;
        height: 1px;
        background: var(--news-gold);
        box-shadow: 0 0 8px rgba(225, 174, 83, 0.18);
      }

      #${MODAL_ID} .whats-new-section-heading {
        margin: 22px 0 8px;
        color: var(--news-gold-bright);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 17px;
        font-weight: 400;
        letter-spacing: 0.035em;
      }

      #${MODAL_ID} .whats-new-paragraph { margin: 7px 0; }

      #${MODAL_ID} .whats-new-list {
        margin: 7px 0 15px;
        padding: 11px 15px 11px 36px;
        background: linear-gradient(145deg, rgba(14, 29, 42, 0.82), rgba(6, 15, 24, 0.86));
        border: 1px solid rgba(122, 158, 172, 0.18);
        border-left: 2px solid var(--news-gold);
      }

      #${MODAL_ID} .whats-new-list li { margin: 5px 0; padding-left: 2px; }
      #${MODAL_ID} .whats-new-list li::marker { color: var(--news-gold); }

      #${MODAL_ID} .whats-new-empty {
        padding: 14px 15px;
        color: var(--news-muted);
        background: rgba(13, 28, 41, 0.72);
        border: 1px solid var(--news-border-soft);
        border-left: 2px solid var(--news-gold);
        font-style: italic;
      }

      #${MODAL_ID} button:focus-visible {
        outline: 2px solid var(--news-gold-bright);
        outline-offset: 2px;
      }

      @media (max-width: 600px) {
        #${MODAL_ID} { padding: 10px; }
        #${MODAL_ID} .whats-new-panel { width: 100%; height: min(88vh, 760px); }
        #${MODAL_ID} .whats-new-header { min-height: 70px; padding: 12px 13px 12px 18px; }
        #${MODAL_ID} .whats-new-title-wrap h1 { font-size: 23px; }
        #${MODAL_ID} .whats-new-body { padding: 22px 20px 28px; }
        #${MODAL_ID} .whats-new-release-heading { font-size: 22px; }
      }

      @media (prefers-reduced-motion: reduce) {
        #${MODAL_ID} * { transition-duration: 0.01ms !important; }
      }
    `;
    return style;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && document.getElementById(MODAL_ID)) {
      event.stopPropagation();
      this.close();
    }
  };

  private renderEmpty(body: HTMLDivElement): void {
    const message = document.createElement('div');
    message.textContent = EMPTY_MESSAGE;
    message.className = 'whats-new-empty';
    body.appendChild(message);
  }

  /**
   * Minimal, safe Markdown rendering (no innerHTML): `#`/`##` headings,
   * `-`/`*` bullets, blank lines as spacing, everything else as paragraphs.
   */
  private renderMarkdown(body: HTMLDivElement, text: string): void {
    let currentList: HTMLUListElement | null = null;
    const flushList = (): void => { currentList = null; };

    for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
      const line = rawLine.trimEnd();
      if (line.trim().length === 0) { flushList(); continue; }

      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) {
        if (!currentList) {
          currentList = document.createElement('ul');
          currentList.className = 'whats-new-list';
          body.appendChild(currentList);
        }
        const li = document.createElement('li');
        li.textContent = bullet[1];
        currentList.appendChild(li);
        continue;
      }
      flushList();

      const h2 = line.match(/^##\s+(.*)$/);
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1) {
        const el = document.createElement('h2');
        el.textContent = h1[1];
        el.className = 'whats-new-release-heading';
        body.appendChild(el);
      } else if (h2) {
        const el = document.createElement('h3');
        el.textContent = h2[1];
        el.className = 'whats-new-section-heading';
        body.appendChild(el);
      } else {
        const el = document.createElement('p');
        el.textContent = line;
        el.className = 'whats-new-paragraph';
        body.appendChild(el);
      }
    }
  }
}
