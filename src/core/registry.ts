// Brücke zwischen Phaser-Szenen und dem GameStateManager.
// Der GSM wird beim Boot in die Phaser-Registry gelegt, damit jede Szene
// (die den State NICHT besitzt) lesend darauf zugreifen kann (docs/02).

import type Phaser from 'phaser';
import type { GameStateManager } from '@/core/state/GameStateManager';
import type { RunCoordinator } from '@/core/RunCoordinator';

const GSM_KEY = 'gsm';
const COORDINATOR_KEY = 'coordinator';

export function provideGsm(game: Phaser.Game, gsm: GameStateManager): void {
  game.registry.set(GSM_KEY, gsm);
}

export function getGsm(scene: Phaser.Scene): GameStateManager {
  const gsm = scene.game.registry.get(GSM_KEY) as GameStateManager | undefined;
  if (!gsm) throw new Error('GameStateManager nicht in der Registry — Boot fehlgeschlagen?');
  return gsm;
}

export function provideCoordinator(game: Phaser.Game, coordinator: RunCoordinator): void {
  game.registry.set(COORDINATOR_KEY, coordinator);
}

export function getCoordinator(scene: Phaser.Scene): RunCoordinator {
  const c = scene.game.registry.get(COORDINATOR_KEY) as RunCoordinator | undefined;
  if (!c) throw new Error('RunCoordinator nicht in der Registry — Boot fehlgeschlagen?');
  return c;
}
