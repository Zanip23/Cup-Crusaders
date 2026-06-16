// Baut die Gegner-Instanzen einer Welle aus der LevelDef + Skalierung (docs/04).
// Reine Logik, testbar.

import type { LevelDef } from '@/types/content';
import { ENEMY_REGISTRY } from '@/content/enemies';
import { DEFAULT_SCALING, scaleEnemy } from '@/content/scaling';
import type { EnemyInstance } from './combat/types';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `enemy_${idCounter}`;
}

/** Erzeugt die Gegner-Instanzen für `waveNumber` (1-basiert) eines Levels. */
export function buildWave(level: LevelDef, waveNumber: number): EnemyInstance[] {
  const wave = level.waves[waveNumber - 1];
  if (!wave) return [];
  const instances: EnemyInstance[] = [];
  for (const spawn of wave.spawns) {
    const def = ENEMY_REGISTRY[spawn.enemyId];
    if (!def) continue; // unbekannte Referenz → überspringen (validateContent fängt das, docs/10)
    const scaled = scaleEnemy(def, waveNumber, level.chapter, DEFAULT_SCALING);
    for (let i = 0; i < spawn.count; i++) {
      instances.push({
        instanceId: nextId(),
        defId: def.id,
        name: def.name,
        role: def.role,
        maxHp: scaled.hp,
        hp: scaled.hp,
        contactDamage: scaled.contactDamage,
        ballDrop: def.ballDrop,
        effects: def.effects,
        alive: true,
      });
    }
  }
  return instances;
}

export function isBossWave(level: LevelDef, waveNumber: number): boolean {
  return level.waves[waveNumber - 1]?.isBoss ?? false;
}
