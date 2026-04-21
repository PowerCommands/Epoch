import type { DiagnosticSnapshot } from '../systems/DiagnosticSystem';
import type { DiagnosticSystem } from '../systems/DiagnosticSystem';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 220;

export class DiagnosticDialog {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly valueEls: Record<'zoom' | 'camX' | 'camY', HTMLSpanElement>;
  private readonly unsubscribeSnapshot: () => void;
  private readonly unsubscribeVisibility: () => void;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private hasPosition = false;

  constructor(private readonly diagnosticSystem: DiagnosticSystem) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed;
      z-index: 10020;
      display: none;
      width: ${DEFAULT_WIDTH}px;
      height: ${DEFAULT_HEIGHT}px;
      min-width: 260px;
      min-height: 160px;
      resize: both;
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
    `;

    const title = document.createElement('div');
    title.textContent = 'Diagnostics';
    title.style.cssText = 'font-size: 13px; font-weight: 700; letter-spacing: 0.04em;';

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
    closeButton.addEventListener('click', () => this.diagnosticSystem.close());

    this.header.append(title, closeButton);

    this.content = document.createElement('div');
    this.content.style.cssText = `
      display: grid;
      gap: 10px;
      padding: 12px;
    `;

    this.valueEls = {
      zoom: this.createValueRow('Zoom'),
      camX: this.createValueRow('Cam X'),
      camY: this.createValueRow('Cam Y'),
    };

    this.root.append(this.header, this.content);
    document.body.appendChild(this.root);

    this.header.addEventListener('mousedown', this.handleHeaderMouseDown);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);

    this.unsubscribeSnapshot = this.diagnosticSystem.subscribe((snapshot) => this.render(snapshot));
    this.unsubscribeVisibility = this.diagnosticSystem.subscribeVisibility((open) => {
      if (open) {
        this.show();
        this.render(this.diagnosticSystem.getSnapshot());
      } else {
        this.hide();
      }
    });
  }

  shutdown(): void {
    this.unsubscribeSnapshot();
    this.unsubscribeVisibility();
    this.header.removeEventListener('mousedown', this.handleHeaderMouseDown);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    this.root.remove();
  }

  private createValueRow(label: string): HTMLSpanElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
    `;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'color: #aab7c7;';

    const valueEl = document.createElement('span');
    valueEl.textContent = '0';
    valueEl.style.cssText = 'font-weight: 700;';

    row.append(labelEl, valueEl);
    this.content.append(row);
    return valueEl;
  }

  private show(): void {
    this.root.style.display = 'block';
    if (!this.hasPosition) {
      this.centerInViewport();
      this.hasPosition = true;
    }
  }

  private hide(): void {
    this.root.style.display = 'none';
    this.dragging = false;
  }

  private centerInViewport(): void {
    const left = Math.max(12, Math.round((window.innerWidth - DEFAULT_WIDTH) / 2));
    const top = Math.max(12, Math.round((window.innerHeight - DEFAULT_HEIGHT) / 2));
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
  }

  private render(snapshot: DiagnosticSnapshot): void {
    this.valueEls.zoom.textContent = snapshot.zoom.toFixed(2);
    this.valueEls.camX.textContent = String(snapshot.camX);
    this.valueEls.camY.textContent = String(snapshot.camY);
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
