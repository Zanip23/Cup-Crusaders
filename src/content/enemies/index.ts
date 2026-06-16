// Gegner-Content für M2 (docs/12). 1 Normal + 1 Boss. Eigene Namen (ADR-012).

import type { EnemyDef } from '@/types/content';

export const MUG_GREMLIN: EnemyDef = {
  id: 'mug_gremlin',
  name: 'Mug Gremlin',
  role: 'normal',
  baseStats: { hp: 45, contactDamage: 10, moveSpeed: 1 },
  ballDrop: 3,
};

export const BRIGAND_LORD: EnemyDef = {
  id: 'brigand_lord',
  name: 'Brigand Lord',
  role: 'boss',
  // Boss-Multiplikatoren liegen im ScalingProfile; baseStats sind die Roh-Basis.
  baseStats: { hp: 82, contactDamage: 12, moveSpeed: 1 },
  ballDrop: 40, // großzügiger Boss-Drop (Bosskämpfe sind ball-ergiebig, ADR-002)
};

export const ENEMY_REGISTRY: Record<string, EnemyDef> = {
  [MUG_GREMLIN.id]: MUG_GREMLIN,
  [BRIGAND_LORD.id]: BRIGAND_LORD,
};
