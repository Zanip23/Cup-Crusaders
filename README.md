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
| — | [Decision Log](docs/decisions.md) | Verbindliche Designentscheidungen (ADR-001…012) |
| — | [Glossar](docs/glossary.md) | Einheitliche Begriffe |

---

## Status

🟡 **Phase 0 – Planung & Dokumentation.** Noch kein Spielcode. Implementierung
beginnt nach Freigabe des Architekturplans (siehe Roadmap, Milestone M1).
