# 13 – KPIs & Analytics

> **Rahmen ([ADR-014](decisions.md)):** Mess- und Qualitätsziele aus dem externen
> Recherche-Report — **client-lokal & opt-in**. Keine Server-Übertragung (kompatibel
> mit [ADR-004](decisions.md), kein Backend). Monetarisierungs- und Social-KPIs
> entfallen bewusst (kein Payment, kein Multiplayer).

## Wozu KPIs in einem Offline-Single-Player-Spiel?
Auch ohne Backend sind klare Zielwerte nützlich: Sie sind **Design-Leitplanken**
(„ab wann ist der Loop gut genug?") und treiben **clientseitige Qualitätsmessung**
(Performance, Crash-Freiheit, Fortschritt). Populationsweite Aggregation über viele
Spieler ist ohne Server nicht möglich — die Zielwerte gelten daher als
**Benchmarks/Akzeptanzkriterien** (Playtest, CI-Perf-Tests, optionales Dev-Overlay),
nicht als Live-Dashboard.

## Messprinzipien
- **Opt-in & transparent:** Analytics nur nach expliziter Zustimmung; im Zweifel aus.
- **Lokal:** Aggregation in IndexedDB / im Speicher; **keine** Übertragung im MVP.
- **Anonym:** keine personenbezogenen Daten, keine Geräte-Fingerprints.
- **Abschaltbar:** jederzeit in den Settings deaktivierbar; Löschen = lokal löschen.

---

## KPI-Zielwerte
Übernommen aus dem Report; Monetarisierung/Social gestrichen, da nicht im Scope
([ADR-004](decisions.md)).

| Bereich | KPI | Zielwert | Messung |
|---|---|---|---|
| Retention | D1 | ≥ 35 % | lokal (Rückkehr-Tage) ¹ |
| Retention | D7 | ≥ 12 % | lokal ¹ |
| Retention | D30 | ≥ 4 % | lokal ¹ |
| Onboarding | Kapitel 1 in ≤ 2 Sessions | ≥ 70 % | lokal |
| Core Loop | Anteil Runs bis Welle 10 (ab Session 3) | 45–60 % | lokal |
| Core Loop | Bossclear-Rate Kapitel 1–3 | 35–45 % | lokal |
| Balance | Dominanz eines Helden (PvE) | < 22 % Pickrate | Post-MVP ² |
| Technik | Crash-free Sessions | ≥ 99,5 % | clientseitig |
| Technik | p75 INP | ≤ 200 ms | clientseitig ³ |
| Technik | mittlere FPS im Kampf | > 55 | clientseitig |

¹ Rückkehr-Tage sind clientseitig zählbar; eine populationsweite Quote bräuchte ein
optionales Backend (derzeit ausgeschlossen, [ADR-004](decisions.md)).
² Im MVP nur **ein** Held ([ADR-006](decisions.md)) → die Pickrate-KPI greift erst
mit wachsendem Roster.
³ INP ≤ 200 ms = web.dev-Schwelle für „gute" Responsiveness; für Mobile-Web Pflicht.

> **Gestrichen ggü. Report (Scope-Entscheidung):** Kosmetik-Conversion, Refund-Rate
> und „tatsächliche Machtvorteile durch Echtgeld" (kein Payment) sowie
> Harassment-Reports (kein Chat/Multiplayer).

---

## Analytics-Events
Lokale Event-Logs als Grundlage für Balancing (siehe
[10](10-content-pipeline-and-balancing.md)) und Performance-Pässe. Namen/Felder am
Report orientiert, an das Pachinko-/Single-Player-Modell angepasst.

| Event | Trigger | Wichtige Felder |
|---|---|---|
| `app_boot` | App wird geladen | appVersion, locale, deviceClass |
| `session_start` | Session beginnt | installAge, consentState |
| `hero_selected` | Held gewählt | heroId, heroLevel, loadoutPower |
| `run_start` | Run startet | chapterId, runSeed, heroId |
| `wave_start` | Welle beginnt | runId, wave, hpPct, activeUpgrades |
| `wave_end` | Welle endet | kills, damageTaken, ballsCollected |
| `cup_drop_resolved` | Drop-Board abgeschlossen | inputBalls, outputBalls, **binResult** |
| `upgrade_shown` | Shop-Draft erscheint | optionIds, costs, rerollsLeft |
| `upgrade_selected` | Karte gekauft | chosenId, skippedIds, ballSpend |
| `boss_defeated` | Boss fällt | chapterId, runTime, hpLeft |
| `run_end` | Sieg/Niederlage | outcome, lastWave, rewardSummary |
| `gear_merged` | Merge/Crafting | slot, family, fromRarity, toRarity |
| `performance_sample` | periodisch | fpsAvg, fpsLow1, INP, memEstimate |

> **Gestrichen ggü. Report:** `cosmetic_purchase` (kein Payment), `report_player`
> (kein Social).
>
> **Angepasst:** Report-`laneResult` → **`binResult`** (das Board hat Bins, keine
> Lanes — siehe [05 – Drop-Phase](05-drop-phase.md)); `run_start.mode` entfällt
> (nur Kapitelmodus, [ADR-004](decisions.md)).

---

## Verdrahtung
- Events laufen über den **EventBus** (siehe [02 – Architektur](02-architecture.md));
  ein optionaler `AnalyticsCollector` (opt-in) aggregiert sie lokal.
- `performance_sample` zieht FPS/INP/Memory periodisch und speist die Technik-KPIs;
  ergänzt die WebGL-Context-Loss-Robustheit aus [01](01-tech-stack.md).
- `cup_drop_resolved` (`inputBalls`/`outputBalls`) ist zugleich der Haupt-Hebel fürs
  **empirische Drop-Balancing** ([ADR-009](decisions.md), siehe
  [10](10-content-pipeline-and-balancing.md)) — der Median-Multiplikator wird über
  Board-Geometrie in den Zielkorridor geschoben.
- Speicherung im `meta.stats`-Zweig (siehe [09 – Game State](09-game-state.md)) bzw.
  einem separaten Analytics-Store; **debounced**, nicht pro Frame.

---

## Roadmap-Einordnung
- **MVP:** `performance_sample` + Crash-Erfassung + Core-Loop-Events
  (`run_start`/`wave_end`/`run_end`) als Basis für Perf- und Balance-Pässe.
- **Post-MVP:** Retention-/Onboarding-Auswertung in einem Dev-Overlay,
  Balance-KPIs (Helden-Dominanz) mit wachsendem Roster.

Siehe [11 – Roadmap & MVP](11-roadmap-and-mvp.md).
