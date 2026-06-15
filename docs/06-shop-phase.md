# 06 – Shop-Phase (Roguelite-Upgrades)

Rendering: **DOM-Overlay** (`ShopScene` via `scene.launch`). Keine Physik.

## UI-Layout
```
┌─────────────────────────────┐
│  💰 Währung: <ballsFromDrop>   │   ← oben: aktuelle Bälle
├─────────────────────────────┤
│  ┌────┐   ┌────┐   ┌────┐     │
│  │Card│   │Card│   │Card│     │   ← 3 zufällige Upgrade-Karten
│  └────┘   └────┘   └────┘     │
├─────────────────────────────┤
│      [ Nächste Welle ▶ ]      │   ← unten: weiter (Kauf optional)
└─────────────────────────────┘
```
Jede Karte zeigt: **Pixel-Icon · Name · Kurzbeschreibung · Kosten (Bälle) · Rarität**.

---

## Karten-Auswahl (Randomisierung)
- Es werden **3** Karten aus einem **gewichteten Pool** verfügbarer Upgrades
  gezogen (seedbarer `Rng` → reproduzierbar/testbar).
- **Gewichtung nach Rarität:** häufige Upgrades öfter, seltene (z. B. Ricochet)
  selten. Gewichte sind Content-Daten.
- **Pool-Filter:** Upgrades können Voraussetzungen/Exklusivitäten haben
  (`requires`, `maxStacks`, `excludes`) — bereits maximal gestackte Upgrades
  erscheinen nicht mehr.
- Optionale **Pity-/Reroll-Mechaniken** (z. B. ein kostenpflichtiger Reroll-Button)
  als spätere Erweiterung vorgesehen.

---

## Kosten-Skalierung
- Kosten richten sich nach **Rarität** und optional nach **Welle/Run-Fortschritt**.
- Beispiel-Tabelle (Balancing, nicht final):

| Rarität | Basis-Kosten (Bälle) | Beispiel-Upgrade |
|---|---|---|
| Common | 40 | +10 % Angriff, +Rüstung |
| Rare | 90 | Attack Speed, +MaxHP |
| Epic | 180 | Multi-Shot, Lifesteal |
| Legendary | 320 | Ricochet, Magnet |
| Mythic | 500 | seltene Build-Definierer |

> Raritäten = 5 Stufen (Common→Mythic, [ADR-013](decisions.md)); die Basis-Kosten
> entsprechen der Blessing-Kostenbasis aus [12](12-content-library.md).

- Kosten dürfen mit der Welle leicht steigen (`costScalingPerWave`), damit Bälle
  ihren Wert über den Run behalten. Genauer in
  [10 – Balancing](10-content-pipeline-and-balancing.md).

---

## Kauf-Flow & State
```
tap(Card) ─► prüfe run.currency >= card.cost
          ├─ ja  ─► run.currency -= cost
          │        EffectSystem.apply(upgrade)         (mutiert playerStats/Modifier)
          │        run.upgrades.push(upgrade.id)
          │        Karte als "gekauft" markieren / Overlay aktualisieren
          └─ nein ─► Karte ausgegraut / Feedback "zu wenig Bälle"
```
- ✅ **Entschieden ([ADR-003](decisions.md)):** **Mehrere** Käufe pro Shop
  erlaubt, solange Bälle reichen (`maxPurchasesPerShop: ∞`) → stärkt das
  Ressourcengefühl der Drop-Phase und zahlt die Loop-Kopplung (Drop→Shop) aus.
- Der "schmerzhafte Wahl"-Reiz entsteht über **Knappheit per Balancing**: Kosten
  so setzen, dass man pro Shop typischerweise nur **1–2 von 3** Karten leisten
  kann (`costScalingPerWave`). Beide Effekte — Entscheidung *und* Belohnung —
  bleiben so erhalten.
- **Upgrades wirken sofort** ab der nächsten Welle, weil sie über die
  [StatEngine](08-data-schemas.md)/`EffectSystem` in den Player State fließen.

---

## Upgrade-Kategorien (aus dem Konzept)
| Kategorie | Beispiele | Wirkungsort |
|---|---|---|
| **Kampf** | Multi-Shot, Ricochet, Lifesteal, Attack Speed, Crit | CombatScene |
| **Pachinko** | Starting Balls, Peg-Density, Magnet | DropScene |
| **Passiv/Meta (run-weit)** | +Basis-Angriff, +MaxHP, +Rüstung | StatEngine global |

Alle Upgrades sind **Content-Einträge** mit Effekt-Komponenten — siehe
[08 – Daten-Schemas](08-data-schemas.md), Abschnitt *Upgrade*.

---

## Phasenende
- **Kauf abgeschlossen oder übersprungen** → Tap auf "Nächste Welle":
  - `run.waveNumber++` (bzw. Level-Fortschritt)
  - `emit(SHOP_COMPLETE)` → `CombatScene` mit erhöhter Schwierigkeit.
