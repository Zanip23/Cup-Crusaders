// Typisierte Aktionen — die EINZIGE Art, den State zu mutieren (docs/09).
// Reducer sind rein; Seiteneffekte (Szenenwechsel, SFX) hängen am EventBus.

import type { EquipSlot, ItemInstance } from '@/types/content';

export type Action =
  // Run-Lebenszyklus
  | { type: 'START_RUN'; levelId: string; totalWaves: number; seed: number; maxHp: number }
  | { type: 'RESET_RUN' }
  // Kampf-Phase: Bälle werden gesammelt, dann abgeschlossen
  | { type: 'COMBAT_BALLS_COLLECTED'; amount: number }
  | { type: 'SET_HERO_HP'; hp: number }
  | { type: 'COMBAT_COMPLETE' }
  // Drop-Phase: liefert die per Physik gefarmte Ballsumme
  | { type: 'DROP_COMPLETE'; balls: number }
  // Shop-Phase: Käufe ziehen Währung ab, Abschluss erhöht die Welle
  | { type: 'SHOP_BUY'; upgradeId: string; cost: number }
  | { type: 'SHOP_COMPLETE' }
  // Level-Progression (Boss besiegt → nächstes Level im selben Run)
  | { type: 'ADVANCE_LEVEL'; levelId: string; totalWaves: number }
  // Run-Ende
  | { type: 'PLAYER_DIED' }
  | { type: 'END_RUN'; victory: boolean }
  // Meta-Progression (permanent, gespeichert)
  | { type: 'GRANT_ITEM'; item: ItemInstance }
  | { type: 'EQUIP_ITEM'; instanceId: string }
  | { type: 'UNEQUIP_ITEM'; slot: EquipSlot }
  | { type: 'MERGE_ITEMS'; instanceIds: string[] }
  | { type: 'LEVEL_ITEM'; instanceId: string }
  | { type: 'BUY_META_SKILL'; skillId: string };

export type ActionType = Action['type'];
