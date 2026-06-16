// Welt 1 „Waldpfad" — 15 Wellen (14 Normal + Boss), docs/12.
// M2 nutzt nur Mug Gremlin + Brigand Lord; Anzahl steigt moderat (snappy Fights).

import type { LevelDef, WaveDef } from '@/types/content';

const TOTAL_WAVES = 15;

function buildWaves(): WaveDef[] {
  const waves: WaveDef[] = [];
  for (let n = 1; n <= TOTAL_WAVES - 1; n++) {
    // Anzahl wächst von 2 bis ~6, gedeckelt für lesbare Rundenkämpfe.
    const count = Math.min(2 + Math.floor(n / 2), 6);
    waves.push({ id: `w1_wave_${n}`, spawns: [{ enemyId: 'mug_gremlin', count }] });
  }
  waves.push({ id: 'w1_boss', spawns: [{ enemyId: 'brigand_lord', count: 1 }], isBoss: true });
  return waves;
}

export const WORLD_1: LevelDef = {
  id: 'world_1',
  name: 'Waldpfad',
  chapter: 1,
  waves: buildWaves(),
  boardId: 'board_basic',
  dropCadence: 'everyWave',
  scalingProfileId: 'standard',
};

export const LEVEL_REGISTRY: Record<string, LevelDef> = {
  [WORLD_1.id]: WORLD_1,
};
