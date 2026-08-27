import type { WorldWarAnnouncement } from '../systems/ScenarioHistoricalEventPresentationSystem';

const MODAL_ID = 'epoch-world-war-announcement';

/** Queueing, presentation-only dialog for Scenario World War lifecycle moments. */
export class WorldWarAnnouncementDialog {
  private readonly pending: WorldWarAnnouncement[] = [];

  present(announcement: WorldWarAnnouncement): void {
    if (this.isOpen()) {
      this.pending.push(announcement);
      return;
    }
    this.show(announcement);
  }

  close(): void {
    this.removeOverlay();
    const next = this.pending.shift();
    if (next) this.show(next);
  }

  shutdown(): void {
    this.pending.length = 0;
    this.removeOverlay();
  }

  isOpen(): boolean {
    return document.getElementById(MODAL_ID) !== null;
  }

  getPendingCount(): number {
    return this.pending.length;
  }

  private show(announcement: WorldWarAnnouncement): void {
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.tabIndex = -1;
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:10030;display:flex;align-items:center;
      justify-content:center;padding:18px;background:rgba(5,7,12,.88);
      color:#eee;font-family:Georgia,'Times New Roman',serif;
    `;
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }
    document.addEventListener('keydown', this.handleKeyDown, true);

    const panel = document.createElement('section');
    panel.setAttribute('aria-label', announcement.kind === 'started' ? 'World War announcement' : 'World War ending announcement');
    panel.style.cssText = `
      width:min(700px,94vw);max-height:92vh;overflow-y:auto;box-sizing:border-box;
      padding:clamp(24px,4vw,44px);border:3px double #c8a34f;border-radius:5px;
      background:linear-gradient(145deg,#171923,#0c0e15);box-shadow:0 28px 90px rgba(0,0,0,.8);
      text-align:center;
    `;

    panel.append(
      element('div', announcement.kind === 'started' ? 'WORLD WAR' : 'WORLD WAR ENDS', 'font:700 14px sans-serif;letter-spacing:.32em;color:#d8b45c;margin-bottom:15px;'),
      element('h1', announcement.eventName, 'font-size:clamp(31px,6vw,53px);line-height:1.04;margin:0 0 9px;color:#fff;'),
      element('div', announcement.dateLabel, 'font-size:18px;letter-spacing:.12em;color:#d4c7aa;margin-bottom:25px;'),
    );

    if (announcement.kind === 'started' && announcement.description) {
      panel.appendChild(element('p', announcement.description, 'font-size:19px;line-height:1.55;text-align:left;margin:0 auto 25px;max-width:610px;white-space:pre-wrap;'));
    }
    if (announcement.kind === 'completed' && announcement.completionMessage) {
      panel.appendChild(element('p', announcement.completionMessage, 'font-size:20px;line-height:1.5;margin:0 auto 24px;max-width:610px;'));
    }

    if (announcement.kind === 'started' && announcement.conflicts.length > 0) {
      const conflicts = document.createElement('section');
      conflicts.style.cssText = 'border-top:1px solid #665a42;border-bottom:1px solid #665a42;padding:18px 0;margin:0 auto 22px;max-width:610px;';
      conflicts.appendChild(element('h2', 'World War participants and conflicts', 'font:700 13px sans-serif;text-transform:uppercase;letter-spacing:.14em;color:#d8b45c;margin:0 0 13px;'));
      const list = document.createElement('div');
      list.style.cssText = 'display:grid;gap:8px;font-size:18px;';
      for (const conflict of announcement.conflicts) {
        list.appendChild(element('div', `${conflict.nationAName} ↔ ${conflict.nationBName}`, 'line-height:1.35;'));
      }
      conflicts.appendChild(list);
      panel.appendChild(conflicts);
    }

    if (announcement.humanInvolved && announcement.kind === 'started') {
      panel.appendChild(element('div', 'Your nation is involved in this World War.', 'font:700 15px sans-serif;color:#f2cf70;margin:0 0 18px;'));
    }
    if (announcement.timelineMessage) {
      panel.appendChild(element('p', announcement.timelineMessage, 'font:italic 15px sans-serif;color:#bbb;margin:0 0 24px;'));
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue';
    button.style.cssText = 'padding:10px 30px;border:1px solid #d8b45c;border-radius:4px;background:#d8b45c;color:#111;font-size:16px;font-weight:700;cursor:pointer;';
    button.addEventListener('click', () => this.close());
    panel.appendChild(button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => button.focus({ preventScroll: true }));
  }

  private removeOverlay(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.getElementById(MODAL_ID)?.remove();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key !== 'Escape' && event.key !== 'Enter') return;
    event.preventDefault();
    this.close();
  };
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, style: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.style.cssText = style;
  return node;
}
