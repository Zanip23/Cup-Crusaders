// Run-Upgrades für den Shop (docs/06, docs/08 §3.3, docs/12). Eigene Namen (ADR-012).
// Effekte sind addModifier(scope:'run') → wirken über die StatEngine ab der
// nächsten Welle. Mind. eine Karte je Kategorie (combat/pachinko/passive).

import type { Effect, Rarity } from '@/types/content';
import { StatKey } from '@/core/stats/StatTypes';
import type { ModifierOp } from '@/core/stats/StatTypes';

export type UpgradeCategory = 'combat' | 'pachinko' | 'passive';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji (MVP; Pixel-Icons später)
  rarity: Rarity;
  category: UpgradeCategory;
  cost: number; // Basiskosten (Bälle), skaliert via docs/10
  effects: Effect[];
  maxStacks?: number;
  weight?: number;
  requires?: string[];
  excludes?: string[];
}

const mod = (stat: StatKey, op: ModifierOp, value: number): Effect => ({
  type: 'addModifier',
  params: { stat, op, value },
});

export const UPGRADES: UpgradeDef[] = [
  // — Kampf —
  {
    id: 'multishot',
    name: 'Mehrfachschuss',
    description: '+1 Projektil pro Zug',
    icon: '🏹',
    rarity: 'epic',
    category: 'combat',
    cost: 180,
    maxStacks: 3,
    effects: [mod(StatKey.ProjectileCount, 'flat', 1)],
  },
  {
    id: 'sharpshooter',
    name: 'Scharfschütze',
    description: '+8 % Krit-Chance',
    icon: '🎯',
    rarity: 'common',
    category: 'combat',
    cost: 40,
    maxStacks: 4,
    effects: [mod(StatKey.CritChance, 'flat', 0.08)],
  },
  {
    id: 'salvo',
    name: 'Salve',
    description: '+20 % Zusatzangriff-Chance',
    icon: '⚡',
    rarity: 'rare',
    category: 'combat',
    cost: 90,
    maxStacks: 3,
    effects: [mod(StatKey.ExtraAttack, 'flat', 0.2)],
  },
  {
    id: 'bloodfletch',
    name: 'Blutgefieder',
    description: '+8 % Lebensraub',
    icon: '🩸',
    rarity: 'epic',
    category: 'combat',
    cost: 180,
    maxStacks: 3,
    effects: [mod(StatKey.LifestealPct, 'flat', 0.08)],
  },
  // — Pachinko —
  {
    id: 'extra_ammo',
    name: 'Extra-Munition',
    description: '+5 Start-Bälle im Drop',
    icon: '🏐',
    rarity: 'common',
    category: 'pachinko',
    cost: 40,
    maxStacks: 5,
    effects: [mod(StatKey.StartingBalls, 'flat', 5)],
  },
  // — Passiv —
  {
    id: 'vital_surge',
    name: 'Vitalstrom',
    description: '+25 % maximale HP',
    icon: '❤️',
    rarity: 'common',
    category: 'passive',
    cost: 40,
    maxStacks: 4,
    effects: [mod(StatKey.MaxHp, 'percentAdd', 0.25)],
  },
  {
    id: 'power_throw',
    name: 'Wuchtwurf',
    description: '+15 % Angriffsschaden',
    icon: '💪',
    rarity: 'common',
    category: 'passive',
    cost: 40,
    maxStacks: 5,
    effects: [mod(StatKey.AttackDamage, 'percentAdd', 0.15)],
  },
  {
    id: 'iron_skin',
    name: 'Eisenhaut',
    description: '+20 Rüstung',
    icon: '🛡️',
    rarity: 'rare',
    category: 'passive',
    cost: 90,
    maxStacks: 3,
    effects: [mod(StatKey.Armor, 'flat', 20)],
  },
];

export const UPGRADE_REGISTRY: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
