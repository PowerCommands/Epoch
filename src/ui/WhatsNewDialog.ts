const MODAL_ID = 'whats-new-modal';
const ACCENT = '#6ec6ff';
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
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.78); font-family: sans-serif; color: #e7eef5;
    `;
    // Swallow pointer events; click outside the panel closes the dialog.
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.close();
    });

    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; flex-direction: column;
      width: clamp(420px, 40vw, 92vw); height: min(80vh, 760px);
      background: #121a26; border: 1px solid #33465c; border-radius: 10px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55); overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 22px; border-bottom: 1px solid #25344a; background: #0e1620;
    `;
    const title = document.createElement('div');
    title.textContent = "What's New";
    title.style.cssText = `font-size: 18px; font-weight: bold; letter-spacing: 1px; color: ${ACCENT};`;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: transparent; border: none; color: #9fb3c8; font-size: 20px;
      cursor: pointer; line-height: 1; padding: 4px 8px;
    `;
    closeBtn.addEventListener('click', () => this.close());
    header.append(title, closeBtn);

    const body = document.createElement('div');
    body.className = 'whats-new-body';
    body.style.cssText = `
      flex: 1; min-height: 0; padding: 22px 28px; overflow-y: auto;
      line-height: 1.55; font-size: 15px;
    `;

    panel.append(header, body);
    overlay.appendChild(panel);
    document.addEventListener('keydown', this.handleKeyDown, true);
    return overlay;
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
    message.style.cssText = 'color: #9fb3c8; font-style: italic;';
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
          currentList.style.cssText = 'margin: 6px 0 12px; padding-left: 22px;';
          body.appendChild(currentList);
        }
        const li = document.createElement('li');
        li.textContent = bullet[1];
        li.style.cssText = 'margin: 3px 0;';
        currentList.appendChild(li);
        continue;
      }
      flushList();

      const h2 = line.match(/^##\s+(.*)$/);
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1) {
        const el = document.createElement('div');
        el.textContent = h1[1];
        el.style.cssText = `font-size: 20px; font-weight: bold; color: ${ACCENT}; margin: 4px 0 14px;`;
        body.appendChild(el);
      } else if (h2) {
        const el = document.createElement('div');
        el.textContent = h2[1];
        el.style.cssText = 'font-size: 16px; font-weight: bold; color: #cfe2f5; margin: 16px 0 6px;';
        body.appendChild(el);
      } else {
        const el = document.createElement('div');
        el.textContent = line;
        el.style.cssText = 'margin: 6px 0;';
        body.appendChild(el);
      }
    }
  }
}
