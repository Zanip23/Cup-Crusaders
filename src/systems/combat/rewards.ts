// Wellen-Belohnung — auch bei Niederlage (ADR-007, docs/04). Reine Funktion.
// Abgestufte Reward-Kurve: jeder erreichte Abschnitt zahlt anteilig aus.

/** Anteil des vollen Run-Rewards je nach erreichter Welle. */
export function rewardFraction(waveReached: number, bossDefeated = false): number {
  if (bossDefeated) return 0.85;
  if (waveReached >= 10) return 0.7;
  if (waveReached >= 5) return 0.55;
  if (waveReached >= 1) return 0.35;
  return 0;
}

/** Gold-Belohnung bei Run-Ende (Platzhalter-Ökonomie bis volle Meta-Phase M5). */
export function runRewardGold(waveReached: number, bossDefeated = false): number {
  const baseFullReward = 20 + waveReached * 8;
  return Math.round(baseFullReward * rewardFraction(waveReached, bossDefeated));
}
