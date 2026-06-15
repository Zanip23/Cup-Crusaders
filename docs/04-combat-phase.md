# 04 – Kampf-Phase (Rundenbasiertes Auto-Battle)

Physik: **Phaser Arcade** (kein Matter) — nur für Bewegung/Anordnung & Treffer-VFX,
**nicht** kampfentscheidend. Szene: `CombatScene`.

> **Kampfmodell (entschieden, [ADR-005](decisions.md)):** Der Kampf ist
> **rundenbasiert** (Turn-Phasen), **nicht** Echtzeit. Held und Gegner handeln in
> klar getrennten Zügen. Begründung: am besten mit Original-Reviews belegbar,
> lesbarer/strategischer, deterministischer und testbarer als ein Echtzeit-Loop.
> Die Side-Scrolling-**Optik** (Held links, Gegner rechts) bleibt erhalten — nur
> der zeitliche Ablauf ist getaktet.

## Layout & Perspektive
- 2D-**Side-Scrolling-Optik** im Hochformat (siehe [03](03-portrait-layout-and-ux.md)).
- Held steht **statisch links** (keine Bewegung über die Karte).
- Gegner stehen/formieren sich **rechts** in einer Linie.
- Kampf spielt in Region **[B]** (obere ~62 %); Eingaben nur in der unteren Zone.

---

## Rundenablauf (Turn Structure)
- **Spieler-Input im Basiskampf: keiner** — das Auto-Battle löst die Züge selbst auf.
  Optionale aktive Eingriffe nur über den *Active Ability Deck* (Post-MVP, unten).
- Eine **Runde** läuft in fester Phasenreihenfolge ab:
  1. **Held-Zug:** Der Held führt seine Angriffe aus (`projectileCount` Angriffe,
     je mit `attackDamage`, Crit-Wurf etc.). Zielwahl: vorderster/linkester lebender
     Gegner (alternative Strategien per Stat/Upgrade).
  2. **Effekt-Auflösung:** `onHit`/`onKill`-Effekte, DoTs (Burn), Lifesteal,
     Ricochet/Pierce werden aufgelöst.
  3. **Gegner-Zug:** Lebende Gegner handeln (Nah-/Fernangriff, Spezialfähigkeiten).
  4. **Statusphase:** Schilde/Buffs ticken, Tode werden verbucht, Ball-Drops fliegen
     in die Cup-UI.
- Runden wiederholen sich, bis die Welle leer ist oder der Held stirbt.
- **Werte kommen aus der [StatEngine](08-data-schemas.md)** — `attackDamage`,
  `attackSpeed` (→ Zusatzangriffe/ExtraAttack pro Runde), `projectileCount`,
  `pierce`, `ricochetBounces`, `critChance`, `critMultiplier`, `lifestealPct`.

> **Hinweis zu „Attack Speed" im Rundenmodell:** Feuerrate wird zu
> **Zusatzangriffen/ExtraAttack-Chance pro Runde** (statt höherer Echtzeit-Frequenz).
> Mechanisch derselbe Modifier, andere Interpretation.

### Trefferfeedback (bleibt „wuchtig")
- **Floating Combat Text** (Schadenszahl, größer/gelb bei Crit).
- **Hit-Flash:** Gegner blinkt kurz weiß (Tint).
- Kurzer Knockback/Impact-Tween — auch im Rundenmodell wichtig fürs Spielgefühl.

### Relevante Combat-Skills (aus dem Pool)
| Skill | Wirkung |
|---|---|
| Multi-Shot | `projectileCount += n` (mehrere Angriffe pro Zug) |
| Ricochet | Treffer springt zum nächsten Gegner (`ricochetBounces`) |
| Pierce | Treffer durchschlägt mehrere Gegner |
| Lifesteal | `lifestealPct` % des Schadens heilt den Helden (nicht aus Reflect) |
| Attack Speed | Zusatzangriff/ExtraAttack pro Runde |
| Crit | `critChance` / `critMultiplier` |

Alle als **Modifikatoren** über die [StatEngine](08-data-schemas.md), nicht als
Sonderlogik.

---

## Wellen-System (Wave Progression)
- Ein **Level/Kapitel** besteht aus einer festen Anzahl Wellen. **Default: 15**
  (14 Normalwellen + Bosswelle 15), konfigurierbar pro Level. → [ADR-007](decisions.md)
- **Top-Bar** zeigt `Welle X / N`.
- **Letzte Welle = Boss:** ein größerer Gegner mit deutlich mehr HP, ggf.
  Phasenwechsel/Adds und **garantiertem Item-Drop** (siehe [07](07-meta-progression-and-equipment.md)).
- Eine Welle ist eine **Liste von Spawn-Einträgen** (Gegnertyp, Anzahl, Timing).
  Schema in [08 – Daten-Schemas](08-data-schemas.md), Abschnitt *Wave*.

### Wellen-Belohnung — auch bei Niederlage ([ADR-007](decisions.md))
Jeder **abgeschlossene Wellenabschnitt belohnt**, selbst wenn der Run später
scheitert. Das senkt Frust und macht Wiederholungsschleifen fair. Abgestufte
Reward-Kurve (Anteil des vollen Run-Rewards):

| Fortschritt | ausgezahlter Anteil |
|---|---|
| ab Welle 1 | 35 % |
| ab Welle 5 | 55 % |
| ab Welle 10 | 70 % |
| Boss besiegt | 85 % (+ Boss-Beute) |

Die Werte sind Balancing-Daten (siehe [10](10-content-pipeline-and-balancing.md)).

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
2. **Bei Treffer (zufallsbasiert):** Jeder **aufgelöste Treffer** des Helden (pro
   Angriff im Held-Zug) hat eine **Chance** (`ballDropOnHitChance`, Start ~15 %),
   **1 Ball** abzuwerfen. Modelliert als `onHit`-Effekt über das
   [Effekt-System](08-data-schemas.md) — keine Sonderlogik. Im Rundenmodell
   weiterhin gültig (ADR-002), nur pro Zug-Treffer statt pro Echtzeit-Schuss.

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
