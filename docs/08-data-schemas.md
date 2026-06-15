# 08 – Daten-Schemas (Content-Backbone)

> **Das wichtigste Architektur-Dokument.** Es definiert, wie sich *hunderte* Items,
> Gegner, Upgrades und Abilities **rein über Daten** hinzufügen lassen, ohne
> Engine-Code zu ändern.

Die zwei tragenden Säulen:

1. **Stat- & Modifier-System** — eine einzige Wahrheit für alle Zahlen.
2. **Effekt-/Komponenten-System** — Verhalten als komponierbare Daten
   (Composition over Inheritance).

Alle Schemas sind **TypeScript-Interfaces** (Pseudocode, zur Implementierung).
Content liegt als typisierte Module/JSON unter `src/content/`.

---

## 1. Stat- & Modifier-System

### 1.1 Stat-Keys
Eine **geschlossene Enum** aller Stats. Neue Stats sind eine bewusste
Engine-Erweiterung; Content benutzt nur existierende Keys.

```ts
enum StatKey {
  // Held / Kampf
  MaxHp, Armor, AttackDamage, AttackSpeed, ProjectileCount,
  Pierce, RicochetBounces, CritChance, CritMultiplier, LifestealPct,
  Dodge, Execute, Thorns, ExtraAttack, SummonPower,
  // Pachinko
  StartingBalls, PegDensity, MagnetStrength, BallRestitution,
  // Ökonomie
  BallDropBonus, BallDropOnHitChance, GoldFind, BlueprintFind, Rerolls,
}
```

### 1.1a Balance-Caps (gegen Endgame-Degeneration)
Aus den dokumentierten Meta-Problemen des Vorbilds (Execute-/Reflect-/%-Builds)
abgeleitet ([ADR-010](decisions.md)). Caps werden **in der StatEngine** nach der
Berechnung als Klammerung (`clamp`) erzwungen:

| Stat | Cap | Anmerkung |
|---|---|---|
| effektive Schadensreduktion (aus Armor) | **75 %** | Formel: `dmg × 100 / (100 + Armor)` |
| Dodge | **35 %** | Boss-Angriffe ignorieren 50 % Dodge |
| Lifesteal | **20 %** | kein Heal aus Reflect/Thorns |
| Execute (Non-Boss) | **9 %** | gegen Bosse **nie tödlich** → True-Damage-Conversion |
| Thorns | **50 %** | vor Armor des Gegners, gecappt |
| CritChance | **60 %** (soft) | darüber abnehmender Ertrag |
| Rerolls (gespeichert) | **5** | nie per Echtgeld |

> Diese Caps sind **Daten** (eine `StatCaps`-Tabelle), kein Code-Branch — Tuning
> ohne Refactor. Siehe [10 – Balancing](10-content-pipeline-and-balancing.md).

### 1.2 Modifier
Jeder Bonus im Spiel ist ein **Modifier**. Quelle und Lebensdauer sind explizit.

```ts
type ModifierOp = 'flat' | 'percentAdd' | 'percentMult';
//  flat        : +5            (addiert auf Basis)
//  percentAdd  : +10%          (alle percentAdd werden summiert, dann angewandt)
//  percentMult : ×1.10         (multiplikativ, stapelt multiplikativ)

type ModifierScope = 'meta' | 'run' | 'buff';
//  meta : permanent (Items, Meta-Skills)
//  run  : bis Run-Ende (Shop-Upgrades)
//  buff : temporär/zeitlich (Abilities, Statuseffekte)

interface Modifier {
  stat: StatKey;
  op: ModifierOp;
  value: number;
  scope: ModifierScope;
  sourceId: string;     // z.B. 'item:sword_01', 'upgrade:multishot'
  expiresAt?: number;   // optional für 'buff' (ms-Timestamp / Ticks)
}
```

### 1.3 Berechnungsreihenfolge (kanonisch)
```
final = ( base + Σ flat )
        × ( 1 + Σ percentAdd )
        × Π ( percentMult )
```
- Erst alle `flat` addieren, dann **summierte** `percentAdd` als ein Faktor,
  dann alle `percentMult` multiplikativ.
- Diese Reihenfolge ist **fix dokumentiert**, damit Balancing vorhersehbar ist und
  Stacking-Bugs vermieden werden.

### 1.4 StatEngine-API (konzeptionell)
```ts
class StatEngine {
  setBase(stats: Partial<Record<StatKey, number>>): void;
  addModifier(m: Modifier): void;
  removeBySource(sourceId: string): void;
  clearScope(scope: ModifierScope): void;   // z.B. 'run' beim Run-Ende
  get(stat: StatKey): number;                // berechnet final (memoized)
  snapshot(): Record<StatKey, number>;
}
```
Run-Ende ruft `clearScope('run')`; Meta-Modifier bleiben. Das ist der ganze
"Reset zwischen Runs" für Stats.

---

## 2. Effekt-/Komponenten-System

Verhalten ist **nicht** in Subklassen, sondern in **Effekt-Komponenten** kodiert.
Ein Upgrade, ein Item-Affix oder ein Tor "hat" eine Liste von Effekten.

```ts
type EffectType =
  | 'addModifier'        // fügt Modifier hinzu (häufigster Fall)
  | 'grantAbility'       // schaltet eine Ability frei
  | 'onHit'              // triggert bei Treffer (z.B. Lifesteal, Ricochet)
  | 'onKill'             // triggert bei Kill (z.B. Bonus-Ball)
  | 'onWaveStart'        // triggert zu Wellenbeginn
  | 'gateMultiply'       // Drop-Tor: ball.value *= x
  | 'gateAdd'            // Drop-Tor: ball.value += n
  | 'binCollect';        // Bin: contribution = value * mult

interface Effect {
  type: EffectType;
  params: Record<string, unknown>;   // typgeprüft pro Handler
}
```

- Pro `EffectType` gibt es **einen Handler** unter
  `core/effects/effectHandlers/`. Neuer Effekt = neuer Handler (selten);
  neuer Content = nur neue Daten (häufig).
- `onHit`/`onKill` etc. werden vom CombatSystem an definierten **Hook-Punkten**
  aufgerufen → ermöglicht komplexe Item-/Upgrade-Synergien ohne if-Wüsten.

---

## 3. Content-Schemas

### 3.0 Hero
**Scope-Entscheidung ([ADR-006](decisions.md)):** Launch mit **einem** Helden,
aber als **Daten-Entity** modelliert, damit weitere Helden später ohne
Engine-Umbau hinzukommen. Der Held ist die Quelle der Basis-Stats, in die alle
Modifier fließen.

```ts
interface HeroDef {
  id: string;                  // 'archer'
  name: string;
  sprite: string;              // Atlas-Key (Idle/Attack/Hit/Death/Cast)
  baseStats: Partial<Record<StatKey, number>>;   // Basis vor Modifiern
  signature?: {                // optionale Signaturmechanik (Post-MVP)
    name: string;
    effects: Effect[];
  };
  startingAbilities?: string[];   // Ability-IDs für den Active Ability Deck
  levelBreakpoints?: number[];    // Stufen mit Power-Spikes (z.B. 3,5,8,11,15)
}
```
> Der **eine** MVP-Held nutzt nur `baseStats`; `signature`/Roster sind vorbereitet,
> aber nicht im MVP-Scope.

### 3.1 Enemy
```ts
interface EnemyDef {
  id: string;                  // 'goblin_basic'
  name: string;
  sprite: string;              // Atlas-Key
  role: 'normal' | 'elite' | 'boss';
  baseStats: {
    hp: number;
    contactDamage: number;
    moveSpeed: number;
  };
  ballDrop: number;            // Bälle bei Tod
  attack?: {                   // optional: Fernkampf-Gegner
    type: 'melee' | 'ranged';
    damage: number;
    range: number;
    cooldown: number;
  };
  abilities?: string[];        // Ability-IDs (Boss-Spezialfähigkeiten)
  lootTable?: string;          // ID einer Loot-Tabelle (Item-Drops)
  scalingProfile?: string;     // Verweis auf Scaling-Kurve (siehe docs/10)
}
```

### 3.2 Wave
```ts
interface SpawnEntry {
  enemyId: string;
  count: number;
  delayMs: number;             // Abstand zwischen Spawns dieses Eintrags
  startAtMs?: number;          // Offset ab Wellenbeginn
}

interface WaveDef {
  id: string;
  spawns: SpawnEntry[];
  isBoss?: boolean;
}

interface LevelDef {
  id: string;                  // 'world_1'
  name: string;
  waves: WaveDef[];            // letzte Welle typischerweise isBoss
  boardId: string;             // welches Pachinko-Board für die Drop-Phase
  dropCadence: 'everyWave' | 'levelEnd';
  difficultyScaling: string;   // Scaling-Profil-ID
}
```

### 3.3 Upgrade (Shop / Run-Scope)
```ts
interface UpgradeDef {
  id: string;
  name: string;
  description: string;         // i18n-Key oder Text
  icon: string;
  rarity: Rarity;
  category: 'combat' | 'pachinko' | 'passive';
  cost: number;                // Basiskosten (Bälle), skaliert via docs/10
  effects: Effect[];           // i.d.R. addModifier(scope:'run')
  maxStacks?: number;          // wie oft kaufbar
  weight?: number;             // Pool-Ziehgewicht (Default aus Rarität)
  requires?: string[];         // Voraussetzungs-Upgrade-IDs
  excludes?: string[];         // gegenseitiger Ausschluss
}
```

### 3.4 Item (Ausrüstung / Meta-Scope)
```ts
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
type EquipSlot = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'ring';

interface AffixDef {
  stat: StatKey;
  op: ModifierOp;
  valueByRarity: Record<Rarity, number>;  // skaliert mit Rarität
}

interface ItemBaseDef {                    // "Bauplan" eines Item-Typs
  id: string;                              // 'sword'
  name: string;
  slot: EquipSlot;
  icon: string;
  baseAffixes: AffixDef[];                 // garantierte Stats
  randomAffixPool?: AffixDef[];            // optionale Roll-Affixe
  affixCountByRarity?: Record<Rarity, number>;
  mergeInto?: string;                      // i.d.R. derselbe base, höhere Rarity
}

interface ItemInstance {                   // konkretes Item im Inventar
  instanceId: string;                      // UUID
  baseId: string;                          // -> ItemBaseDef
  rarity: Rarity;
  level: number;                           // Item-Level (hochlevelbar)
  rolledAffixes: Modifier[];               // konkret gerollte Werte
}
```
- **Trennung Def vs. Instance** ist zentral: Defs sind statischer Content,
  Instances sind veränderlicher Spielerbesitz (gespeichert).

### 3.5 Ability (Active Ability Deck — Post-MVP)
```ts
interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  targeting: 'self' | 'point' | 'enemy' | 'global';
  cooldownMs: number;
  effects: Effect[];           // z.B. addModifier(scope:'buff'), Damage, Heal
  durationMs?: number;         // für Buff-Abilities
}
```

### 3.6 Board (Pachinko)
```ts
interface PegDef   { x: number; y: number; radius: number; }
interface GateDef  { x: number; y: number; w: number; h: number; effect: Effect; label: string; }
interface BinDef   { x: number; w: number; multiplier: number; special?: Effect; label: string; }

interface BoardDef {
  id: string;
  width: number; height: number;
  gravity: number;
  defaultRestitution: number;  // Bounce
  pegs: PegDef[];              // oder generiert via 'pegPattern'
  pegPattern?: { type: 'grid' | 'staggered'; rows: number; cols: number; jitter: number; };
  gates: GateDef[];
  bins: BinDef[];
  maxConcurrentBalls: number;  // Performance-Cap (siehe docs/05)
}
```

### 3.7 Loot-Tabelle
```ts
interface LootEntry { itemBaseId: string; rarity: Rarity; weight: number; }
interface LootTableDef {
  id: string;
  guaranteed?: LootEntry[];    // z.B. Boss: garantiertes Item
  rolls: number;               // Anzahl Ziehungen
  pool: LootEntry[];
}
```

---

## 4. Content-Registry & Validierung
- Alle Defs werden beim Boot in **typisierte Registries** geladen
  (`EnemyRegistry`, `ItemRegistry`, `UpgradeRegistry`, …) und per **ID** referenziert.
- **ID-Konvention:** `kebab_case`, präfixiert nach Typ in Referenzen
  (`item:sword`, `upgrade:multishot`, `enemy:goblin_basic`).
- **Validierungs-Schritt** (Dev/Build): prüft auf doppelte IDs, fehlende
  Referenzen (z. B. `mergeInto` zeigt ins Leere), unbekannte `StatKey`/`EffectType`.
  Verhindert kaputten Content bei großer Menge. Siehe
  [10 – Content-Pipeline](10-content-pipeline-and-balancing.md).

---

## 5. Warum dieses Design hunderte Einträge trägt
- **Eine Stat-Wahrheit:** jeder neue Bonus ist nur ein `Modifier` → kein
  Sonderfall im Kampf-/Drop-Code.
- **Eine Verhaltens-Wahrheit:** jedes neue Verhalten ist eine `Effect`-Komponente,
  ausgeführt von einem bestehenden Handler.
- **Def/Instance-Trennung:** statischer Content vs. Spielerbesitz sauber getrennt
  (kleine, robuste Saves — siehe [09](09-game-state.md)).
- **Daten, nicht Code:** Content-Autoren fügen Einträge hinzu; Engine bleibt stabil.
