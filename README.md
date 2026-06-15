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

🟢 **M1 – Projekt-Skelett & leerer Loop (in Arbeit).** Das Vite + TS + Phaser-3-Setup
steht, der 3-Phasen-Loop ist „leer" durchklickbar und der `transfer`-Kanal
(Kampf → Drop → Shop) trägt die Ballzahl korrekt durch alle Phasen. Gameplay-Tiefe
(M2–M4) folgt darauf, siehe [Roadmap](docs/11-roadmap-and-mvp.md).

---

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server (Vite, HMR) → http://localhost:5173
npm run build    # Typecheck + Production-Build nach dist/
npm test         # Vitest (reine Logik: Reducer, Rng)
npm run lint     # ESLint
```

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
