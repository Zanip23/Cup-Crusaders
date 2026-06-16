import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/ui/layout';
import type { GameState, RunPhase } from '@/types/state';
import { GameStateManager } from '@/core/state/GameStateManager';

declare global {
  interface Window {
    __cc?: { getPhase: () => RunPhase; getState: () => GameState };
  }
}
import { RunCoordinator } from '@/core/RunCoordinator';
import { provideGsm, provideCoordinator } from '@/core/registry';
import { BootScene } from '@/scenes/BootScene';
import { MetaScene } from '@/scenes/MetaScene';
import { CombatScene } from '@/scenes/CombatScene';
import { DropScene } from '@/scenes/DropScene';
import { ShopScene } from '@/scenes/ShopScene';

// Phaser-Game-Config — Zielwerte aus docs/01.
function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: COLORS.bgCss,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    pixelArt: true,
    roundPixels: true,
    physics: { default: 'arcade' }, // Matter wird pro-Scene (DropScene) aktiviert
    scene: [BootScene, MetaScene, CombatScene, DropScene, ShopScene],
  };
}

async function bootstrap(): Promise<void> {
  // 1. State zuerst laden (Single Source of Truth, überlebt Szenen).
  const gsm = new GameStateManager();
  await gsm.init();

  // 2. Phaser-Game starten.
  const game = new Phaser.Game(createGameConfig());

  // 3. State + Coordinator in die Registry legen, Loop verdrahten.
  provideGsm(game, gsm);
  const coordinator = new RunCoordinator(game, gsm);
  coordinator.wire();
  provideCoordinator(game, coordinator);

  // Schlanker, read-only Debug-/E2E-Hook (Phase abfragen für Browser-Tests).
  window.__cc = {
    getPhase: () => gsm.getState().run.phase,
    getState: () => gsm.getState(),
  };

  // 4. Bei App-Wegblendung sofort speichern (Mobile-Tabs werden eingefroren).
  const flush = () => void gsm.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  // 5. WebGL-Context-Loss robust behandeln (docs/01).
  game.events.on(Phaser.Core.Events.CONTEXT_LOST, () =>
    console.warn('[Phaser] WebGL-Kontext verloren — wird wiederhergestellt.'),
  );
}

// PWA: Service Worker registrieren (offline-first, ADR-008).
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[PWA] Service-Worker-Registrierung fehlgeschlagen:', err));
  });
}

registerServiceWorker();
void bootstrap();
