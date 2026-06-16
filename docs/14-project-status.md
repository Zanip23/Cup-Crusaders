# 14 – Projektstand & offene Punkte

> **Stand:** 2026-06-16 · **Branch:** `claude/jolly-ritchie-dv38c4` · **PR #3**
> Lebendes Dokument — bei jedem Milestone aktualisieren.

## Überblick

Aus dem reinen Planungs-Repo (M0) ist ein **spielbarer Vertical Slice mit
Meta-Progression und Content-Breite** geworden. Der vollständige Loop läuft im
Browser: **Hauptmenü → Kampf → Drop → Shop → (nächste Welle/Welt) → Run-Ende → Menü**.

| Kennzahl | Wert |
|---|---|
| Quellmodule (`src/**/*.ts`) | 46 Dateien, ~3.790 LOC |
| Tests (Vitest) | 11 Dateien, **80 Tests**, grün |
| Gates | `typecheck` · `lint` · `build` sauber |
| E2E | Playwright-Harness (`tools/clickthrough.playwright.mjs`) + `tests-e2e/loop.spec.ts` |
| Tech-Stack | Vite · TypeScript (strict) · Phaser 3 · Matter.js (nur Drop) · DOM-Overlays |

---

## Implementierungsstand pro Milestone (docs/11)

| Milestone | Status | Inhalt |
|---|---|---|
| **M0** Planung/Doku | ✅ | Vollständige Architektur-/Design-Doku |
| **M1** Skelett & leerer Loop | ✅ | Vite/TS/Phaser, PWA-Grundgerüst, `GameStateManager`/Reducer, typisierter `EventBus`, `SaveRepository` (IndexedDB), `Rng`, `RunCoordinator`, `transfer`-Kanal, Resume-after-reload |
| **M2** Kampf-Phase | ✅ | `StatEngine` (+Caps), `EffectSystem` (addModifier/onHit/onKill), rundenbasiertes `CombatSystem` (Crit/Lifesteal/ExtraAttack/Armor-DR/**Pierce/Ricochet/AttackSpeed**), `WaveSpawner`+Skalierung, HP-Balken/Hit-Flash/Floating-Text, Ball-Drops |
| **M3** Drop-Phase | ✅ | `DropScene` mit **Matter.js** (physik-autoritativ, ADR-009), Value-Carrying Balls, Tore/Bins, `DropResolver`, Becher (Drag+Tap+Buttons+**Tastatur**), Performance-Cap/Timeout |
| **M4** Shop-Phase | ✅ | **DOM-Overlay**, gewichteter seedbarer Pool, Kosten-Skalierung, mehrere Käufe (ADR-003), Upgrades wirken über `buildHeroStats` ab nächster Welle |
| **M5** Meta-Progression | ✅ | `MetaScene` (DOM): 6 Ausrüstungs-Slots, Inventar, **Merge** (3→1), **Item-Leveling**, **Meta-Skills**, Boss-Loot, IndexedDB-Persistenz des `meta`-Scopes |
| **M6** Content-Breite & Polish | 🟡 teilweise | ✅ `validateContent()` + CI-Test, Balancing-Leitplanken, **2 Welten/Gegner-Sets/2 Boards/Level-Progression**. ⏳ Active Ability Deck, Audio/Haptik, Settings, Lokalisierung, Performance-/PWA-Pass |

---

## Architektur-Überblick

```
src/
├── core/            State (GameStateManager/Reducer/Actions/Selectors), EventBus,
│                    RunCoordinator, StatEngine, EffectSystem, Rng, SaveRepository, registry
├── systems/         CombatSystem, WaveSpawner, DropResolver, ShopPool, meta/{items,merge,loot}, heroBuild
├── content/         enemies, heroes, items, upgrades, metaSkills, boards, waves/, levels, scaling, validate
├── scenes/          Boot, Meta, Combat, Drop, Shop (Phaser-Szenen = View + Timing)
├── ui/              TopBar, ShopOverlay, MetaOverlay (DOM), PlaceholderButton, layout, styles/
└── types/           state, content
```

Leitprinzipien (eingehalten): State lebt außerhalb der Szenen; reine/immutable
Reducer; eine StatEngine als Zahl-Wahrheit; datengetriebener Content; Core von
Phaser entkoppelt und in Node testbar.

---

## Offene Punkte

### A. Verbleibende M6-Features (geplant, docs/11)
- **A1 – Active Ability Deck** (docs/03): aktive Fähigkeiten mit Cooldowns/Targeting
  (Tap-to-Activate, Tap-Target). Layout-Zone ist reserviert, Logik fehlt. `AbilityDef`-
  Schema und `buff`-Scope der StatEngine sind vorbereitet, aber ungenutzt.
- **A2 – Audio & Haptik:** keine SFX/Musik/Vibration (Treffer, Ball-Sammeln,
  Peg-Bounce, Bin-Treffer, Kauf). Settings sehen Lautstärke/Haptik vor, ohne UI.
- **A3 – Settings-Menü:** `settings` (sfx/music/haptics/language) liegt im State und
  wird persistiert, ist aber **nicht editierbar** (kein UI).
- **A4 – Lokalisierung:** Texte sind hartkodiert (de). Kein i18n-Gerüst (de/en).
- **A5 – Performance-/PWA-Pass:** WebGL-Context-Loss nur geloggt (kein Recovery);
  Service Worker cached nur App-Shell (kein Asset-Precache, da keine Assets);
  keine INP/FPS-Messung (docs/13).

### B. Aufgeschobene Architektur-/Design-Entscheidungen
- **B1 – Shop/Meta als `scene.start` statt `scene.launch`-Overlay** (Abweichung von
  docs/02, dort dokumentiert): Vollflächen-DOM-Overlay ist funktional gleichwertig;
  echtes Parallel-Overlay ist optionale Politur.
- **B2 – MVP-Recovery:** Held wird je Welle voll geheilt (statt persistentem
  HP-Verschleiß). Bewusster Balancing-Hebel; alternative Modelle (Teilheilung,
  stärkeres Lifesteal/Shop-Heals) sind später zu evaluieren.

### C. Latente technische Punkte (kein aktueller Bug)
- **C1 – `prefers-reduced-motion` nur teilweise:** Camera-Shake im Kampf ist
  gated; Floating-Text/Tweens (Kampf/Drop) und Overlay-Transitions noch nicht.
- **C2 – Canvas-A11y:** DOM-Overlays (Shop/Meta) haben Focus-States; die
  Canvas-Buttons (Drop-Steuerung, TopBar) nicht. Drop ist immerhin **tastaturbedienbar**
  (←/→/Leer), aber ohne sichtbaren Fokusring. Vollständige A11y bräuchte DOM-Controls.
- **C3 – Ungenutzte Stats:** `Execute`, `Thorns`, `SummonPower`, `PegDensity`,
  `MagnetStrength`, `BallRestitution`, `GoldFind`, `BlueprintFind`, `Rerolls` sind in
  der Enum, aber ohne Wirkung/Content. Entweder implementieren oder als „reserviert"
  kennzeichnen.
- **C4 – `buff`-Scope/`pruneExpired`** der StatEngine sind implementiert, aber
  ungenutzt (erst mit Abilities/Statuseffekten relevant). Cache-Invalidierung ist
  zeitabhängig nur korrekt, wenn `pruneExpired` vor relevanten `get()` läuft.

### D. Balancing (empirisch, docs/10) — zu tunen
- **D1 – Boss-Erreichbarkeit:** Ein Run bis zum Boss dauert ~14 Wellen Auto-Battle
  (mehrere Minuten). Tempo/Wellenzahl ggf. justieren.
- **D2 – Drop-Ökonomie:** Board-Geometrie (Peg-Dichte, Bin-Breiten, Tor-Werte) ist
  nur grob gesetzt; Median-Multiplikator empirisch in den Zielkorridor (×2–×4) bringen.
- **D3 – Shop-Kosten/Skalierung & Reward-Gold** sind Platzhalter-nah; mit Telemetrie
  feinjustieren. Die Balancing-Leitplanken-Tests sichern nur grobe Schwellen ab.

### E. Content-Lücken vs. Referenz (docs/12)
- **Helden:** 1 von 8 (Fletcher); Signaturmechanik nicht implementiert.
- **Gegner:** 4 Normals + 1 Elite + 2 Bosse von ~13/4/5. Keine Statuseffekte
  (Burn/Freeze/Gift), keine Resistenzen, keine Boss-Phasen/Adds, keine
  Spezialverhalten (Split-Slime, Fuse-Imp-Explosion, Heiler, …).
- **Items:** 6 Basis-Items (1 je Slot), nur garantierte Affixe (kein
  `randomAffixPool`), **keine Gear-Sets/Set-Boni**.
- **Upgrades:** ~12 passive; **aktive** Blessings (Heilkrug/Schutzbanner/…) fehlen
  (hängen an A1 Abilities).
- **Loot:** vereinfachter Boss-Drop; keine `LootTableDef`-getriebenen Tabellen,
  keine regulären Run-Drops, keine Blueprints-Quelle außer Reducer-Stub.
- **Welten:** 2 von 5; 2 Kapitel (Referenz: 5×6 = 30).
- **Assets:** **keine** echten Sprites/Hintergründe/Audio — Platzhalter (farbige
  Rechtecke/Emoji). `public/assets/` ist leer.

### F. Persistenz/Robustheit
- **F1 – Save-Migration:** Pipeline + Shape-Guard vorhanden, aber bislang nur
  Version 1 (keine echten Migrationsschritte nötig).
- **F2 – Resume-after-reload:** für `combat/drop/shop` umgesetzt; mitten in einer
  laufenden Drop-/Kampfauflösung wird an den Phasenanfang zurückgesetzt (kein
  Frame-genaues Resume — bewusst, docs/11-Backlog).

### G. Tooling/Infra
- **G1 – Playwright-Browser:** In der CI-/Web-Umgebung ist die Playwright-CDN
  geblockt; E2E nutzt ein Chromium via `CHROME_BIN`/`@sparticuz/chromium`
  (siehe README). `npm run e2e` (Test-Runner) läuft lokal/CI mit Browser; in der
  Sandbox dient `npm run clickthrough` (ein Node-Prozess) als Ersatz.
- **G2 – Keine CI-Pipeline-Datei** (z. B. GitHub Actions) eingecheckt; Gates werden
  manuell/als Tests ausgeführt. `validateContent()` ist als Test eingebunden.

---

## Bewusst ausgeschlossen (kein Backlog, ADR-004)
Multiplayer/PvP/Koop, Online-Leaderboards, Seed-Challenges, Cloud-Sync, jegliche
Netzwerk-/Backend-Features. Cup Crusaders bleibt reines Single-Player offline.

---

## Empfohlene nächste Schritte
1. **Assets-Pipeline** (auch nur Platzhalter-Sprites/Audio) — größter Hebel fürs
   „Spielgefühl"; entkoppelt Polish von Platzhaltern.
2. **Active Ability Deck (A1)** — schaltet aktive Blessings frei und nutzt den
   reservierten UX-Bereich.
3. **Settings-UI + Audio (A2/A3)** — schnelle, sichtbare Qualitätsgewinne.
4. **Balancing-Pass (D1–D3)** mit der lokalen Analytics aus docs/13.
5. Laufende Pflege: **`docs/14` aktuell halten**, CI-Workflow-Datei ergänzen (G2).
