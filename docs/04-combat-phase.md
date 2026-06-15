# 04 – Kampf-Phase (Auto-Battler)

Physik: **Phaser Arcade** (kein Matter). Szene: `CombatScene`.

## Layout & Perspektive
- 2D-**Side-Scrolling** im Hochformat (siehe [03](03-portrait-layout-and-ux.md)).
- Held steht **statisch links** (keine Bewegung über die Karte).
- Gegner spawnen **rechts** und laufen in einer horizontalen Linie heran.
- Kampf spielt in Region **[B]** (obere ~62 %); Eingaben nur in der unteren Zone.

---

## Auto-Attack-Mechanik
- **Spieler-Input im Basiskampf: keiner.** Held feuert automatisch.
- **Zielwahl:** nächster Gegner in Reichweite (Default: der vorderste/linkeste
  lebende Gegner). Andere Zielstrategien per Stat/Upgrade möglich (siehe unten).
- **Angriff** = Spawn eines `Projectile` mit Werten aus der `StatEngine`:
  `attackDamage`, `attackSpeed` (Feuerrate), `projectileCount`, `pierce`,
  `ricochetBounces`, `critChance`, `critMultiplier`, `lifestealPct`.
- **Trefferfeedback:**
  - **Floating Combat Text** (Schadenszahl, größer/gelb bei Crit).
  - **Hit-Flash:** Gegner blinkt 1 Frame weiß (Tint).
  - Kleiner Knockback/Impact-Tween optional.

### Relevante Combat-Skills (aus dem Pool)
| Skill | Wirkung |
|---|---|
| Multi-Shot | `projectileCount += n` (mehrere Pfeile) |
| Ricochet | Projektil springt nach Treffer zum nächsten Gegner (`ricochetBounces`) |
| Pierce | Projektil durchschlägt mehrere Gegner |
| Lifesteal | `lifestealPct` % des Schadens heilt den Helden |
| Attack Speed | erhöht Feuerrate |
| Crit | `critChance` / `critMultiplier` |

Alle als **Modifikatoren** über die [StatEngine](08-data-schemas.md), nicht als
Sonderlogik.

---

## Wellen-System (Wave Progression)
- Ein **Level** besteht aus einer festen Anzahl Wellen (z. B. 7 oder 15).
- **Top-Bar** zeigt `Welle X / N`.
- **Letzte Welle = Boss:** ein größerer Gegner mit deutlich mehr HP (und ggf.
  Spezialverhalten / garantiertem Item-Drop, siehe [07](07-meta-progression-and-equipment.md)).
- Eine Welle ist eine **Liste von Spawn-Einträgen** (Gegnertyp, Anzahl, Timing).
  Schema in [08 – Daten-Schemas](08-data-schemas.md), Abschnitt *Wave*.

### Spawn & Difficulty Scaling
- `WaveSpawner` liest die `Wave`-Definition und spawnt Gegner über Zeit.
- Schwierigkeit skaliert über die Welle/Level via **Scaling-Kurven** (HP, Schaden,
  Speed, Anzahl) — als Formel/Tabelle in den Content-Daten, nicht hartcodiert.
  Siehe [10 – Content-Pipeline & Balancing](10-content-pipeline-and-balancing.md).

---

## Ball-Drops (die Verbindung zur Drop-Phase)
**Wichtigste Mechanik der Phase.**

Bälle entstehen aus **zwei Quellen** (Entscheidung [ADR-002](decisions.md)):

1. **Bei Tod (garantiert):** `enemy.death` droppt `ballDrop` Bälle (Wert aus der
   `Enemy`-Definition, ggf. modifiziert).
2. **Bei Treffer (zufallsbasiert):** Jeder Treffer des Helden hat eine **Chance**
   (`ballDropOnHitChance`, Start ~15 %), **1 Ball** abzuwerfen. Modelliert als
   `onHit`-Effekt über das [Effekt-System](08-data-schemas.md) — keine Sonderlogik.

- Bälle bleiben **nicht** liegen: kleine Tween-Animation **nach oben in die
  Cup-UI** (Top-Bar). Der Cup-Zähler zählt hoch.
- Jeder gesammelte Ball erhöht `run.transfer.ballsFromCombat`.

```
enemy.hit   ─► roll(ballDropOnHitChance) ─► ggf. +1 Ball  ─┐
enemy.death ─► +ballDrop Bälle                            ─┤─► tween → Cup-UI
                                                           └─► run.transfer.ballsFromCombat += n
```

> **Warum Treffer-Drops?** Sie machen lange **Bosskämpfe** (viele Treffer,
> langsamer Tod) ball-ergiebig und belohnen Attack-Speed/Multi-Shot doppelt.
> Die Chance ist ein Balancing-Hebel, kein fester Wert.

> **Vertrag:** Die an die Drop-Phase übergebene Zahl ist **exakt**
> `run.transfer.ballsFromCombat`. Die visuelle Animation darf die Zahl nie
> verändern — sie ist reines Feedback.

---

## Held-Status & Tod
- Held hat **HP** und optional **Schild** (eigener Balken in Region [C]).
- Gegner, die den Helden erreichen, fügen Schaden zu (Nahkampf am linken Rand)
  bzw. nach Gegnertyp (Fernkampf-Gegner möglich).
- **`armor`** reduziert eingehenden Schaden; **`maxHp`** via Items/Upgrades.
- HP ≤ 0 → `PLAYER_DIED` → Run endet → Belohnungs-/Meta-Bildschirm.

---

## Active Ability Deck (Post-MVP)
Optionale aktive Eingriffe in der unteren Zone — siehe
[03 – Portrait-Layout & UX](03-portrait-layout-and-ux.md). Abilities sind
datengetrieben ([08](08-data-schemas.md), Abschnitt *Ability*). Im MVP bleibt die
Zone reserviert/leer.

---

## Phasenende
- Sobald **alle Gegner der Welle tot** sind → `COMBAT_COMPLETE { balls }`.
- `balls = run.transfer.ballsFromCombat`.
- Übergang zur `DropScene`.

---

## Balancing-Parameter
**Entschieden** (siehe [Decision Log](decisions.md)):
- ✅ **Loop-Frequenz:** Drop+Shop nach **jeder** Welle (`dropCadence: 'everyWave'`),
  pro Level überschreibbar. → [ADR-001](decisions.md)
- ✅ **Ball-Drops:** bei **Tod** (garantiert) **und** bei **Treffer** (Chance
  `ballDropOnHitChance`). → [ADR-002](decisions.md)

**Noch offen** (Config-Flags vorgesehen, kein Code-Branch):
- Ziel-Strategie des Auto-Attacks (vorderster / niedrigste HP / stärkster).
- Konkreter Startwert von `ballDropOnHitChance` (Tuning).
