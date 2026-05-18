import { chromium, type Browser, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

interface AutorunOptions {
  turns: number;
  scenario: string;
  outputDir: string;
  port: number;
  headed: boolean;
  timeoutMs: number;
  browserPath?: string;
  savePath?: string;
}

interface AutorunMetadata {
  scenario: string;
  requestedTurns: number;
  completedTurns: number;
  timestamp: string;
  success: boolean;
  durationMs: number;
  port: number;
  savePath?: string;
  outputSavePath?: string;
  startingTurn?: number;
  startingYear?: number;
  finalTurn?: number;
  finalYear?: number;
  browserPath?: string;
  error?: string;
  stateSummary?: unknown;
}

const DEFAULT_PORT = 4173;
const DEFAULT_TURNS = 10;
const DEFAULT_SCENARIO = 'map_europe';
const DEFAULT_OUTPUT_DIR = 'autorun-output';
const SYSTEM_BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  const outputDir = path.resolve(process.cwd(), options.outputDir);
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const savePath = options.savePath ? path.resolve(process.cwd(), options.savePath) : undefined;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
  await fs.mkdir(path.resolve(process.cwd(), 'autorun-input'), { recursive: true });
  const port = options.port;

  let server: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let success = false;
  let completedTurns = 0;
  let errorMessage: string | undefined;
  let logText = '';
  let stateSummary: unknown;
  let saveState: unknown;
  let startScenario = options.scenario;
  let startingTurn: number | undefined;
  let startingYear: number | undefined;
  let browserPath = options.browserPath;
  const browserMessages: string[] = [];

  try {
    const savedState = savePath ? await readSaveState(savePath) : undefined;
    startingTurn = getSavedTurn(savedState);
    startingYear = getSavedYear(savedState);
    startScenario = getSavedScenario(savedState) ?? options.scenario;

    await runNpmCommand(['run', 'build']);
    server = startPreviewServer(port);
    browserPath = browserPath ?? await findSystemBrowserPath();
    browser = await chromium.launch({
      headless: !options.headed,
      executablePath: browserPath,
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    });
    page = await browser.newPage();
    page.on('console', (message) => {
      const text = `[browser:${message.type()}] ${message.text()}`;
      browserMessages.push(text);
      if (message.type() === 'error') console.warn(text);
      else if (message.type() === 'log') console.log(text);
    });
    page.on('pageerror', (error) => {
      const text = `[browser:pageerror] ${error.message}`;
      browserMessages.push(text);
      console.warn(text);
    });

    await gotoWithRetry(page, `http://127.0.0.1:${port}/?epochDiagnostics=1`, options.timeoutMs);
    await page.waitForFunction(
      (useSave) => useSave
        ? typeof window.__epochDiagnostics?.startSavedGame === 'function'
        : typeof window.__epochDiagnostics?.startNewGame === 'function',
      Boolean(savedState),
      { timeout: options.timeoutMs },
    );

    const startResult = savedState
      ? await page.evaluate((state) => window.__epochDiagnostics!.startSavedGame!(state), savedState)
      : await page.evaluate((scenario) => window.__epochDiagnostics!.startNewGame({ scenario }), options.scenario);
    if (!startResult.ok) throw new Error(startResult.error);
    startScenario = startResult.scenario;
    startingTurn = startResult.startingTurn ?? startingTurn;
    startingYear = startResult.startingYear ?? startingYear;

    await page.waitForFunction(
      () => typeof window.__epochDiagnostics?.startAutoplay === 'function',
      undefined,
      { timeout: options.timeoutMs },
    );

    const autoplayResult = await withTimeout(
      page.evaluate((turns) => window.__epochDiagnostics!.startAutoplay(turns), options.turns),
      options.timeoutMs,
      `Autorun timed out after ${options.timeoutMs}ms`,
    );
    completedTurns = autoplayResult.completedRounds;
    logText = await page.evaluate(() => window.__epochDiagnostics!.getEventLogText());
    stateSummary = await page.evaluate(() => window.__epochDiagnostics!.getStateSummary());
    saveState = await page.evaluate(() => window.__epochDiagnostics!.getSaveState?.());
    success = completedTurns >= options.turns;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    if (page) {
      try {
        logText = await page.evaluate(() => window.__epochDiagnostics?.getEventLogText?.() ?? '');
        stateSummary = await page.evaluate(() => window.__epochDiagnostics?.getStateSummary?.() ?? undefined);
        await page.screenshot({ path: path.join(screenshotsDir, 'failure.png'), fullPage: true });
      } catch (screenshotError) {
        browserMessages.push(`[autorun] failed to capture failure details: ${String(screenshotError)}`);
      }
    }
  } finally {
    await browser?.close();
    stopPreviewServer(server);
  }

  const durationMs = Date.now() - startedAt;
  const outputSavePath = path.join(outputDir, 'latest-save.json');
  const finalState = stateSummary as { currentRound?: number } | undefined;
  const metadata: AutorunMetadata = {
    scenario: startScenario,
    requestedTurns: options.turns,
    completedTurns,
    timestamp,
    success,
    durationMs,
    port,
    savePath,
    outputSavePath: saveState ? path.relative(process.cwd(), outputSavePath) : undefined,
    startingTurn,
    startingYear,
    finalTurn: finalState?.currentRound,
    browserPath,
    error: errorMessage,
    stateSummary,
  };
  const summary = buildSummary(metadata, browserMessages);

  await fs.writeFile(path.join(outputDir, 'latest-log.txt'), logText || '(no log entries)\n', 'utf8');
  await fs.writeFile(path.join(outputDir, 'latest-summary.md'), summary, 'utf8');
  await fs.writeFile(path.join(outputDir, 'latest-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  if (saveState) {
    await fs.writeFile(outputSavePath, `${JSON.stringify(saveState, null, 2)}\n`, 'utf8');
  }

  if (!success) {
    console.error(`Autorun failed: ${errorMessage ?? 'completed fewer turns than requested'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Autorun completed ${completedTurns}/${options.turns} turns.`);
  console.log(`Wrote diagnostics to ${path.relative(process.cwd(), outputDir)}`);
}

function parseArgs(args: string[]): AutorunOptions {
  const options: AutorunOptions = {
    turns: DEFAULT_TURNS,
    scenario: DEFAULT_SCENARIO,
    outputDir: DEFAULT_OUTPUT_DIR,
    port: DEFAULT_PORT,
    headed: false,
    timeoutMs: 120_000,
    browserPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--turns' && next) {
      options.turns = Math.max(1, Number.parseInt(next, 10));
      i++;
    } else if (arg === '--scenario' && next) {
      options.scenario = next;
      i++;
    } else if (arg === '--output' && next) {
      options.outputDir = next;
      i++;
    } else if (arg === '--save' && next) {
      options.savePath = next;
      i++;
    } else if (arg === '--timeout-ms' && next) {
      options.timeoutMs = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--browser-path' && next) {
      options.browserPath = next;
      i++;
    }
  }

  return options;
}

function startPreviewServer(port: number): ChildProcessWithoutNullStreams {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: 'none' },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function runNpmCommand(args: string[]): Promise<void> {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${npmCommand} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function stopPreviewServer(server: ChildProcessWithoutNullStreams | null): void {
  if (!server || server.killed) return;
  if (process.platform !== 'win32' && server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
      return;
    } catch {
      // Fall back to killing the npm wrapper directly.
    }
  }
  server.kill('SIGTERM');
}

async function gotoWithRetry(page: Page, url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not open ${url}`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function buildSummary(metadata: AutorunMetadata, browserMessages: string[]): string {
  const lines = [
    '# Epoch Autorun Summary',
    '',
    `- Scenario: ${metadata.scenario}`,
    `- Requested turns: ${metadata.requestedTurns}`,
    `- Completed turns: ${metadata.completedTurns}`,
    `- Success: ${metadata.success ? 'yes' : 'no'}`,
    `- Duration: ${(metadata.durationMs / 1000).toFixed(1)}s`,
    `- Timestamp: ${metadata.timestamp}`,
    `- Port: ${metadata.port}`,
  ];
  if (metadata.savePath) lines.push(`- Input save: ${metadata.savePath}`);
  if (metadata.outputSavePath) lines.push(`- Output save: ${metadata.outputSavePath}`);
  if (metadata.startingTurn !== undefined) lines.push(`- Starting turn: ${metadata.startingTurn}`);
  if (metadata.finalTurn !== undefined) lines.push(`- Final turn: ${metadata.finalTurn}`);
  if (metadata.startingYear !== undefined) lines.push(`- Starting year: ${metadata.startingYear}`);
  if (metadata.error) lines.push(`- Error: ${metadata.error}`);
  if (metadata.browserPath) lines.push(`- Browser: ${metadata.browserPath}`);
  if (browserMessages.length > 0) {
    lines.push('', '## Browser Messages', '');
    lines.push(...browserMessages.slice(-20).map((message) => `- ${message}`));
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findSystemBrowserPath(): Promise<string | undefined> {
  for (const candidate of SYSTEM_BROWSER_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known local browser path.
    }
  }
  return undefined;
}

async function readSaveState(savePath: string): Promise<unknown> {
  const raw = await fs.readFile(savePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse save file ${savePath}: ${message}`);
  }
}

function getSavedScenario(savedState: unknown): string | undefined {
  return isRecord(savedState) && typeof savedState.mapKey === 'string' ? savedState.mapKey : undefined;
}

function getSavedTurn(savedState: unknown): number | undefined {
  if (!isRecord(savedState) || !isRecord(savedState.turn)) return undefined;
  return typeof savedState.turn.currentRound === 'number' ? savedState.turn.currentRound : undefined;
}

function getSavedYear(savedState: unknown): number | undefined {
  return isRecord(savedState) && typeof savedState.worldYear === 'number' ? savedState.worldYear : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

declare global {
  interface Window {
    __epochDiagnostics?: {
      listScenarios?: () => Array<{ key: string; label: string; custom: boolean }>;
      startNewGame?: (options?: {
        scenario?: string;
        humanNationId?: string;
        activeNationIds?: string[];
        gameSpeedId?: string;
        resourceAbundance?: string;
      }) => { ok: true; scenario: string; humanNationId: string; activeNationIds: string[] } | { ok: false; error: string };
      startSavedGame?: (savedState: unknown) => {
        ok: true;
        scenario: string;
        humanNationId: string;
        activeNationIds: string[];
        startingTurn: number;
        startingYear?: number;
      } | { ok: false; error: string };
      startAutoplay?: (rounds: number) => Promise<{ completedRounds: number }>;
      stopAutoplay?: () => void;
      isAutoplayActive?: () => boolean;
      isAutoplayCompleted?: () => boolean;
      getEventLogText?: () => string;
      getStateSummary?: () => unknown;
      getSaveState?: () => unknown;
    };
  }
}
