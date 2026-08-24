import type { HistoricalTimelineService } from '../systems/HistoricalTimelineService';

/** Most recent entries rendered (older ones stay stored/saved); keeps the DOM light. */
const RENDER_LIMIT = 300;
const COLLAPSED_KEY = 'epoch.historyPanelCollapsed';
const SHORTCUT_HIDDEN_KEY = 'epoch.historyPanelShortcutHidden';

/**
 * Permanent "History of the World" panel pinned to the right edge.
 *
 * Always present (not a sidebar tab): a compact, scrollable chronicle that the
 * player can minimise with the header expander (open by default). Reads the
 * HistoricalTimelineService and re-renders on change. Newest entries on top.
 *
 * Built as an HTML overlay so it gets a native vertical scrollbar and small,
 * dense text for free, styled to match the dark-blue UI theme.
 */
export class TimelinePanel {
  private readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly toggleEl: HTMLButtonElement;
  private collapsed = false;
  private shortcutHidden = false;
  private contextHidden = false;
  private renderQueued = false;

  constructor(private readonly timeline: HistoricalTimelineService) {
    this.collapsed = this.readCollapsed();
    this.shortcutHidden = this.readShortcutHidden();

    this.root = document.createElement('div');
    this.root.id = 'history-panel';
    this.root.style.cssText = `
      position: fixed; top: 122px; right: 14px; z-index: 90;
      width: 232px; max-height: calc(100vh - 290px);
      display: flex; flex-direction: column;
      background: linear-gradient(180deg, rgba(16, 44, 70, 0.96), rgba(11, 30, 49, 0.96));
      border: 1px solid #2f567c; border-radius: 12px;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
      font-family: sans-serif; color: #e7eef5; overflow: hidden;
      pointer-events: auto;
    `;
    for (const type of ['pointerdown', 'mousedown', 'wheel', 'click']) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 8px 12px; cursor: pointer;
      border-bottom: 1px solid rgba(120, 160, 200, 0.22); flex: 0 0 auto;
    `;
    const title = document.createElement('span');
    title.textContent = '📜 History';
    title.title = 'Show or hide History (Ctrl+H)';
    title.style.cssText = 'font-size: 13px; font-weight: 700; letter-spacing: 0.4px; color: #f4dfaa;';
    this.toggleEl = document.createElement('button');
    this.toggleEl.type = 'button';
    this.toggleEl.style.cssText = `
      width: 22px; height: 22px; line-height: 1; cursor: pointer; font-size: 13px;
      border: 1px solid #3a597d; border-radius: 5px; background: transparent; color: #cdd8e3;
    `;
    header.append(title, this.toggleEl);
    header.addEventListener('click', () => this.setCollapsed(!this.collapsed));

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = `
      flex: 1 1 auto; min-height: 0; overflow-y: auto;
      padding: 8px 12px 10px; font-size: 12px; line-height: 1.4;
    `;

    this.root.append(header, this.listEl);
    document.body.appendChild(this.root);

    this.timeline.onChanged(() => this.scheduleRender());
    document.addEventListener('keydown', this.handleKeyDown, true);
    this.applyCollapsedState();
    this.applyVisibility();
    this.render();
  }

  /** Hide the whole panel (e.g. while a sidebar mode overlays the same area). */
  setHidden(hidden: boolean): void {
    this.contextHidden = hidden;
    this.applyVisibility();
  }

  shutdown(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.root.remove();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'h') return;
    if (isEditableTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    this.shortcutHidden = !this.readShortcutHidden();
    this.writeShortcutHidden(this.shortcutHidden);
    this.applyVisibility();
  };

  private applyVisibility(): void {
    this.shortcutHidden = this.readShortcutHidden();
    this.root.style.display = this.shortcutHidden || this.contextHidden ? 'none' : 'flex';
  }

  private setCollapsed(collapsed: boolean): void {
    if (this.collapsed === collapsed) return;
    this.collapsed = collapsed;
    this.writeCollapsed(collapsed);
    this.applyCollapsedState();
  }

  private applyCollapsedState(): void {
    this.listEl.style.display = this.collapsed ? 'none' : 'block';
    this.toggleEl.textContent = this.collapsed ? '▸' : '▾';
    this.toggleEl.title = this.collapsed ? 'Expand history' : 'Minimise history';
  }

  // Coalesce bursts of events into a single render per frame.
  private scheduleRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private render(): void {
    const events = this.timeline.getEvents();
    this.listEl.replaceChildren();

    if (events.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'History has yet to be written.';
      empty.style.cssText = 'color: #9fb0c4; font-style: italic;';
      this.listEl.appendChild(empty);
      return;
    }

    const recent = events.slice(-RENDER_LIMIT);
    // Newest first.
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const event = recent[i];
      const entry = document.createElement('div');
      entry.style.cssText = 'margin-bottom: 10px;';

      const head = document.createElement('div');
      head.textContent = `${event.dateLabel} (Round ${event.round})`;
      head.style.cssText = 'color: #8fb6dd; font-size: 11px; margin-bottom: 1px;';

      const line = document.createElement('div');
      line.textContent = `${event.icon} ${event.text}`;
      line.style.cssText = 'color: #e7eef5;';

      entry.append(head, line);
      this.listEl.appendChild(entry);
    }

    if (events.length > RENDER_LIMIT) {
      const more = document.createElement('div');
      more.textContent = `… ${events.length - RENDER_LIMIT} earlier events`;
      more.style.cssText = 'color: #8295aa; font-style: italic; margin-top: 4px;';
      this.listEl.appendChild(more);
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeCollapsed(collapsed: boolean): void {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Ignore storage errors.
    }
  }

  private readShortcutHidden(): boolean {
    try {
      return window.localStorage.getItem(SHORTCUT_HIDDEN_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeShortcutHidden(hidden: boolean): void {
    try {
      window.localStorage.setItem(SHORTCUT_HIDDEN_KEY, String(hidden));
    } catch {
      // Ignore storage errors.
    }
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches('input, textarea, select');
}
