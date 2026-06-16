// Loot (docs/07): besiegte Bosse droppen garantiert ein Item. Seedbar/rein.

import type { ItemInstance, Rarity } from '@/types/content';
import type { Rng } from '@/core/rng/Rng';
import { ITEMS } from '@/content/items';
import { createItemInstance } from './items';

// Boss-Drop: garantiert mindestens „rare", gewichtet nach oben.
const BOSS_RARITY_WEIGHTS: [Rarity, number][] = [
  ['rare', 50],
  ['epic', 30],
  ['legendary', 15],
  ['mythic', 5],
];

export function rollBossItem(rng: Rng): ItemInstance {
  const base = ITEMS[rng.intBetween(0, ITEMS.length - 1)];
  const rarity = rng.weightedPick(BOSS_RARITY_WEIGHTS, ([, w]) => w)[0];
  return createItemInstance(base.id, rarity, 1);
}
