// Ausrüstungs-Items (docs/07). 6 Slots, je ein Basis-Affix. Eigene Namen (ADR-012).
// valueByRarity wird aus einem Basiswert × RARITY_SCALE erzeugt (DRY).

import type { AffixDef, ItemBaseDef, Rarity } from '@/types/content';
import { RARITY_SCALE } from '@/types/content';
import { StatKey } from '@/core/stats/StatTypes';
import type { ModifierOp } from '@/core/stats/StatTypes';

function byRarity(base: number): Record<Rarity, number> {
  return {
    common: base * RARITY_SCALE.common,
    rare: base * RARITY_SCALE.rare,
    epic: base * RARITY_SCALE.epic,
    legendary: base * RARITY_SCALE.legendary,
    mythic: base * RARITY_SCALE.mythic,
  };
}

const affix = (stat: StatKey, op: ModifierOp, base: number): AffixDef => ({
  stat,
  op,
  valueByRarity: byRarity(base),
});

export const ITEMS: ItemBaseDef[] = [
  {
    id: 'recurve_bow',
    name: 'Reflexbogen',
    slot: 'weapon',
    icon: '🏹',
    baseAffixes: [affix(StatKey.AttackDamage, 'flat', 8)],
  },
  {
    id: 'leather_cap',
    name: 'Lederkappe',
    slot: 'helmet',
    icon: '🪖',
    baseAffixes: [affix(StatKey.MaxHp, 'flat', 30)],
  },
  {
    id: 'scale_vest',
    name: 'Schuppenweste',
    slot: 'armor',
    icon: '🦺',
    baseAffixes: [affix(StatKey.MaxHp, 'flat', 20), affix(StatKey.Armor, 'flat', 10)],
  },
  {
    id: 'quick_gloves',
    name: 'Flinkhandschuhe',
    slot: 'gloves',
    icon: '🧤',
    baseAffixes: [affix(StatKey.AttackDamage, 'flat', 5)],
  },
  {
    id: 'trail_boots',
    name: 'Pfadstiefel',
    slot: 'boots',
    icon: '🥾',
    baseAffixes: [affix(StatKey.MaxHp, 'flat', 18), affix(StatKey.ExtraAttack, 'flat', 0.05)],
  },
  {
    id: 'keen_ring',
    name: 'Scharfsinn-Ring',
    slot: 'ring',
    icon: '💍',
    baseAffixes: [affix(StatKey.CritChance, 'flat', 0.04)],
  },
];

export const ITEM_REGISTRY: Record<string, ItemBaseDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);
