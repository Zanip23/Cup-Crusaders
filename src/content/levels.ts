// Zentrale Level-Registry + Reihenfolge (docs/10/11). Level-Progression: Sieg über
// einen Boss führt zum nächsten Level; nach dem letzten endet der Run als Sieg.

import type { LevelDef } from '@/types/content';
import { WORLD_1 } from '@/content/waves/world-1';
import { WORLD_2 } from '@/content/waves/world-2';

/** Spielreihenfolge der Welten. */
export const LEVEL_ORDER: LevelDef[] = [WORLD_1, WORLD_2];

export const LEVEL_REGISTRY: Record<string, LevelDef> = Object.fromEntries(
  LEVEL_ORDER.map((l) => [l.id, l]),
);

export const FIRST_LEVEL = LEVEL_ORDER[0];

export function getLevel(levelId: string | undefined): LevelDef {
  return (levelId && LEVEL_REGISTRY[levelId]) || FIRST_LEVEL;
}

/** Nächstes Level nach `levelId` oder null (war das letzte). */
export function nextLevel(levelId: string): LevelDef | null {
  const i = LEVEL_ORDER.findIndex((l) => l.id === levelId);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}
