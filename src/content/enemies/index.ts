// Gegner-Content (docs/12). Normals, ein Elite und zwei Bosse. Eigene Namen (ADR-012).
// baseStats sind Roh-Basiswerte VOR Rollen-/Wellen-Skalierung (siehe scaling.ts).

import type { EnemyDef } from '@/types/content';

export const MUG_GREMLIN: EnemyDef = {
  id: 'mug_gremlin',
  name: 'Mug Gremlin',
  role: 'normal',
  baseStats: { hp: 45, contactDamage: 10, moveSpeed: 1 },
  ballDrop: 3,
};

export const SHAMBLER: EnemyDef = {
  id: 'shambler',
  name: 'Shambler',
  role: 'normal',
  baseStats: { hp: 80, contactDamage: 9, moveSpeed: 1 },
  ballDrop: 4,
};

export const BONE_ARCHER: EnemyDef = {
  id: 'bone_archer',
  name: 'Bone Archer',
  role: 'normal',
  baseStats: { hp: 55, contactDamage: 12, moveSpeed: 1 },
  ballDrop: 3,
};

export const TOMB_KNIGHT: EnemyDef = {
  id: 'tomb_knight',
  name: 'Tomb Knight',
  role: 'elite',
  // ×2.2 HP / ×1.5 DMG (Elite-Mult) → ~180 HP / ~22 DMG (docs/12).
  baseStats: { hp: 82, contactDamage: 15, moveSpeed: 1 },
  ballDrop: 10,
};

export const BRIGAND_LORD: EnemyDef = {
  id: 'brigand_lord',
  name: 'Brigand Lord',
  role: 'boss',
  baseStats: { hp: 82, contactDamage: 12, moveSpeed: 1 }, // ×10/×2 → ~820 HP / 24 DMG
  ballDrop: 40,
};

export const ASH_WYRM: EnemyDef = {
  id: 'ash_wyrm',
  name: 'Ash Wyrm',
  role: 'boss',
  baseStats: { hp: 90, contactDamage: 15, moveSpeed: 1 }, // ×10/×2 → ~900 HP / 30 DMG
  ballDrop: 55,
};

export const ENEMIES: EnemyDef[] = [
  MUG_GREMLIN,
  SHAMBLER,
  BONE_ARCHER,
  TOMB_KNIGHT,
  BRIGAND_LORD,
  ASH_WYRM,
];

export const ENEMY_REGISTRY: Record<string, EnemyDef> = Object.fromEntries(
  ENEMIES.map((e) => [e.id, e]),
);
