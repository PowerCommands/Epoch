import type { TileInspectionInfo, TileInspectionRow } from '../systems/TileInspectionData';

const DEFAULT_WIDTH = 300;

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Draggable HTML/CSS overlay that shows read-only details about a single tile
 * (terrain, territory + owning city, units, structures, city). Presentation
 * only: it renders a {@link TileInspectionInfo} prepared by
 * `buildTileInspection` and holds no gameplay logic. Opened via the `I` hotkey
 * while something is selected; primarily an inspection/debug aid.
 */
export class TileInspectorDialog {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private hasPosition = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'tile-inspector-dialog';
    this.root.style.cssText = `
      position: fixed;
      z-index: 10020;
      display: none;
      width: ${DEFAULT_WIDTH}px;
      max-height: 70vh;
      overflow: auto;
      border: 1px solid rgba(180, 180, 180, 0.28);
      border-radius: 8px;
      background: rgba(12, 14, 18, 0.96);
      color: #ebeff5;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      pointer-events: auto;
    `;

    this.header = document.createElement('div');
    this.header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: move;
      user-select: none;
      background: rgba(255, 255, 255, 0.03);
      position: sticky;
      top: 0;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.textContent = 'Tile';
    this.titleEl.style.cssText = 'font-size: 13px; font-weight: 700; letter-spacing: 0.04em;';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      border: 1px solid rgba(180, 180, 180, 0.24);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      cursor: pointer;
      font: inherit;
      padding: 4px 8px;
    `;
    closeButton.addEventListener('click', () => this.close());

    this.header.append(this.titleEl, closeButton);

    this.content = document.createElement('div');
    this.content.style.cssText = 'display: grid; gap: 12px; padding: 12px;';

    this.root.append(this.header, this.content);
    document.body.appendChild(this.root);

    this.header.addEventListener('mousedown', this.handleHeaderMouseDown);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(info: TileInspectionInfo): void {
    this.render(info);
    this.root.style.display = 'block';
    if (!this.hasPosition) {
      const left = Math.max(12, window.innerWidth - DEFAULT_WIDTH - 24);
      const top = 80;
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
      this.hasPosition = true;
    }
  }

  close(): void {
    this.root.style.display = 'none';
    this.dragging = false;
  }

  shutdown(): void {
    this.header.removeEventListener('mousedown', this.handleHeaderMouseDown);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    this.root.remove();
  }

  private render(info: TileInspectionInfo): void {
    this.titleEl.textContent = info.title;
    this.content.replaceChildren();
    for (const section of info.sections) {
      this.content.append(this.createSection(section.heading, section.rows));
    }
  }

  private createSection(heading: string, rows: TileInspectionRow[]): HTMLDivElement {
    const block = document.createElement('div');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
      overflow: hidden;
    `;

    const headingEl = document.createElement('div');
    headingEl.textContent = heading;
    headingEl.style.cssText = `
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8fa3bb;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    block.append(headingEl);

    for (const row of rows) {
      block.append(this.createRow(row));
    }
    return block;
  }

  private createRow(row: TileInspectionRow): HTMLDivElement {
    const rowEl = document.createElement('div');
    rowEl.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 10px;
      font-size: 12px;
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = row.label;
    labelEl.style.cssText = 'color: #aab7c7; flex: 0 0 auto;';

    const valueWrap = document.createElement('span');
    valueWrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      text-align: right;
      color: ${row.warning ? '#ffb454' : '#edf5ff'};
    `;

    if (row.color !== undefined) {
      const swatch = document.createElement('span');
      swatch.style.cssText = `
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.4);
        background: ${toCssColor(row.color)};
        flex: 0 0 auto;
      `;
      valueWrap.append(swatch);
    }

    const valueEl = document.createElement('span');
    valueEl.textContent = row.value;
    valueWrap.append(valueEl);

    rowEl.append(labelEl, valueWrap);
    return rowEl;
  }

  private readonly handleHeaderMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = this.root.getBoundingClientRect();
    this.dragging = true;
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    event.preventDefault();
  };

  private readonly handleDocumentMouseMove = (event: MouseEvent): void => {
    if (!this.dragging) return;
    const left = clamp(event.clientX - this.dragOffsetX, 0, Math.max(0, window.innerWidth - this.root.offsetWidth));
    const top = clamp(event.clientY - this.dragOffsetY, 0, Math.max(0, window.innerHeight - this.root.offsetHeight));
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
  };

  private readonly handleDocumentMouseUp = (): void => {
    this.dragging = false;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
