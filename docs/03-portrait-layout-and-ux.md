# 03 – Portrait-Layout & UX

Alles ist für **Hochformat (Portrait)** und **Touch** optimiert. Interne
Referenzauflösung: **720 × 1280 (9:16)**, skaliert via `Phaser.Scale.FIT`.

## Warum 720×1280
- 9:16 ist das häufigste Handy-Seitenverhältnis und ein sauberer Mittelwert.
- 720 px Breite ist genug für Pixel-Art-Detail, aber leicht zu rendern.
- `FIT` + `CENTER_BOTH` füllt abweichende Geräte mit Letterbox; UI-Anker beziehen
  sich auf Safe-Area-Insets.

---

## Bildschirm-Regionen (Kampf-Phase)

```
 0 ┌─────────────────────────────┐  ← Safe-Area Top (Notch)
   │  [A] TOP BAR  (Welle 4/7)    │  ~8%   Wellen-Fortschritt, Cup-Ballzähler
   ├─────────────────────────────┤
   │                             │
   │                             │
   │  [B] KAMPF-BÜHNE             │  ~62%  Side-Scroller: Held links, Gegner rechts
   │      (Side-Scrolling)        │        Floating Combat Text, Hit-Flash
   │                             │
   │   🧙‍♂️→ → → →   👹 👹 👹     │
   ├─────────────────────────────┤
   │  [C] HELD-STATUS             │  ~6%   HP-/Schildbalken des Helden
   ├─────────────────────────────┤
   │  [D] ACTIVE ABILITY DECK     │  ~24%  Aktive Fähigkeiten (Touch-Zone)
   │   [Q]  [W]  [E]  [R]          │        cooldown-basiert, Daumen-erreichbar
1280└─────────────────────────────┘  ← Safe-Area Bottom (Home-Indicator)
```

- **Daumen-Zone:** Region **[D]** liegt im unteren Drittel → bequem mit einer Hand
  erreichbar. Hier liegen ALLE interaktiven Kampf-Elemente.
- Die obere Bühne **[B]** ist bewusst input-frei im Auto-Battler (nur Zuschauen),
  damit der Daumen die Sicht nicht verdeckt.

---

## Die untere Zone: "Active Ability Deck"

> Designentscheidung: Die untere ~24 % des Kampfbildschirms wird **nicht** leer
> gelassen, sondern als optionale aktive Eingriffsebene genutzt. Der Auto-Battler
> bleibt die Basis; das Deck ist die Skill-Decke darüber.

### Konzept
Eine Reihe von **Ability-Buttons** (Start: 4 Slots). Jede Ability ist
**cooldown-basiert** und datengetrieben (siehe [08 – Daten-Schemas](08-data-schemas.md),
Abschnitt *Ability*). Beispiele:

| Ability | Effekt | Cooldown |
|---|---|---|
| **Smite** | Gezielter Flächenschaden — Spieler tippt Gegner an | mittel |
| **Trank** | Heilt den Helden um X % | hoch |
| **Zeitlupe** | Verlangsamt Gegner für N Sekunden | hoch |
| **Schildwall** | Temporärer Absorptions-Schild | mittel |
| **Schnellfeuer** | Burst erhöhter Angriffsgeschwindigkeit | mittel |

### Interaktionsmuster
- **Tap-to-Activate** für Sofort-Abilities.
- **Tap-Ability-then-Tap-Target** für gezielte Abilities (z. B. Smite): Button
  aktiviert Zielmodus, dann tippt der Spieler einen Gegner in **[B]**.
- Cooldown wird als radialer Overlay auf dem Button dargestellt.

### Warum das gut zum Konzept passt
- Erhält die "Zuschauen"-Grundhaltung (alles optional).
- Gibt Skill-Ausdruck und Spannung in langen Wellen/Bosskämpfen.
- Erweiterbar: Abilities sind Content-Einträge; neue per Daten hinzufügbar.
- Verbindbar mit Progression: Abilities/Slots via Shop/Ausrüstung freischaltbar.

> Das Active Ability Deck ist als **Post-MVP-Feature** geplant (Layout wird aber
> ab M1 reserviert). Siehe [Roadmap](11-roadmap-and-mvp.md).

---

## Bildschirm-Regionen (Drop-Phase)

```
   ┌─────────────────────────────┐
   │  TOP: Becher (Munition: N)    │  ← wandert/zieht horizontal, Tap = ausschütten
   ├─────────────────────────────┤
   │   ·   ·   ·   ·   ·   ·       │
   │ ·   ·   ·   ·   ·   ·   ·     │  PEG-FELD (Matter-Physik)
   │   · [x2] · · [x3] ·  ·        │  ← Multiplikator-Tore zwischen den Pegs
   │ ·   ·   ·   ·   ·   ·   ·     │
   ├──┬────┬────┬────┬────┬───────┤
   │x1│ x5 │ x10│ x5 │ x1 │  ...   │  BINS (Auffangbehälter mit Multiplikatoren)
   └──┴────┴────┴────┴────┴───────┘
```

- Becher-Steuerung per **Drag** (horizontal) und **Tap** (ausschütten) in
  Daumenreichweite oben — alternativ Steuerleiste unten konfigurierbar.

---

## Bildschirm-Regionen (Shop-Phase, DOM-Overlay)

```
   ┌─────────────────────────────┐
   │   💰 Währung: 1.240 Bälle      │
   ├─────────────────────────────┤
   │  ┌────┐   ┌────┐   ┌────┐     │
   │  │Card│   │Card│   │Card│     │  3 zufällige Upgrade-Karten
   │  │ 1  │   │ 2  │   │ 3  │     │
   │  └────┘   └────┘   └────┘     │
   ├─────────────────────────────┤
   │      [ Nächste Welle ▶ ]      │
   └─────────────────────────────┘
```

---

## Accessibility & Eingabe ([ADR-011](decisions.md))
- **Pointer Events** als einheitliche Eingabeschicht (Touch/Maus/Pen in einem Modell).
- **Touch-Ziele ≥ 48×48 px** (CSS) für alle interaktiven Elemente in Kampf, Drop,
  Shop (W3C ≥24, Apple ≥44 pt, Material ≥48 dp → wir nehmen 48 als Untergrenze).
- **Drag braucht immer eine Tap-Alternative** (WCAG 2.5.7): Die Becher-Steuerung im
  Drop ist per Drag *und* per Tap/Buttons („nach links/rechts", „ausschütten")
  bedienbar — Pflicht, kein Nice-to-have.
- **Sichtbare Focus-States** (WCAG 2.4.x) für alle Buttons/Karten.
- **Reduced Motion** respektieren (`prefers-reduced-motion`): Floating Text/Shake
  abschwächen.
- Einhandbedienung: alle Interaktionen in der unteren Daumen-Zone.

## Responsiveness & Safe Areas
- **Safe-Area-Insets** (`env(safe-area-inset-*)`) für Notch/Home-Indicator in
  allen DOM-Overlays respektieren.
- **Portrait-first, Landscape-safe:** `ScreenOrientation.lock()` ist nicht überall
  robust → kein harter Lock, sondern **reflow-fähiges Layout** + freundlicher
  „Bitte Gerät drehen"-Hinweis im Querformat.
- Skalierungs-Anker: Top-Bar oben verankert, Ability-Deck unten verankert, Bühne
  dehnt sich dazwischen.

---

## Audio/Haptik (Notiz)
- Kurze, knackige SFX für Treffer, Ball-Sammeln, Peg-Bounce, Bin-Treffer, Kauf.
- Optionale **Vibration** (`navigator.vibrate`) bei großen Multiplikator-Treffern
  (Near-Miss-Verstärkung) — abschaltbar in Settings.
