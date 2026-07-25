/**
 * Autorun series wrapper.
 *
 * Runs a long autorun session as a sequence of fixed-size turn blocks, continuing
 * each block from the previous block's save, stopping on victory / max turns /
 * failure, preserving a checkpoint save per block, and finally assembling a
 * consolidated series report.
 *
 * It deliberately shells out to the existing `scripts/autorun.ts` for game
 * execution rather than reimplementing it, and treats that script's output files
 * (`latest-save.json`, `latest-metadata.json`, ...) as the source of truth. No AI
 * inspection happens between blocks — the whole series is mechanical.
 *
 * Usage:
 *   npx tsx tools/autorun-series.ts                # full default series
 *   npx tsx tools/autorun-series.ts --report-only  # rebuild reports from block dirs
 *
 * Flags: --scenario --max-turns --block-size --victory --timeout-ms --output
 *        --port --report-only --resume-save
 *
 * --resume-save <path>: seed the first block from an existing checkpoint save so
 * an interrupted series can continue. --max-turns is then interpreted as turns
 * from the resumed starting turn (not absolute).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  type BlockResult,
  type SeriesRunContext,
  buildSeriesReportModel,
  checkpointFileName,
  finalNameLookup,
  loadBlockArtifacts,
  renderSeriesReportMarkdown,
} from './autorun-series-report.ts';

const HOUR_MS = 60 * 60 * 1000;

interface SeriesOptions {
  scenario: string;
  maxTurns: number;
  blockSize: number;
  victoryTypes: string[];
  timeoutMs: number;
  outputDir: string;
  port: number;
  reportOnly: boolean;
  /** Optional save to seed the FIRST block with, to resume a previously interrupted series. */
  resumeSave?: string;
}

const DEFAULTS: SeriesOptions = {
  scenario: 'map_maritime_expansion',
  maxTurns: 800,
  blockSize: 100,
  victoryTypes: ['domination', 'science', 'cultural', 'diplomatic'],
  timeoutMs: 3 * HOUR_MS,
  outputDir: 'autorun-output/maritime-expansion-full-test',
  port: 4173,
  reportOnly: false,
};

function parseArgs(argv: string[]): SeriesOptions {
  const options: SeriesOptions = { ...DEFAULTS, victoryTypes: [...DEFAULTS.victoryTypes] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--scenario' && next) { options.scenario = next; i++; }
    else if (arg === '--max-turns' && next) { options.maxTurns = Math.max(1, Number.parseInt(next, 10)); i++; }
    else if (arg === '--block-size' && next) { options.blockSize = Math.max(1, Number.parseInt(next, 10)); i++; }
    else if (arg === '--victory' && next) { options.victoryTypes = next.split(',').map((s) => s.trim()).filter(Boolean); i++; }
    else if (arg === '--timeout-ms' && next) { options.timeoutMs = Number.parseInt(next, 10); i++; }
    else if (arg === '--output' && next) { options.outputDir = next; i++; }
    else if (arg === '--port' && next) { options.port = Number.parseInt(next, 10); i++; }
    else if (arg === '--resume-save' && next) { options.resumeSave = next; i++; }
    else if (arg === '--report-only') { options.reportOnly = true; }
  }
  return options;
}

function blockDirName(blockNumber: number): string {
  return `block-${String(blockNumber).padStart(3, '0')}`;
}

/** Spawn scripts/autorun.ts for one block, streaming output to a console log. */
function runAutorunBlock(
  args: string[],
  consoleLogPath: string,
  hardTimeoutMs: number,
): Promise<{ exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn('npx', ['tsx', 'scripts/autorun.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let timedOut = false;
    const watchdog = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Escalate if it ignores SIGTERM.
      setTimeout(() => child.kill('SIGKILL'), 15_000);
    }, hardTimeoutMs);

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      process.stdout.write(chunk);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('close', (code) => {
      clearTimeout(watchdog);
      void fs.writeFile(consoleLogPath, Buffer.concat(chunks)).finally(() => {
        resolve({ exitCode: code, timedOut });
      });
    });
    child.once('error', (error) => {
      clearTimeout(watchdog);
      chunks.push(Buffer.from(`\n[autorun-series] spawn error: ${String(error)}\n`));
      void fs.writeFile(consoleLogPath, Buffer.concat(chunks)).finally(() => {
        resolve({ exitCode: null, timedOut });
      });
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runSeries(options: SeriesOptions): Promise<void> {
  const seriesRoot = path.resolve(process.cwd(), options.outputDir);
  await fs.mkdir(seriesRoot, { recursive: true });

  const totalBlocks = Math.ceil(options.maxTurns / options.blockSize);
  const startedAt = Date.now();
  const blocks: BlockResult[] = [];
  // Seed the first block from a resume save when provided, so an interrupted
  // series can continue from its last preserved checkpoint.
  let previousSavePath: string | null = options.resumeSave
    ? path.resolve(process.cwd(), options.resumeSave)
    : null;
  let endReason: SeriesRunContext['endReason'] = 'max-turns';

  if (previousSavePath && !(await fileExists(previousSavePath))) {
    throw new Error(`--resume-save file not found: ${previousSavePath}`);
  }

  console.log(`\n=== Autorun series: ${options.scenario} ===`);
  if (previousSavePath) {
    console.log(`Resuming from ${path.relative(process.cwd(), previousSavePath)}`);
  }
  console.log(`Max ${options.maxTurns} turns in ${options.blockSize}-turn blocks (up to ${totalBlocks} blocks).`);
  console.log(`Victory types: ${options.victoryTypes.join(', ')}`);
  console.log(`Per-block timeout: ${(options.timeoutMs / HOUR_MS).toFixed(1)}h`);
  console.log(`Output: ${path.relative(process.cwd(), seriesRoot)}\n`);

  for (let blockNumber = 1; blockNumber <= totalBlocks; blockNumber++) {
    const blockDir = path.join(seriesRoot, blockDirName(blockNumber));
    if (await fileExists(path.join(blockDir, 'latest-metadata.json'))) {
      throw new Error(
        `Refusing to overwrite existing block output at ${blockDir}. ` +
        `Remove ${path.relative(process.cwd(), seriesRoot)} (or pass a fresh --output) before re-running.`,
      );
    }
    await fs.mkdir(blockDir, { recursive: true });

    const args = [
      '--scenario', options.scenario,
      '--turns', String(options.blockSize),
      '--victory', options.victoryTypes.join(','),
      '--timeout-ms', String(options.timeoutMs),
      '--output', blockDir,
      '--port', String(options.port),
    ];
    if (previousSavePath) args.push('--save', previousSavePath);

    console.log(`\n----- Block ${blockNumber}/${totalBlocks} -----`);
    console.log(previousSavePath ? `Continuing from ${path.relative(process.cwd(), previousSavePath)}` : 'Starting a fresh game');

    const consoleLogPath = path.join(blockDir, 'run-console.log');
    // Give the child a little headroom over the internal autoplay timeout so the
    // internal timeout fires first (and writes artifacts) rather than the watchdog.
    const { exitCode, timedOut } = await runAutorunBlock(args, consoleLogPath, options.timeoutMs + 10 * 60 * 1000);

    const { metadata, save } = await loadBlockArtifacts(blockDir);
    const block: BlockResult = { blockNumber, dir: blockDir, metadata, save, exitCode };

    // Failure detection: non-zero exit, watchdog kill, missing metadata, or the
    // autorun itself reporting failure. Any of these stops the series.
    const failed =
      timedOut ||
      exitCode !== 0 ||
      metadata === null ||
      metadata.success === false;

    if (failed) {
      block.error = timedOut
        ? `Block ${blockNumber} exceeded the ${(options.timeoutMs / HOUR_MS).toFixed(1)}h watchdog and was killed.`
        : exitCode !== 0
          ? `Block ${blockNumber} autorun exited with code ${exitCode}.`
          : metadata === null
            ? `Block ${blockNumber} produced no metadata file.`
            : `Block ${blockNumber} autorun reported success=false${metadata.error ? `: ${metadata.error}` : ''}.`;
      blocks.push(block);
      endReason = 'failure';
      console.error(`\n❌ ${block.error}`);
      console.error('Stopping the series. Preserving all available block output; not restarting.');
      break;
    }

    // Preserve a checkpoint copy named by the actual final turn.
    const finalTurn = metadata.finalTurn;
    const checkpointName = checkpointFileName(finalTurn, blockNumber);
    const checkpointPath = path.join(seriesRoot, checkpointName);
    if (save && await fileExists(path.join(blockDir, 'latest-save.json'))) {
      await fs.copyFile(path.join(blockDir, 'latest-save.json'), checkpointPath);
      block.checkpointFile = checkpointName;
    }
    blocks.push(block);

    const victory = metadata.victoryDetected;
    console.log(
      `✔ Block ${blockNumber} done: turns ${metadata.startingTurn}→${metadata.finalTurn}, ` +
      `${metadata.stateSummary?.cityCount ?? '?'} cities, ${metadata.stateSummary?.unitCount ?? '?'} units. ` +
      `Checkpoint: ${checkpointName}`,
    );

    if (victory) {
      endReason = 'victory';
      console.log(
        `\n🏆 Victory detected: ${metadata.victoryNationName ?? metadata.victoryNationId} won by ` +
        `${metadata.victoryType} on turn ${metadata.victoryRound}. Ending series.`,
      );
      break;
    }

    if (finalTurn != null && metadata.startingTurn != null) {
      const turnsFromStart = finalTurn - (blocks[0].metadata?.startingTurn ?? metadata.startingTurn);
      if (turnsFromStart >= options.maxTurns) {
        endReason = 'max-turns';
        console.log(`\nReached the ${options.maxTurns}-turn maximum. Ending series.`);
        break;
      }
    }

    previousSavePath = path.join(blockDir, 'latest-save.json');
  }

  await generateReports(options, seriesRoot, blocks, Date.now() - startedAt, endReason);

  if (endReason === 'failure') {
    process.exitCode = 1;
  }
}

/** Rebuild the report from whatever block dirs already exist on disk. */
async function reportOnly(options: SeriesOptions): Promise<void> {
  const seriesRoot = path.resolve(process.cwd(), options.outputDir);
  const entries = await fs.readdir(seriesRoot).catch(() => [] as string[]);
  const blockNames = entries.filter((name) => /^block-\d{3}$/.test(name)).sort();
  if (blockNames.length === 0) throw new Error(`No block directories found under ${seriesRoot}.`);

  const blocks: BlockResult[] = [];
  for (const name of blockNames) {
    const blockDir = path.join(seriesRoot, name);
    const blockNumber = Number.parseInt(name.slice('block-'.length), 10);
    const { metadata, save } = await loadBlockArtifacts(blockDir);
    const checkpointName = checkpointFileName(metadata?.finalTurn, blockNumber);
    const checkpointFile = await fileExists(path.join(seriesRoot, checkpointName)) ? checkpointName : undefined;
    const error = metadata === null
      ? `Block ${blockNumber} produced no metadata file.`
      : metadata.success === false
        ? `Block ${blockNumber} reported success=false${metadata.error ? `: ${metadata.error}` : ''}.`
        : undefined;
    blocks.push({ blockNumber, dir: blockDir, metadata, save, exitCode: 0, error, checkpointFile });
  }

  const endReason: SeriesRunContext['endReason'] = blocks.some((b) => b.error)
    ? 'failure'
    : blocks.some((b) => b.metadata?.victoryDetected)
      ? 'victory'
      : 'max-turns';
  const totalDuration = blocks.reduce((sum, b) => sum + (b.metadata?.durationMs ?? 0), 0);
  await generateReports(options, seriesRoot, blocks, totalDuration, endReason);
}

async function generateReports(
  options: SeriesOptions,
  seriesRoot: string,
  blocks: BlockResult[],
  totalDurationMs: number,
  endReason: SeriesRunContext['endReason'],
): Promise<void> {
  const ctx: SeriesRunContext = {
    scenario: options.scenario,
    maxTurns: options.maxTurns,
    blockSize: options.blockSize,
    enabledVictoryConditions: options.victoryTypes,
    blocks,
    totalDurationMs,
    endReason,
    generatedAt: new Date().toISOString(),
  };
  const model = buildSeriesReportModel(ctx);
  const names = finalNameLookup(model);
  const markdown = renderSeriesReportMarkdown(model, names);

  const jsonPath = path.join(seriesRoot, 'series-report.json');
  const mdPath = path.join(seriesRoot, 'series-report.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');

  console.log(`\nWrote report:\n- ${path.relative(process.cwd(), mdPath)}\n- ${path.relative(process.cwd(), jsonPath)}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.reportOnly) {
    await reportOnly(options);
    return;
  }
  await runSeries(options);
}

// Only run when invoked directly (not when imported by a test).
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
