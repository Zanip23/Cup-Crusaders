// Typisierte Aktionen — die EINZIGE Art, den State zu mutieren (docs/09).
// Reducer sind rein; Seiteneffekte (Szenenwechsel, SFX) hängen am EventBus.

export type Action =
  // Run-Lebenszyklus
  | { type: 'START_RUN'; levelId: string; totalWaves: number; seed: number; maxHp: number }
  | { type: 'RESET_RUN' }
  // Kampf-Phase: Bälle werden gesammelt, dann abgeschlossen
  | { type: 'COMBAT_BALLS_COLLECTED'; amount: number }
  | { type: 'COMBAT_COMPLETE' }
  // Drop-Phase: liefert die per Physik gefarmte Ballsumme
  | { type: 'DROP_COMPLETE'; balls: number }
  // Shop-Phase: Käufe ziehen Währung ab, Abschluss erhöht die Welle
  | { type: 'SHOP_BUY'; upgradeId: string; cost: number }
  | { type: 'SHOP_COMPLETE' }
  // Run-Ende
  | { type: 'PLAYER_DIED' };

export type ActionType = Action['type'];
