// Lese-Getter auf den State. Szenen lesen NIE rohe interne Felder (docs/02),
// sondern gehen über diese Selektoren.

import type { GameState } from '@/types/state';

export const selectPhase = (s: GameState) => s.run.phase;
export const selectWave = (s: GameState) => ({ current: s.run.waveNumber, total: s.run.totalWaves });
export const selectCurrency = (s: GameState) => s.run.currency;
export const selectBallsFromCombat = (s: GameState) => s.run.transfer.ballsFromCombat;
export const selectBallsFromDrop = (s: GameState) => s.run.transfer.ballsFromDrop;
export const selectHero = (s: GameState) => s.run.hero;
export const selectIsBossWave = (s: GameState) =>
  s.run.totalWaves > 0 && s.run.waveNumber >= s.run.totalWaves;
export const selectHighestLevel = (s: GameState) => s.meta.highestLevel;
export const selectSettings = (s: GameState) => s.settings;
