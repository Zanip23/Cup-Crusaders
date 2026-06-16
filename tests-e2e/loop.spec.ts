import { test, expect, type Page } from '@playwright/test';

// End-to-End: spielt zwei Wellen des Loops durch und prüft jede Phase per
// Screenshot + Fehler-Sammlung. Der Kampf ist Auto-Battle (ADR-005) — die Phasen
// werden über den read-only Debug-Hook window.__cc abgewartet, nicht geklickt.

const H = 1280;
const DROP_RELEASE = { x: 360, y: H - 180 };
const SHOP_CARD = { x: 360, y: Math.round(H * 0.45) };
const SHOP_NEXT = { x: 360, y: H - 150 };

async function tap(page: Page, p: { x: number; y: number }) {
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(650);
}

async function waitPhase(page: Page, phase: string, timeout = 90_000) {
  await page.waitForFunction(
    (p) => (window as unknown as { __cc?: { getPhase: () => string } }).__cc?.getPhase() === p,
    phase,
    { timeout, polling: 250 },
  );
}

test('zwei Wellen Auto-Battle → Drop → Shop, ohne Browser-Fehler', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto('/');
  await page.waitForSelector('canvas');

  const shot = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });

  await waitPhase(page, 'combat');
  await page.waitForTimeout(1500);
  await shot('01-combat-wave1');
  await waitPhase(page, 'drop');
  await shot('02-drop-wave1');
  await tap(page, DROP_RELEASE);
  await waitPhase(page, 'shop');
  await shot('03-shop-wave1');
  await tap(page, SHOP_CARD);
  await shot('04-shop-wave1-after-buy');
  await tap(page, SHOP_NEXT);

  await waitPhase(page, 'combat');
  await page.waitForTimeout(1500);
  await shot('05-combat-wave2');
  await waitPhase(page, 'drop');
  await shot('06-drop-wave2');
  await tap(page, DROP_RELEASE);
  await waitPhase(page, 'shop');
  await shot('07-shop-wave2');

  expect(errors, `Browser-Fehler:\n${errors.join('\n')}`).toEqual([]);
});
