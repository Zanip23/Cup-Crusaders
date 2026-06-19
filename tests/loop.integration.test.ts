import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Phaser from 'phaser';
import { eventBus } from '@/core/events/EventBus';
import { GameEvent } from '@/core/events/GameEvents';
import { GameStateManager } from '@/core/state/GameStateManager';
import { RunCoordinator, SceneKey } from '@/core/RunCoordinator';
import { InMemorySaveRepository } from '@/core/save/SaveRepository';

// Simuliert das „Durchklicken" des leeren Loops über den EventBus —
// genau die Events, die die Platzhalter-Buttons der Szenen feuern.
function makeHarness() {
  const start = vi.fn();
  // Fake-SceneManager: go() stoppt aktive Szenen und startet die Ziel-Szene.
  // Ohne real laufende Szenen liefert getScenes(true) eine leere Liste.
  const fakeGame = {
    scene: { start, stop: vi.fn(), getScenes: () => [] },
  } as unknown as Phaser.Game;
  const gsm = new GameStateManager(new InMemorySaveRepository());
  const coordinator = new RunCoordinator(fakeGame, gsm);
  coordinator.wire();
  return { start, gsm, coordinator };
}

describe('Loop-Integration — Durchklicken Kampf → Drop → Shop → Kampf', () => {
  beforeEach(() => {
    eventBus.removeAll();
  });

  it('eine volle Welle: Ballzahl fließt korrekt durch alle Phasen', () => {
    const { start, gsm, coordinator } = makeHarness();

    coordinator.startNewRun();
    expect(start).toHaveBeenLastCalledWith(SceneKey.Combat);
    expect(gsm.getState().run.phase).toBe('combat');
    expect(gsm.getState().run.waveNumber).toBe(1);

    // Kampf: Bälle werden während des Kampfes laufend gesammelt, dann Abschluss.
    eventBus.emit(GameEvent.CombatBallsCollected, { amount: 15 });
    eventBus.emit(GameEvent.CombatBallsCollected, { amount: 10 });
    eventBus.emit(GameEvent.CombatComplete, {});
    expect(gsm.getState().run.transfer.ballsFromCombat).toBe(25);
    expect(gsm.getState().run.phase).toBe('drop');
    expect(start).toHaveBeenLastCalledWith(SceneKey.Drop);

    // Drop-Button „Bälle fallen lassen (→ 60)"
    eventBus.emit(GameEvent.DropComplete, { balls: 60 });
    expect(gsm.getState().run.transfer.ballsFromDrop).toBe(60);
    expect(gsm.getState().run.currency).toBe(60);
    expect(gsm.getState().run.phase).toBe('shop');
    expect(start).toHaveBeenLastCalledWith(SceneKey.Shop);

    // Shop: ein Kauf, dann „Nächste Welle"
    eventBus.emit(GameEvent.ShopBuy, { upgradeId: 'upg_max_hp', cost: 40 });
    expect(gsm.getState().run.currency).toBe(20);
    expect(gsm.getState().run.upgrades).toContain('upg_max_hp');

    eventBus.emit(GameEvent.ShopComplete, {});
    expect(gsm.getState().run.phase).toBe('combat');
    expect(gsm.getState().run.waveNumber).toBe(2);
    expect(gsm.getState().run.transfer).toEqual({ ballsFromCombat: 0, ballsFromDrop: 0 });
    expect(start).toHaveBeenLastCalledWith(SceneKey.Combat);
  });

  it('drei Wellen am Stück bleiben konsistent (kein Transfer-Leak)', () => {
    const { gsm, coordinator } = makeHarness();
    coordinator.startNewRun();

    let expectedCurrency = 0;
    for (let wave = 1; wave <= 3; wave++) {
      expect(gsm.getState().run.waveNumber).toBe(wave);
      eventBus.emit(GameEvent.CombatBallsCollected, { amount: 30 });
      eventBus.emit(GameEvent.CombatComplete, {});
      // Jede Welle startet mit frischem transfer → exakt 30, nie kumuliert.
      expect(gsm.getState().run.transfer.ballsFromCombat).toBe(30);
      eventBus.emit(GameEvent.DropComplete, { balls: 72 });
      expectedCurrency += 72;
      expect(gsm.getState().run.currency).toBe(expectedCurrency);
      eventBus.emit(GameEvent.ShopComplete, {});
    }
    expect(gsm.getState().run.waveNumber).toBe(4);
  });

  it('Tod beendet den Run (Gold-Belohnung) und kehrt ins Hauptmenü zurück', () => {
    const { start, gsm, coordinator } = makeHarness();
    coordinator.startNewRun();
    eventBus.emit(GameEvent.ShopComplete, {}); // → Welle 2

    eventBus.emit(GameEvent.PlayerDied, {});
    // PLAYER_DIED schreibt highestLevel (erreichte Welle 2) + Gold, dann Menü.
    expect(gsm.getState().meta.highestLevel).toBe(2);
    expect(gsm.getState().run.phase).toBe('gameover');
    expect(gsm.getState().meta.currencies.gold).toBeGreaterThan(0);
    expect(start).toHaveBeenLastCalledWith(SceneKey.Meta);
  });

  it('go() stoppt die aktive Szene vor dem Start der nächsten (kein Stacking)', () => {
    // Regression: game.scene.start() allein stoppt die Vorgaenger-Szene NICHT.
    const start = vi.fn();
    const stop = vi.fn();
    const active = [{ scene: { key: 'Shop' } }];
    const fakeGame = {
      scene: { start, stop, getScenes: () => active },
    } as unknown as Phaser.Game;
    const gsm = new GameStateManager(new InMemorySaveRepository());
    const coordinator = new RunCoordinator(fakeGame, gsm);
    coordinator.wire();
    // Laufenden Run aufsetzen, damit ShopComplete nicht als Boss-Sieg gilt.
    coordinator.startNewRun();

    eventBus.emit(GameEvent.ShopComplete, {});
    expect(stop).toHaveBeenCalledWith('Shop');
    expect(start).toHaveBeenLastCalledWith(SceneKey.Combat);
  });

  it('Boss-Sieg führt ins nächste Level; finaler Boss beendet den Run als Sieg', () => {
    const { start, gsm, coordinator } = makeHarness();
    coordinator.startNewRun(); // world_1, Welle 1
    const clearWaves = (n: number) => {
      for (let i = 0; i < n; i++) eventBus.emit(GameEvent.ShopComplete, {});
    };
    // Wellen 1→15 (14× Nicht-Boss-Abschluss bringt waveNumber auf 15 = Boss).
    clearWaves(14);
    expect(gsm.getState().run.waveNumber).toBe(15);

    // Boss von Welt 1 abschließen → Item-Drop + Vorrücken nach Welt 2.
    eventBus.emit(GameEvent.ShopComplete, {});
    expect(gsm.getState().run.levelId).toBe('world_2');
    expect(gsm.getState().run.waveNumber).toBe(1);
    expect(gsm.getState().meta.inventory.length).toBe(1); // garantierter Boss-Drop
    expect(start).toHaveBeenLastCalledWith(SceneKey.Combat);

    // Durch Welt 2 bis zum finalen Boss → Run-Sieg → Menü.
    clearWaves(14);
    expect(gsm.getState().run.waveNumber).toBe(15);
    eventBus.emit(GameEvent.ShopComplete, {});
    expect(gsm.getState().run.phase).toBe('menu');
    expect(gsm.getState().meta.inventory.length).toBe(2);
    expect(gsm.getState().meta.currencies.gold).toBeGreaterThan(0);
    expect(start).toHaveBeenLastCalledWith(SceneKey.Meta);
  });

  it('resumeOrStart routet an die gespeicherte Phase (Resume after reload)', () => {
    const { start, coordinator } = makeHarness();
    coordinator.startNewRun();
    eventBus.emit(GameEvent.CombatComplete, {}); // jetzt in 'drop'
    start.mockClear();

    coordinator.resumeOrStart();
    expect(start).toHaveBeenLastCalledWith(SceneKey.Drop);
  });
});
