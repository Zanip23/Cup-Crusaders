// Content-Schemas (docs/08 §3). Subset für M2 (Kampf). Defs sind statischer,
// per ID referenzierter Content; Instances (Laufzeit) liegen woanders.

import type { StatKey, Modifier, ModifierOp } from '@/core/stats/StatTypes';

/** Raritäten (5 Stufen, Common→Mythic, ADR-013). */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Skalierung auf den Basiseffekt (docs/07, docs/12). */
export const RARITY_SCALE: Record<Rarity, number> = {
  common: 1.0,
  rare: 1.25,
  epic: 1.6,
  legendary: 2.0,
  mythic: 2.4,
};

export type EquipSlot = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'ring';

export interface AffixDef {
  stat: StatKey;
  op: ModifierOp;
  valueByRarity: Record<Rarity, number>;
}

/** "Bauplan" eines Item-Typs (statischer Content). */
export interface ItemBaseDef {
  id: string;
  name: string;
  slot: EquipSlot;
  icon: string;
  baseAffixes: AffixDef[];
}

/** Konkretes Item im Inventar (Spielerbesitz, gespeichert). */
export interface ItemInstance {
  instanceId: string;
  baseId: string;
  rarity: Rarity;
  level: number;
  rolledAffixes: Modifier[]; // optionale Zufalls-Affixe (MVP: leer)
}

export type EffectType =
  | 'addModifier'
  | 'grantAbility'
  | 'onHit'
  | 'onKill'
  | 'onWaveStart'
  | 'gateMultiply'
  | 'gateAdd'
  | 'gateMystery'
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

export interface LevelBoardSelection {
  mode: 'generated' | 'fixed';
  /** Fallback oder festes Board aus BOARD_REGISTRY. */
  boardId?: string;
}

export interface LevelDef {
  id: string;
  name: string;
  chapter: number;
  waves: WaveDef[];
  /** Legacy/Fallback: festes Board aus BOARD_REGISTRY, wenn kein Generator genutzt wird. */
  boardId?: string;
  boardSelection?: LevelBoardSelection;
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

// ---- Pachinko-Board (docs/08 §3.6, docs/05) ------------------------------

export interface PegDef {
  x: number;
  y: number;
  radius: number;
}

export interface BoardMotionDef {
  type: 'horizontal' | 'vertical' | 'pingpong' | 'pulse';
  amplitude: number;
  durationMs: number;
  phaseOffsetMs?: number;
}

export interface GateDef {
  x: number;
  y: number;
  w: number;
  h: number;
  effect: Effect; // gateMultiply | gateAdd | gateMystery
  label: string;
  color?: number;
  motion?: BoardMotionDef;
}

export interface BoardBumperDef {
  x: number;
  y: number;
  radius: number;
  label?: string;
  effect?: Effect;
  color?: number;
}

export interface BoardRampDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  label?: string;
  effect?: Effect;
  color?: number;
}

export interface BoardPlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  label: string;
  effect: Effect;
  color?: number;
  motion?: BoardMotionDef;
}

export interface BoardBoosterDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  label: string;
  effect?: Effect;
  color?: number;
  motion?: BoardMotionDef;
}

export interface BoardBlockerDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  label?: string;
  effect?: Effect;
  color?: number;
  motion?: BoardMotionDef;
}

export interface BinDef {
  x: number; // linke Kante
  w: number;
  multiplier: number;
  label: string;
  special?: Effect;
}

export interface BoardDef {
  id: string;
  width: number;
  height: number;
  gravity: number;
  defaultRestitution: number; // Bounce
  pegs: PegDef[];
  gates: GateDef[];
  /** Catcher-Becher-Breite (Fang-Mund) in px. Default in der Szene, falls leer. */
  catcherWidth?: number;
  /** @deprecated Alte feste Bins (vor dem beweglichen Catcher). Optional, ungenutzt. */
  bins?: BinDef[];
  bumpers?: BoardBumperDef[];
  ramps?: BoardRampDef[];
  platforms?: BoardPlatformDef[];
  boosters?: BoardBoosterDef[];
  blockers?: BoardBlockerDef[];
  maxConcurrentBalls: number; // Performance-Cap (docs/05)
}
