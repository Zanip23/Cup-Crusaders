// Laufzeit-Instanzen & Ergebnis-Typen der Kampf-Phase (Def/Instance-Trennung).

import type { Effect, EnemyRole } from '@/types/content';

export interface EnemyInstance {
  instanceId: string;
  defId: string;
  name: string;
  role: EnemyRole;
  maxHp: number;
  hp: number;
  contactDamage: number;
  ballDrop: number;
  effects?: Effect[];
  alive: boolean;
}

/** Ergebnis eines einzelnen Helden-Treffers (für VFX in der Szene). */
export interface HitResult {
  targetId: string;
  damage: number;
  crit: boolean;
  killed: boolean;
  remainingHp: number; // Rest-HP des Ziels nach diesem Treffer (für HP-Balken)
  ballsDropped: number; // aus onHit-Chance + (bei kill) Tod-Drop + onKill
}

export interface HeroTurnResult {
  hits: HitResult[];
  healed: number;
  ballsCollected: number;
}

export interface EnemyAttack {
  enemyId: string;
  rawDamage: number;
  dealt: number; // nach Armor/Dodge
  dodged: boolean;
}

export interface EnemyTurnResult {
  attacks: EnemyAttack[];
  heroHp: number;
  heroDied: boolean;
}
