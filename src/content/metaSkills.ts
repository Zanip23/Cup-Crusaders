// Permanente Passiv-Skills (docs/07). Fließen als scope:'meta'-Modifier in die
// StatEngine und gelten ab Run-Start. Mit Gold freischaltbar.

import type { Modifier, ModifierOp } from '@/core/stats/StatTypes';
import { StatKey } from '@/core/stats/StatTypes';

export interface MetaSkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  stat: StatKey;
  op: ModifierOp;
  valuePerLevel: number;
  maxLevel: number;
  goldPerLevel: number;
}

export const META_SKILLS: MetaSkillDef[] = [
  {
    id: 'might',
    name: 'Stärke',
    description: '+3 Angriffsschaden je Stufe',
    icon: '⚔️',
    stat: StatKey.AttackDamage,
    op: 'flat',
    valuePerLevel: 3,
    maxLevel: 5,
    goldPerLevel: 60,
  },
  {
    id: 'vigor',
    name: 'Zähigkeit',
    description: '+15 max. HP je Stufe',
    icon: '❤️',
    stat: StatKey.MaxHp,
    op: 'flat',
    valuePerLevel: 15,
    maxLevel: 5,
    goldPerLevel: 60,
  },
  {
    id: 'guard',
    name: 'Wache',
    description: '+5 Rüstung je Stufe',
    icon: '🛡️',
    stat: StatKey.Armor,
    op: 'flat',
    valuePerLevel: 5,
    maxLevel: 5,
    goldPerLevel: 50,
  },
];

export const META_SKILL_REGISTRY: Record<string, MetaSkillDef> = Object.fromEntries(
  META_SKILLS.map((s) => [s.id, s]),
);

/** Erzeugt die permanenten Modifier aus den freigeschalteten Meta-Skill-Stufen. */
export function metaSkillModifiers(levels: Record<string, number>): Modifier[] {
  const mods: Modifier[] = [];
  for (const [id, level] of Object.entries(levels)) {
    const def = META_SKILL_REGISTRY[id];
    if (!def || level <= 0) continue;
    mods.push({
      stat: def.stat,
      op: def.op,
      value: def.valuePerLevel * level,
      scope: 'meta',
      sourceId: `metaSkill:${id}`,
    });
  }
  return mods;
}

export function metaSkillCost(def: MetaSkillDef, currentLevel: number): number {
  return def.goldPerLevel * (currentLevel + 1);
}
