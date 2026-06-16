// Orchestriert den Loop: lauscht auf semantische Events der Szenen, übersetzt
// sie in State-Aktionen und steuert die Szenenwechsel (docs/02 §Phasenübergänge).
//
// Wichtig: Szenen kennen die jeweils nächste Szene NICHT. Nur hier wird der
// Loop verdrahtet — neue Phase einschieben = nur hier ändern.

import type Phaser from 'phaser';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import type { GameStateManager } from '@/core/state/GameStateManager';
import { Rng } from '@/core/rng/Rng';
import { FLETCHER } from '@/content/heroes/fletcher';
import { StatKey } from '@/core/stats/StatTypes';
import { rollBossItem } from '@/systems/meta/loot';
import { LEVEL_REGISTRY, WORLD_1 } from '@/content/waves/world-1';

export const SceneKey = {
  Boot: 'Boot',
  Meta: 'Meta',
  Combat: 'Combat',
  Drop: 'Drop',
  Shop: 'Shop',
} as const;

const DEFAULT_HERO_HP = FLETCHER.baseStats[StatKey.MaxHp] ?? 100;

export class RunCoordinator {
  constructor(
    private readonly game: Phaser.Game,
    private readonly gsm: GameStateManager,
  ) {}

  /** Verbindet alle Loop-Events. Einmal beim Boot aufrufen. */
  wire(): void {
    eventBus.on(GameEvent.StartRun, ({ levelId }) => this.startNewRun(levelId));

    // Bälle werden während des Kampfes laufend gesammelt (Tod + Treffer-Chance).
    eventBus.on(GameEvent.CombatBallsCollected, ({ amount }) => {
      this.gsm.dispatch({ type: 'COMBAT_BALLS_COLLECTED', amount });
    });

    eventBus.on(GameEvent.HeroHpChanged, ({ hp }) => {
      this.gsm.dispatch({ type: 'SET_HERO_HP', hp });
    });

    eventBus.on(GameEvent.CombatComplete, () => {
      // Bälle sind via CombatBallsCollected bereits im transfer-Kanal.
      this.gsm.dispatch({ type: 'COMBAT_COMPLETE' });
      this.go(SceneKey.Drop);
    });

    eventBus.on(GameEvent.DropComplete, ({ balls }) => {
      this.gsm.dispatch({ type: 'DROP_COMPLETE', balls });
      this.go(SceneKey.Shop);
    });

    eventBus.on(GameEvent.ShopBuy, ({ upgradeId, cost }) => {
      this.gsm.dispatch({ type: 'SHOP_BUY', upgradeId, cost });
    });

    eventBus.on(GameEvent.ShopComplete, () => {
      const run = this.gsm.getState().run;
      const wasBoss = run.waveNumber >= run.totalWaves; // letzter (Boss-)Abschnitt
      this.gsm.dispatch({ type: 'SHOP_COMPLETE' });
      if (wasBoss) {
        this.endRun(true);
        return;
      }
      this.go(SceneKey.Combat);
    });

    eventBus.on(GameEvent.PlayerDied, () => {
      this.gsm.dispatch({ type: 'PLAYER_DIED' });
      this.go(SceneKey.Meta); // zurück ins Hauptmenü (Belohnung via Reducer)
    });
  }

  /** Run-Ende: bei Sieg garantierter Boss-Item-Drop, dann zurück ins Menü. */
  private endRun(victory: boolean): void {
    if (victory) {
      const seed = this.gsm.getState().run.seed;
      this.gsm.dispatch({ type: 'GRANT_ITEM', item: rollBossItem(new Rng(seed ^ 0x5eed)) });
    }
    this.gsm.dispatch({ type: 'END_RUN', victory });
    this.go(SceneKey.Meta);
  }

  /** Startet einen frischen Run. totalWaves kommt datengetrieben aus dem Level. */
  startNewRun(levelId?: string): void {
    const level = (levelId && LEVEL_REGISTRY[levelId]) || WORLD_1;
    this.gsm.dispatch({
      type: 'START_RUN',
      levelId: level.id,
      totalWaves: level.waves.length,
      seed: Rng.randomSeed(),
      maxHp: DEFAULT_HERO_HP,
    });
    this.go(SceneKey.Combat);
  }

  /** Routet an die zur gespeicherten Phase passende Szene (Resume after reload). */
  resumeOrStart(): void {
    const phase = this.gsm.getState().run.phase;
    switch (phase) {
      case 'combat':
        this.go(SceneKey.Combat);
        break;
      case 'drop':
        this.go(SceneKey.Drop);
        break;
      case 'shop':
        this.go(SceneKey.Shop);
        break;
      default:
        this.go(SceneKey.Meta); // menu / gameover → Hauptmenü
    }
  }

  private go(key: string): void {
    // WICHTIG: game.scene (SceneManager).start() stoppt die vorherige Szene NICHT
    // — es würde Szenen uebereinander stapeln. Daher erst alle aktiven Szenen
    // stoppen, dann die Ziel-Szene starten (entspricht dem Verhalten von
    // scene.scene.start() innerhalb einer Szene).
    const mgr = this.game.scene;
    mgr.getScenes(true).forEach((s) => mgr.stop(s.scene.key));
    mgr.start(key);
  }
}
