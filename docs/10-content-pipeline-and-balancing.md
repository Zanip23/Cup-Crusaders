# 10 – Content-Pipeline & Balancing

Wie wir **hunderte** Items, Gegner, Upgrades und Boards pflegen, ohne im Chaos zu
versinken.

## Verzeichnis-Layout des Contents
```
src/content/
├── enemies/        enemies.<set>.ts        → EnemyDef[]
├── items/          items.<slot>.ts         → ItemBaseDef[]
├── upgrades/       upgrades.<category>.ts   → UpgradeDef[]
├── abilities/      abilities.ts            → AbilityDef[]
├── waves/          levels.<world>.ts       → LevelDef[] (mit WaveDef[])
├── boards/         boards.ts               → BoardDef[]
├── loot/           lootTables.ts           → LootTableDef[]
└── index.ts        registriert alles in den Registries
```
- Content thematisch in Dateien gruppieren (pro Welt/Slot/Kategorie), nicht eine
  Monster-Datei.
- Jede Datei exportiert ein typisiertes Array → TypeScript erzwingt Schema-Treue
  (siehe [08](08-data-schemas.md)).

---

## Content-Validierung (Build-/Dev-Schritt)
Ein `validateContent()`-Lauf (Dev-Start + CI) prüft:
- **Eindeutige IDs** pro Typ.
- **Referenzielle Integrität:** `boardId`, `enemyId`, `lootTable`, `mergeInto`,
  `requires`/`excludes`, Ability-IDs zeigen auf existierende Einträge.
- **Enum-Gültigkeit:** alle `StatKey`/`EffectType`/`Rarity`/`EquipSlot` bekannt.
- **Sanity-Ranges:** keine negativen HP, Kosten ≥ 0, Gewichte > 0, Bin-Summe
  sinnvoll.
Fehlerhafter Content bricht den Build → kein "stiller" kaputter Eintrag bei
hunderten Items.

---

## Balancing-Philosophie
- **Zahlen leben in Daten, nicht in Logik.** Tuning = Datei editieren, kein
  Refactor.
- **Scaling-Profile** statt hartcodierter Formeln. Ein Profil beschreibt, wie ein
  Wert mit Welle/Level wächst:
```ts
interface ScalingProfile {
  id: string;
  hp:     ScalingCurve;   // z.B. { type:'exp', base:10, factor:1.15 }
  damage: ScalingCurve;
  count:  ScalingCurve;
  ballDrop: ScalingCurve;
}
type ScalingCurve =
  | { type: 'linear'; base: number; perWave: number }
  | { type: 'exp';    base: number; factor: number }
  | { type: 'table';  values: number[] };
```
- **Ökonomie-Leitplanken (Zielkorridore, zu tunen):**
  - Bälle aus Kampf wachsen ~ mit Gegner-Anzahl × `ballDrop`.
  - Drop-Phase soll im Schnitt einen **moderaten Multiplikator** liefern
    (z. B. ×2–×4 Median), mit hoher Varianz für Spannung.
  - Shop-Kosten skalieren mit Welle (`costScalingPerWave`), damit Bälle relevant
    bleiben.

---

## Near-Miss & Wahrnehmung (siehe auch docs/05)
- Wahrgenommene "Beinahe-Jackpots" werden über **Board-Layout** erzeugt, nicht
  über verdeckte Mathematik-Manipulation.
- Tuning-Hebel: Bin-Breiten/-Positionen, Peg-Jitter, Kamera-Fokus, SFX/Haptik bei
  großen Toren.

---

## Telemetrie für Balancing (später)
- Optionale, lokale Aggregation: durchschnittlicher Drop-Multiplikator, Win-Rate
  pro Welle, beliebteste Upgrades.
- Hilft, Korridore datenbasiert nachzujustieren (kein Online-Tracking nötig im MVP).

---

## Workflow zum Hinzufügen von Content (Beispiel: neuer Gegner)
1. `EnemyDef` in `content/enemies/enemies.<set>.ts` ergänzen (Sprite-Key, Stats,
   `ballDrop`, optional `lootTable`/`scalingProfile`).
2. In einer `WaveDef`/`LevelDef` referenzieren.
3. Asset (Sprite/Atlas) unter `public/assets/` ablegen, Atlas-Key matchen.
4. `validateContent()` läuft automatisch → meldet fehlende Referenzen.
5. Fertig — keine Engine-Änderung nötig.

Analog für Items (`ItemBaseDef` + Affixe + Loot-Tabelle), Upgrades
(`UpgradeDef` + `Effect[]`), Abilities, Boards.
