// Zentral typisierte Events + Payload-Map (docs/02 §EventBus).
// Producer und Consumer teilen sich diese Wahrheit, damit sie nicht driften.

export enum GameEvent {
  // Phasen-Abschlüsse (von Szenen gefeuert, vom RunCoordinator orchestriert)
  CombatBallsCollected = 'combat.balls.collected',
  CombatComplete = 'combat.complete',
  DropComplete = 'drop.complete',
  ShopBuy = 'shop.buy',
  ShopComplete = 'shop.complete',
  PlayerDied = 'player.died',
  // Lebenszyklus
  StartRun = 'run.start',
  StateChanged = 'state.changed',
}

export interface GameEventPayloads {
  [GameEvent.CombatBallsCollected]: { amount: number };
  [GameEvent.CombatComplete]: { balls: number };
  [GameEvent.DropComplete]: { balls: number };
  [GameEvent.ShopBuy]: { upgradeId: string; cost: number };
  [GameEvent.ShopComplete]: { pickedId?: string };
  [GameEvent.PlayerDied]: Record<string, never>;
  [GameEvent.StartRun]: { levelId: string };
  [GameEvent.StateChanged]: Record<string, never>;
}
