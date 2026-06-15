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

## Wie sich Bälle "vermehren" (Resolver-Modell)

Echte Tausende von Matter-Bodies sind auf Mobile teuer. Daher trennen wir
**Visualisierung** und **Zählung**:

> **Kernidee:** Ein Tor verändert nicht zwingend die *physische* Ballzahl, sondern
> einen **Wert/Gewichtung**, den jeder Ball trägt. Der `DropResolver` summiert am
> Ende exakt.

Zwei kombinierbare Strategien:

| Strategie | Beschreibung | Einsatz |
|---|---|---|
| **Value-Carrying Balls** | Jeder physische Ball trägt einen `value` (Start 1). Tor `x2` verdoppelt den `value` des durchfallenden Balls; `+5` addiert. Bin-Multiplikator multipliziert beim Auffangen. Finalsumme = Σ(`ball.value × bin.mult`). | Standard — wenige Bodies, große Zahlen möglich |
| **Spawn-on-Pass** | Tor `+5`/`x2` spawnt zusätzliche *physische* Bälle (begrenzt durch ein Hard-Cap). | Nur für visuell wichtige, kleine Mengen |

**MVP nutzt Value-Carrying Balls** mit optionalem visuellem "Aufblitzen/Vergrößern"
des Balls bei Tor-Durchgang, plus begrenztem Spawn für das Gefühl von "mehr Bällen".

```
ball.value = 1
durch Gate(x2): ball.value *= 2
durch Gate(+5): ball.value += 5
landet in Bin(x10): contribution = ball.value * 10
run.transfer.ballsFromDrop = Σ contribution über alle Bälle
```

### Performance-Leitplanken
- **Hard-Cap** an gleichzeitigen Matter-Bodies (z. B. 150–250) → Becher tropft
  gestreut, statt alles auf einmal.
- Bälle, die in Bins landen oder ruhen, werden **despawnt** und nur ihr `value`
  verbucht.
- `value` wird als Integer/Big-genug-Typ geführt, um Overflow bei großen
  Multiplikatorketten zu vermeiden.

---

## Near-Miss-Design (bewusst eingebaut)
Wie im Genre üblich wird das Brett so layoutet, dass der Spieler oft das Gefühl
hat, **"fast" den riesigen x10** getroffen zu haben.

- Der `x10`-Bin liegt zentral, flankiert von attraktiven, aber kleineren Bins.
- Peg-Anordnung lenkt Bälle visuell **nahe** an den Jackpot, ohne ihn zu
  garantieren.
- **Ehrlichkeit-Leitplanke:** Wir manipulieren das **Layout/Gefühl**, nicht
  verdeckt die Mathematik gegen den Spieler. Der seedbare `Rng` und die Physik
  bleiben fair und reproduzierbar; "Trickserei" beschränkt sich auf
  Wahrnehmungsdesign (Platzierung, Kamera, SFX, Haptik).

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
