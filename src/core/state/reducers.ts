// Reiner Reducer + Initial-State-Fabriken. Kein Phaser, keine Seiteneffekte
// → vollständig mit Vitest testbar (docs/02 Test-Strategie, docs/09).

import type { GameState, MetaState, RunState, SettingsState } from '@/types/state';
import { SAVE_VERSION } from '@/types/state';
import type { ItemInstance } from '@/types/content';
import { runRewardGold } from '@/systems/combat/rewards';
import { ITEM_REGISTRY } from '@/content/items';
import { createItemInstance, levelUpCost, nextRarity } from '@/systems/meta/items';
import { canMerge } from '@/systems/meta/merge';
import { META_SKILL_REGISTRY, metaSkillCost } from '@/content/metaSkills';
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
      // Drop schreibt ballsFromDrop und übergibt sie als Shop-Währung (inklusive gesparter Bälle).
      return {
        ...state,
        run: {
          ...state.run,
          phase: 'shop',
          currency: state.run.currency + action.balls,
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

    case 'ADVANCE_LEVEL':
      // Nächstes Level im selben Run: Upgrades bleiben, Welle/Transfer zurücksetzen.
      return {
        ...state,
        run: {
          ...state.run,
          phase: 'combat',
          levelId: action.levelId,
          totalWaves: action.totalWaves,
          waveNumber: 1,
          transfer: { ballsFromCombat: 0, ballsFromDrop: 0 },
        },
      };

    case 'END_RUN': {
      const gold = action.victory ? runRewardGold(state.run.totalWaves, true) : 0;
      // waveNumber wurde durch SHOP_COMPLETE bereits über die Bosswelle erhöht →
      // auf totalWaves klammern (sonst „Welle 16 von 15").
      const reached = Math.min(state.run.waveNumber, state.run.totalWaves || state.run.waveNumber);
      const highestLevel = Math.max(state.meta.highestLevel, reached);
      return {
        ...state,
        run: createMenuRun(),
        meta: {
          ...state.meta,
          highestLevel,
          currencies: { ...state.meta.currencies, gold: state.meta.currencies.gold + gold },
        },
      };
    }

    case 'GRANT_ITEM':
      return {
        ...state,
        meta: { ...state.meta, inventory: [...state.meta.inventory, action.item] },
      };

    case 'EQUIP_ITEM': {
      const inst = state.meta.inventory.find((i) => i.instanceId === action.instanceId);
      const def = inst && ITEM_REGISTRY[inst.baseId];
      if (!def) return state;
      return {
        ...state,
        meta: { ...state.meta, equipped: { ...state.meta.equipped, [def.slot]: action.instanceId } },
      };
    }

    case 'UNEQUIP_ITEM':
      return {
        ...state,
        meta: { ...state.meta, equipped: { ...state.meta.equipped, [action.slot]: null } },
      };

    case 'MERGE_ITEMS': {
      const items = action.instanceIds
        .map((id) => state.meta.inventory.find((i) => i.instanceId === id))
        .filter((i): i is ItemInstance => !!i);
      if (!canMerge(items)) return state;
      const equippedIds = new Set(Object.values(state.meta.equipped).filter(Boolean));
      if (items.some((i) => equippedIds.has(i.instanceId))) return state;
      const nr = nextRarity(items[0].rarity);
      if (!nr) return state;
      const remaining = state.meta.inventory.filter((i) => !action.instanceIds.includes(i.instanceId));
      const merged = createItemInstance(items[0].baseId, nr, items[0].level);
      return { ...state, meta: { ...state.meta, inventory: [...remaining, merged] } };
    }

    case 'LEVEL_ITEM': {
      const idx = state.meta.inventory.findIndex((i) => i.instanceId === action.instanceId);
      if (idx < 0) return state;
      const inst = state.meta.inventory[idx];
      const cost = levelUpCost(inst.level);
      const { gold, blueprints } = state.meta.currencies;
      if (gold < cost.gold || blueprints < cost.blueprints) return state;
      const inventory = state.meta.inventory.slice();
      inventory[idx] = { ...inst, level: inst.level + 1 };
      return {
        ...state,
        meta: {
          ...state.meta,
          inventory,
          currencies: { gold: gold - cost.gold, blueprints: blueprints - cost.blueprints },
        },
      };
    }

    case 'BUY_META_SKILL': {
      const def = META_SKILL_REGISTRY[action.skillId];
      if (!def) return state;
      const cur = state.meta.metaSkills[action.skillId] ?? 0;
      if (cur >= def.maxLevel) return state;
      const cost = metaSkillCost(def, cur);
      if (state.meta.currencies.gold < cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          currencies: { ...state.meta.currencies, gold: state.meta.currencies.gold - cost },
          metaSkills: { ...state.meta.metaSkills, [action.skillId]: cur + 1 },
        },
      };
    }

    default:
      return state;
  }
}
