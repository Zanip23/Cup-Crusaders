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
