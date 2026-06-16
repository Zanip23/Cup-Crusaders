// Zentrale State-Typen — Abbild von docs/09 (Game State & Persistenz).
// Drei Scopes: meta (persistent), run (flüchtig), settings (persistent).

import type { EquipSlot, ItemInstance } from './content';

export type RunPhase = 'menu' | 'combat' | 'drop' | 'shop' | 'gameover';

export type { EquipSlot } from './content';

/** Aktuelle Save-Schema-Version (Migration siehe SaveRepository / docs/09). */
export const SAVE_VERSION = 1;

export interface MetaState {
  highestLevel: number;
  currencies: {
    gold: number;
    blueprints: number;
  };
  // Inventar/Equip kommen in M5 (Meta-Progression) inhaltlich dazu;
  // Felder bleiben hier vorbereitet, damit die Save-Form stabil ist.
  inventory: ItemInstance[];
  equipped: Partial<Record<EquipSlot, string | null>>;
  metaSkills: Record<string, number>;
  unlockedAbilities: string[];
  stats: {
    runs: number;
    kills: number;
  };
}

export interface RunHeroState {
  currentHp: number;
  shield: number;
}

/** Expliziter Phasen-Übergabekanal (kritischer Vertrag, docs/09 §transfer). */
export interface TransferState {
  ballsFromCombat: number; // Kampf → Drop (Munition)
  ballsFromDrop: number; // Drop → Shop (Σ Bins)
}

export interface RunState {
  phase: RunPhase;
  levelId: string;
  waveNumber: number;
  totalWaves: number;
  seed: number;
  currency: number; // Bälle als Shop-Währung
  hero: RunHeroState;
  upgrades: string[]; // gekaufte Run-Upgrade-IDs
  transfer: TransferState;
}

export interface SettingsState {
  sfxVolume: number;
  musicVolume: number;
  haptics: boolean;
  language: string;
}

export interface GameState {
  version: number;
  meta: MetaState;
  run: RunState;
  settings: SettingsState;
}

/** Was wirklich gespeichert wird (docs/09): meta + settings, run als Resume-Slot. */
export interface SavedState {
  version: number;
  meta: MetaState;
  settings: SettingsState;
  run: RunState | null;
}
