# 11 – Roadmap & MVP

Strategie: **erst der vollständige, leere Loop**, dann **vertikaler Slice mit echtem
Gameplay**, dann **Content-Breite & Meta-Progression**. Wir bauen Tiefe erst, wenn
der Loop steht.

---

## Milestones

### M0 — Planung & Dokumentation  ✅ (dieses Repo)
Vollständige Architektur- und Design-Doku. **Kein Spielcode.**

### M1 — Projekt-Skelett & leerer Loop
**Ziel:** Den 3-Phasen-Loop "leer" durchklicken.
- Vite + TS + Phaser 3 Setup, Portrait-Config (720×1280), Pixel-Art-Flags.
- `core/`: `GameStateManager` (Scopes, Reducer, Actions), `EventBus`
  (typisierte Events), `SaveRepository` (localStorage-Stub), `Rng`.
- Leere Szenen: Boot → Combat → Drop → Shop → Combat (Loop), nur mit
  Platzhalter-Buttons ("Welle gewonnen", "Drop fertig", "Weiter").
- `transfer`-Kanal funktioniert: eine Test-Ballzahl fließt korrekt durch alle
  drei Phasen.
- **Definition of Done:** Man kann den Loop endlos durchklicken; Ballzahl wird
  korrekt übergeben; Reload bricht nichts.

### M2 — Kampf-Phase (Vertical Slice)
- `StatEngine` + `EffectSystem` (mind. `addModifier`, `onHit`, `onKill`).
- Held mit Auto-Attack (Arcade), 1 Projektiltyp.
- `WaveSpawner` + 1 Gegnertyp + 1 Boss; HP-Balken, Hit-Flash, Floating Text.
- **Ball-Drops** mit Tween in die Cup-UI → füllt `transfer.ballsFromCombat`.
- Top-Bar (Welle X/N), Held-HP. Ability-Deck-Zone reserviert (leer).

### M3 — Drop-Phase (Vertical Slice)
- `DropScene` mit Matter.js, 1 `BoardDef`.
- Becher (Drag + Tap), Pegs, **Tore** (x2, +5), **Bins** (x1/x5/x10).
- `DropResolver` (Value-Carrying-Balls) + Performance-Cap.
- Near-Miss-Layout (zentraler x10). Ergebnis → `transfer.ballsFromDrop`.

### M4 — Shop-Phase (Vertical Slice)
- `ShopScene` DOM-Overlay, 3 gewichtete Karten aus Pool (seedbar).
- 5 Start-Upgrades (je Kategorie mind. eins), Kauf-Flow, Kosten-Skalierung.
- Upgrades wirken nachweisbar in der nächsten Welle (über StatEngine).
- **Definition of Done für Vertical Slice:** Voller spielbarer Loop mit echtem
  Gameplay, steigender Schwierigkeit und Tod-/Run-Ende.

### M5 — Meta-Progression
- `MetaScene` (Hauptmenü): Inventar, 6 Ausrüstungs-Slots, Equip.
- Rarity, **Merge** (3→1), Item-Level (Gold/Baupläne), Boss-Item-Drops.
- Permanente Meta-Skills (Modifier mit `scope:'meta'`).
- Persistenz von `meta` + Save-Versionierung.

### M6 — Content-Breite & Polish
- Mehrere Welten/Level, Gegner-Sets, Boards, große Item-/Upgrade-Pools.
- `validateContent()` in CI.
- **Active Ability Deck** aktivieren (Abilities, Cooldowns, Targeting).
- Audio, Haptik, Settings, Lokalisierung, Performance-Pass auf echten Geräten.

---

## Empfohlener Scope für den ersten Code-Schritt (nach Freigabe)
**M1 — Projekt-Skelett & leerer Loop.** Begründung: Risiko früh senken, indem die
Phasenübergänge und der `transfer`-Vertrag stehen, bevor Gameplay-Komplexität
dazukommt. Erst wenn der leere Loop robust läuft, füllen wir M2–M4.

---

## Bewusst aufgeschoben (Backlog)
- Cloud-Saves (lokales localStorage genügt; kein Backend im Scope).
- Resume-after-reload mitten im Run (zunächst nur Meta persistent).
- Reroll/Pity im Shop, Telemetrie-Dashboards.

> **Ausgeschlossen (kein Backlog), [ADR-004](decisions.md):** Multiplayer/PvP/Koop,
> Online-Leaderboards, Seed-Challenges und jegliche Netzwerk-Features. Cup Crusaders
> ist ein reines Single-Player-Spiel.
- Erweiterte Bossmechaniken, Statuseffekte, Synergie-Sets bei Items.

---

## Risiken & Gegenmaßnahmen
| Risiko | Gegenmaßnahme |
|---|---|
| Matter-Performance bei vielen Bällen | Value-Carrying-Balls + Hard-Cap + gestreutes Tropfen (docs/05) |
| Stat-Stacking-Bugs bei vielen Upgrades | Eine StatEngine, fixe Berechnungsreihenfolge, Unit-Tests (docs/08) |
| Kaputter Content bei hunderten Einträgen | `validateContent()` + TS-Typen (docs/10) |
| Save-Brüche bei Updates | Nur IDs/Instances speichern + Migrationspipeline (docs/09) |
| Scope-Creep | Milestones, Vertical Slice zuerst, Backlog diszipliniert |
