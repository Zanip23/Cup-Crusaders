# 02 – Architektur

## Leitprinzip: State lebt *außerhalb* der Szenen

Die größte Falle bei Phaser: Spielstand in Szenen-Objekten verstecken. Szenen
werden zerstört/neu erzeugt → Datenverlust bei Übergängen.

**Lösung:** Ein zentraler, persistenter **`GameStateManager`** (Singleton), der die
Szenen überlebt. Szenen sind nur **Views + Input**; sie lesen/schreiben den
zentralen State über klar definierte Aktionen, **besitzen** ihn aber nicht.

```
                ┌─────────────────────────────┐
                │      GameStateManager        │  ← Single Source of Truth
                │   (überlebt Szenenwechsel)   │
                └─────────────────────────────┘
                  ▲          ▲          ▲          ▲
          dispatch(action) / select(state)   |   emit/on
                  │          │          │          │
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ BootScene│ │ Combat   │ │ DropScene│ │ ShopScene│ │ MetaScene│
   │          │ │ Scene    │ │ (Matter) │ │ (DOM)    │ │ (DOM)    │
   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                  └──────────────── EventBus ──────────────────┘
```

---

## Bausteine

### 1. `GameStateManager` (core/state)
- Hält den gesamten [Game State](09-game-state.md).
- Mutationen **nur** über typisierte Aktionen/Reducer (vorhersehbar, testbar).
- Verantwortlich für Persistenz via `SaveRepository` (IndexedDB, ADR-008).
- Stellt `select(...)`-Getter bereit; Szenen lesen nie rohe interne Felder.

### 2. `EventBus` (core/events)
- Dünner Wrapper um Phasers `EventEmitter`, global instanziiert.
- **Semantische Events** entkoppeln die Phasen. Eine Phase kennt nur ihr eigenes
  "Ich bin fertig", nicht die nächste Szene.
- Alle Event-Namen + Payloads sind **zentral typisiert** (ein
  `GameEvents`-Enum + Payload-Map), damit Producer/Consumer nicht driften.

### 3. `StatEngine` (core/stats) — siehe [08](08-data-schemas.md)
- Berechnet finale Stats aus Basiswerten + Modifikatoren (Items, Upgrades, Buffs).
- Wird von Kampf, Drop und Shop konsultiert. Eine einzige Wahrheit für Zahlen.

### 4. `EffectSystem` (core/effects) — siehe [08](08-data-schemas.md)
- Führt datengetriebene Effekt-Komponenten aus (Upgrades, Item-Affixe,
  Tor-Effekte). Composition over Inheritance.

### 5. Szenen (scenes/)
Eine Phaser-Scene pro Phase + Boot + Meta-Menü.

---

## Szenen-Übersicht

| Szene | Physik | Rendering | Aufgabe |
|---|---|---|---|
| `BootScene` | – | – | Assets laden, State init/laden, Routing zum Menü/Run |
| `MetaScene` | – | DOM | Hauptmenü: Ausrüstung, Merge, Upgrades, Run starten |
| `CombatScene` | Arcade | Canvas + DOM-HUD | Auto-Battler, Wellen, Ball-Drops, Ability-Deck |
| `DropScene` | **Matter** | Canvas + DOM-HUD | Pachinko: Becher, Pegs, Tore, Bins |
| `ShopScene` | – | DOM-Overlay | 3 Upgrade-Karten, Kauf/Skip |

> `ShopScene` läuft als **Overlay** via `scene.launch` (parallel), nicht
> `scene.start` — so bleibt der Kampf-Hintergrund sichtbar/eingefroren.

---

## Phasenübergänge (Event-getrieben)

Szenen feuern Events; der `GameStateManager` (bzw. ein `RunCoordinator`) reagiert,
persistiert und orchestriert den Szenenwechsel.

```
CombatScene ──emit(COMBAT_COMPLETE, { balls })──► speichert transfer.ballsFromCombat
                                                  └► scene.start('Drop')

DropScene   ──emit(DROP_COMPLETE,   { balls })──► speichert transfer.ballsFromDrop
                                                  └► run.currency = balls
                                                  └► scene.launch('Shop')

ShopScene   ──emit(SHOP_COMPLETE,   { pickedId? })─► EffectSystem.apply(upgrade)
                                                  └► run.waveNumber++
                                                  └► scene.start('Combat')

CombatScene ──emit(PLAYER_DIED)───────────────────► run beenden → MetaScene + Belohnungen
```

**Vorteil:** Neue Phase einschieben = nur Bus-Verdrahtung im `RunCoordinator`
ändern, keine Szene kennt die nächste.

---

## State-Machine des Runs

```
        ┌────────┐  start run   ┌────────┐
        │  MENU  ├─────────────►│ COMBAT │◄──────────────┐
        └────────┘              └───┬────┘               │
            ▲                       │ wave cleared       │ next wave
            │ player died /         ▼                    │
            │ run abandoned     ┌────────┐           ┌────────┐
            └───────────────────┤  SHOP  │◄──────────┤  DROP  │
                                └────────┘  drop done └────────┘
```

Diese Run-Status sind eine explizite Enum (`RunPhase`) im State, damit UI und
Speicher-Logik immer wissen, wo der Spieler steht (wichtig für *Resume after
reload*).

---

## Projektstruktur (Zielbild)

```
cup-crusaders/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── docs/                       ← diese Dokumentation
├── public/
│   └── assets/                 ← Sprites, Audio, Atlas
├── src/
│   ├── main.ts                 ← Phaser-Game-Config, Scene-Registry
│   ├── core/
│   │   ├── state/
│   │   │   ├── GameStateManager.ts
│   │   │   ├── reducers.ts
│   │   │   ├── actions.ts
│   │   │   └── selectors.ts
│   │   ├── events/
│   │   │   ├── EventBus.ts
│   │   │   └── GameEvents.ts        ← Event-Enum + Payload-Typen
│   │   ├── stats/
│   │   │   ├── StatEngine.ts
│   │   │   └── StatTypes.ts
│   │   ├── effects/
│   │   │   ├── EffectSystem.ts
│   │   │   └── effectHandlers/      ← je Effekt-Typ ein Handler
│   │   ├── rng/
│   │   │   └── Rng.ts               ← seedbarer PRNG (für faire/reproduzierbare Runs)
│   │   └── save/
│   │       └── SaveRepository.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MetaScene.ts
│   │   ├── CombatScene.ts
│   │   ├── DropScene.ts
│   │   └── ShopScene.ts
│   ├── entities/
│   │   ├── Hero.ts
│   │   ├── Enemy.ts
│   │   ├── Projectile.ts
│   │   ├── Ball.ts
│   │   ├── Peg.ts
│   │   ├── Gate.ts
│   │   └── Bin.ts
│   ├── systems/                ← Cross-Cutting Gameplay-Systeme
│   │   ├── WaveSpawner.ts
│   │   ├── CombatSystem.ts
│   │   ├── DropResolver.ts
│   │   └── AbilityDeck.ts
│   ├── content/                ← DATENGETRIEBENER CONTENT (siehe docs/08)
│   │   ├── enemies/
│   │   ├── items/
│   │   ├── upgrades/
│   │   ├── abilities/
│   │   ├── waves/
│   │   └── boards/
│   ├── ui/                     ← DOM-Overlays + CSS
│   │   ├── Hud.ts
│   │   ├── ShopOverlay.ts
│   │   ├── AbilityBar.ts
│   │   └── styles/
│   └── types/                  ← geteilte TS-Typen/Schemas
└── tests/
```

---

## Test-Strategie (kurz)
- **Reine Logik** (Reducer, StatEngine, EffectSystem, DropResolver-Mathematik)
  ist von Phaser entkoppelt → mit **Vitest** unit-testbar ohne Browser.
- **Determinismus:** Seedbarer `Rng` erlaubt reproduzierbare Tests von Drop- und
  Shop-Zufall.
- Physik-Verhalten und Rendering werden manuell/visuell getestet (später evtl.
  Playwright-Smoke-Tests).
