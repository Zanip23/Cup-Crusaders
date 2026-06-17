import { describe, it, expect } from 'vitest';
import {
  FIRST_LEVEL,
  getLevel,
  LEVEL_ORDER,
  nextLevel,
  resolveBoardForDrop,
} from '@/content/levels';
import { buildWave, isBossWave } from '@/systems/WaveSpawner';
import { WORLD_2 } from '@/content/waves/world-2';
import { createInitialState, reducer } from '@/core/state/reducers';

describe('Level-Progression (docs/11)', () => {
  it('nextLevel führt durch die Reihenfolge und endet beim letzten', () => {
    expect(LEVEL_ORDER.length).toBeGreaterThanOrEqual(2);
    expect(nextLevel('world_1')?.id).toBe('world_2');
    expect(nextLevel(LEVEL_ORDER[LEVEL_ORDER.length - 1].id)).toBeNull();
  });

  it('getLevel fällt auf das erste Level zurück', () => {
    expect(getLevel('world_2').id).toBe('world_2');
    expect(getLevel(undefined)).toBe(FIRST_LEVEL);
    expect(getLevel('does_not_exist')).toBe(FIRST_LEVEL);
  });

  it('Welt 2 hat 15 Wellen mit Boss am Ende auf generiertem Board-Fallback', () => {
    expect(WORLD_2.waves).toHaveLength(15);
    expect(isBossWave(WORLD_2, 15)).toBe(true);
    expect(buildWave(WORLD_2, 15)[0].role).toBe('boss');
    expect(WORLD_2.boardId).toBe('board_dense');
    expect(WORLD_2.boardSelection).toEqual({ mode: 'generated', boardId: 'board_dense' });
    expect(WORLD_2.chapter).toBe(2);
  });

  it('resolveBoardForDrop erzeugt deterministische Wellen-Profile', () => {
    const early = resolveBoardForDrop('world_1', 1, 1234);
    const earlyAgain = resolveBoardForDrop('world_1', 1, 1234);
    const mid = resolveBoardForDrop('world_1', 7, 1234);
    const late = resolveBoardForDrop('world_1', 12, 1234);
    const boss = resolveBoardForDrop('world_1', 15, 1234);

    expect(early.id).toBe(earlyAgain.id);
    expect(early.id).toContain('_early');
    expect(early.boosters ?? []).toHaveLength(0);
    expect(
      [...early.gates, ...(early.platforms ?? [])].some((element) => element.label === '???'),
    ).toBe(false);
    expect(mid.id).toContain('_mid');
    expect(late.id).toContain('_late');
    expect(boss.id).toContain('_boss');
    expect(new Set([early.id, mid.id, late.id, boss.id]).size).toBe(4);
  });

  it('generierte Drop-Boards setzen keine Holzpfosten mitten in Multiplikator-Balken', () => {
    for (const seed of [7, 1234, 9999]) {
      for (const wave of [1, 4, 7, 10, 15]) {
        const board = resolveBoardForDrop('world_1', wave, seed);
        for (const blocker of board.blockers ?? []) {
          for (const platform of board.platforms ?? []) {
            const overlapsVertically =
              Math.abs(blocker.y - platform.y) < (blocker.h + platform.h) / 2;
            const edgeTolerance = blocker.w / 2 + 12;
            const leftEdge = platform.x - platform.w / 2;
            const rightEdge = platform.x + platform.w / 2;
            const isInsidePlatformInterior =
              overlapsVertically &&
              blocker.x > leftEdge + edgeTolerance &&
              blocker.x < rightEdge - edgeTolerance;

            expect(isInsidePlatformInterior).toBe(false);
          }
        }
      }
    }
  });

  it('resolveBoardForDrop ist pro (Welle, Seed) deterministisch', () => {
    for (const wave of [1, 3, 7, 12, 15]) {
      const a = resolveBoardForDrop('world_1', wave, 4242);
      const b = resolveBoardForDrop('world_1', wave, 4242);
      expect(a.id).toBe(b.id);
      expect(a.platforms?.map((p) => p.x)).toEqual(b.platforms?.map((p) => p.x));
    }
  });

  it('resolveBoardForDrop erzeugt pro Run (Seed) sichtbar unterschiedliche Boards', () => {
    // Gleiche Welle, verschiedene Run-Seeds → der Generator soll seed-gesteuert
    // unterschiedliche Layouts (und über mehrere Seeds auch verschiedene
    // Struktur-Templates) liefern, statt immer dasselbe Board zu zeigen.
    const seeds = [1, 7, 42, 1234, 9999, 555, 808, 31337];
    const templatesForWave1 = new Set<string>();
    const layoutsForWave1 = new Set<string>();

    for (const seed of seeds) {
      const board = resolveBoardForDrop('world_1', 1, seed);
      const templateId = board.id.replace(/^board_generated_\d+_\d+_\d+_\d+_/, '');
      templatesForWave1.add(templateId);
      layoutsForWave1.add((board.platforms ?? []).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('|'));
    }

    // Über mehrere Runs müssen verschiedene Templates vorkommen ...
    expect(templatesForWave1.size).toBeGreaterThan(1);
    // ... und die konkreten Layouts dürfen sich nicht alle gleichen.
    expect(layoutsForWave1.size).toBeGreaterThan(1);
  });

  it('ADVANCE_LEVEL setzt Welle/Transfer zurück, behält Upgrades', () => {
    let s = reducer(createInitialState(), {
      type: 'START_RUN',
      levelId: 'world_1',
      totalWaves: 15,
      seed: 1,
      maxHp: 120,
    });
    s = reducer(s, { type: 'SHOP_BUY', upgradeId: 'multishot', cost: 0 });
    s = { ...s, run: { ...s.run, waveNumber: 15 } };
    s = reducer(s, { type: 'ADVANCE_LEVEL', levelId: 'world_2', totalWaves: 15 });
    expect(s.run.levelId).toBe('world_2');
    expect(s.run.waveNumber).toBe(1);
    expect(s.run.phase).toBe('combat');
    expect(s.run.transfer).toEqual({ ballsFromCombat: 0, ballsFromDrop: 0 });
    expect(s.run.upgrades).toContain('multishot'); // Upgrades bleiben im Run
  });
});
