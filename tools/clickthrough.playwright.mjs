// Echter Browser-Durchlauf des M1-Loops mit Playwright (Library-API) — als
// schlichter, self-contained Node-Prozess. Praktisch in eingeschränkten Sandboxes,
// wo der Playwright-Test-Runner (Worker-Forks) bzw. Hintergrund-Dev-Server stören.
//
// Server: nutzt einen vorhandenen (URL gesetzt) oder liefert das gebaute dist/
// über einen winzigen statischen HTTP-Server im selben Prozess aus → vorher
// `npm run build`. Browser: CHROME_BIN bevorzugt, sonst der von
// @sparticuz/chromium gebündelte Binary (aus der npm-Registry, kein CDN nötig).
//
//   npm run build && node tools/clickthrough.playwright.mjs
//   # oder gegen einen laufenden Server:
//   URL=http://localhost:5173/ CHROME_BIN=/pfad/zu/chrome node tools/clickthrough.playwright.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.OUT ?? '/tmp/shots-pw';
const W = 720;
const H = 1280;

// Statischer Server für das gebaute dist/ (keine Worker-Subprozesse).
async function startStaticServer(port) {
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { extname, join, normalize } = await import('node:path');
  const root = join(process.cwd(), 'dist');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
  };
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (p === '/' || p.endsWith('/')) p += 'index.html';
      const body = await readFile(join(root, normalize(p)));
      res.writeHead(200, { 'content-type': mime[extname(p)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(await readFile(join(root, 'index.html')).catch(() => 'not found'));
    }
  });
  await new Promise((r) => server.listen(port, r));
  return server;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let server = null;
  let url = process.env.URL;
  if (!url) {
    server = await startStaticServer(5173);
    url = 'http://localhost:5173/';
    console.log('🟢 Statischer dist/-Server: ' + url);
  }

  let executablePath = process.env.CHROME_BIN;
  if (!executablePath) {
    const sp = (await import('@sparticuz/chromium')).default;
    executablePath = await sp.executablePath();
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    // --single-process/--no-zygote verhindern lingernde Helfer-Prozesse.
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--single-process',
      '--use-gl=swiftshader',
    ],
  });

  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');

    const shot = async (name) => {
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`📸 ${name}`);
    };
    const tap = async ([x, y]) => {
      await page.mouse.click(x, y);
      await page.waitForTimeout(650);
    };
    // Auf eine Run-Phase warten (Kampf ist Auto-Battle ohne Klicks).
    const waitPhase = async (phase, timeout = 90000) => {
      await page.waitForFunction((p) => window.__cc?.getPhase() === p, phase, {
        timeout,
        polling: 250,
      });
    };

    const DROP_RELEASE = [360, H - 90]; // „Ausschütten"-Button (Canvas)
    // Shop ist ein DOM-Overlay → Klick per data-testid (robuster als Koordinaten).
    const buyAll = async () => {
      for (let i = 0; i < 3; i++) await page.click(`[data-testid="shop-card-${i}"]`).catch(() => {});
    };

    // Welle 1
    await waitPhase('combat');
    await page.waitForTimeout(1500);
    await shot('01-combat-wave1');
    await waitPhase('drop'); // Auto-Battle läuft durch
    await shot('02-drop-wave1');
    await tap(DROP_RELEASE);
    await waitPhase('shop');
    await shot('03-shop-wave1');
    await buyAll();
    await shot('04-shop-wave1-after-buy');
    await page.click('[data-testid="shop-next"]');

    // Welle 2
    await waitPhase('combat');
    await page.waitForTimeout(1500);
    await shot('05-combat-wave2');
    await waitPhase('drop');
    await shot('06-drop-wave2');
    await tap(DROP_RELEASE);
    await waitPhase('shop');
    await shot('07-shop-wave2');

    // Ergebnis VOR dem Teardown schreiben — in manchen Sandboxes wird der
    // Prozess beim browser.close() gekillt, nachdem die Screenshots bereits da sind.
    const ok = errors.length === 0;
    writeFileSync(`${OUT}/result.txt`, (ok ? 'PASS' : `FAIL\n${errors.join('\n')}`) + '\n');
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
  }
  return errors;
}

// Ergebnis zusätzlich in eine Datei schreiben (robuste Verifikation, auch wenn
// die Konsole in einer Sandbox verschluckt wird).
try {
  const errors = await main();
  const ok = errors.length === 0;
  writeFileSync(
    `${OUT}/result.txt`,
    (ok ? 'PASS' : `FAIL\n${errors.join('\n')}`) + '\n',
  );
  console.log(
    ok
      ? `\n✅ Playwright: kompletter Loop durchgeklickt, keine Browser-Fehler. → ${OUT}`
      : `\n❌ ${errors.length} Browser-Fehler (siehe ${OUT}/result.txt)`,
  );
  process.exit(ok ? 0 : 1);
} catch (e) {
  writeFileSync(`${OUT}/result.txt`, `ERROR\n${e.stack || e.message}\n`);
  console.error('❌ Lauf fehlgeschlagen:', e.message);
  process.exit(1);
}
