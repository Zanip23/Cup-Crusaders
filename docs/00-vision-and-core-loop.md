# 00 – Vision & Core Loop

## Vision

Cup Crusaders ist ein **mobiles Roguelite** im Browser. Ein "Run" ist eine
Endlosschleife aus drei Phasen mit steigender Schwierigkeit. Über mehrere Runs
hinweg baut der Spieler **Meta-Progression** auf (Ausrüstung, permanente Stats).

### Design Pillars

1. **Ein flüssiger Loop, eine Ressource.** Bälle sind Loot, Munition und Währung
   zugleich. Diese Kopplung ist das Herz des Spiels und muss jederzeit sichtbar
   und nachvollziehbar sein.
2. **Zuschauen, dann eingreifen.** Der Kampf ist Auto-Battler (Spieler schaut zu).
   Aktiver Skill-Ausdruck kommt über (a) den optionalen *Active Ability Deck* im
   Kampf und (b) das *Geschick* in der Drop-Phase.
3. **Fair statt Pay-to-Win.** Jede Mechanik, die im Genre üblicherweise per
   Echtgeld monetarisiert wird (Kisten, Merge-Material, Energie), wird hier durch
   faires Gameplay verdient.
4. **Datengetrieben & erweiterbar.** Hunderte Items, Gegner und Upgrades müssen
   sich per Daten (JSON/Config) hinzufügen lassen — ohne Engine-Code zu ändern.
   Siehe [08 – Daten-Schemas](08-data-schemas.md).
5. **Mobile-First Portrait.** Alles ist für Hochformat und Touch optimiert.
   Einhandbedienung muss möglich sein.

### Was Cup Crusaders NICHT ist

- Kein Echtzeit-Action-Game mit Bewegungssteuerung des Helden (er steht fest links).
- Kein Pay-to-Win, keine Werbung, keine Energie-/Wartesysteme.
- Kein PvP (zumindest nicht im MVP).

---

## Der Core Loop im Detail

Ein **Run** besteht aus mehreren **Leveln**. Ein Level besteht aus mehreren
**Wellen** (z. B. 7 oder 15), wobei die letzte Welle ein **Boss** ist. Jede Welle
durchläuft den 3-Phasen-Zyklus.

```
RUN
└── LEVEL (z.B. "Welt 1")
    ├── WELLE 1 ─►  [Kampf] ─► [Drop] ─► [Shop]
    ├── WELLE 2 ─►  [Kampf] ─► [Drop] ─► [Shop]
    ├── ...
    └── WELLE N ─►  [BOSS-Kampf] ─► [Drop] ─► [Shop] ─► nächstes Level
```

> **Hinweis zur Granularität:** Ob *jede* Welle eine Drop+Shop-Phase auslöst oder
> nur Welle-Enden, ist ein **Balancing-Parameter** (`dropAfterEveryWave` vs.
> `dropAfterLevelOnly`). Das MVP nutzt Drop+Shop nach **jeder** Welle für maximale
> Loop-Frequenz; konfigurierbar in der Level-Definition. Siehe
> [04 – Kampf-Phase](04-combat-phase.md).

### Phase 1 — Kampf (Auto-Battler)

- Held steht statisch **links**, Gegner spawnen **rechts** und laufen heran.
- Held greift automatisch den nächsten Gegner in Reichweite an (Projektile).
- Trefferfeedback: Floating Combat Text + weißer Hit-Flash.
- Besiegte (auf höheren Stufen auch getroffene) Gegner droppen **Bälle**, die in
  einer Animation nach oben in die **Cup-UI** fliegen und dort gezählt werden.
- **Phasenende:** Welle leer → exakte Ballzahl wird an die Drop-Phase übergeben.

### Phase 2 — Drop (Pachinko-Physik)

- Becher am oberen Rand mit exakt der Ballzahl aus dem Kampf als Munition.
- Spieler bewegt den Becher horizontal, tippt zum Ausschütten.
- Bälle fallen, prallen von **Pegs** ab, passieren **Multiplikator-Tore**
  (x2, x3, +5, −5, x0.5) und landen in **Bins** mit eigenen Multiplikatoren.
- **Near-Miss-Design** (bewusst): Layout suggeriert "fast den x10 getroffen".
- **Phasenende:** Summe der Bins = Währung für den Shop.

### Phase 3 — Shop (Roguelite)

- Overlay mit aktueller Währung oben, **3 zufälligen Upgrade-Karten** in der Mitte,
  "Nächste Welle"-Button unten.
- Karten zeigen Icon, Name, Beschreibung, Kosten (dynamisch nach Rarität).
- Kauf zieht Bälle ab und aktualisiert den **Player State** (wirkt sofort nächste
  Welle).
- **Phasenende:** Kauf/Skip → nächste, schwerere Welle.

---

## Datenfluss der Bälle (kanonisch)

```
Kampf:  enemy.kill ─► run.transfer.ballsFromCombat += enemy.ballDrop
Drop:   start mit ballsFromCombat ─► Physik ─► run.transfer.ballsFromDrop = Σ(bins)
Shop:   run.currency = ballsFromDrop ─► kaufe Upgrade ─► run.currency -= cost
```

Diese drei Übergaben sind die wichtigsten Verträge im Spiel. Sie sind im
[Game State](09-game-state.md) explizit als `transfer`-Kanal modelliert und
in [Architektur](02-architecture.md) als Events verdrahtet.
