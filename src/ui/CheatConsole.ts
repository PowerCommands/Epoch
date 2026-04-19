import { CheatSystem } from '../systems/CheatSystem';

const MAX_OUTPUT_LINES = 40;

interface ConsoleLine {
  kind: 'input' | 'output';
  text: string;
}

export class CheatConsole {
  private readonly root: HTMLDivElement;
  private readonly outputEl: HTMLDivElement;
  private readonly inputEl: HTMLInputElement;
  private readonly history: string[] = [];
  private readonly lines: ConsoleLine[] = [];
  private historyIndex = 0;
  private isOpen = false;

  constructor(private readonly cheatSystem: CheatSystem) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed;
      left: 12vw;
      right: 12vw;
      bottom: 14px;
      z-index: 10000;
      display: none;
      flex-direction: column;
      gap: 6px;
      max-height: 34vh;
      padding: 8px;
      border: 1px solid rgba(180, 180, 180, 0.24);
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.78);
      color: #e7e7e7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.35;
      pointer-events: auto;
    `;

    this.outputEl = document.createElement('div');
    this.outputEl.style.cssText = `
      min-height: 24px;
      max-height: 24vh;
      overflow-y: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    `;

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.spellcheck = false;
    this.inputEl.autocomplete = 'off';
    this.inputEl.autocapitalize = 'off';
    this.inputEl.style.cssText = `
      width: 100%;
      border: 1px solid rgba(180, 180, 180, 0.22);
      border-radius: 4px;
      outline: none;
      padding: 6px 8px;
      background: rgba(20, 20, 20, 0.92);
      color: #ffffff;
      font: inherit;
    `;

    this.root.append(this.outputEl, this.inputEl);
    document.body.appendChild(this.root);

    document.addEventListener('keydown', this.handleDocumentKeyDown);
    this.inputEl.addEventListener('keydown', this.handleInputKeyDown);
  }

  shutdown(): void {
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    this.inputEl.removeEventListener('keydown', this.handleInputKeyDown);
    this.root.remove();
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.clearVisibleContent();
    this.isOpen = true;
    this.root.style.display = 'flex';
    window.setTimeout(() => this.inputEl.focus(), 0);
  }

  private close(): void {
    this.isOpen = false;
    this.root.style.display = 'none';
    this.inputEl.blur();
  }

  private submit(): void {
    const input = this.inputEl.value.trim();
    if (input.length === 0) return;

    this.history.push(input);
    this.historyIndex = this.history.length;
    this.addLine('input', `> ${input}`);

    const output = this.cheatSystem.execute(input);
    if (output.length > 0) {
      this.addLine('output', output);
    }

    this.inputEl.value = '';
  }

  private addLine(kind: ConsoleLine['kind'], text: string): void {
    this.lines.push({ kind, text });
    while (this.lines.length > MAX_OUTPUT_LINES) this.lines.shift();
    this.renderOutput();
  }

  private clearVisibleContent(): void {
    this.lines.length = 0;
    this.inputEl.value = '';
    this.historyIndex = this.history.length;
    this.renderOutput();
  }

  private renderOutput(): void {
    this.outputEl.replaceChildren();

    for (const line of this.lines) {
      const div = document.createElement('div');
      div.textContent = line.text;
      div.style.color = line.kind === 'input' ? '#a8d8ff' : '#e7e7e7';
      this.outputEl.appendChild(div);
    }

    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private recallHistory(delta: number): void {
    if (this.history.length === 0) return;

    this.historyIndex = clamp(this.historyIndex + delta, 0, this.history.length);
    this.inputEl.value = this.historyIndex === this.history.length
      ? ''
      : this.history[this.historyIndex];

    window.setTimeout(() => {
      const end = this.inputEl.value.length;
      this.inputEl.setSelectionRange(end, end);
    }, 0);
  }

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
      return;
    }

    if (this.isOpen && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  };

  private readonly handleInputKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.submit();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.inputEl.value = this.cheatSystem.completeInput(this.inputEl.value);
      const end = this.inputEl.value.length;
      this.inputEl.setSelectionRange(end, end);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.recallHistory(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.recallHistory(1);
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
