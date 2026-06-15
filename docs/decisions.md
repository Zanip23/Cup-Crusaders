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

## ADR-004 — Reines Single-Player, kein Multiplayer
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Soll das Spiel soziale/vernetzte Features bekommen (PvP, Koop,
Online-Leaderboards, geteilte Seed-Challenges)?
**Entscheidung:** **Nein.** Cup Crusaders ist und bleibt ein reines
**Single-Player**-Spiel. Kein Multiplayer, kein PvP/Koop, keine Online-Features —
weder im MVP noch später.
**Begründung:** Wunsch des Designers; hält Scope, Komplexität und Infrastruktur
klein und passt zum fairen, offline-fähigen Roguelite-Kern.
**Konsequenzen:** Kein Backend/Server, kein Netzwerk-Code, kein Account-System
nötig. Persistenz bleibt lokal (IndexedDB, siehe [09](09-game-state.md)). Der
seedbare `Rng` dient nur Tests/Reproduzierbarkeit, nicht geteilten Challenges.

---

## ADR-005 — Rundenbasiertes Auto-Battle (statt Echtzeit)
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Externer Recherche-Report liest aus Original-Reviews ein rundenbasiertes
Kampfmodell; frühere Vision/Briefing deuteten auf Echtzeit-Side-Scrolling.
**Entscheidung:** Kampf ist **rundenbasiert** (klare Turn-Phasen). Side-Scrolling
bleibt als **Optik**, der Ablauf ist getaktet.
**Begründung:** Am besten belegbar, lesbarer/strategischer, deterministischer und
testbarer als ein Echtzeit-Loop.
**Konsequenzen:** `docs/04` neu strukturiert (Rundenablauf). „Attack Speed" wird zu
ExtraAttack/Zusatzangriff pro Runde. ADR-002 bleibt gültig (Ball-Drop pro
aufgelöstem Treffer im Zug).

---

## ADR-006 — Ein Held jetzt, Hero als Daten-Entity
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Report baut auf einem Hero-Roster (8 Helden) auf; unsere Doku hatte
einen Helden.
**Entscheidung:** **Ein** Held im MVP, aber als **`HeroDef`-Daten-Entity** gebaut,
sodass weitere Helden später ohne Engine-Umbau hinzukommen.
**Begründung:** Hält Scope/Balancing klein, hält die Tür für Roster offen.
**Konsequenzen:** `HeroDef`-Schema in `docs/08`; `signature`/Roster vorbereitet,
aber nicht im MVP-Scope.

---

## ADR-007 — Wellen-Default 15 + Belohnung auch bei Niederlage
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Report standardisiert 14 + Boss = 15 Wellen und „jeder Wellenabschluss
belohnt".
**Entscheidung:** **Default 15 Wellen** (pro Level konfigurierbar). Abgestufte
Reward-Kurve (35/55/70/85 %) zahlt auch bei späterem Run-Tod aus.
**Begründung:** Senkt Frust, macht Wiederholung fair, guter Retention-Hebel.
**Konsequenzen:** Reward-State im Run; Balancing-Werte in `docs/04`/`docs/10`.

---

## ADR-008 — PWA: IndexedDB + Service Worker (statt localStorage)
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Persistenz für wachsendes Inventar; Wunsch nach installierbarem,
offline-fähigem Mobile-Web-Client.
**Entscheidung:** **PWA** mit Web App Manifest, **Service Worker** (App-Shell/Asset-
Cache) und **IndexedDB** als Default-`SaveRepository`.
**Begründung:** IndexedDB passt zu strukturierten, größeren Saves (hunderte Items);
offline-first passt zu Single-Player. Voll kompatibel mit ADR-004 (kein Backend).
**Konsequenzen:** `SaveRepository` wird async; `docs/01`/`docs/09` aktualisiert.

---

## ADR-009 — Drop-Board ist physik-autoritativ (reine Physik)
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Hybrid (seed-gesteuerte Auszahlung) vs. reine Physik. Original-Interna
sind öffentlich nicht dokumentiert; Beschreibungen wirken physik-betont.
**Entscheidung:** **Reine Matter.js-Physik bestimmt die Auszahlung.** Kein
ökonomisches Steering. Value-Carrying-Balls sind nur Repräsentation; der
`DropResolver` summiert tatsächliche Ergebnisse.
**Begründung:** Wunsch nach realistisch-emergentem Spielgefühl; maximaler direkter
Skill-Einfluss der Becher-Position.
**Konsequenzen:** **Nicht exakt reproduzierbar** (akzeptiert). Balancing **empirisch**
über Board-Geometrie. Performance via Body-Cap/gestreutes Tropfen/Despawn.
Optionaler großzügiger Auszahlungs-Cap nur als Exploit-Sicherung. `docs/05`/`docs/09`
aktualisiert.

---

## ADR-010 — Balance-Caps gegen Endgame-Degeneration
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Report dokumentiert dominante Execute-/Reflect-/%-Builds im Vorbild.
**Entscheidung:** Harte Caps in der StatEngine: DR 75 %, Dodge 35 %, Lifesteal 20 %,
Execute non-boss 9 % (Boss → True-Damage-Conversion, nie tödlich), Thorns 50 %,
CritChance 60 % soft, Rerolls max 5. Als `StatCaps`-Datentabelle.
**Begründung:** Verhindert Snowball-Exploits und Stat-Inflation; hält Endgame an
Build-Checks statt an Zahlenmauern.
**Konsequenzen:** Caps-Tabelle in `docs/08`; Tuning in `docs/10`.

---

## ADR-011 — UX/A11y-Härtung (Pointer Events, 48px, WCAG-Drag-Alternative)
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Mobile-Web-Tauglichkeit & Barrierearmut aus dem Report.
**Entscheidung:** Pointer Events als Eingabeschicht; Touch-Ziele ≥48 px; jede
Drag-Funktion (Becher) zusätzlich per Tap/Buttons bedienbar (WCAG 2.5.7); sichtbare
Focus-States; `prefers-reduced-motion`; Portrait-first/Landscape-safe ohne harten
Orientation-Lock.
**Begründung:** Reduziert Fehlbedienung, erfüllt anerkannte Web-Standards.
**Konsequenzen:** In `docs/03` als verbindliche Regeln.

---

## ADR-012 — Spiritual Successor, eigene Namen/IP
**Status:** ✅ entschieden (2026-06-15)
**Kontext:** Report nennt „© 2024, 501 Ltd." am Original. Direkte Übernahme von
Namen/Art wäre rechtlich riskant.
**Entscheidung:** Cup Crusaders ist ein **eigenständiger Spiritual Successor**.
Mechanik-Archetypen dürfen inspiriert sein, aber **Namen, Texte und Art sind
original** — inkl. eigener Set-/Helden-/Gegnernamen (nicht die im Report geliehenen).
**Begründung:** IP-/Lizenzrisiko vermeiden.
**Konsequenzen:** Die Content-Bibliothek (`docs/12`) nutzt nur als
Balancing-/Struktur-Referenz dienende Werte; Klartextnamen werden ersetzt.

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
