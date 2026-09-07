import { CheatSystem } from '../systems/CheatSystem';
import { TUTORIAL_SECTIONS, type TutorialBlock, type TutorialSection } from '../data/tutorialContent';
import { CORPORATIONS, type CorporationDefinition } from '../data/corporations';
import { getTechnologyById } from '../data/technologies';
import { getBuildingById } from '../data/buildings';
import { getResourceDisplayName } from '../data/resources';
import { getManufacturedResourceById } from '../data/manufacturedResources';
import {
  MANUFACTURED_RESOURCE_EFFECTS,
  getManufacturedResourceEffectSummary,
} from '../systems/ManufacturedResourceEffects';
import { AEROSPACE_INDUSTRIES_ID } from '../data/scienceVictory';

/**
 * Full-screen, self-contained tutorial / manual overlay.
 *
 * Standalone learning experience (distinct from the new-game wizard) reachable
 * from the Main Menu and the pause menu. A left-hand navigation list selects a
 * chapter; the right-hand content area renders that chapter's blocks and
 * scrolls when long. All content is data-driven from `TUTORIAL_SECTIONS`, and
 * the Cheat Panel chapter pulls the live cheat command list so it never drifts.
 *
 * Built as an isolated HTML/CSS overlay (like the other documentation-style
 * panels) with inline styles so it carries no external stylesheet dependency.
 * Pinned above the pause menu so it can open on top of it.
 */
export class TutorialView {
  private readonly overlay: HTMLDivElement;
  private readonly navEl: HTMLDivElement;
  private readonly contentEl: HTMLDivElement;
  private readonly navButtons = new Map<string, HTMLButtonElement>();
  private open = false;
  private activeSectionId: string | null = null;

  constructor(private readonly onClosed?: () => void) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorial-view';
    this.overlay.setAttribute('role', 'presentation');
    this.overlay.appendChild(this.buildStyles());
    // Swallow pointer events so nothing leaks to the scene underneath.
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      this.overlay.addEventListener(type, (e) => e.stopPropagation());
    }

    const panel = document.createElement('div');
    panel.className = 'tutorial-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'tutorial-view-title');

    panel.appendChild(this.buildHeader());

    const body = document.createElement('div');
    body.className = 'tutorial-body';

    this.navEl = document.createElement('div');
    this.navEl.className = 'tutorial-nav';
    this.navEl.setAttribute('aria-label', 'Tutorial chapters');

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'tutorial-content';

    body.append(this.navEl, this.contentEl);
    panel.appendChild(body);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.buildNav();
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.overlay.style.display = 'flex';
    this.open = true;
    // Default to the first chapter on first open; otherwise keep the last one.
    this.selectSection(this.activeSectionId ?? TUTORIAL_SECTIONS[0]?.id ?? null);
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
    this.onClosed?.();
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  shutdown(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.overlay.remove();
  }

  private buildStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      #tutorial-view {
        --tutorial-panel: #07121c;
        --tutorial-panel-light: #0d1c29;
        --tutorial-gold: #b88a43;
        --tutorial-gold-bright: #efcd83;
        --tutorial-text: #eee8dc;
        --tutorial-muted: #9ba9b5;
        --tutorial-border: rgba(190, 145, 70, 0.35);
        --tutorial-border-soft: rgba(190, 145, 70, 0.17);
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: none;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 20px;
        color: var(--tutorial-text);
        background:
          radial-gradient(circle at 50% 38%, rgba(49, 80, 96, 0.15), transparent 38%),
          rgba(0, 5, 10, 0.84);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(7px);
      }

      #tutorial-view,
      #tutorial-view * { box-sizing: border-box; }

      #tutorial-view .tutorial-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(1120px, 96vw);
        height: min(90vh, 860px);
        overflow: hidden;
        background: linear-gradient(145deg, rgba(15, 29, 42, 0.99), rgba(4, 12, 20, 0.995));
        border: 1px solid var(--tutorial-border);
        border-radius: 2px;
        box-shadow: 0 28px 85px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      #tutorial-view .tutorial-panel::before,
      #tutorial-view .tutorial-panel::after {
        content: '';
        position: absolute;
        z-index: 3;
        left: 50%;
        width: 7px;
        height: 7px;
        transform: translateX(-50%) rotate(45deg);
        border: 1px solid var(--tutorial-gold);
        background: #08131d;
      }

      #tutorial-view .tutorial-panel::before { top: -5px; }
      #tutorial-view .tutorial-panel::after { bottom: -5px; }

      #tutorial-view .tutorial-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 78px;
        padding: 14px 20px 14px 26px;
        background: linear-gradient(90deg, rgba(8, 19, 29, 0.99), rgba(13, 28, 40, 0.96));
        border-bottom: 1px solid var(--tutorial-border);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      }

      #tutorial-view .tutorial-title-wrap span {
        display: block;
        color: var(--tutorial-gold);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      #tutorial-view .tutorial-title-wrap h1 {
        margin: 3px 0 0;
        color: var(--tutorial-text);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 27px;
        font-weight: 400;
        letter-spacing: 0.07em;
      }

      #tutorial-view .tutorial-close-btn {
        width: 38px;
        height: 38px;
        padding: 0;
        color: var(--tutorial-muted);
        background: rgba(7, 17, 27, 0.76);
        border: 1px solid var(--tutorial-border-soft);
        border-radius: 1px;
        font-size: 15px;
        line-height: 1;
        cursor: pointer;
        transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 100ms ease;
      }

      #tutorial-view .tutorial-close-btn:hover {
        color: var(--tutorial-gold-bright);
        border-color: var(--tutorial-border);
        background: rgba(30, 47, 60, 0.94);
      }

      #tutorial-view .tutorial-close-btn:active { transform: translateY(1px); }

      #tutorial-view .tutorial-body {
        display: flex;
        flex: 1;
        min-height: 0;
      }

      #tutorial-view .tutorial-nav {
        flex: 0 0 235px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 14px 10px;
        overflow-y: auto;
        background: rgba(4, 12, 20, 0.78);
        border-right: 1px solid var(--tutorial-border-soft);
        scrollbar-color: rgba(184, 138, 67, 0.55) rgba(0, 0, 0, 0.2);
      }

      #tutorial-view .tutorial-nav-btn {
        position: relative;
        flex: 0 0 auto;
        min-height: 38px;
        padding: 8px 12px 8px 16px;
        color: #aebbc5;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 1px;
        font: 12px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.025em;
        text-align: left;
        cursor: pointer;
        transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      #tutorial-view .tutorial-nav-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 3px;
        width: 4px;
        height: 4px;
        transform: translateY(-50%) rotate(45deg);
        border: 1px solid rgba(184, 138, 67, 0.35);
      }

      #tutorial-view .tutorial-nav-btn:hover {
        color: var(--tutorial-text);
        background: rgba(24, 40, 54, 0.7);
        border-color: rgba(112, 159, 175, 0.16);
      }

      #tutorial-view .tutorial-nav-btn.active {
        color: #fff1ce;
        background: linear-gradient(90deg, rgba(118, 81, 29, 0.42), rgba(20, 34, 46, 0.8));
        border-color: var(--tutorial-border);
        box-shadow: inset 2px 0 0 var(--tutorial-gold);
        font-weight: 700;
      }

      #tutorial-view .tutorial-nav-btn.active::before {
        border-color: var(--tutorial-gold-bright);
        background: var(--tutorial-gold);
        box-shadow: 0 0 7px rgba(224, 172, 82, 0.24);
      }

      #tutorial-view .tutorial-content {
        flex: 1;
        min-width: 0;
        padding: 28px 36px 36px;
        overflow-y: auto;
        background:
          radial-gradient(circle at 80% 0%, rgba(70, 127, 143, 0.05), transparent 34%),
          rgba(7, 16, 25, 0.35);
        color: var(--tutorial-text);
        font-size: 14px;
        line-height: 1.62;
        scrollbar-color: rgba(184, 138, 67, 0.58) rgba(0, 0, 0, 0.18);
      }

      #tutorial-view .tutorial-section-heading {
        position: relative;
        margin: 0 0 24px;
        padding-bottom: 15px;
        color: var(--tutorial-text);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 29px;
        font-weight: 400;
        letter-spacing: 0.04em;
        border-bottom: 1px solid var(--tutorial-border-soft);
      }

      #tutorial-view .tutorial-section-heading::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -1px;
        width: 72px;
        height: 1px;
        background: var(--tutorial-gold);
        box-shadow: 0 0 8px rgba(225, 174, 83, 0.18);
      }

      #tutorial-view .tutorial-block-heading {
        margin: 24px 0 8px;
        color: var(--tutorial-gold-bright);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 18px;
        font-weight: 400;
        letter-spacing: 0.035em;
      }

      #tutorial-view .tutorial-paragraph {
        margin: 0 0 13px;
        color: #d4dce1;
      }

      #tutorial-view .tutorial-paragraph.muted { color: var(--tutorial-muted); }

      #tutorial-view .tutorial-list {
        margin: 0 0 15px;
        padding-left: 23px;
        color: #d4dce1;
      }

      #tutorial-view .tutorial-list li { margin: 5px 0; padding-left: 3px; }
      #tutorial-view .tutorial-list li::marker { color: var(--tutorial-gold); }

      #tutorial-view .tutorial-note {
        margin: 8px 0 18px;
        padding: 12px 15px;
        color: #e7dcc2;
        background: linear-gradient(90deg, rgba(151, 105, 38, 0.16), rgba(17, 31, 43, 0.5));
        border: 1px solid var(--tutorial-border-soft);
        border-left: 2px solid var(--tutorial-gold);
        border-radius: 1px;
        font-size: 13px;
      }

      #tutorial-view .tutorial-figure { margin: 8px 0 18px; text-align: center; }

      #tutorial-view .tutorial-figure img {
        display: block;
        max-width: 100%;
        max-height: 60vh;
        height: auto;
        margin: 0 auto;
        object-fit: contain;
        border: 1px solid var(--tutorial-border);
        border-radius: 1px;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.32);
      }

      #tutorial-view .tutorial-card-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 7px 0 5px;
      }

      #tutorial-view .tutorial-card-list.compact { gap: 6px; }

      #tutorial-view .tutorial-info-card {
        padding: 12px 14px;
        color: #d5dde2;
        background: linear-gradient(145deg, rgba(14, 29, 42, 0.9), rgba(6, 15, 24, 0.92));
        border: 1px solid rgba(122, 158, 172, 0.2);
        border-radius: 1px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      #tutorial-view .tutorial-info-card.compact { padding: 8px 11px; font-size: 13px; }

      #tutorial-view .tutorial-card-title {
        margin-bottom: 4px;
        color: var(--tutorial-gold-bright);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 16px;
        font-weight: 700;
      }

      #tutorial-view .tutorial-card-title.inline { display: inline; margin: 0; font-size: 14px; }

      #tutorial-view .tutorial-card-description {
        margin-bottom: 8px;
        color: var(--tutorial-muted);
        font-size: 13px;
      }

      #tutorial-view .tutorial-command-name {
        margin-bottom: 2px;
        color: var(--tutorial-gold-bright);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-weight: 700;
      }

      #tutorial-view .tutorial-data-row { margin: 2px 0; color: #d5dde2; font-size: 13px; }
      #tutorial-view .tutorial-data-key { color: #b7c4cc; font-weight: 700; }

      #tutorial-view button:focus-visible {
        outline: 2px solid var(--tutorial-gold-bright);
        outline-offset: 2px;
      }

      @media (max-width: 760px) {
        #tutorial-view { padding: 10px; }
        #tutorial-view .tutorial-panel { width: 100%; height: calc(100vh - 20px); }
        #tutorial-view .tutorial-header { min-height: 68px; padding: 11px 13px 11px 17px; }
        #tutorial-view .tutorial-title-wrap h1 { font-size: 23px; }
        #tutorial-view .tutorial-body { flex-direction: column; }
        #tutorial-view .tutorial-nav {
          flex: 0 0 auto;
          flex-direction: row;
          gap: 5px;
          width: 100%;
          padding: 8px;
          overflow-x: auto;
          overflow-y: hidden;
          border-right: 0;
          border-bottom: 1px solid var(--tutorial-border-soft);
        }
        #tutorial-view .tutorial-nav-btn { min-height: 35px; padding: 7px 11px 7px 15px; white-space: nowrap; }
        #tutorial-view .tutorial-content { padding: 22px 20px 28px; }
        #tutorial-view .tutorial-section-heading { font-size: 25px; }
      }

      @media (prefers-reduced-motion: reduce) {
        #tutorial-view * { transition-duration: 0.01ms !important; }
      }
    `;
    return style;
  }

  private buildHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'tutorial-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'tutorial-title-wrap';
    const kicker = document.createElement('span');
    kicker.textContent = 'Archives of Knowledge';
    const title = document.createElement('h1');
    title.id = 'tutorial-view-title';
    title.textContent = 'Tutorial';
    titleWrap.append(kicker, title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close tutorial');
    closeBtn.className = 'tutorial-close-btn';
    closeBtn.addEventListener('click', () => this.close());

    header.append(titleWrap, closeBtn);
    return header;
  }

  private buildNav(): void {
    this.navEl.replaceChildren();
    this.navButtons.clear();

    for (const section of TUTORIAL_SECTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = section.title;
      btn.className = 'tutorial-nav-btn';
      btn.addEventListener('click', () => this.selectSection(section.id));
      this.navButtons.set(section.id, btn);
      this.navEl.appendChild(btn);
    }
  }

  private selectSection(sectionId: string | null): void {
    const section = TUTORIAL_SECTIONS.find((s) => s.id === sectionId) ?? TUTORIAL_SECTIONS[0];
    if (!section) return;
    this.activeSectionId = section.id;

    for (const [id, btn] of this.navButtons) {
      const active = id === section.id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    }

    this.renderSection(section);
    this.contentEl.scrollTop = 0;
  }

  private renderSection(section: TutorialSection): void {
    this.contentEl.replaceChildren();

    const heading = document.createElement('h2');
    heading.textContent = section.title;
    heading.className = 'tutorial-section-heading';
    this.contentEl.appendChild(heading);

    for (const block of section.blocks) {
      this.contentEl.appendChild(this.renderBlock(block));
    }
  }

  private renderBlock(block: TutorialBlock): HTMLElement {
    switch (block.kind) {
      case 'heading': {
        const el = document.createElement('h3');
        el.textContent = block.text;
        el.className = 'tutorial-block-heading';
        return el;
      }
      case 'paragraph': {
        const el = document.createElement('p');
        el.textContent = block.text;
        el.className = 'tutorial-paragraph';
        return el;
      }
      case 'list': {
        const ul = document.createElement('ul');
        ul.className = 'tutorial-list';
        for (const item of block.items) {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        }
        return ul;
      }
      case 'note': {
        const el = document.createElement('div');
        el.textContent = block.text;
        el.className = 'tutorial-note';
        return el;
      }
      case 'image': {
        const figure = document.createElement('div');
        figure.className = 'tutorial-figure';
        const img = document.createElement('img');
        img.src = block.src;
        img.alt = block.alt;
        // Fit within the content column, preserve aspect ratio, and never
        // overflow the dialog (cap height to most of the viewport too).
        figure.appendChild(img);
        return figure;
      }
      case 'corporations':
        return this.renderCorporations();
      case 'manufactured-resource-effects':
        return this.renderManufacturedResourceEffects();
      case 'cheat-commands':
        return this.renderCheatCommands();
      default:
        return document.createElement('div');
    }
  }

  private renderCorporations(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tutorial-card-list';

    for (const corporation of CORPORATIONS) {
      container.appendChild(this.renderCorporationCard(corporation));
    }

    return container;
  }

  private renderCorporationCard(corporation: CorporationDefinition): HTMLElement {
    const card = document.createElement('div');
    card.className = 'tutorial-info-card';

    const name = document.createElement('div');
    name.textContent = corporation.name;
    name.className = 'tutorial-card-title';
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.textContent = corporation.description;
    desc.className = 'tutorial-card-description';
    card.appendChild(desc);

    const techNames = corporation.requiredTechIds
      .map((id) => getTechnologyById(id)?.name ?? id)
      .join(', ');
    card.appendChild(this.renderCorporationRow('Technology', techNames));

    const resourceIds = corporation.requiredResourceIds ?? [];
    if (resourceIds.length > 0) {
      const resourceNames = resourceIds.map((id) => getResourceDisplayName(id)).join(', ');
      const label = resourceIds.length > 1 ? 'Resources' : 'Resource';
      card.appendChild(this.renderCorporationRow(label, resourceNames));
    }

    const buildingIds = corporation.requiredBuildingIds ?? [];
    if (buildingIds.length > 0) {
      const buildingNames = buildingIds.map((id) => getBuildingById(id)?.name ?? id).join(', ');
      const label = buildingIds.length > 1 ? 'Buildings' : 'Building';
      card.appendChild(this.renderCorporationRow(label, buildingNames));
    }

    const goodName = getManufacturedResourceById(corporation.manufacturedResourceId)?.name
      ?? corporation.manufacturedResourceId;
    card.appendChild(this.renderCorporationRow('Produces', goodName));

    const productionBuildingName = getBuildingById(corporation.productionBuildingId)?.name
      ?? corporation.productionBuildingId;
    if (corporation.id === AEROSPACE_INDUSTRIES_ID || corporation.resourcePerBuilding <= 0) {
      card.appendChild(this.renderCorporationRow(
        'Output',
        `Factories do not auto-generate ${goodName}; they must be produced deliberately (see below)`,
      ));
    } else {
      card.appendChild(this.renderCorporationRow(
        'Output',
        `${corporation.resourcePerBuilding} per qualifying ${productionBuildingName}`,
      ));
    }

    return card;
  }

  private renderCorporationRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tutorial-data-row';

    const key = document.createElement('span');
    key.textContent = `${label}: `;
    key.className = 'tutorial-data-key';

    const val = document.createElement('span');
    val.textContent = value;

    row.append(key, val);
    return row;
  }

  /**
   * Manufactured-resource effect list, generated from the same shared
   * `MANUFACTURED_RESOURCE_EFFECTS` table gameplay uses, so the values shown
   * here can never drift from the actual effects. Names come from the resource
   * definitions, so the player-facing "Tools" name is used automatically.
   */
  private renderManufacturedResourceEffects(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tutorial-card-list compact';

    for (const effect of MANUFACTURED_RESOURCE_EFFECTS) {
      const summary = getManufacturedResourceEffectSummary(effect.resourceId);
      if (!summary) continue;
      const name = getManufacturedResourceById(effect.resourceId)?.name ?? effect.resourceId;

      const row = document.createElement('div');
      row.className = 'tutorial-info-card compact';

      const key = document.createElement('span');
      key.textContent = `${name}: `;
      key.className = 'tutorial-card-title inline';

      const val = document.createElement('span');
      val.textContent = summary;

      row.append(key, val);
      container.appendChild(row);
    }

    return container;
  }

  private renderCheatCommands(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tutorial-card-list compact';

    let commands: { name: string; description: string }[] = [];
    try {
      commands = CheatSystem.getDocumentedCommands();
    } catch {
      // Defensive: never let a docs-enumeration failure break the tutorial.
      commands = [];
    }

    if (commands.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No cheat commands are currently available.';
      empty.className = 'tutorial-paragraph muted';
      container.appendChild(empty);
      return container;
    }

    for (const command of commands) {
      const row = document.createElement('div');
      row.className = 'tutorial-info-card compact';

      const name = document.createElement('div');
      name.textContent = command.name;
      name.className = 'tutorial-command-name';

      const desc = document.createElement('div');
      desc.textContent = command.description;
      desc.className = 'tutorial-card-description';

      row.append(name, desc);
      container.appendChild(row);
    }

    return container;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === 'Escape') {
      // Close the tutorial and stop the key from also reaching the scene
      // (which would otherwise toggle the pause menu underneath).
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close();
    }
  };
}
