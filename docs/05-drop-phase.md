# 05 – Drop-Phase (Pachinko-Physik)

Physik: **Matter.js** (nur hier aktiv). Szene: `DropScene`.

## Ziel der Phase
Die `ballsFromCombat` als Munition möglichst gewinnbringend durch ein
Nagelbrett fallen lassen, sodass Multiplikatoren und Bins die finale Ballzahl
maximieren. Ergebnis = Währung für den Shop.

---

## Aufbau des Bretts
Ein **Board** (datengetrieben, siehe [08](08-data-schemas.md), Abschnitt *Board*)
besteht aus:

1. **Becher (Cup)** — oben, beweglich.
   - Enthält exakt `ballsFromCombat` Bälle als Munition.
   - **Steuerung:** horizontaler **Drag**; **Tap** = Bälle ausschütten.
   - Ausschütten kann **gestreut über Zeit** erfolgen (Bälle tropfen nacheinander),
     um Physik-Last zu glätten und Spannung zu erzeugen.

2. **Pegs** — statische runde Matter-Bodies.
   - Layout aus der Board-Definition (Grid/Versatz/Custom).
   - **Restitution** (Bounce) als Board-Parameter → bestimmt Chaos-Grad.
   - Dichte via **Peg-Density-Skill** erhöhbar (mehr Pegs = komplexer, oft
     ertragreicher).

3. **Tore (Gates)** — durchlässige Zonen, die durchfallende Bälle modifizieren.
   - **Multiplikativ:** `x2`, `x3` (verdoppelt/verdreifacht durchfallende Bälle).
   - **Additiv:** `+5`, `+10`.
   - **Negativ/Risiko:** `-5`, `x0.5`.
   - Effekt = datengetriebene Effekt-Komponente (siehe [08](08-data-schemas.md)).

4. **Bins (Sammelbehälter)** — unten, unterschiedlich breit.
   - Jeder Bin hat einen **Multiplikator/Bonus** (`x1`, `x5`, `x10`, Spezial).
   - Bälle, die hier landen, werden zur Shop-Währung.

---

## Ökonomie-Modell: physik-autoritativ ([ADR-009](decisions.md))

> **Entscheidung:** **Die echte Matter.js-Physik bestimmt das Ergebnis** — kein
> seed-basiertes „Steering", keine verdeckte Verteilung. Wo ein Ball landet, ergibt
> sich allein aus der Simulation. Das ist bewusst „realistisch/emergent" gewählt.

**Repräsentation (Value-Carrying Balls):** Jeder Ball ist ein echter Matter-Body
und trägt einen `value` (Start 1). Passiert er physisch ein Tor, ändert sich sein
`value`; fängt ihn ein Bin, multipliziert dessen Faktor. Der `DropResolver` summiert
am Ende nur die tatsächlich physisch entstandenen Ergebnisse — er **steuert nichts**.

```
ball.value = 1
physisch durch Gate(x2): ball.value *= 2
physisch durch Gate(+5): ball.value += 5
physisch in Bin(x10):    contribution = ball.value * 10
run.transfer.ballsFromDrop = Σ contribution über alle Bälle
```

- **Skill zählt direkt:** Wo du den Becher positionierst und ausschüttest,
  beeinflusst über die Physik real das Ergebnis.
- **Optional `Spawn-on-Pass`:** Ein Tor `+5`/`x2` darf zusätzlich *physische* Bälle
  spawnen (begrenzt durch den Body-Cap) für das „mehr Bälle"-Gefühl.

### Bewusste Trade-offs (so gewählt)
- **Nicht exakt reproduzierbar** über Geräte/Frames hinweg (Float-Determinismus von
  Matter ist nicht garantiert). Akzeptiert für das realistische Gefühl.
- **Balancing empirisch:** Erwartungswert wird **nicht** per Formel garantiert,
  sondern über **Board-Geometrie** (Peg-/Bin-/Tor-Layout) per Playtest & Telemetrie
  getunt (siehe [10](10-content-pipeline-and-balancing.md)).

### Performance- & Sicherheits-Leitplanken (Optik/Stabilität, kein Steering)
- **Hard-Cap** an gleichzeitigen Matter-Bodies (z. B. 150–250) → Becher tropft
  gestreut, statt alles auf einmal.
- Bälle, die in Bins landen oder zu lange ruhen, werden **despawnt** und nur ihr
  `value` verbucht (siehe Timeout-Sicherung unten).
- `value` als Integer/Big-genug-Typ gegen Overflow bei langen Multiplikatorketten.
- Optionaler, großzügiger **Auszahlungs-Hard-Cap pro Welle** nur als
  Exploit-Sicherung (standardmäßig sehr hoch; verändert normales Spiel nicht).

---

## Near-Miss-Design (bewusst eingebaut)
Wie im Genre üblich wird das Brett so layoutet, dass der Spieler oft das Gefühl
hat, **"fast" den riesigen x10** getroffen zu haben.

- Der `x10`-Bin liegt zentral, flankiert von attraktiven, aber kleineren Bins.
- Peg-Anordnung lenkt Bälle visuell **nahe** an den Jackpot, ohne ihn zu
  garantieren.
- **Ehrlichkeit-Leitplanke:** Wir manipulieren nur das **Layout/Gefühl**, nie
  verdeckt das Ergebnis. Da die **echte Physik autoritativ** ist (ADR-009), gibt es
  ohnehin keine versteckte Mathematik gegen den Spieler; „Trickserei" beschränkt
  sich auf Wahrnehmungsdesign (Bin-Platzierung, Peg-Anordnung, Kamera, SFX, Haptik).

---

## Pachinko-beeinflussende Skills
| Skill | Wirkung |
|---|---|
| Starting Balls | erhöht Munition zu Beginn des Drops (additiv vor Phasenstart) |
| Peg-Density | mehr Pegs auf dem Brett |
| Magnet | zieht fallende Bälle leicht zu besseren Toren/Bins (Kraftfeld auf Matter-Bodies) |
| Bounce/Restitution | beeinflusst Abprallverhalten |

---

## Phasenende
- Wenn **alle Bälle** in Bins gelandet sind oder zur Ruhe gekommen/despawnt sind:
  - `run.transfer.ballsFromDrop = Σ contributions`
  - `emit(DROP_COMPLETE, { balls })` → `run.currency = balls` → `ShopScene`.
- **Timeout-Sicherung:** Bälle, die zu lange "feststecken", werden nach
  T Sekunden despawnt (mit value=0 oder Mindestwert), damit die Phase garantiert
  endet.
