import type {
  AutoplayCompletedPayload,
  AutoplayLogEvent,
  AutoplayProgressEvent,
  AutoplayStartedEvent,
  AutoplaySystem,
} from '../../systems/AutoplaySystem';

const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 480;

/**
 * AutoplayHud — debug overlay shown while AutoplaySystem is running or
 * paused. Pure HTML/CSS, mirrors the DiagnosticDialog pattern.
 *
 * Knows nothing about AI internals: subscribes to AutoplaySystem events
 * (started / progress / paused / resumed / stopped / completed / log) and
 * forwards button clicks back to AutoplaySystem.
 */
export class AutoplayHud {
  private readonly root: HTMLDivElement;
  private readonly progressText: HTMLDivElement;
  private readonly progressBarFill: HTMLDivElement;
  private readonly turnLabel: HTMLDivElement;
  private readonly logBox: HTMLDivElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;

  private logLineCount = 0;

  constructor(private readonly autoplay: AutoplaySystem) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10030;
      display: none;
      width: ${PANEL_WIDTH}px;
      max-width: calc(100vw - 32px);
      height: ${PANEL_HEIGHT}px;
      max-height: calc(100vh - 96px);
      border: 1px solid rgba(180, 180, 180, 0.32);
      border-radius: 10px;
      background: rgba(10, 14, 20, 0.94);
      color: #ebeff5;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      pointer-events: auto;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    `;
    const title = document.createElement('div');
    title.textContent = 'Autoplay';
    title.style.cssText = 'font-size: 18px; font-weight: 700; letter-spacing: 0.04em;';
    header.append(title);

    const progressBlock = document.createElement('div');
    progressBlock.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 18px;
    `;
    this.progressText = document.createElement('div');
    this.progressText.textContent = 'Turn 0 of 0';
    this.progressText.style.cssText = 'font-size: 14px; font-weight: 600;';
    const barTrack = document.createElement('div');
    barTrack.style.cssText = `
      height: 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    `;
    this.progressBarFill = document.createElement('div');
    this.progressBarFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6ec6ff, #a7f3d0);
      transition: width 120ms ease-out;
    `;
    barTrack.append(this.progressBarFill);
    this.turnLabel = document.createElement('div');
    this.turnLabel.style.cssText = 'font-size: 12px; color: #aab7c7;';
    progressBlock.append(this.progressText, barTrack, this.turnLabel);

    this.logBox = document.createElement('div');
    this.logBox.style.cssText = `
      flex: 1 1 auto;
      margin: 6px 18px 12px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.25);
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12.5px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    `;

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 12px 18px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      justify-content: flex-end;
    `;
    this.pauseButton = makeButton('Pause', '#f4d06f');
    this.resumeButton = makeButton('Resume', '#a7f3d0');
    this.stopButton = makeButton('Stop', '#f08a7e');
    this.closeButton = makeButton('Close', '#a7f3d0');
    this.pauseButton.addEventListener('click', () => this.autoplay.pause());
    this.resumeButton.addEventListener('click', () => this.autoplay.resume());
    this.stopButton.addEventListener('click', () => this.autoplay.stop());
    this.closeButton.addEventListener('click', () => {
      this.autoplay.reset();
      this.hide();
    });
    buttonRow.append(this.pauseButton, this.resumeButton, this.stopButton, this.closeButton);

    this.root.append(header, progressBlock, this.logBox, buttonRow);
    document.body.appendChild(this.root);

    this.autoplay.onStarted((e) => this.handleStarted(e));
    this.autoplay.onProgress((e) => this.handleProgress(e));
    this.autoplay.onLog((e) => this.handleLog(e));
    this.autoplay.onPaused(() => this.refreshButtons());
    this.autoplay.onResumed(() => this.refreshButtons());
    this.autoplay.onStopped(() => this.handleStopped());
    this.autoplay.onCompleted((e) => this.handleCompleted(e));
  }

  shutdown(): void {
    this.root.remove();
  }

  private handleStarted(e: AutoplayStartedEvent): void {
    this.logLineCount = 0;
    this.logBox.textContent = '';
    this.progressText.textContent = `Turn 0 of ${e.requestedRounds}`;
    this.progressBarFill.style.width = '0%';
    this.turnLabel.textContent = '';
    this.show();
    this.refreshButtons();
  }

  private handleProgress(e: AutoplayProgressEvent): void {
    this.progressText.textContent = `Turn ${e.completedRounds} of ${e.requestedRounds}`;
    const percent = e.requestedRounds > 0
      ? Math.max(0, Math.min(100, (e.completedRounds / e.requestedRounds) * 100))
      : 0;
    this.progressBarFill.style.width = `${percent.toFixed(1)}%`;
    this.turnLabel.textContent = e.currentTurnLabel;
  }

  private handleLog(e: AutoplayLogEvent): void {
    const line = document.createElement('div');
    line.textContent = `[r${e.round}] ${e.message}`;
    this.logBox.append(line);
    this.logLineCount += 1;
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }

  private handleCompleted(e: AutoplayCompletedPayload): void {
    this.progressText.textContent = `Autoplay completed (${e.totalRounds} / ${this.autoplay.getRequestedRounds()} rounds)`;
    this.progressBarFill.style.width = '100%';
    this.turnLabel.textContent = 'Complete';
    this.show();
    this.refreshButtons();
    this.copyLogToClipboard();
  }

  private handleStopped(): void {
    this.hide();
  }

  private refreshButtons(): void {
    const running = this.autoplay.isRunning();
    const paused = this.autoplay.isPaused();
    const completed = this.autoplay.isCompleted();
    this.pauseButton.style.display = running ? '' : 'none';
    this.resumeButton.style.display = paused ? '' : 'none';
    this.stopButton.style.display = running || paused ? '' : 'none';
    this.closeButton.style.display = completed ? '' : 'none';
    this.pauseButton.disabled = completed;
    this.resumeButton.disabled = completed;
    this.stopButton.disabled = completed;
  }

  private show(): void {
    this.root.style.display = 'flex';
  }

  private hide(): void {
    this.root.style.display = 'none';
  }

  private copyLogToClipboard(): void {
    const fullLogText = this.logBox.innerText;
    if (!navigator.clipboard?.writeText) {
      console.warn('[AUTOPLAY] Clipboard API unavailable; log was not copied.');
      return;
    }
    navigator.clipboard.writeText(fullLogText).catch((error) => {
      console.warn('[AUTOPLAY] Clipboard copy failed; log was not copied.', error);
    });
  }
}

function makeButton(label: string, accentColor: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = `
    border: 1px solid ${accentColor};
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    padding: 8px 18px;
    font-weight: 600;
  `;
  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(255, 255, 255, 0.10)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = 'rgba(255, 255, 255, 0.04)';
  });
  return button;
}
