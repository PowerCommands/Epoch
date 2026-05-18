import { chromium, type Browser, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
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
}

interface AutorunMetadata {
  scenario: string;
  requestedTurns: number;
  completedTurns: number;
  timestamp: string;
  success: boolean;
  durationMs: number;
  port: number;
  browserPath?: string;
  error?: string;
  stateSummary?: unknown;
}

const DEFAULT_PORT = 4175;
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
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
  const port = await findAvailablePort(options.port);

  let server: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let success = false;
  let completedTurns = 0;
  let errorMessage: string | undefined;
  let logText = '';
  let stateSummary: unknown;
  let browserPath = options.browserPath;
  const browserMessages: string[] = [];

  try {
    await runNpmCommand(['run', 'build']);
    server = startPreviewServer(port);
    browserPath = browserPath ?? await findSystemBrowserPath();
    browser = await chromium.launch({
      headless: !options.headed,
      executablePath: browserPath,
    });
    page = await browser.newPage();
    page.on('console', (message) => {
      const text = `[browser:${message.type()}] ${message.text()}`;
      browserMessages.push(text);
      if (message.type() === 'error') console.warn(text);
    });
    page.on('pageerror', (error) => {
      const text = `[browser:pageerror] ${error.message}`;
      browserMessages.push(text);
      console.warn(text);
    });

    await gotoWithRetry(page, `http://127.0.0.1:${port}/?epochDiagnostics=1`, options.timeoutMs);
    await page.waitForFunction(
      () => typeof window.__epochDiagnostics?.startNewGame === 'function',
      undefined,
      { timeout: options.timeoutMs },
    );

    const startResult = await page.evaluate((scenario) => {
      return window.__epochDiagnostics!.startNewGame({ scenario });
    }, options.scenario);
    if (!startResult.ok) throw new Error(startResult.error);

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
    stopDevServer(server);
  }

  const durationMs = Date.now() - startedAt;
  const metadata: AutorunMetadata = {
    scenario: options.scenario,
    requestedTurns: options.turns,
    completedTurns,
    timestamp,
    success,
    durationMs,
    port,
    browserPath,
    error: errorMessage,
    stateSummary,
  };
  const summary = buildSummary(metadata, browserMessages);

  await fs.writeFile(path.join(outputDir, 'latest-log.txt'), logText || '(no log entries)\n', 'utf8');
  await fs.writeFile(path.join(outputDir, 'latest-summary.md'), summary, 'utf8');
  await fs.writeFile(path.join(outputDir, 'latest-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

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
    } else if (arg === '--port' && next) {
      options.port = Number.parseInt(next, 10);
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

function stopDevServer(server: ChildProcessWithoutNullStreams | null): void {
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

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 50; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 49}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
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
      startAutoplay?: (rounds: number) => Promise<{ completedRounds: number }>;
      stopAutoplay?: () => void;
      isAutoplayActive?: () => boolean;
      isAutoplayCompleted?: () => boolean;
      getEventLogText?: () => string;
      getStateSummary?: () => unknown;
    };
  }
}
