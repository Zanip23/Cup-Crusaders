// Echter Browser-Durchlauf des M1-Loops mit Headless-Chromium.
// Klickt zwei volle Wellen durch (inkl. zweitem Shop-Besuch) und screenshottet
// jede Phase. Sammelt Konsolenfehler/Exceptions als Pass/Fail-Signal.

// Voraussetzung: ein laufender Dev-/Preview-Server (Standard: localhost:5173).
//   Terminal 1:  npm run dev
//   Terminal 2:  npm run clickthrough
// Eigener Server/Port via Env: URL=http://localhost:4173/ npm run clickthrough
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { mkdirSync } from 'node:fs';

const PORT = process.env.PORT ?? '5173';
const URL = process.env.URL ?? `http://localhost:${PORT}/`;
const OUT = process.env.OUT ?? '/tmp/shots';
const W = 720;
const H = 1280;

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--hide-scrollbars',
    `--window-size=${W},${H}`,
  ],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await sleep(1200); // Boot (500ms) → Combat

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
};
const tap = async (x, y) => {
  await page.mouse.click(x, y);
  await sleep(700);
};

// Button-Mittelpunkte (720×1280, FIT scale = 1 → Seitenkoordinaten = Spielkoordinaten)
const COMBAT_WIN = [360, 1280 - 220];
const DROP_RELEASE = [360, 1280 - 180];
const SHOP_CARD = [360, 1280 * 0.45];
const SHOP_NEXT = [360, 1280 - 150];

await shot('01-combat-wave1');
await tap(...COMBAT_WIN);
await shot('02-drop-wave1');
await tap(...DROP_RELEASE);
await shot('03-shop-wave1');
await tap(...SHOP_CARD); // ein Kauf
await shot('04-shop-wave1-after-buy');
await tap(...SHOP_NEXT);
await shot('05-combat-wave2');

// Zweite Welle — exerziert den ShopScene-Reuse-Pfad (Fund 1).
await tap(...COMBAT_WIN);
await shot('06-drop-wave2');
await tap(...DROP_RELEASE);
await shot('07-shop-wave2');

await browser.close();

if (errors.length) {
  console.log(`\n❌ ${errors.length} Browser-Fehler:`);
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
} else {
  console.log(`\n✅ Kompletter Loop durchgeklickt, keine Browser-Fehler. Screenshots: ${OUT}`);
}
