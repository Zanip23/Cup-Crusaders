// MVP-Held „Fletcher" (Ranger-Starter, docs/12). Daten-Entity (ADR-006):
// reiner baseStats-Block, Signaturmechanik vorbereitet aber Post-MVP.

import type { HeroDef } from '@/types/content';
import { StatKey } from '@/core/stats/StatTypes';

export const FLETCHER: HeroDef = {
  id: 'fletcher',
  name: 'Fletcher',
  baseStats: {
    [StatKey.MaxHp]: 120,
    [StatKey.Armor]: 0,
    [StatKey.AttackDamage]: 18,
    [StatKey.ProjectileCount]: 1,
    [StatKey.CritChance]: 0.2,
    [StatKey.CritMultiplier]: 2.0,
    [StatKey.LifestealPct]: 0,
    [StatKey.Dodge]: 0,
    [StatKey.ExtraAttack]: 0,
    [StatKey.BallDropOnHitChance]: 0.15, // ADR-002 Startwert ~15 %
  },
};
