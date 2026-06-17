// Zentrale Level-Registry + Reihenfolge (docs/10/11). Level-Progression: Sieg über
// einen Boss führt zum nächsten Level; nach dem letzten endet der Run als Sieg.

import type { BoardGenerationOptions, BoardTemplateId } from '@/content/boards/generator';
import { generateBoard } from '@/content/boards/generator';
import { BOARD_BASIC, BOARD_REGISTRY } from '@/content/boards/basic';
import type { BoardDef, LevelDef } from '@/types/content';
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

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function waveProgress(level: LevelDef, waveNumber: number): number {
  if (level.waves.length <= 1) return 1;
  return (waveNumber - 1) / (level.waves.length - 1);
}

function cycleTemplate(
  templates: readonly BoardTemplateId[],
  waveNumber: number,
): readonly BoardTemplateId[] {
  // Wichtig für das Spielgefühl: Nach jeder besiegten Welle soll sichtbar ein
  // anderes Pachinko-Board kommen. Deshalb geben wir dem Generator pro Welle
  // gezielt genau ein Template vor, statt ihn frei aus der gesamten Phase wählen
  // zu lassen. Innerhalb dieses Templates bleiben Seed/Difficulty weiterhin
  // deterministisch variiert.
  return [templates[(waveNumber - 1) % templates.length]];
}

function boardOptionsForWave(
  level: LevelDef,
  waveNumber: number,
): BoardGenerationOptions & { difficultyBonus: number } {
  const wave = level.waves[waveNumber - 1];
  const progress = waveProgress(level, waveNumber);

  if (wave?.isBoss) {
    return {
      allowedTemplates: cycleTemplate(
        ['split_choice', 'booster_tunnel', 'risk_wall'],
        waveNumber,
      ),
      allowMystery: true,
      allowBoosters: true,
      budgetBonus: 26,
      difficultyBonus: 3,
      idSuffix: 'boss',
    };
  }

  if (progress < 0.34) {
    return {
      allowedTemplates: cycleTemplate(['classic', 'snake'], waveNumber),
      allowMystery: false,
      allowBoosters: false,
      budgetBonus: -14,
      difficultyBonus: -2,
      idSuffix: 'early',
    };
  }

  if (progress < 0.67) {
    return {
      allowedTemplates: cycleTemplate(['classic', 'snake', 'booster_tunnel'], waveNumber),
      allowMystery: true,
      allowBoosters: true,
      budgetBonus: 6,
      difficultyBonus: 1,
      idSuffix: 'mid',
    };
  }

  return {
    allowedTemplates: cycleTemplate(
      ['split_choice', 'booster_tunnel', 'risk_wall'],
      waveNumber,
    ),
    allowMystery: true,
    allowBoosters: true,
    budgetBonus: 18,
    difficultyBonus: 2,
    idSuffix: 'late',
  };
}

function hasGeneratedTemplates(
  options: BoardGenerationOptions,
): options is BoardGenerationOptions & {
  allowedTemplates: readonly BoardTemplateId[];
} {
  return Boolean(options.allowedTemplates?.length);
}

/**
 * Löst das Drop-Board für genau eine Welle auf.
 *
 * Standard ist ein deterministisch generiertes Board aus Level, Kapitel, Welle und
 * Run-Seed. Level können über `boardSelection.mode = 'fixed'` weiterhin explizit
 * ein Board aus `BOARD_REGISTRY` erzwingen; `boardId` bleibt als Legacy-Fallback
 * erhalten.
 */
export function resolveBoardForDrop(
  levelId: string,
  waveNumber: number,
  runSeed: number,
): BoardDef {
  const level = getLevel(levelId);
  const fixedBoardId = level.boardSelection?.boardId ?? level.boardId;

  if (level.boardSelection?.mode === 'fixed') {
    return (fixedBoardId && BOARD_REGISTRY[fixedBoardId]) || BOARD_BASIC;
  }

  const options = boardOptionsForWave(level, waveNumber);
  const levelSeed = stableStringHash(`${level.id}:${level.chapter}`);
  const boardSeed =
    (runSeed ^
      levelSeed ^
      Math.imul(waveNumber, 0x9e3779b9) ^
      Math.imul(level.chapter, 0x85ebca6b)) >>>
    0;
  const difficulty = Math.max(1, level.chapter * 2 + waveNumber + options.difficultyBonus);

  if (hasGeneratedTemplates(options)) {
    return generateBoard(boardSeed, difficulty, waveNumber, level.chapter, options);
  }

  return (fixedBoardId && BOARD_REGISTRY[fixedBoardId]) || BOARD_BASIC;
}
