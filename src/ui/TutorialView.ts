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
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      display: none; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.78);
      font-family: sans-serif; color: #e7eef5;
    `;
    // Swallow pointer events so nothing leaks to the scene underneath.
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      this.overlay.addEventListener(type, (e) => e.stopPropagation());
    }

    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; flex-direction: column;
      width: clamp(640px, 50vw, 96vw); height: 90vh;
      background: #121a26; border: 1px solid #33465c; border-radius: 10px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55); overflow: hidden;
    `;

    panel.appendChild(this.buildHeader());

    const body = document.createElement('div');
    body.style.cssText = 'display: flex; flex: 1; min-height: 0;';

    this.navEl = document.createElement('div');
    this.navEl.style.cssText = `
      flex: 0 0 220px; padding: 12px 8px; overflow-y: auto;
      border-right: 1px solid #25344a; background: #0e1620;
      display: flex; flex-direction: column; gap: 2px;
    `;

    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = `
      flex: 1; min-width: 0; padding: 26px 34px; overflow-y: auto;
      line-height: 1.55; font-size: 15px;
    `;

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

  private buildHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 22px; border-bottom: 1px solid #25344a; background: #0e1620;
    `;

    const title = document.createElement('h1');
    title.textContent = 'Tutorial';
    title.style.cssText = 'margin: 0; font-size: 20px; letter-spacing: 0.5px; color: #f4dfaa;';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close tutorial');
    closeBtn.style.cssText = `
      width: 34px; height: 34px; cursor: pointer; font-size: 18px;
      border: 1px solid #3a4d63; border-radius: 6px;
      background: transparent; color: #cdd8e3;
    `;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#26384c'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; });
    closeBtn.addEventListener('click', () => this.close());

    header.append(title, closeBtn);
    return header;
  }

  private buildNav(): void {
    this.navEl.replaceChildren();
    this.navButtons.clear();

    for (const section of TUTORIAL_SECTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = section.title;
      btn.style.cssText = `
        text-align: left; padding: 9px 12px; cursor: pointer;
        border: none; border-radius: 6px; background: transparent;
        color: #c7d2dd; font-size: 14px; font-family: inherit;
      `;
      btn.addEventListener('mouseenter', () => {
        if (this.activeSectionId !== section.id) btn.style.background = '#1a2636';
      });
      btn.addEventListener('mouseleave', () => {
        if (this.activeSectionId !== section.id) btn.style.background = 'transparent';
      });
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
      btn.style.background = active ? '#2a4a66' : 'transparent';
      btn.style.color = active ? '#ffffff' : '#c7d2dd';
      btn.style.fontWeight = active ? '600' : '400';
    }

    this.renderSection(section);
    this.contentEl.scrollTop = 0;
  }

  private renderSection(section: TutorialSection): void {
    this.contentEl.replaceChildren();

    const heading = document.createElement('h2');
    heading.textContent = section.title;
    heading.style.cssText = 'margin: 0 0 18px; font-size: 24px; color: #f4dfaa;';
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
        el.style.cssText = 'margin: 22px 0 8px; font-size: 17px; color: #9fd0ff;';
        return el;
      }
      case 'paragraph': {
        const el = document.createElement('p');
        el.textContent = block.text;
        el.style.cssText = 'margin: 0 0 12px; color: #dbe4ee;';
        return el;
      }
      case 'list': {
        const ul = document.createElement('ul');
        ul.style.cssText = 'margin: 0 0 14px; padding-left: 22px; color: #dbe4ee;';
        for (const item of block.items) {
          const li = document.createElement('li');
          li.textContent = item;
          li.style.cssText = 'margin: 4px 0;';
          ul.appendChild(li);
        }
        return ul;
      }
      case 'note': {
        const el = document.createElement('div');
        el.textContent = block.text;
        el.style.cssText = `
          margin: 6px 0 16px; padding: 12px 14px;
          border-left: 3px solid #f2c46b; border-radius: 4px;
          background: rgba(242, 196, 107, 0.10); color: #f3e6c6; font-size: 14px;
        `;
        return el;
      }
      case 'image': {
        const figure = document.createElement('div');
        figure.style.cssText = 'margin: 6px 0 16px; text-align: center;';
        const img = document.createElement('img');
        img.src = block.src;
        img.alt = block.alt;
        // Fit within the content column, preserve aspect ratio, and never
        // overflow the dialog (cap height to most of the viewport too).
        img.style.cssText = `
          display: block; margin: 0 auto;
          max-width: 100%; height: auto; max-height: 60vh; object-fit: contain;
          border: 1px solid #25344a; border-radius: 6px;
        `;
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
    container.style.cssText = 'margin: 6px 0 4px; display: flex; flex-direction: column; gap: 12px;';

    for (const corporation of CORPORATIONS) {
      container.appendChild(this.renderCorporationCard(corporation));
    }

    return container;
  }

  private renderCorporationCard(corporation: CorporationDefinition): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 12px 14px; border: 1px solid #25344a; border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
    `;

    const name = document.createElement('div');
    name.textContent = corporation.name;
    name.style.cssText = 'font-size: 16px; font-weight: 700; color: #a8d8ff; margin-bottom: 4px;';
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.textContent = corporation.description;
    desc.style.cssText = 'font-size: 13px; color: #c2ccd7; margin-bottom: 8px;';
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
    row.style.cssText = 'font-size: 13px; color: #dbe4ee; margin: 2px 0;';

    const key = document.createElement('span');
    key.textContent = `${label}: `;
    key.style.cssText = 'color: #9fb2c6; font-weight: 600;';

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
    container.style.cssText = 'margin: 6px 0 4px; display: flex; flex-direction: column; gap: 6px;';

    for (const effect of MANUFACTURED_RESOURCE_EFFECTS) {
      const summary = getManufacturedResourceEffectSummary(effect.resourceId);
      if (!summary) continue;
      const name = getManufacturedResourceById(effect.resourceId)?.name ?? effect.resourceId;

      const row = document.createElement('div');
      row.style.cssText = `
        padding: 8px 12px; border: 1px solid #25344a; border-radius: 6px;
        background: rgba(255, 255, 255, 0.03); font-size: 13px; color: #dbe4ee;
      `;

      const key = document.createElement('span');
      key.textContent = `${name}: `;
      key.style.cssText = 'color: #a8d8ff; font-weight: 700;';

      const val = document.createElement('span');
      val.textContent = summary;

      row.append(key, val);
      container.appendChild(row);
    }

    return container;
  }

  private renderCheatCommands(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'margin: 6px 0 4px; display: flex; flex-direction: column; gap: 8px;';

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
      empty.style.cssText = 'color: #aeb9c5;';
      container.appendChild(empty);
      return container;
    }

    for (const command of commands) {
      const row = document.createElement('div');
      row.style.cssText = `
        padding: 8px 12px; border: 1px solid #25344a; border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
      `;

      const name = document.createElement('div');
      name.textContent = command.name;
      name.style.cssText = `
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-weight: 700; color: #a8d8ff; margin-bottom: 2px;
      `;

      const desc = document.createElement('div');
      desc.textContent = command.description;
      desc.style.cssText = 'font-size: 13px; color: #c2ccd7;';

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
