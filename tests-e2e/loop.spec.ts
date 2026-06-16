import { test, expect, type Page } from '@playwright/test';

// End-to-End: klickt den leeren M1-Loop im echten Browser durch und prüft jede
// Phase per Screenshot + Fehler-Sammlung. Dieser Test hätte den Szenen-Stacking-
// Bug sofort gefangen (Phase wechselte nicht trotz steigendem Wellenzähler).

// 720×1280, FIT-Scale 1 → diese Seitenkoordinaten = Spielkoordinaten.
const COMBAT_WIN = { x: 360, y: 1280 - 220 };
const DROP_RELEASE = { x: 360, y: 1280 - 180 };
const SHOP_CARD = { x: 360, y: Math.round(1280 * 0.45) };
const SHOP_NEXT = { x: 360, y: 1280 - 150 };

async function tap(page: Page, p: { x: number; y: number }) {
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(600);
}

test('voller Loop über zwei Wellen ohne Fehler, mit Screenshots', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto('/');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1200); // Boot (500ms) → Combat

  const shot = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });

  await shot('01-combat-wave1');
  await tap(page, COMBAT_WIN);
  await shot('02-drop-wave1');
  await tap(page, DROP_RELEASE);
  await shot('03-shop-wave1');
  await tap(page, SHOP_CARD); // ein Kauf
  await shot('04-shop-wave1-after-buy');
  await tap(page, SHOP_NEXT);
  await shot('05-combat-wave2');

  // Zweite Welle — exerziert den ShopScene-Reuse-Pfad.
  await tap(page, COMBAT_WIN);
  await shot('06-drop-wave2');
  await tap(page, DROP_RELEASE);
  await shot('07-shop-wave2');

  expect(errors, `Browser-Fehler:\n${errors.join('\n')}`).toEqual([]);
});
