// Welt 1 „Waldpfad" — 15 Wellen (14 + Boss), docs/12. Komposition steigt:
// nur Gremlins → gemischte Normals → +Elite → Boss.

import type { LevelDef, SpawnEntry, WaveDef } from '@/types/content';

const TOTAL_WAVES = 15;

function wave(id: string, spawns: SpawnEntry[], isBoss = false): WaveDef {
  return { id, spawns, isBoss };
}

function buildWaves(): WaveDef[] {
  const w: WaveDef[] = [];
  for (let n = 1; n <= TOTAL_WAVES - 1; n++) {
    const spawns: SpawnEntry[] = [];
    if (n <= 4) {
      spawns.push({ enemyId: 'mug_gremlin', count: 1 + n });
    } else if (n <= 9) {
      spawns.push({ enemyId: 'mug_gremlin', count: 2 });
      spawns.push({
        enemyId: n % 2 === 0 ? 'shambler' : 'bone_archer',
        count: 1 + Math.floor((n - 5) / 2),
      });
    } else {
      // Druckphase: 1 Elite + Normals (docs/12 Wellen 10–14).
      spawns.push({ enemyId: 'tomb_knight', count: n >= 13 ? 2 : 1 });
      spawns.push({ enemyId: 'mug_gremlin', count: 2 });
      spawns.push({ enemyId: 'bone_archer', count: 1 });
    }
    w.push(wave(`w1_wave_${n}`, spawns));
  }
  w.push(wave('w1_boss', [{ enemyId: 'brigand_lord', count: 1 }], true));
  return w;
}

export const WORLD_1: LevelDef = {
  id: 'world_1',
  name: 'Waldpfad',
  chapter: 1,
  waves: buildWaves(),
  boardId: 'board_basic',
  boardSelection: { mode: 'generated', boardId: 'board_basic' },
  dropCadence: 'everyWave',
  scalingProfileId: 'standard',
};
