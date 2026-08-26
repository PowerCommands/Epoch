/**
 * Visual verification for the city banner (city badge).
 *
 * Boots a production preview build, starts a new game, runs a few autoplay
 * turns so at least one city is founded, centres the camera on that city and
 * screenshots it. Used to confirm the badge renders correctly (e.g. the 50%
 * transparency change did not make the whole banner disappear).
 *
 * Usage: tsx scripts/visualCityBanner.ts [--scenario map_europe] [--turns 8]
 */
import { chromium, type Browser, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PORT = 4100 + (process.pid % 800);
const OUT_DIR = path.resolve(process.cwd(), 'autorun-output', 'visual');
const SYSTEM_BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function findBrowser(): Promise<string | undefined> {
  for (const candidate of SYSTEM_BROWSER_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const scenario = arg('scenario', 'map_europe');
  const turns = Number(arg('turns', '8'));
  await fs.mkdir(OUT_DIR, { recursive: true });

  if (!process.argv.includes('--skip-build')) {
    await run('npm', ['run', 'build']);
  }

  const server: ChildProcessWithoutNullStreams = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: 'inherit', shell: false },
  );

  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    const executablePath = await findBrowser();
    browser = await chromium.launch({ headless: true, executablePath });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => console.warn('[pageerror]', e.message));

    // Wait for the preview server, then boot diagnostics.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        await page.goto(`http://127.0.0.1:${PORT}/?epochDiagnostics=1`, { timeout: 3000 });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    await page.waitForFunction(() => typeof window.__epochDiagnostics?.startNewGame === 'function', undefined, { timeout: 60000 });
    const start = await page.evaluate((s) => window.__epochDiagnostics!.startNewGame({ scenario: s }), scenario);
    if (!start || start.ok !== true) throw new Error(`startNewGame failed: ${JSON.stringify(start)}`);

    await page.waitForFunction(() => typeof window.__epochDiagnostics?.startAutoplay === 'function', undefined, { timeout: 60000 });
    await page.evaluate((t) => window.__epochDiagnostics!.startAutoplay(t), turns);

    // Give the render loop a beat, then focus the first city and screenshot.
    await page.waitForFunction(
      () => typeof window.__epochDiagnostics?.focusFirstCity === 'function',
      undefined,
      { timeout: 60000 },
    );
    const summary = await page.evaluate(() => window.__epochDiagnostics!.getStateSummary());

    // Dismiss the HTML "Autoplay completed" dialog (a real <button>).
    await page.evaluate(() => {
      for (const b of Array.from(document.querySelectorAll('button'))) {
        if (b.textContent?.trim() === 'Close') b.click();
      }
    });
    await new Promise((r) => setTimeout(r, 500));

    // The "Getting Started" guide wizard is Phaser canvas-rendered, so it can
    // only be dismissed by clicking the canvas at its Close button position
    // (viewport is a fixed 1280x800, so the wizard is centred deterministically).
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.click(699, 452);
      await new Promise((r) => setTimeout(r, 400));
    }

    const focus = await page.evaluate(() => window.__epochDiagnostics!.focusFirstCity(2.2));
    console.log('cities founded:', summary.cityCount, 'focus:', JSON.stringify(focus));
    await new Promise((r) => setTimeout(r, 1000));

    const outPath = path.join(OUT_DIR, 'city-banner.png');
    await page.screenshot({ path: outPath });
    console.log('screenshot:', outPath, '| cityCount:', summary.cityCount);
    if (!focus.ok) throw new Error('No city was founded to screenshot');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
