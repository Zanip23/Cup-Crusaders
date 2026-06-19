import { describe, it, expect } from 'vitest';
import { createInitialState, reducer } from '@/core/state/reducers';
import type { Action } from '@/core/state/actions';
import type { GameState } from '@/types/state';

function run(state: GameState, actions: Action[]): GameState {
  return actions.reduce(reducer, state);
}

describe('reducer — Run-Lebenszyklus & transfer-Vertrag', () => {
  it('START_RUN initialisiert combat-Phase, Welle 1, volle HP', () => {
    const s = reducer(createInitialState(), {
      type: 'START_RUN',
      levelId: 'world_1',
      totalWaves: 15,
      seed: 123,
      maxHp: 100,
    });
    expect(s.run.phase).toBe('combat');
    expect(s.run.waveNumber).toBe(1);
    expect(s.run.totalWaves).toBe(15);
    expect(s.run.hero.currentHp).toBe(100);
    expect(s.meta.stats.runs).toBe(1);
  });

  it('Ball-Datenfluss Kampf → Drop → Shop ist korrekt verdrahtet', () => {
    const start = reducer(createInitialState(), {
      type: 'START_RUN',
      levelId: 'world_1',
      totalWaves: 15,
      seed: 1,
      maxHp: 100,
    });

    // Kampf: Bälle sammeln (zwei Drops) und abschließen.
    const afterCombat = run(start, [
      { type: 'COMBAT_BALLS_COLLECTED', amount: 15 },
      { type: 'COMBAT_BALLS_COLLECTED', amount: 10 },
      { type: 'COMBAT_COMPLETE' },
    ]);
    expect(afterCombat.run.transfer.ballsFromCombat).toBe(25);
    expect(afterCombat.run.phase).toBe('drop');

    // Drop: liefert Summe → wird Shop-Währung.
    const afterDrop = reducer(afterCombat, { type: 'DROP_COMPLETE', balls: 60 });
    expect(afterDrop.run.transfer.ballsFromDrop).toBe(60);
    expect(afterDrop.run.currency).toBe(60);
    expect(afterDrop.run.phase).toBe('shop');
  });

  it('DROP_COMPLETE addiert Bälle zur bestehenden Währung (Sparen möglich)', () => {
    const start = createInitialState();
    // Simulieren, dass wir bereits Währung vom vorherigen Shop-Besuch haben
    const stateWithCurrency = {
      ...start,
      run: { ...start.run, phase: 'drop' as const, currency: 40 },
    };

    const afterDrop = reducer(stateWithCurrency, { type: 'DROP_COMPLETE', balls: 50 });
    expect(afterDrop.run.currency).toBe(90);
  });

  it('SHOP_BUY zieht Währung ab; unbezahlbarer Kauf ist ein No-op', () => {
    let s = createInitialState();
    s = run(s, [
      { type: 'START_RUN', levelId: 'world_1', totalWaves: 15, seed: 1, maxHp: 100 },
      { type: 'COMBAT_BALLS_COLLECTED', amount: 50 },
      { type: 'COMBAT_COMPLETE' },
      { type: 'DROP_COMPLETE', balls: 100 },
    ]);

    const afterBuy = reducer(s, { type: 'SHOP_BUY', upgradeId: 'upg_x', cost: 40 });
    expect(afterBuy.run.currency).toBe(60);
    expect(afterBuy.run.upgrades).toContain('upg_x');

    // Zu teuer → State unverändert (gleiche Referenz).
    const noop = reducer(afterBuy, { type: 'SHOP_BUY', upgradeId: 'upg_y', cost: 999 });
    expect(noop).toBe(afterBuy);
  });


  it('SHOP_REFUND erstattet Währung und entfernt Upgrade', () => {
    let s = createInitialState();
    s = run(s, [
      { type: 'START_RUN', levelId: 'world_1', totalWaves: 15, seed: 1, maxHp: 100 },
      { type: 'COMBAT_BALLS_COLLECTED', amount: 50 },
      { type: 'COMBAT_COMPLETE' },
      { type: 'DROP_COMPLETE', balls: 100 },
      { type: 'SHOP_BUY', upgradeId: 'upg_x', cost: 40 }
    ]);
    expect(s.run.currency).toBe(60);
    expect(s.run.upgrades).toContain('upg_x');

    const afterRefund = reducer(s, { type: 'SHOP_REFUND', upgradeId: 'upg_x', cost: 40 });
    expect(afterRefund.run.currency).toBe(100);
    expect(afterRefund.run.upgrades).not.toContain('upg_x');
  });

  it('SHOP_COMPLETE erhöht die Welle und setzt den transfer-Kanal zurück', () => {
    let s = createInitialState();
    s = run(s, [
      { type: 'START_RUN', levelId: 'world_1', totalWaves: 15, seed: 1, maxHp: 100 },
      { type: 'COMBAT_BALLS_COLLECTED', amount: 50 },
      { type: 'COMBAT_COMPLETE' },
      { type: 'DROP_COMPLETE', balls: 100 },
      { type: 'SHOP_COMPLETE' },
    ]);
    expect(s.run.phase).toBe('combat');
    expect(s.run.waveNumber).toBe(2);
    expect(s.run.transfer).toEqual({ ballsFromCombat: 0, ballsFromDrop: 0 });
  });

  it('PLAYER_DIED setzt gameover und schreibt highestLevel in meta', () => {
    let s = reducer(createInitialState(), {
      type: 'START_RUN',
      levelId: 'world_1',
      totalWaves: 15,
      seed: 1,
      maxHp: 100,
    });
    s = run(s, [{ type: 'SHOP_COMPLETE' }, { type: 'SHOP_COMPLETE' }]); // bis Welle 3
    s = reducer(s, { type: 'PLAYER_DIED' });
    expect(s.run.phase).toBe('gameover');
    expect(s.meta.highestLevel).toBe(3);
  });

  it('Reducer mutiert den Eingangs-State nicht (Immutabilität)', () => {
    const base = createInitialState();
    const snapshot = JSON.stringify(base);
    reducer(base, { type: 'START_RUN', levelId: 'world_1', totalWaves: 15, seed: 1, maxHp: 100 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
