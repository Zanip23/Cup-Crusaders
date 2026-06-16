// Skalierungsformeln (docs/12). Bewusst flach → Build-Checks statt Statistikmauer.
// Reine Funktion, testbar.

import type { EnemyDef, ScalingProfile } from '@/types/content';

export const DEFAULT_SCALING: ScalingProfile = {
  id: 'standard',
  hpPerChapter: 1.11,
  dmgPerChapter: 1.09,
  hpPerWave: 0.07,
  dmgPerWave: 0.05,
  eliteHpMult: 2.2,
  eliteDmgMult: 1.5,
  bossHpMult: 10,
  bossDmgMult: 2.0,
};

export const SCALING_REGISTRY: Record<string, ScalingProfile> = {
  [DEFAULT_SCALING.id]: DEFAULT_SCALING,
};

export interface ScaledStats {
  hp: number;
  contactDamage: number;
}

/**
 * Skaliert die Basiswerte eines Gegners auf Kapitel/Welle (1-basiert).
 *   HP  = BaseHP  × hpPerChapter^(chapter-1)  × (1 + hpPerWave×(wave-1))  × roleHpMult
 *   DMG = BaseDMG × dmgPerChapter^(chapter-1) × (1 + dmgPerWave×(wave-1)) × roleDmgMult
 */
export function scaleEnemy(
  def: EnemyDef,
  wave: number,
  chapter: number,
  profile: ScalingProfile = DEFAULT_SCALING,
): ScaledStats {
  const hpChapter = Math.pow(profile.hpPerChapter, chapter - 1);
  const dmgChapter = Math.pow(profile.dmgPerChapter, chapter - 1);
  // Bosse sind Set-Piece-Encounter: nur Kapitel- + Rollen-Mult, KEINE Wellen-
  // Skalierung obendrauf (sonst stapelt sich ×Welle auf ×10 → unfair tanky).
  const isBoss = def.role === 'boss';
  const hpWave = isBoss ? 1 : 1 + profile.hpPerWave * (wave - 1);
  const dmgWave = isBoss ? 1 : 1 + profile.dmgPerWave * (wave - 1);

  let hpRole = 1;
  let dmgRole = 1;
  if (def.role === 'elite') {
    hpRole = profile.eliteHpMult;
    dmgRole = profile.eliteDmgMult;
  } else if (def.role === 'boss') {
    hpRole = profile.bossHpMult;
    dmgRole = profile.bossDmgMult;
  }

  return {
    hp: Math.round(def.baseStats.hp * hpChapter * hpWave * hpRole),
    contactDamage: Math.round(def.baseStats.contactDamage * dmgChapter * dmgWave * dmgRole),
  };
}
