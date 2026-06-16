// Merge-System (docs/07): 3 identische Items (gleicher Typ, Rarität, Level) →
// 1 Item nächsthöherer Rarität (gleiches Level). Reine Logik, testbar.

import type { ItemInstance } from '@/types/content';
import { nextRarity } from './items';

export interface MergeGroup {
  baseId: string;
  rarity: ItemInstance['rarity'];
  level: number;
  instanceIds: string[]; // >= 3
}

const keyOf = (i: ItemInstance) => `${i.baseId}|${i.rarity}|${i.level}`;

/** Findet mergebare Gruppen (≥3 gleiche, nicht ausgerüstete Items). */
export function findMergeGroups(inventory: ItemInstance[], equippedIds: Set<string>): MergeGroup[] {
  const groups = new Map<string, ItemInstance[]>();
  for (const item of inventory) {
    if (equippedIds.has(item.instanceId)) continue;
    if (nextRarity(item.rarity) === null) continue; // Mythic ist nicht weiter mergebar
    const k = keyOf(item);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(item);
  }
  const result: MergeGroup[] = [];
  for (const items of groups.values()) {
    if (items.length >= 3) {
      result.push({
        baseId: items[0].baseId,
        rarity: items[0].rarity,
        level: items[0].level,
        instanceIds: items.slice(0, 3).map((i) => i.instanceId),
      });
    }
  }
  return result;
}

/** Prüft, ob die drei Instanzen eine gültige Merge-Gruppe bilden. */
export function canMerge(items: ItemInstance[]): boolean {
  if (items.length !== 3) return false;
  const [a] = items;
  if (nextRarity(a.rarity) === null) return false;
  return items.every((i) => i.baseId === a.baseId && i.rarity === a.rarity && i.level === a.level);
}
