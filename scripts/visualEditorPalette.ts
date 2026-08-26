/**
 * Visual check for the editor terrain/resource palette button text colour.
 * Boots the vite dev server (serves public/editor.html live), screenshots the
 * toolbar in both Terrain and Resource paint modes.
 */
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PORT = 5200 + (process.pid % 300);
const OUT_DIR = path.resolve(process.cwd(), 'autorun-output', 'visual');
const CANDIDATES = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

async function findBrowser(): Promise<string | undefined> {
  for (const c of CANDIDATES) { try { await fs.access(c); return c; } catch { /* next */ } }
  return undefined;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  // Serve public/ with a plain static server (no vite file-watching, which trips
  // the OS watcher limit on this repo, and no build step needed): editor.html
  // and all required manifests already live under public/.
  const server: ChildProcessWithoutNullStreams = spawn(
    'python3', ['-m', 'http.server', String(PORT), '--directory', 'public'],
    { stdio: 'inherit', shell: false },
  );
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, executablePath: await findBrowser() });
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    for (let i = 0; i < 40; i += 1) {
      try { await page.goto(`http://127.0.0.1:${PORT}/editor.html`, { timeout: 3000 }); break; }
      catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    // The editor opens on a landing page; create a fresh blank scenario (no
    // scenario fetch needed) so the palette builds.
    await page.waitForSelector('#landing-create-btn', { timeout: 60000 });
    await page.waitForTimeout(1800); // let init() finish wiring landing handlers
    await page.click('#landing-create-btn');
    await page.waitForSelector('#landing-create', { state: 'visible', timeout: 10000 });
    await page.fill('#create-name-input', 'Palette Check');
    await page.click('#create-size-grid [data-size="small"]');
    await page.locator('#landing-create input[type="checkbox"]').first().check();
    await page.click('#create-submit-btn');
    await page.waitForTimeout(2500);
    // The palette panel only shows in the Paint tool; make sure it is active.
    await page.click('.tool-btn[data-tool="paint"]').catch(() => undefined);
    await page.waitForTimeout(1000);
    const debug = await page.evaluate(() => {
      const section = document.getElementById('palette-section');
      const grid = document.getElementById('palette');
      return {
        sectionDisplay: section ? getComputedStyle(section).display : 'no-section',
        btnCount: grid ? grid.querySelectorAll('.palette-btn').length : -1,
        landingVisible: getComputedStyle(document.getElementById('editor-landing')!).display,
      };
    });
    console.log('debug state:', JSON.stringify(debug));
    if (debug.btnCount <= 0) {
      await page.screenshot({ path: path.join(OUT_DIR, 'editor-debug.png') });
      throw new Error(`palette not built: ${JSON.stringify(debug)}`);
    }
    await new Promise((r) => setTimeout(r, 300));
    const palette = page.locator('#palette-section');
    await palette.scrollIntoViewIfNeeded();
    await palette.screenshot({ path: path.join(OUT_DIR, 'editor-terrain-palette.png') });

    await page.click('#resource-paint-mode-btn');
    await page.waitForTimeout(400);
    await palette.scrollIntoViewIfNeeded();
    await palette.screenshot({ path: path.join(OUT_DIR, 'editor-resource-palette.png') });
    console.log('screenshots written to', OUT_DIR);
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
