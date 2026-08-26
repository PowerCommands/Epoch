/**
 * Functional check: new cities created in the editor draw their names from the
 * selected nation's city-name pool (city-names-manifest.json), not a numbered
 * default. Serves public/ statically, creates a blank scenario, adds several
 * cities via the editor's own addCityAt(), and prints the resulting names.
 */
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PORT = 5600 + (process.pid % 300);
const OUT_DIR = path.resolve(process.cwd(), 'autorun-output', 'visual');
const CANDIDATES = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

async function findBrowser(): Promise<string | undefined> {
  for (const c of CANDIDATES) { try { await fs.access(c); return c; } catch { /* next */ } }
  return undefined;
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
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
    await page.waitForSelector('#landing-create-btn', { timeout: 60000 });
    await page.waitForTimeout(1800);
    await page.click('#landing-create-btn');
    await page.waitForSelector('#landing-create', { state: 'visible', timeout: 10000 });
    await page.fill('#create-name-input', 'City Name Check');
    await page.click('#create-size-grid [data-size="small"]');
    // Pick England specifically so we can assert against a known pool.
    const englishBox = page.locator('#landing-create input[type="checkbox"][value="nation_england"]');
    await englishBox.check().catch(async () => {
      await page.locator('#landing-create input[type="checkbox"]').first().check();
    });
    await page.click('#create-submit-btn');
    await page.waitForSelector('#palette .palette-btn', { state: 'attached', timeout: 60000 });

    // Add five cities via the editor's own logic (addCityAt is a global function
    // on window; the first nation is auto-selected after the scenario is created).
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        getSelectedNation: () => { id: string; name: string } | null;
        addCityAt: (q: number, r: number) => void;
      };
      const coords: Array<[number, number]> = [[5, 5], [8, 6], [12, 8], [16, 10], [20, 12]];
      for (const [q, r] of coords) w.addCityAt(q, r);
      const rows = Array.from(document.querySelectorAll('#city-list .entity-row span:nth-child(2)'));
      return {
        nation: w.getSelectedNation(),
        names: rows.map((el) => (el.textContent || '').trim()),
      };
    });
    console.log('nation:', JSON.stringify(result.nation));
    console.log('city names:', JSON.stringify(result.names));

    await page.screenshot({ path: path.join(OUT_DIR, 'editor-city-names.png') });
    console.log('screenshot written');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
