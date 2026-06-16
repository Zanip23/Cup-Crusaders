// Reiner Reducer + Initial-State-Fabriken. Kein Phaser, keine Seiteneffekte
// → vollständig mit Vitest testbar (docs/02 Test-Strategie, docs/09).

import type { GameState, MetaState, RunState, SettingsState } from '@/types/state';
import { SAVE_VERSION } from '@/types/state';
import { runRewardGold } from '@/systems/combat/rewards';
import type { Action } from './actions';

export function createInitialMeta(): MetaState {
  return {
    highestLevel: 0,
    currencies: { gold: 0, blueprints: 0 },
    inventory: [],
    equipped: {},
    metaSkills: {},
    unlockedAbilities: [],
    stats: { runs: 0, kills: 0 },
  };
}

export function createInitialSettings(): SettingsState {
  return {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    haptics: true,
    language: 'de',
  };
}

/** Frischer Run im Menü-Zustand (noch nicht gestartet). */
export function createMenuRun(): RunState {
  return {
    phase: 'menu',
    levelId: '',
    waveNumber: 0,
    totalWaves: 0,
    seed: 0,
    currency: 0,
    hero: { currentHp: 0, shield: 0 },
    upgrades: [],
    transfer: { ballsFromCombat: 0, ballsFromDrop: 0 },
  };
}

export function createInitialState(): GameState {
  return {
    version: SAVE_VERSION,
    meta: createInitialMeta(),
    run: createMenuRun(),
    settings: createInitialSettings(),
  };
}

/**
 * Reiner Reducer. Gibt bei jeder Aktion einen NEUEN State zurück
 * (kein In-Place-Mutieren), damit Vergleiche/Tests vorhersehbar sind.
 */
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_RUN': {
      const run: RunState = {
        phase: 'combat',
        levelId: action.levelId,
        waveNumber: 1,
        totalWaves: action.totalWaves,
        seed: action.seed,
        currency: 0,
        hero: { currentHp: action.maxHp, shield: 0 },
        upgrades: [],
        transfer: { ballsFromCombat: 0, ballsFromDrop: 0 },
      };
      return {
        ...state,
        run,
        meta: { ...state.meta, stats: { ...state.meta.stats, runs: state.meta.stats.runs + 1 } },
      };
    }

    case 'RESET_RUN':
      return { ...state, run: createMenuRun() };

    case 'COMBAT_BALLS_COLLECTED':
      return {
        ...state,
        run: {
          ...state.run,
          transfer: {
            ...state.run.transfer,
            ballsFromCombat: state.run.transfer.ballsFromCombat + action.amount,
          },
        },
      };

    case 'SET_HERO_HP':
      return {
        ...state,
        run: { ...state.run, hero: { ...state.run.hero, currentHp: Math.max(0, action.hp) } },
      };

    case 'COMBAT_COMPLETE':
      // Kampf abgeschlossen → Phase Drop. ballsFromCombat ist bereits gefüllt.
      return { ...state, run: { ...state.run, phase: 'drop' } };

    case 'DROP_COMPLETE':
      // Drop schreibt ballsFromDrop und übergibt sie als Shop-Währung (docs/00, docs/09).
      return {
        ...state,
        run: {
          ...state.run,
          phase: 'shop',
          currency: action.balls,
          transfer: { ...state.run.transfer, ballsFromDrop: action.balls },
        },
      };

    case 'SHOP_BUY': {
      if (action.cost > state.run.currency) return state; // unbezahlbar → no-op
      return {
        ...state,
        run: {
          ...state.run,
          currency: state.run.currency - action.cost,
          upgrades: [...state.run.upgrades, action.upgradeId],
        },
      };
    }

    case 'SHOP_COMPLETE': {
      // Nächste Welle; transfer-Kanal für den nächsten Kampf zurücksetzen.
      const nextWave = state.run.waveNumber + 1;
      return {
        ...state,
        run: {
          ...state.run,
          phase: 'combat',
          waveNumber: nextWave,
          transfer: { ballsFromCombat: 0, ballsFromDrop: 0 },
        },
      };
    }

    case 'PLAYER_DIED': {
      const reachedLevel = Math.max(state.meta.highestLevel, state.run.waveNumber);
      // Wellen-Belohnung auch bei Niederlage (ADR-007).
      const gold = runRewardGold(state.run.waveNumber, false);
      return {
        ...state,
        run: { ...state.run, phase: 'gameover' },
        meta: {
          ...state.meta,
          highestLevel: reachedLevel,
          currencies: { ...state.meta.currencies, gold: state.meta.currencies.gold + gold },
        },
      };
    }

    default:
      return state;
  }
}
