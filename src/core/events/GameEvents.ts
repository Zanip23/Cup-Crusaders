// Zentral typisierte Events + Payload-Map (docs/02 §EventBus).
// Producer und Consumer teilen sich diese Wahrheit, damit sie nicht driften.

export enum GameEvent {
  // Phasen-Abschlüsse (von Szenen gefeuert, vom RunCoordinator orchestriert)
  CombatBallsCollected = 'combat.balls.collected',
  HeroHpChanged = 'combat.hero.hp',
  CombatComplete = 'combat.complete',
  DropComplete = 'drop.complete',
  ShopBuy = 'shop.buy',
  ShopRefund = 'shop.refund',
  ShopComplete = 'shop.complete',
  PlayerDied = 'player.died',
  // Lebenszyklus
  StartRun = 'run.start',
  StateChanged = 'state.changed',
}

export interface GameEventPayloads {
  [GameEvent.CombatBallsCollected]: { amount: number };
  [GameEvent.HeroHpChanged]: { hp: number };
  // Bälle werden laufend via CombatBallsCollected übergeben → kein Payload nötig.
  [GameEvent.CombatComplete]: Record<string, never>;
  [GameEvent.DropComplete]: { balls: number };
  [GameEvent.ShopBuy]: { upgradeId: string; cost: number };
  [GameEvent.ShopRefund]: { upgradeId: string; cost: number };
  [GameEvent.ShopComplete]: { pickedId?: string };
  [GameEvent.PlayerDied]: Record<string, never>;
  [GameEvent.StartRun]: { levelId: string };
  [GameEvent.StateChanged]: Record<string, never>;
}
