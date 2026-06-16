# Cup Crusaders

Ein webbasiertes 2D-Pixel-Art-Mobile-Game im **Hochformat (Portrait)**. Es kombiniert
einen **Auto-Battler** mit einem **Pachinko-Physik-Minispiel** und einer
**Roguelite-Shop-Phase**. Inspiriert von *Cup Heroes*.

> **Designprinzip:** Kein Pay-to-Win, keine Werbung. Fairer Roguelite-Loop mit
> tiefer, datengetriebener Progression.

---

## Der Core Loop

```
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │  KAMPF        │ ───► │  DROP         │ ───► │  SHOP         │ ──┐
   │ (Auto-Battler)│ Bälle│ (Pachinko)    │Bälle │ (Upgrades)    │   │
   └──────────────┘      └──────────────┘      └──────────────┘   │
          ▲                                                        │
          └──────────  nächste, schwerere Welle  ◄─────────────────┘
```

Die verbindende Ressource sind **Bälle**: Loot im Kampf → Munition im Drop →
Währung im Shop.

---

## Dokumentation

Dies ist aktuell ein **Planungs-Repository**. Die Dokumentation ist die primäre
Deliverable. Lies in dieser Reihenfolge:

| # | Dokument | Inhalt |
|---|----------|--------|
| 00 | [Vision & Core Loop](docs/00-vision-and-core-loop.md) | Pillars, Zielgruppe, Loop im Detail |
| 01 | [Tech-Stack](docs/01-tech-stack.md) | Phaser 3, Matter.js, TypeScript, Vite — mit Begründung |
| 02 | [Architektur](docs/02-architecture.md) | Szenen, EventBus, GameStateManager, Projektstruktur |
| 03 | [Portrait-Layout & UX](docs/03-portrait-layout-and-ux.md) | Screen-Regionen, Active Ability Deck, Responsiveness |
| 04 | [Kampf-Phase](docs/04-combat-phase.md) | Auto-Attack, Wellen, Ball-Drops, Boss |
| 05 | [Drop-Phase](docs/05-drop-phase.md) | Pegs, Tore, Bins, Near-Miss-Design |
| 06 | [Shop-Phase](docs/06-shop-phase.md) | Karten, Pool, Kosten-Skalierung |
| 07 | [Meta-Progression & Ausrüstung](docs/07-meta-progression-and-equipment.md) | Slots, Rarity, Merge, Item-Level |
| 08 | [Daten-Schemas](docs/08-data-schemas.md) | **Kern:** Stat/Modifier-System, Effekt-Komponenten, alle Content-Schemas |
| 09 | [Game State](docs/09-game-state.md) | State-Form, Persistenz, Save-Versionierung |
| 10 | [Content-Pipeline & Balancing](docs/10-content-pipeline-and-balancing.md) | Wie man hunderte Items/Gegner pflegt |
| 11 | [Roadmap & MVP](docs/11-roadmap-and-mvp.md) | Vertical Slice, Milestones |
| 12 | [Content-Bibliothek](docs/12-content-library.md) | Referenz-Seed: Gegner, Bosse, Sets, Blessings, Welten |
| 13 | [KPIs & Analytics](docs/13-kpis-and-analytics.md) | Qualitäts-/Fairness-Ziele, lokale Analytics-Events (opt-in) |
| — | [Decision Log](docs/decisions.md) | Verbindliche Designentscheidungen (ADR-001…014) |
| — | [Glossar](docs/glossary.md) | Einheitliche Begriffe |

---

## Status

🟢 **M2 – Kampf-Phase (Vertical Slice).** Auf dem leeren M1-Loop steht jetzt echtes,
rundenbasiertes Auto-Battle (ADR-005): `StatEngine` (inkl. Caps), `EffectSystem`
(addModifier/onHit/onKill), `CombatSystem` (testbar), `WaveSpawner` mit Skalierung,
Held „Fletcher" + Gegner + Boss, 15-Wellen-Default, HP-Balken, Hit-Flash, Floating
Combat Text und Ball-Drops (Tod + Treffer-Chance) mit Tween in die Cup-UI →
`transfer.ballsFromCombat`. Drop/Shop bleiben vorerst Platzhalter (M3/M4).

Davor: **M1** — Vite + TS + Phaser-3-Setup, der „leere" 3-Phasen-Loop und der
`transfer`-Kanal (Kampf → Drop → Shop). Siehe [Roadmap](docs/11-roadmap-and-mvp.md).

---

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server (Vite, HMR) → http://localhost:5173
npm run build    # Typecheck + Production-Build nach dist/
npm test         # Vitest (reine Logik: Reducer, Rng, Loop-Integration)
npm run lint     # ESLint
npm run e2e      # Playwright-E2E (echter Browser, klickt den Loop durch)
```

### E2E / visueller Smoke-Test (Playwright)

`tests-e2e/loop.spec.ts` klickt den kompletten Loop im echten Browser durch
(zwei Wellen inkl. zweitem Shop-Besuch) und sammelt Konsolenfehler als Pass/Fail
— so wurden u. a. der Szenen-Stacking- und der ShopScene-Reset-Bug gefunden.

```bash
# Standard (lokal / CI): startet den Dev-Server selbst via webServer-Config
CHROME_BIN=/pfad/zu/chrome npm run e2e
```

**Browser-Binary:** Playwrights eigene (gepatchte) Chromium-Builds liegen nur auf
`cdn.playwright.dev` / `azureedge` — diese Hosts sind in der CI-/Web-Umgebung per
Egress-Policy blockiert, `npx playwright install` schlägt dort fehl. Daher nutzen
wir ein beliebiges Chromium via `CHROME_BIN`:

- **Chrome for Testing** (von `storage.googleapis.com`, erlaubt):
  `chrome-linux64.zip` aus `https://storage.googleapis.com/chrome-for-testing-public/<version>/linux64/`
  entpacken und `CHROME_BIN` auf das `chrome`-Binary setzen.
- **Fallback ohne Download-Host:** `@sparticuz/chromium` liefert einen Chromium-
  Binary direkt im npm-Paket. Der Standalone-Runner unten nutzt ihn automatisch,
  wenn `CHROME_BIN` nicht gesetzt ist.

**Sandbox-tauglicher Standalone-Runner** (ein einzelner Node-Prozess, serviert das
gebaute `dist/` selbst — robust, wo der Playwright-Test-Runner Worker forkt oder
Hintergrund-Server gekillt werden):

```bash
npm run build
npm run clickthrough          # Screenshots + result.txt → /tmp/shots-pw (OUT=… überschreibbar)
```

> Auf manchen Distributionen werden zusätzlich System-Libs (z. B. `libnss3`) benötigt.

### Was in M1 steht

- **Setup:** Vite, TypeScript (strict), Phaser 3, Portrait-Config (720×1280), Pixel-Art-Flags.
- **PWA:** Web App Manifest + Service Worker (App-Shell-Cache, offline-first).
- **`core/`:** `GameStateManager` (Scopes/Reducer/Actions/Selectors), typisierter
  `EventBus`, `SaveRepository` (IndexedDB, async, mit Migrations-Gerüst), seedbarer `Rng`.
- **`RunCoordinator`:** verdrahtet die Phasenübergänge event-getrieben (Szenen kennen
  die nächste Szene nicht).
- **Szenen:** `Boot → Combat → Drop → Shop → Combat` als Loop mit Platzhalter-UI.
- **Resume after reload:** Der laufende Run wird (debounced) persistiert und beim
  Neustart an der korrekten Phase fortgesetzt.
- **Tests:** transfer-Vertrag (Reducer) und Rng-Determinismus.

> Ordnerstruktur und Verträge folgen [docs/02 – Architektur](docs/02-architecture.md)
> und [docs/09 – Game State](docs/09-game-state.md).
