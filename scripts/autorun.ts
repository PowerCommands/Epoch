import { chromium, type Browser, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

type VictoryTypeName = 'domination' | 'science' | 'cultural' | 'diplomatic';
const ALL_VICTORY_TYPES: readonly VictoryTypeName[] = ['domination', 'science', 'cultural', 'diplomatic'];

interface VictoryConditionsConfig {
  domination?: { enabled: boolean };
  science?: { enabled: boolean };
  cultural?: { enabled: boolean };
  diplomatic?: { enabled: boolean };
}

interface AutorunOptions {
  turns: number;
  scenario: string;
  outputDir: string;
  port: number;
  headed: boolean;
  timeoutMs: number;
  browserPath?: string;
  savePath?: string;
  /** When set (via --victory), only these victory types are enabled for new games. */
  victoryTypes?: VictoryTypeName[];
  continueAfterVictory: boolean;
}

interface VictorySummary {
  nationId: string;
  nationName: string;
  type: string;
  round: number;
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
  victoryConditions?: VictoryConditionsConfig;
  victoryDetected: boolean;
  victoryNationId?: string;
  victoryNationName?: string;
  victoryType?: string;
  victoryRound?: number;
  browserPath?: string;
  error?: string;
  stateSummary?: unknown;
}

/** Per-nation progression snapshot exposed by getStateSummary(). */
interface NationStateSummary {
  id: string;
  name: string;
  isHuman: boolean;
  era: string;
  technologyCount: number;
  cultureNodeCount: number;
  currentResearch: string | null;
  currentCulture: string | null;
  cityCount: number;
  population: number;
  currency: {
    name: string;
    symbol: string;
    strength: string;
    treasury: number;
  } | null;
  cityIntegration: {
    occupied: number;
    recovering: number;
    integrated: number;
  };
}

interface EraMilestone {
  era: string;
  nationId: string;
  nationName: string;
  turn: number;
  worldYear: number;
  worldYearLabel: string;
  previousEra: string;
  newEra: string;
  source: string | null;
}

interface StateSummary {
  currentRound: number;
  currentNationId: string;
  currentNationName: string;
  nationCount: number;
  cityCount: number;
  unitCount: number;
  worldYear?: number;
  worldYearLabel?: string;
  scenario?: string;
  victory?: VictorySummary | null;
  nations?: NationStateSummary[];
  eraMilestones?: EraMilestone[];
}

interface NationLeader {
  id: string;
  name: string;
  value: number;
}

/** Machine-readable timeline/progression calibration, written to its own JSON file. */
interface TimelineCalibration {
  scenario: string;
  startingTurn: number | null;
  finalTurn: number | null;
  startingYear: number | null;
  finalYear: number | null;
  finalYearLabel: string | null;
  elapsedTurns: number | null;
  nations: NationStateSummary[];
  leadingByTechnology: NationLeader | null;
  leadingByCulture: NationLeader | null;
  slowestByTechnology: NationLeader | null;
  slowestByCulture: NationLeader | null;
  mostAdvancedEra: string | null;
  eraDistribution: Record<string, number>;
  eraMilestones: EraMilestone[];
  warnings: string[];
}

const ERA_ORDER: readonly string[] = [
  'ancient',
  'classical',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'atomic',
  'information',
  'future',
];

// A nation this far ahead of the runner-up (in techs or culture nodes) is flagged
// as a runaway leader; tune here without touching gameplay code.
const RUNAWAY_LEADER_GAP = 4;

const DEFAULT_PORT = 4173;
const DEFAULT_TURNS = 10;
const DEFAULT_SCENARIO = 'map_maritime_expansion';
const DEFAULT_OUTPUT_DIR = 'autorun-output';
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
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
  let stateSummary: StateSummary | undefined;
  let inputSaveState: unknown;
  let saveState: unknown;
  let startScenario = options.scenario;
  let startingTurn: number | undefined;
  let startingYear: number | undefined;
  let browserPath = options.browserPath;
  let victory: VictorySummary | null = null;
  const browserMessages: string[] = [];
    // New games honor --victory. Loaded diagnostic saves also honor it when
    // supplied, which lets long balance runs continue after unrelated victories.
  const victoryConditions = buildVictoryConditions(options.victoryTypes);

  try {
    inputSaveState = savePath ? await readSaveState(savePath) : undefined;
    startingTurn = getSavedTurn(inputSaveState);
    startingYear = getSavedYear(inputSaveState);
    startScenario = getSavedScenario(inputSaveState) ?? options.scenario;

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
      if (text.includes('[DEBUG] Suspicion')) return;
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
      Boolean(inputSaveState),
      { timeout: options.timeoutMs },
    );

    const startResult = inputSaveState
      ? await page.evaluate(
        (args) => window.__epochDiagnostics!.startSavedGame!(args.state, { victoryConditions: args.victoryConditions }),
        { state: inputSaveState, victoryConditions },
      )
      : await page.evaluate(
        (args) => window.__epochDiagnostics!.startNewGame({
          scenario: args.scenario,
          victoryConditions: args.victoryConditions,
        }),
        { scenario: options.scenario, victoryConditions },
      );
    if (startResult.ok !== true) throw new Error(startResult.error);
    startScenario = startResult.scenario;
    if ('startingTurn' in startResult && typeof startResult.startingTurn === 'number') {
      startingTurn = startResult.startingTurn;
    }
    if ('startingYear' in startResult && typeof startResult.startingYear === 'number') {
      startingYear = startResult.startingYear;
    }

    await page.waitForFunction(
      () => typeof window.__epochDiagnostics?.startAutoplay === 'function',
      undefined,
      { timeout: options.timeoutMs },
    );

    // Capture the pre-autoplay state so starting turn/year are always populated
    // (new games don't report them via startNewGame), giving deterministic elapsed
    // turns in the timeline calibration.
    const initialSummary = await page.evaluate(() => window.__epochDiagnostics?.getStateSummary?.());
    if (startingTurn === undefined && typeof initialSummary?.currentRound === 'number') {
      startingTurn = initialSummary.currentRound;
    }
    if (startingYear === undefined && typeof initialSummary?.worldYear === 'number') {
      startingYear = initialSummary.worldYear;
    }

    const autoplayResult = await withTimeout(
      page.evaluate(
        (args) => window.__epochDiagnostics!.startAutoplay(args.turns, { continueAfterVictory: args.continueAfterVictory }),
        { turns: options.turns, continueAfterVictory: options.continueAfterVictory },
      ),
      options.timeoutMs,
      `Autorun timed out after ${options.timeoutMs}ms`,
    );
    completedTurns = autoplayResult.completedRounds;
    logText = await page.evaluate(() => window.__epochDiagnostics!.getEventLogText());
    stateSummary = await page.evaluate(() => window.__epochDiagnostics!.getStateSummary());
    saveState = await page.evaluate(() => window.__epochDiagnostics!.getSaveState?.());
    // Prefer the structured victory from the autoplay result; fall back to the
    // post-run state summary. A victory ending the run early still counts as success.
    victory = autoplayResult.victory ?? stateSummary?.victory ?? null;
    success = completedTurns >= options.turns || victory !== null;
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
  const finalYear = typeof stateSummary?.worldYear === 'number' ? stateSummary.worldYear : getSavedYear(saveState);
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
    finalTurn: stateSummary?.currentRound,
    finalYear,
    victoryConditions: victoryConditions ?? getSavedVictoryConditions(inputSaveState),
    victoryDetected: victory !== null,
    victoryNationId: victory?.nationId,
    victoryNationName: victory?.nationName,
    victoryType: victory?.type,
    victoryRound: victory?.round,
    browserPath,
    error: errorMessage,
    stateSummary,
  };
  const calibration = buildTimelineCalibration(metadata, stateSummary);
  const summary = buildSummary(metadata, calibration, browserMessages);

  await fs.writeFile(path.join(outputDir, 'latest-log.txt'), logText || '(no log entries)\n', 'utf8');
  // The summary keeps only the last 20 browser messages, which discards every
  // console-only diagnostic the game emits (e.g. [Diplomacy], [AggressionMemory]).
  // Persist the full stream so post-run analysis can reconstruct it.
  await fs.writeFile(
    path.join(outputDir, 'browser-console.log'),
    browserMessages.length > 0 ? `${browserMessages.join('\n')}\n` : '(no browser messages)\n',
    'utf8',
  );
  await fs.writeFile(path.join(outputDir, 'latest-summary.md'), summary, 'utf8');
  await fs.writeFile(path.join(outputDir, 'latest-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(outputDir, 'latest-timeline-calibration.json'),
    `${JSON.stringify(calibration, null, 2)}\n`,
    'utf8',
  );
  if (saveState) {
    await fs.writeFile(outputSavePath, `${JSON.stringify(saveState, null, 2)}\n`, 'utf8');
  }

  if (!success) {
    console.error(`Autorun failed: ${errorMessage ?? 'completed fewer turns than requested'}`);
    process.exitCode = 1;
    return;
  }

  if (victory) {
    console.log(
      `Autorun ended early on victory: ${victory.nationName} won by ${victory.type} victory on round ${victory.round} (after ${completedTurns}/${options.turns} turns).`,
    );
  } else {
    console.log(`Autorun completed ${completedTurns}/${options.turns} turns.`);
  }
  console.log(`Wrote diagnostics to ${path.relative(process.cwd(), outputDir)}`);
}

function parseArgs(args: string[]): AutorunOptions {
  const options: AutorunOptions = {
    turns: DEFAULT_TURNS,
    scenario: DEFAULT_SCENARIO,
    outputDir: DEFAULT_OUTPUT_DIR,
    port: DEFAULT_PORT,
    headed: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    browserPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    continueAfterVictory: false,
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
    } else if (arg === '--save' && next) {
      options.savePath = next;
      i++;
    } else if (arg === '--timeout-ms' && next) {
      options.timeoutMs = Number.parseInt(next, 10);
      i++;
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--continue-after-victory') {
      options.continueAfterVictory = true;
    } else if (arg === '--browser-path' && next) {
      options.browserPath = next;
      i++;
    } else if (arg === '--victory' && next) {
      options.victoryTypes = parseVictoryTypes(next);
      i++;
    }
  }

  return options;
}

/**
 * Parse a `--victory domination,science` value into a deduped list of valid
 * victory types. Unknown tokens are ignored with a warning so a typo can't
 * silently enable everything.
 */
function parseVictoryTypes(value: string): VictoryTypeName[] {
  const selected: VictoryTypeName[] = [];
  for (const raw of value.split(',')) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if ((ALL_VICTORY_TYPES as readonly string[]).includes(token)) {
      const victoryType = token as VictoryTypeName;
      if (!selected.includes(victoryType)) selected.push(victoryType);
    } else {
      console.warn(`[autorun] Ignoring unknown victory type: ${token}`);
    }
  }
  return selected;
}

/**
 * Build the victoryConditions config passed to startNewGame. Absent --victory
 * leaves it undefined so the engine default (all enabled) applies; an explicit
 * list enables only the named types and disables the rest.
 */
function buildVictoryConditions(victoryTypes: VictoryTypeName[] | undefined): VictoryConditionsConfig | undefined {
  if (!victoryTypes) return undefined;
  return {
    domination: { enabled: victoryTypes.includes('domination') },
    science: { enabled: victoryTypes.includes('science') },
    cultural: { enabled: victoryTypes.includes('cultural') },
    diplomatic: { enabled: victoryTypes.includes('diplomatic') },
  };
}

function formatVictoryConditions(config: VictoryConditionsConfig): string {
  return ALL_VICTORY_TYPES
    .map((type) => `${type}: ${config[type]?.enabled ? 'on' : 'off'}`)
    .join(', ');
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

function buildSummary(
  metadata: AutorunMetadata,
  calibration: TimelineCalibration,
  browserMessages: string[],
): string {
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
  // State plainly why the run ended: requested turns completed vs. early victory.
  const endReason = metadata.victoryDetected
    ? `victory (${metadata.victoryNationName ?? metadata.victoryNationId ?? 'a nation'} won by ${metadata.victoryType ?? 'unknown'} victory on round ${metadata.victoryRound ?? '?'})`
    : metadata.completedTurns >= metadata.requestedTurns
      ? 'requested turns completed'
      : 'incomplete (did not reach requested turns or a victory)';
  lines.push(`- End reason: ${endReason}`);
  if (metadata.savePath) lines.push(`- Input save: ${metadata.savePath}`);
  if (metadata.outputSavePath) lines.push(`- Output save: ${metadata.outputSavePath}`);
  if (metadata.startingTurn !== undefined) lines.push(`- Starting turn: ${metadata.startingTurn}`);
  if (metadata.finalTurn !== undefined) lines.push(`- Final turn: ${metadata.finalTurn}`);
  if (metadata.startingYear !== undefined) lines.push(`- Starting year: ${metadata.startingYear}`);
  if (metadata.finalYear !== undefined && metadata.finalYear !== null) lines.push(`- Final year: ${metadata.finalYear}`);
  if (metadata.victoryConditions) {
    lines.push(`- Victory conditions: ${formatVictoryConditions(metadata.victoryConditions)}`);
  }
  if (metadata.error) lines.push(`- Error: ${metadata.error}`);
  if (metadata.browserPath) lines.push(`- Browser: ${metadata.browserPath}`);

  if (metadata.victoryDetected) {
    lines.push('', '## Victory', '');
    lines.push(`- Winner: ${metadata.victoryNationName ?? metadata.victoryNationId ?? 'unknown'}`);
    if (metadata.victoryNationId) lines.push(`- Winner id: ${metadata.victoryNationId}`);
    if (metadata.victoryType) lines.push(`- Type: ${metadata.victoryType}`);
    if (metadata.victoryRound !== undefined) lines.push(`- Round: ${metadata.victoryRound}`);
  }

  lines.push('', ...renderTimelineCalibration(calibration));

  if (browserMessages.length > 0) {
    lines.push('', '## Browser Messages', '');
    lines.push(...browserMessages.slice(-20).map((message) => `- ${message}`));
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/**
 * Derive the timeline/progression calibration view from a state summary. Pure and
 * deterministic — given the same summary it always yields the same result, so it is
 * stable across long autorun sessions. Nations keep their engine order for tie-breaks.
 */
function buildTimelineCalibration(
  metadata: AutorunMetadata,
  stateSummary: StateSummary | undefined,
): TimelineCalibration {
  const nations = stateSummary?.nations ?? [];
  const startingTurn = metadata.startingTurn ?? null;
  const finalTurn = metadata.finalTurn ?? null;
  const elapsedTurns = startingTurn !== null && finalTurn !== null ? finalTurn - startingTurn : null;

  const eraDistribution: Record<string, number> = {};
  for (const nation of nations) {
    eraDistribution[nation.era] = (eraDistribution[nation.era] ?? 0) + 1;
  }

  const leadingByTechnology = pickLeader(nations, (n) => n.technologyCount, 'max');
  const slowestByTechnology = pickLeader(nations, (n) => n.technologyCount, 'min');
  const leadingByCulture = pickLeader(nations, (n) => n.cultureNodeCount, 'max');
  const slowestByCulture = pickLeader(nations, (n) => n.cultureNodeCount, 'min');
  const eraMilestones = stateSummary?.eraMilestones ?? [];
  const mostAdvancedEra = nations.length > 0
    ? nations.reduce((highest, n) => (eraRank(n.era) > eraRank(highest) ? n.era : highest), nations[0].era)
    : null;

  return {
    scenario: metadata.scenario,
    startingTurn,
    finalTurn,
    startingYear: metadata.startingYear ?? null,
    finalYear: metadata.finalYear ?? null,
    finalYearLabel: stateSummary?.worldYearLabel ?? null,
    elapsedTurns,
    nations,
    leadingByTechnology,
    leadingByCulture,
    slowestByTechnology,
    slowestByCulture,
    mostAdvancedEra,
    eraDistribution,
    eraMilestones,
    warnings: buildCalibrationWarnings(nations),
  };
}

function eraRank(era: string): number {
  const index = ERA_ORDER.indexOf(era);
  return index === -1 ? -1 : index;
}

/** Pick the leading/slowest nation by a numeric metric, keeping engine order for ties. */
function pickLeader(
  nations: readonly NationStateSummary[],
  metric: (nation: NationStateSummary) => number,
  mode: 'max' | 'min',
): NationLeader | null {
  if (nations.length === 0) return null;
  let best = nations[0];
  for (const nation of nations) {
    const better = mode === 'max' ? metric(nation) > metric(best) : metric(nation) < metric(best);
    if (better) best = nation;
  }
  return { id: best.id, name: best.name, value: metric(best) };
}

function buildCalibrationWarnings(nations: readonly NationStateSummary[]): string[] {
  const warnings: string[] = [];
  if (nations.length < 2) return warnings;

  const techCounts = nations.map((n) => n.technologyCount).sort((a, b) => b - a);
  if (techCounts[0] - techCounts[1] >= RUNAWAY_LEADER_GAP) {
    const leader = pickLeader(nations, (n) => n.technologyCount, 'max');
    warnings.push(
      `Technology runaway: ${leader?.name ?? 'leader'} leads by ${techCounts[0] - techCounts[1]} techs (${techCounts[0]} vs ${techCounts[1]}).`,
    );
  }

  const cultureCounts = nations.map((n) => n.cultureNodeCount).sort((a, b) => b - a);
  if (cultureCounts[0] - cultureCounts[1] >= RUNAWAY_LEADER_GAP) {
    const leader = pickLeader(nations, (n) => n.cultureNodeCount, 'max');
    warnings.push(
      `Culture runaway: ${leader?.name ?? 'leader'} leads by ${cultureCounts[0] - cultureCounts[1]} nodes (${cultureCounts[0]} vs ${cultureCounts[1]}).`,
    );
  }

  const ancientCount = nations.filter((n) => n.era === 'ancient').length;
  if (ancientCount / nations.length > 0.5 && nations.some((n) => n.era !== 'ancient')) {
    warnings.push(
      `Progression stall: ${ancientCount}/${nations.length} nations are still in the ancient era while others have advanced.`,
    );
  }

  if (nations.every((n) => n.technologyCount === 0)) {
    warnings.push('No technology progress: every nation has 0 technologies researched.');
  }

  return warnings;
}

function renderTimelineCalibration(calibration: TimelineCalibration): string[] {
  const lines = ['## Timeline Calibration', ''];
  lines.push(`- Scenario: ${calibration.scenario}`);
  lines.push(`- Starting turn: ${formatValue(calibration.startingTurn)}`);
  lines.push(`- Final turn: ${formatValue(calibration.finalTurn)}`);
  lines.push(`- Elapsed turns: ${formatValue(calibration.elapsedTurns)}`);
  lines.push(`- Starting year: ${formatValue(calibration.startingYear)}`);
  lines.push(`- Final year: ${formatValue(calibration.finalYear)}${calibration.finalYearLabel ? ` (${calibration.finalYearLabel})` : ''}`);
  lines.push(`- Most advanced era: ${calibration.mostAdvancedEra ?? 'n/a'}`);
  lines.push(`- Leading by technology: ${formatLeader(calibration.leadingByTechnology, 'techs')}`);
  lines.push(`- Slowest by technology: ${formatLeader(calibration.slowestByTechnology, 'techs')}`);
  lines.push(`- Leading by culture: ${formatLeader(calibration.leadingByCulture, 'nodes')}`);
  lines.push(`- Slowest by culture: ${formatLeader(calibration.slowestByCulture, 'nodes')}`);

  const eraKeys = Object.keys(calibration.eraDistribution).sort((a, b) => eraRank(a) - eraRank(b));
  const eraText = eraKeys.length > 0
    ? eraKeys.map((era) => `${era}: ${calibration.eraDistribution[era]}`).join(', ')
    : 'n/a';
  lines.push(`- Era distribution: ${eraText}`);

  lines.push('', '### Era Milestones', '');
  if (calibration.eraMilestones.length > 0) {
    lines.push('| Era | Nation | Turn | Date | Previous | New | Source |');
    lines.push('| --- | --- | ---: | --- | --- | --- | --- |');
    for (const milestone of calibration.eraMilestones) {
      lines.push(
        `| ${milestone.era} | ${milestone.nationName} | ${milestone.turn} | ${milestone.worldYearLabel} | ${milestone.previousEra} | ${milestone.newEra} | ${milestone.source ?? 'n/a'} |`,
      );
    }
  } else {
    lines.push('- None observed in this segment');
  }

  if (calibration.nations.length > 0) {
    lines.push('', '### Nations', '');
    lines.push('| Nation | Era | Techs | Culture | Cities | Pop | Researching | Culture target |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- | --- |');
    for (const nation of calibration.nations) {
      const label = nation.isHuman ? `${nation.name} (human)` : nation.name;
      lines.push(
        `| ${label} | ${nation.era} | ${nation.technologyCount} | ${nation.cultureNodeCount} | ${nation.cityCount} | ${nation.population} | ${nation.currentResearch ?? '—'} | ${nation.currentCulture ?? '—'} |`,
      );
    }
  }

  lines.push('', '### Warnings', '');
  if (calibration.warnings.length > 0) {
    lines.push(...calibration.warnings.map((warning) => `- ⚠️ ${warning}`));
  } else {
    lines.push('- None');
  }

  return lines;
}

function formatValue(value: number | null): string {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function formatLeader(leader: NationLeader | null, unit: string): string {
  return leader ? `${leader.name} (${leader.value} ${unit})` : 'n/a';
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

function getSavedVictoryConditions(savedState: unknown): VictoryConditionsConfig | undefined {
  if (!isRecord(savedState) || !isRecord(savedState.victoryConditions)) return undefined;
  const conditions = savedState.victoryConditions;
  return {
    domination: { enabled: conditions.domination === true },
    science: { enabled: conditions.science === true },
    cultural: { enabled: conditions.cultural === true },
    diplomatic: { enabled: conditions.diplomatic !== false },
  };
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
        victoryConditions?: VictoryConditionsConfig;
      }) => { ok: true; scenario: string; humanNationId: string; activeNationIds: string[] } | { ok: false; error: string };
      startSavedGame?: (savedState: unknown, options?: { victoryConditions?: VictoryConditionsConfig }) => {
        ok: true;
        scenario: string;
        humanNationId: string;
        activeNationIds: string[];
        startingTurn: number;
        startingYear?: number;
      } | { ok: false; error: string };
      startAutoplay?: (rounds: number, options?: { continueAfterVictory?: boolean }) => Promise<{ completedRounds: number; victory: VictorySummary | null }>;
      stopAutoplay?: () => void;
      isAutoplayActive?: () => boolean;
      isAutoplayCompleted?: () => boolean;
      getEventLogText?: () => string;
      getStateSummary?: () => StateSummary;
      getSaveState?: () => unknown;
    };
  }
}
