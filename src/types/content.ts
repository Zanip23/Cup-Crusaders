// Content-Schemas (docs/08 §3). Subset für M2 (Kampf). Defs sind statischer,
// per ID referenzierter Content; Instances (Laufzeit) liegen woanders.

import type { StatKey, Modifier } from '@/core/stats/StatTypes';

export type EffectType =
  | 'addModifier'
  | 'grantAbility'
  | 'onHit'
  | 'onKill'
  | 'onWaveStart'
  | 'gateMultiply'
  | 'gateAdd'
  | 'binCollect';

export interface Effect {
  type: EffectType;
  params: Record<string, unknown>;
}

export interface HeroDef {
  id: string;
  name: string;
  sprite?: string;
  baseStats: Partial<Record<StatKey, number>>;
  signature?: { name: string; effects: Effect[] };
  startingAbilities?: string[];
}

export type EnemyRole = 'normal' | 'elite' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  sprite?: string;
  role: EnemyRole;
  baseStats: {
    hp: number;
    contactDamage: number;
    moveSpeed: number;
  };
  ballDrop: number; // Bälle bei Tod
  effects?: Effect[]; // z.B. onHit/onKill am Gegner
}

export interface SpawnEntry {
  enemyId: string;
  count: number;
}

export interface WaveDef {
  id: string;
  spawns: SpawnEntry[];
  isBoss?: boolean;
}

export type DropCadence = 'everyWave' | 'levelEnd';

export interface LevelDef {
  id: string;
  name: string;
  chapter: number;
  waves: WaveDef[];
  boardId: string;
  dropCadence: DropCadence;
  scalingProfileId: string;
}

/** Skalierungs-Parameter (docs/12 §Skalierungsformeln). */
export interface ScalingProfile {
  id: string;
  hpPerChapter: number; // z.B. 1.11
  dmgPerChapter: number; // z.B. 1.09
  hpPerWave: number; // z.B. 0.07
  dmgPerWave: number; // z.B. 0.05
  eliteHpMult: number; // 2.2
  eliteDmgMult: number; // 1.5
  bossHpMult: number; // 10
  bossDmgMult: number; // 2.0
}

/** Laufzeit-Modifier, der aus einem addModifier-Effect erzeugt wird. */
export type RuntimeModifier = Omit<Modifier, 'scope'> & { scope?: Modifier['scope'] };
