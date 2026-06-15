# 09 – Game State & Persistenz

Der zentrale State lebt im `GameStateManager` (siehe [02](02-architecture.md)) und
ist in **drei Scopes** geteilt:

- **`meta`** — permanent, wird gespeichert (überlebt Runs & Reloads).
- **`run`** — aktueller Durchlauf, verfällt bei Tod/Abbruch.
- **`settings`** — Spieleroptionen (gespeichert).

```
GameState
├── version            // Save-Schema-Version (Migration)
│
├── meta               // PERSISTENT (localStorage)
│   ├── highestLevel
│   ├── currencies
│   │   ├── gold
│   │   └── blueprints
│   ├── inventory: ItemInstance[]        // siehe docs/08
│   ├── equipped: Record<EquipSlot, instanceId | null>
│   ├── metaSkills: Record<string, number>   // freigeschaltete Meta-Skill-Stufen
│   ├── unlockedAbilities: string[]
│   └── stats                            // Telemetrie (Runs, Kills, ...)
│
├── run                // NUR während eines Runs (resetbar)
│   ├── phase: RunPhase                  // 'menu'|'combat'|'drop'|'shop'|'gameover'
│   ├── levelId
│   ├── waveNumber
│   ├── seed                             // für reproduzierbaren Rng
│   ├── currency                         // Bälle als Shop-Währung
│   ├── hero
│   │   ├── currentHp
│   │   └── shield
│   ├── upgrades: string[]               // gekaufte Run-Upgrade-IDs
│   └── transfer                         // EXPLIZITER Phasen-Übergabekanal
│       ├── ballsFromCombat              // Kampf → Drop
│       └── ballsFromDrop                // Drop → Shop
│
└── settings
    ├── sfxVolume / musicVolume
    ├── haptics: boolean
    └── language
```

---

## Der `transfer`-Kanal (kritischer Vertrag)
`transfer` modelliert die drei Ball-Übergaben **explizit**, statt sie über
mehrere Felder zu verstreuen:

```
Kampf  schreibt: transfer.ballsFromCombat   (Summe der Drops)
Drop   liest:    transfer.ballsFromCombat   (Munition)
Drop   schreibt: transfer.ballsFromDrop     (Σ Bins)
Shop   liest:    transfer.ballsFromDrop  →  run.currency
```
Vorteile: leicht testbar, leicht zu loggen, klare Verantwortlichkeit, und
*Resume after reload* kennt die exakte Zwischenmenge.

---

## RunPhase-Enum
```ts
type RunPhase = 'menu' | 'combat' | 'drop' | 'shop' | 'gameover';
```
- Wird bei jedem Phasenwechsel gesetzt.
- Erlaubt **Resume after reload**: Beim Boot kann (optional) der Run an der
  korrekten Phase fortgesetzt werden — zumindest aber sauber zum Menü/Run-Start
  zurückkehren, ohne korrupten Zustand.

---

## Mutationen: Aktionen & Reducer
- State wird **nur** über typisierte Aktionen geändert (vorhersehbar, testbar).
```ts
type Action =
  | { type: 'COMBAT_BALLS_COLLECTED'; amount: number }
  | { type: 'COMBAT_COMPLETE' }
  | { type: 'DROP_COMPLETE'; balls: number }
  | { type: 'SHOP_BUY'; upgradeId: string }
  | { type: 'SHOP_COMPLETE' }
  | { type: 'PLAYER_DIED' }
  | { type: 'EQUIP_ITEM'; instanceId: string; slot: EquipSlot }
  | { type: 'MERGE_ITEMS'; instanceIds: string[] }
  | ... ;
```
- Reducer sind **rein** (kein Phaser, keine Seiteneffekte) → mit Vitest testbar.
- Seiteneffekte (Szenenwechsel, SFX) hängen am EventBus, nicht im Reducer.

---

## Persistenz (SaveRepository)
- Interface `SaveRepository` kapselt Speicherung; Default-Impl. = **localStorage**.
- Gespeichert wird **`meta` + `settings`** (nicht der flüchtige `run` —
  optional als separater "Resume-Slot").
- **Throttled Autosave** (z. B. debounced bei relevanten Meta-Änderungen:
  Item erhalten, gemergt, gelevelt) — nicht jeden Frame.
- **Serialisierung:** nur **Instances/IDs** speichern, nie ganze Defs (Content
  kommt aus Registries). Hält Saves klein und robust gegen Content-Updates.

```ts
interface SaveRepository {
  load(): SavedState | null;
  save(state: SavedState): void;
  clear(): void;
}
```

---

## Save-Versionierung & Migration
- `GameState.version` + **Migrations-Pipeline** (`migrations[from→to]`).
- Beim Laden: wenn `saved.version < CURRENT` → Migrationsschritte anwenden.
- Unbekannte/zukünftige Version → defensives Fallback (frischer Start, Backup des
  alten Blobs), niemals Crash.
- Da nur IDs/Instances gespeichert werden, übersteht ein Save die meisten
  Content-Erweiterungen ohne Migration.

---

## Determinismus / Rng
- `run.seed` speist einen **seedbaren PRNG** (`core/rng/Rng.ts`).
- Drop-Streuung und Shop-Kartenziehung nutzen diesen Rng → reproduzierbare Runs,
  testbare Balancing-Szenarien, und (später) faire geteilte "Seed-Challenges".
