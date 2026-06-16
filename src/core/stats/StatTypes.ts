// Stat- & Modifier-System (docs/08 §1). Eine geschlossene Enum aller Stats;
// jeder Bonus im Spiel ist ein Modifier. Reine Daten/Logik, Phaser-entkoppelt.

export enum StatKey {
  // Held / Kampf
  MaxHp = 'MaxHp',
  Armor = 'Armor',
  AttackDamage = 'AttackDamage',
  AttackSpeed = 'AttackSpeed',
  ProjectileCount = 'ProjectileCount',
  Pierce = 'Pierce',
  RicochetBounces = 'RicochetBounces',
  CritChance = 'CritChance',
  CritMultiplier = 'CritMultiplier',
  LifestealPct = 'LifestealPct',
  Dodge = 'Dodge',
  Execute = 'Execute',
  Thorns = 'Thorns',
  ExtraAttack = 'ExtraAttack',
  SummonPower = 'SummonPower',
  // Pachinko
  StartingBalls = 'StartingBalls',
  PegDensity = 'PegDensity',
  MagnetStrength = 'MagnetStrength',
  BallRestitution = 'BallRestitution',
  // Ökonomie
  BallDropBonus = 'BallDropBonus',
  BallDropOnHitChance = 'BallDropOnHitChance',
  GoldFind = 'GoldFind',
  BlueprintFind = 'BlueprintFind',
  Rerolls = 'Rerolls',
}

export type ModifierOp = 'flat' | 'percentAdd' | 'percentMult';
export type ModifierScope = 'meta' | 'run' | 'buff';

export interface Modifier {
  stat: StatKey;
  op: ModifierOp;
  value: number;
  scope: ModifierScope;
  sourceId: string;
  expiresAt?: number;
}

/**
 * Harte Caps gegen Endgame-Degeneration (ADR-010, docs/08 §1.1a).
 * Werden in der StatEngine NACH der Berechnung als clamp erzwungen — reine Daten.
 * (Armor-basierte Schadensreduktion wird im Combat über die DR-Formel gecappt,
 * nicht hier, da `Armor` selbst nicht gedeckelt ist.)
 */
export const STAT_CAPS: Partial<Record<StatKey, number>> = {
  [StatKey.Dodge]: 0.35,
  [StatKey.LifestealPct]: 0.2,
  [StatKey.Execute]: 0.09,
  [StatKey.Thorns]: 0.5,
  [StatKey.CritChance]: 0.6,
  [StatKey.Rerolls]: 5,
};

/** Maximale effektive Schadensreduktion aus Armor (docs/08 §1.1a). */
export const MAX_ARMOR_DR = 0.75;
