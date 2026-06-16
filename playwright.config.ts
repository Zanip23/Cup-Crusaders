import { defineConfig, devices } from '@playwright/test';

// Playwright-E2E-Konfiguration für Cup Crusaders.
//
// Hinweis zum Browser: Playwrights eigene (gepatchte) Chromium-Builds liegen
// nur auf cdn.playwright.dev / azureedge — diese Hosts sind in der CI-/Web-
// Umgebung per Egress-Policy blockiert. Stattdessen nutzen wir ein offizielles
// "Chrome for Testing" (von storage.googleapis.com, erlaubt) via executablePath.
// Pfad über CHROME_BIN setzen; siehe README → "E2E (Playwright)".
const executablePath = process.env.CHROME_BIN || undefined;

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    // Interne Referenzauflösung 720×1280 → FIT-Scale 1, Seiten- = Spielkoordinaten.
    viewport: { width: 720, height: 1280 },
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Dev-Server: lokal via `npm run dev` separat starten und mit
  // PW_NO_SERVER=1 hier deaktivieren (siehe README), sonst startet Playwright
  // ihn selbst. In der Sandbox-Umgebung wird er extern gestartet.
  ...(process.env.PW_NO_SERVER
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
