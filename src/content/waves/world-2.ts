// Welt 2 „Feuergrat" — Kapitel 2 (höhere Skalierung), dichteres Board, mehr Elites,
// Boss Ash Wyrm. Erreichbar nach Sieg über Welt 1 (Level-Progression).

import type { LevelDef, SpawnEntry, WaveDef } from '@/types/content';

const TOTAL_WAVES = 15;

function buildWaves(): WaveDef[] {
  const w: WaveDef[] = [];
  for (let n = 1; n <= TOTAL_WAVES - 1; n++) {
    const spawns: SpawnEntry[] = [];
    if (n <= 4) {
      spawns.push({ enemyId: 'shambler', count: 1 + Math.floor(n / 2) });
      spawns.push({ enemyId: 'bone_archer', count: 1 });
    } else if (n <= 9) {
      spawns.push({ enemyId: 'tomb_knight', count: 1 });
      spawns.push({ enemyId: 'mug_gremlin', count: 2 });
    } else {
      spawns.push({ enemyId: 'tomb_knight', count: 2 });
      spawns.push({ enemyId: 'bone_archer', count: 2 });
    }
    w.push({ id: `w2_wave_${n}`, spawns });
  }
  w.push({ id: 'w2_boss', spawns: [{ enemyId: 'ash_wyrm', count: 1 }], isBoss: true });
  return w;
}

export const WORLD_2: LevelDef = {
  id: 'world_2',
  name: 'Feuergrat',
  chapter: 2,
  waves: buildWaves(),
  boardId: 'board_dense',
  boardSelection: { mode: 'generated', boardId: 'board_dense' },
  dropCadence: 'everyWave',
  scalingProfileId: 'standard',
};
