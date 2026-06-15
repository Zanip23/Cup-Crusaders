# Decision Log (ADR-light)

Verbindliche Designentscheidungen mit Begründung, damit später nachvollziehbar
ist, **warum** etwas so ist. Format bewusst schlank.

Status-Legende: ✅ entschieden · 🔄 offen/Tuning · ⏸️ aufgeschoben

---

## ADR-001 — Loop-Frequenz: Drop+Shop nach jeder Welle
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Ein Level besteht aus mehreren Wellen (letzte = Boss). Frage: Drop- und
Shop-Phase nach *jeder* Welle oder nur am Level-Ende?
**Entscheidung:** Standard ist **`everyWave`** — nach jeder Welle folgt Drop + Shop.
Pro Level via `LevelDef.dropCadence` auf `'levelEnd'` überschreibbar.
**Begründung:** Maximale Loop-Frequenz macht den charakteristischen 3-Phasen-Kern
am stärksten erlebbar, gibt ständig Feedback und Build-Wachstum (wie im Genre-Vorbild).
`levelEnd` bleibt als Option für spätere Spezial-/Survival-Level erhalten.
**Konsequenzen:** Pro Drop weniger Bälle (kleinere Einzel-Multiplikatoren) →
Drop-Board-Balancing auf häufige, kleinere Drops auslegen.

---

## ADR-002 — Ball-Drops bei Tod UND bei Treffer (Chance)
**Status:** ✅ entschieden (2026-06-15) · 🔄 Wert `ballDropOnHitChance` im Tuning
**Kontext:** Sollen Gegner Bälle nur bei Tod oder auch bei Treffern abwerfen?
**Entscheidung:** **Beides.** Garantierter `ballDrop` bei Tod **plus**
zufallsbasierter Drop pro Treffer über den Stat `BallDropOnHitChance` (Start ~15 %),
modelliert als `onHit`-Effekt.
**Begründung:** Macht lange Bosskämpfe ball-ergiebig und belohnt
Attack-Speed/Multi-Shot doppelt. Über das bestehende Effekt-/Stat-System abbildbar
(keine Sonderlogik).
**Konsequenzen:** Ökonomie-Balancing muss die zusätzliche Ball-Quelle einrechnen;
`BallDropOnHitChance` ist ein zentraler Tuning-Hebel und per Upgrade/Item skalierbar.

---

## ADR-003 — Mehrere Käufe pro Shop
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Im Shop liegen 3 zufällige Karten. Genau ein Kauf ("Draft") oder
mehrere ("Shopping")?
**Entscheidung:** **Mehrere** Käufe, solange Bälle reichen (`maxPurchasesPerShop: ∞`).
**Begründung:** Nur so werden die in der Drop-Phase gefarmten Bälle *wirklich*
wertvoll — das zahlt die zentrale Loop-Kopplung (Kampf→Drop→Shop) aus. Der
"schmerzhafte Wahl"-Reiz wird über **Kosten-Knappheit** zurückgeholt: typischerweise
nur 1–2 von 3 Karten leistbar.
**Konsequenzen:** Kosten-/Scaling-Balancing (`costScalingPerWave`) wird zum
wichtigsten Regler, um Power-Wachstum zu deckeln.

---

## Vorlage für neue Einträge
```
## ADR-00X — <Titel>
**Status:** <✅/🔄/⏸️> (<Datum>)
**Kontext:** <Problem/Frage>
**Entscheidung:** <was wir tun>
**Begründung:** <warum>
**Konsequenzen:** <Folgen, Trade-offs, was dadurch zu beachten ist>
```
