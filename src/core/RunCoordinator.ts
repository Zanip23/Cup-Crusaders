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

export const SceneKey = {
  Boot: 'Boot',
  Combat: 'Combat',
  Drop: 'Drop',
  Shop: 'Shop',
} as const;

// M1-Standard: Welt 1 mit 15 Wellen (14 + Boss), ADR-007.
const DEFAULT_LEVEL = 'world_1';
const DEFAULT_TOTAL_WAVES = 15;
const DEFAULT_HERO_HP = FLETCHER.baseStats[StatKey.MaxHp] ?? 100;

export class RunCoordinator {
  constructor(
    private readonly game: Phaser.Game,
    private readonly gsm: GameStateManager,
  ) {}

  /** Verbindet alle Loop-Events. Einmal beim Boot aufrufen. */
  wire(): void {
    eventBus.on(GameEvent.StartRun, () => this.startNewRun());

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
      this.gsm.dispatch({ type: 'SHOP_COMPLETE' });
      this.go(SceneKey.Combat);
    });

    eventBus.on(GameEvent.PlayerDied, () => {
      this.gsm.dispatch({ type: 'PLAYER_DIED' });
      // M1: kein Meta-Menü → direkt neuen Run starten.
      this.startNewRun();
    });
  }

  /** Startet einen frischen Run (oder setzt ihn nach Reload an der Phase fort). */
  startNewRun(): void {
    this.gsm.dispatch({
      type: 'START_RUN',
      levelId: DEFAULT_LEVEL,
      totalWaves: DEFAULT_TOTAL_WAVES,
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
        this.startNewRun();
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
