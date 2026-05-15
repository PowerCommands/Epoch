import { CheatSystem, type CheatCompletionSuggestion } from '../systems/CheatSystem';

const MAX_OUTPUT_LINES = 40;

interface ConsoleLine {
  kind: 'input' | 'output';
  text: string;
}

export class CheatConsole {
  private readonly root: HTMLDivElement;
  private readonly outputEl: HTMLDivElement;
  private readonly completionEl: HTMLDivElement;
  private readonly inputEl: HTMLInputElement;
  private readonly history: string[] = [];
  private readonly lines: ConsoleLine[] = [];
  private completionSuggestions: CheatCompletionSuggestion[] = [];
  private selectedCompletionIndex = 0;
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

    this.completionEl = document.createElement('div');
    this.completionEl.style.cssText = `
      display: none;
      max-height: 18vh;
      overflow-y: auto;
      border: 1px solid rgba(180, 180, 180, 0.22);
      border-radius: 4px;
      background: rgba(10, 10, 10, 0.96);
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

    this.root.append(this.outputEl, this.completionEl, this.inputEl);
    document.body.appendChild(this.root);

    document.addEventListener('keydown', this.handleDocumentKeyDown);
    this.inputEl.addEventListener('keydown', this.handleInputKeyDown);
    this.inputEl.addEventListener('input', this.handleInputChange);
  }

  shutdown(): void {
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    this.inputEl.removeEventListener('keydown', this.handleInputKeyDown);
    this.inputEl.removeEventListener('input', this.handleInputChange);
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
    this.closeCompletions();
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
    this.closeCompletions();
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
    this.closeCompletions();
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

    this.closeCompletions();
    this.historyIndex = clamp(this.historyIndex + delta, 0, this.history.length);
    this.inputEl.value = this.historyIndex === this.history.length
      ? ''
      : this.history[this.historyIndex];

    window.setTimeout(() => {
      const end = this.inputEl.value.length;
      this.inputEl.setSelectionRange(end, end);
    }, 0);
  }

  private refreshCompletions(): void {
    this.completionSuggestions = this.cheatSystem.getCompletions(this.inputEl.value);
    this.selectedCompletionIndex = 0;
    this.renderCompletions();
  }

  private closeCompletions(): void {
    this.completionSuggestions = [];
    this.selectedCompletionIndex = 0;
    this.renderCompletions();
  }

  private renderCompletions(): void {
    this.completionEl.replaceChildren();

    if (this.completionSuggestions.length === 0) {
      this.completionEl.style.display = 'none';
      return;
    }

    this.completionEl.style.display = 'block';
    this.completionSuggestions.forEach((suggestion, index) => {
      const row = document.createElement('div');
      const selected = index === this.selectedCompletionIndex;
      row.style.cssText = `
        display: grid;
        grid-template-columns: minmax(120px, 1fr) minmax(90px, 1fr) minmax(90px, 1.4fr);
        gap: 10px;
        align-items: baseline;
        padding: 4px 8px;
        cursor: pointer;
        background: ${selected ? 'rgba(80, 140, 220, 0.95)' : 'rgba(24, 24, 24, 0.96)'};
        color: ${selected ? '#ffffff' : '#e7e7e7'};
      `;

      const valueEl = document.createElement('span');
      valueEl.textContent = suggestion.value;
      valueEl.style.cssText = `
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;

      const labelEl = document.createElement('span');
      labelEl.textContent = suggestion.label && suggestion.label !== suggestion.value ? suggestion.label : '';
      labelEl.style.cssText = `
        color: ${selected ? '#ffffff' : '#b8d6ff'};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;

      const descriptionEl = document.createElement('span');
      descriptionEl.textContent = suggestion.description ?? '';
      descriptionEl.style.cssText = `
        color: ${selected ? '#f4f8ff' : '#a8a8a8'};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;

      row.append(valueEl, labelEl, descriptionEl);
      row.addEventListener('mouseenter', () => {
        this.selectedCompletionIndex = index;
        this.renderCompletions();
      });
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.applyCompletion(suggestion);
      });
      this.completionEl.appendChild(row);
    });
  }

  private moveCompletionSelection(delta: number): void {
    if (this.completionSuggestions.length === 0) return;

    this.selectedCompletionIndex = wrapIndex(
      this.selectedCompletionIndex + delta,
      this.completionSuggestions.length,
    );
    this.renderCompletions();
  }

  private applySelectedCompletion(): void {
    const selected = this.completionSuggestions[this.selectedCompletionIndex];
    if (!selected) return;
    this.applyCompletion(selected);
  }

  private applyCompletion(suggestion: CheatCompletionSuggestion): void {
    this.inputEl.value = this.cheatSystem.getCompletionReplacement(this.inputEl.value, suggestion);
    const end = this.inputEl.value.length;
    this.inputEl.setSelectionRange(end, end);
    this.closeCompletions();
    this.inputEl.focus();
  }

  private hasOpenCompletions(): boolean {
    return this.completionSuggestions.length > 0;
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
      if (this.hasOpenCompletions()) {
        this.closeCompletions();
        return;
      }
      this.close();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.hasOpenCompletions()) {
        this.applySelectedCompletion();
        return;
      }
      this.submit();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      if (this.hasOpenCompletions()) {
        this.moveCompletionSelection(event.shiftKey ? -1 : 1);
      } else {
        this.refreshCompletions();
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.hasOpenCompletions()) {
        this.moveCompletionSelection(-1);
        return;
      }
      this.recallHistory(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.hasOpenCompletions()) {
        this.moveCompletionSelection(1);
        return;
      }
      this.recallHistory(1);
    }
  };

  private readonly handleInputChange = (): void => {
    if (this.hasOpenCompletions()) {
      this.refreshCompletions();
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
