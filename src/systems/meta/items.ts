// Item-Instanzen & ihre Stat-Modifier (docs/07). Reine Logik, testbar.
// finaler Item-Stat = valueByRarity[rarity] × levelMultiplier(level) (+ Affixe).

import type { ItemInstance, Rarity } from '@/types/content';
import { RARITIES } from '@/types/content';
import type { Modifier } from '@/core/stats/StatTypes';
import { ITEM_REGISTRY } from '@/content/items';

const LEVEL_STEP = 0.15; // +15 % je Item-Level

export function levelMultiplier(level: number): number {
  return 1 + LEVEL_STEP * (level - 1);
}

function round1(v: number): number {
  return Math.round(v * 100) / 100;
}

export function nextRarity(r: Rarity): Rarity | null {
  const i = RARITIES.indexOf(r);
  return i >= 0 && i < RARITIES.length - 1 ? RARITIES[i + 1] : null;
}

let counter = 0;
function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  counter += 1;
  return `item_${Date.now()}_${counter}`;
}

export function createItemInstance(baseId: string, rarity: Rarity, level = 1): ItemInstance {
  return { instanceId: newId(), baseId, rarity, level, rolledAffixes: [] };
}

/** Berechnet die (Meta-)Modifier eines Items aus Def + Rarität + Level. */
export function itemModifiers(inst: ItemInstance): Modifier[] {
  const def = ITEM_REGISTRY[inst.baseId];
  if (!def) return [];
  const mult = levelMultiplier(inst.level);
  const mods: Modifier[] = def.baseAffixes.map((a) => ({
    stat: a.stat,
    op: a.op,
    value: round1(a.valueByRarity[inst.rarity] * mult),
    scope: 'meta' as const,
    sourceId: `item:${inst.instanceId}`,
  }));
  return [...mods, ...inst.rolledAffixes];
}

/** Gold-/Bauplan-Kosten für das nächste Item-Level. */
export function levelUpCost(level: number): { gold: number; blueprints: number } {
  return { gold: 40 * level, blueprints: level >= 3 ? Math.floor(level / 2) : 0 };
}
